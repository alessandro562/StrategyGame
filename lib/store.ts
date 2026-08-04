/**
 * Accesso allo stato: load/save con lock ottimistico, commit su chiavi
 * separate, presenza, backup, idempotenza delle azioni.
 *
 * Schema delle chiavi (§2.4):
 *   room:version                  contatore INCR
 *   room:state                    JSON dello stato strutturale
 *   commit:{sessioneId}:{pid}     un commit individuale
 *   commit:index                  set delle chiavi commit esistenti
 *   room:seen                     hash pid -> ultimo polling
 *   backup:{ts}                   snapshot completo
 *   backup:index                  set dei timestamp di backup
 *   action:{actionId}             marcatore di idempotenza, TTL 1h
 */

import { redis } from './redis';
import { statoIniziale } from './seed';
import type { Commit, Store } from './types';

const K_VERSION = 'room:version';
const K_STATE = 'room:state';
const K_COMMIT_INDEX = 'commit:index';
const K_SEEN = 'room:seen';
const K_BACKUP_INDEX = 'backup:index';

export const TENTATIVI_CAS = 3;
/** Oltre questa distanza dall'ultimo polling il partecipante è "disconnesso". */
export const SOGLIA_PRESENZA_MS = 10_000;

export interface StatoVersionato {
  version: number;
  state: Store;
}

function chiaveCommit(sessioneId: string, pid: string) {
  return `commit:${sessioneId}:${pid}`;
}

export async function caricaStato(): Promise<StatoVersionato> {
  const r = redis();
  const [grezzo, ver] = await Promise.all([r.get(K_STATE), r.get(K_VERSION)]);
  if (!grezzo) {
    const iniziale = statoIniziale();
    await r.set(K_STATE, JSON.stringify(iniziale));
    const v = ver === null ? await r.incr(K_VERSION) : Number(ver);
    return { version: v, state: iniziale };
  }
  return { version: Number(ver ?? 0), state: JSON.parse(grezzo) as Store };
}

/**
 * Lock ottimistico: legge, applica la mutazione, scrive solo se la versione non
 * è cambiata. Tre tentativi, poi errore all'utente (§2.4).
 */
export async function muta(fn: (s: Store) => void | Promise<void>): Promise<number> {
  const r = redis();
  for (let tentativo = 0; tentativo < TENTATIVI_CAS; tentativo++) {
    if (tentativo > 0) await attesaConJitter(tentativo);
    const { version, state } = await caricaStato();
    await fn(state);
    const nuova = await r.casState(K_STATE, K_VERSION, version, JSON.stringify(state));
    if (nuova !== null) return nuova;
  }
  throw new ConflittoDiScrittura();
}

/**
 * Senza jitter due scrittori in conflitto riprovano nello stesso istante e
 * continuano a scontrarsi. Il ritardo casuale li separa: è la differenza fra
 * "quasi sempre passa al secondo tentativo" e "collidono tutti e tre i giri".
 */
function attesaConJitter(tentativo: number): Promise<void> {
  const base = 15 * 2 ** (tentativo - 1);
  return new Promise((res) => setTimeout(res, base + Math.random() * base));
}

export class ConflittoDiScrittura extends Error {
  constructor() {
    super('Conflitto di scrittura su room:state dopo 3 tentativi');
    this.name = 'ConflittoDiScrittura';
  }
}

export async function bumpVersione(): Promise<number> {
  return redis().incr(K_VERSION);
}

export async function versioneCorrente(): Promise<number> {
  return Number((await redis().get(K_VERSION)) ?? 0);
}

/* ------------------------------------------------------------------ */
/* Commit — chiavi disgiunte, nessuna collisione per costruzione       */
/* ------------------------------------------------------------------ */

export async function scriviCommit(c: Commit): Promise<number> {
  const r = redis();
  const k = chiaveCommit(c.sessioneId, c.partecipanteId);
  await r.set(k, JSON.stringify(c));
  await r.sadd(K_COMMIT_INDEX, k);
  return r.incr(K_VERSION);
}

export async function caricaCommits(): Promise<Commit[]> {
  const r = redis();
  const chiavi = await r.smembers(K_COMMIT_INDEX);
  if (chiavi.length === 0) return [];
  const grezzi = await Promise.all(chiavi.map((k) => r.get(k)));
  return grezzi
    .filter((g): g is string => typeof g === 'string' && g.length > 0)
    .map((g) => JSON.parse(g) as Commit);
}

export async function caricaCommit(sessioneId: string, pid: string): Promise<Commit | null> {
  const grezzo = await redis().get(chiaveCommit(sessioneId, pid));
  return grezzo ? (JSON.parse(grezzo) as Commit) : null;
}

