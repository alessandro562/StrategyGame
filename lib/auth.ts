/**
 * Accessi.
 *
 * Registrazione leggera — email e password, nessuna verifica via mail, nessun
 * requisito di complessità — perché il tool serve a sei persone in una stanza
 * per due giorni, non a un pubblico.
 *
 * Due cose però restano non negoziabili, e non costano nulla:
 *  - le password non si salvano mai in chiaro (scrypt con sale per utente);
 *  - il confronto è a tempo costante.
 *
 * E soprattutto: da qui in avanti **l'identità viene dal cookie di sessione,
 * non da un pid nell'URL**. Prima un pid inventato non apriva porte ma
 * permetteva comunque di presentarsi come chiunque; ora il server sa chi sei
 * perché lo ha firmato lui, e il commit cieco poggia su una base vera.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const COOKIE_SESSIONE = 'wda_sessione';
export const DURATA_SESSIONE_S = 60 * 60 * 24 * 30;

/**
 * L'account con diritti da facilitatore permanenti, a prescindere da chi ha
 * rivendicato il ruolo in un dato momento. Un solo indirizzo, impostato qui e
 * non a runtime: il ruolo master non si autoconcede via API.
 */
export const EMAIL_MASTER = 'alessandro@wda.company';

/** Volutamente basso: la richiesta era esplicita, «non stringente». */
export const LUNGHEZZA_MINIMA_PASSWORD = 4;

export interface Utente {
  id: string;
  nome: string;
  email: string;
  hash: string;
  creatoA: number;
}

export function normalizzaEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValida(email: string): boolean {
  // Volutamente permissiva: deve escludere gli errori di battitura evidenti,
  // non fare da guardiano.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizzaEmail(email));
}

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */

export function cifraPassword(password: string): string {
  const sale = randomBytes(16).toString('hex');
  const derivata = scryptSync(password, sale, 64).toString('hex');
  return `scrypt:${sale}:${derivata}`;
}

export function verificaPassword(password: string, memorizzata: string): boolean {
  const parti = memorizzata.split(':');
  if (parti.length !== 3 || parti[0] !== 'scrypt') return false;
  const [, sale, atteso] = parti;
  const derivata = scryptSync(password, sale, 64);
  const bufferAtteso = Buffer.from(atteso, 'hex');
  if (bufferAtteso.length !== derivata.length) return false;
  return timingSafeEqual(derivata, bufferAtteso);
}

/* ------------------------------------------------------------------ */
/* Sessione                                                            */
/* ------------------------------------------------------------------ */

/**
 * Token opaco firmato: `pid.scadenza.firma`. Non contiene nulla di segreto, ma
 * non è falsificabile senza il segreto di server.
 */
export function firmaSessione(pid: string, segreto: string, ora = Date.now()): string {
  const scadenza = ora + DURATA_SESSIONE_S * 1000;
  const corpo = `${pid}.${scadenza}`;
  return `${corpo}.${hmac(corpo, segreto)}`;
}

export function leggiSessione(token: string | undefined, segreto: string, ora = Date.now()): string | null {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const corpo = token.slice(0, i);
  const firma = token.slice(i + 1);

  const atteso = hmac(corpo, segreto);
  const a = Buffer.from(firma);
  const b = Buffer.from(atteso);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [pid, scadenza] = corpo.split('.');
  if (!pid || !scadenza) return null;
  if (Number(scadenza) < ora) return null;
  return pid;
}

function hmac(dato: string, segreto: string): string {
  return createHmac('sha256', segreto).update(dato).digest('hex');
}

/* ------------------------------------------------------------------ */
/* Validazione dei dati di registrazione                               */
/* ------------------------------------------------------------------ */

export interface EsitoValidazione {
  ok: boolean;
  errore?: string;
}

export function validaRegistrazione(nome: string, email: string, password: string): EsitoValidazione {
  if (!nome.trim()) return { ok: false, errore: 'Serve un nome' };
  if (!emailValida(email)) return { ok: false, errore: 'Email non valida' };
  if (password.length < LUNGHEZZA_MINIMA_PASSWORD) {
    return { ok: false, errore: `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri` };
  }
  return { ok: true };
}