/* ------------------------------------------------------------------ */
/* Presenza — dedotta dal polling, non da una connessione persistente  */
/* ------------------------------------------------------------------ */

export async function segnalaPresenza(pid: string): Promise<void> {
  await redis().hset(K_SEEN, pid, String(Date.now()));
}

export async function presenze(): Promise<Record<string, number>> {
  const h = await redis().hgetall(K_SEEN);
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, Number(v)]));
}

export function connessi(visti: Record<string, number>, ora = Date.now()): string[] {
  return Object.entries(visti)
    .filter(([, t]) => ora - t < SOGLIA_PRESENZA_MS)
    .map(([pid]) => pid)
    .sort();
}

/**
 * Firma della presenza: cambia solo quando cambia l'insieme dei connessi.
 * Serve a far scattare un 200 anche a versione invariata, senza dover
 * incrementare room:version a ogni polling.
 */
export function firmaPresenza(visti: Record<string, number>, ora = Date.now()): string {
  const c = connessi(visti, ora);
  let h = 5381;
  for (const s of c) for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${c.length}.${(h >>> 0).toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Segreto per l'anonimato di M6                                       */
/* ------------------------------------------------------------------ */

const K_SEGRETO = 'room:anon-secret';

/**
 * Vive solo su Redis e non compare in nessuna risposta. È ciò che rende la
 * permutazione anonima non ricalcolabile da un client, anche avendo sotto mano
 * l'id di sessione, la lista dei partecipanti e il codice del bundle.
 */
export async function segretoAnonimo(): Promise<string> {
  const r = redis();
  const esistente = await r.get(K_SEGRETO);
  if (esistente) return esistente;
  const nuovo = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  // setNx: se due richieste concorrenti lo creano insieme, vince la prima e la
  // seconda rilegge il valore vincente. Il segreto non deve mai cambiare in
  // corsa, o le etichette anonime si rimescolerebbero sotto gli occhi di tutti.
  const scritto = await r.setNx(K_SEGRETO, nuovo, 60 * 60 * 24 * 30);
  return scritto ? nuovo : ((await r.get(K_SEGRETO)) ?? nuovo);
}

/* ------------------------------------------------------------------ */
/* Idempotenza (§6.2)                                                  */
/* ------------------------------------------------------------------ */

/** true se l'azione è nuova, false se è un doppione da scartare. */
export async function registraAzione(actionId: string): Promise<boolean> {
  return redis().setNx(`action:${actionId}`, '1', 3600);
}

/* ------------------------------------------------------------------ */
/* Backup (§9, modalità panico)                                        */
/* ------------------------------------------------------------------ */

export async function snapshot(): Promise<string> {
  const r = redis();
  const { state } = await caricaStato();
  const commits = await caricaCommits();
  const chiave = `backup:${Date.now()}`;
  await r.set(chiave, JSON.stringify({ state, commits, ts: Date.now() }));
  await r.sadd(K_BACKUP_INDEX, chiave);
  return chiave;
}

export async function elencaBackup(): Promise<string[]> {
  const chiavi = await redis().smembers(K_BACKUP_INDEX);
  return chiavi.sort().reverse();
}

export async function leggiBackup(chiave: string): Promise<{ state: Store; commits: Commit[] } | null> {
  if (!chiave.startsWith('backup:')) return null;
  const grezzo = await redis().get(chiave);
  return grezzo ? JSON.parse(grezzo) : null;
}

export async function ripristina(chiave: string): Promise<number> {
  const b = await leggiBackup(chiave);
  if (!b) throw new Error('Snapshot inesistente');
  const r = redis();
  await r.set(K_STATE, JSON.stringify(b.state));
  for (const c of b.commits) {
    const k = chiaveCommit(c.sessioneId, c.partecipanteId);
    await r.set(k, JSON.stringify(c));
    await r.sadd(K_COMMIT_INDEX, k);
  }
  return r.incr(K_VERSION);
}

/**
 * Riporta la stanza al seed: serve dopo la prova generale in produzione, che
 * altrimenti lascerebbe sessioni e commit di prova dentro il ritiro vero.
 * Prende uno snapshot prima di buttare via, così anche un azzeramento fatto per
 * sbaglio si annulla dal ripristino.
 */
export async function azzera(): Promise<number> {
  const r = redis();
  await snapshot();
  const chiavi = await r.smembers(K_COMMIT_INDEX);
  if (chiavi.length > 0) await r.del(...chiavi);
  await r.del(K_COMMIT_INDEX, K_SEEN);
  await r.set(K_STATE, JSON.stringify(statoIniziale()));
  return r.incr(K_VERSION);
}

export async function scriviStatoGrezzo(state: Store): Promise<number> {
  const r = redis();
  await r.set(K_STATE, JSON.stringify(state));
  return r.incr(K_VERSION);
}
