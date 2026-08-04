/**
 * Calcoli derivati. Funzioni pure, nessun accesso a Redis, nessun React.
 * Tutto ciò che compare come numero sul Tavolo si calcola qui e si testa qui.
 */

import type {
  Azione,
  Cappello,
  Commit,
  Destinazione,
  Flusso,
  Lock,
  Partecipante,
  Posizionamento,
  Servizio,
  Sessione,
  Soglia,
} from './types';
import { CAPPELLI, CAPPELLI_OBBLIGATORI } from './types';

const DESTINAZIONI: Destinazione[] = ['AI', 'UMANO', 'MORTA'];

/* ------------------------------------------------------------------ */
/* M1 — residuo umano                                                  */
/* ------------------------------------------------------------------ */

export interface EsitoAttivita {
  attivitaId: string;
  nome: string;
  quotaPct: number;
  conteggi: Record<Destinazione, number>;
  /** null = pareggio: nessuna destinazione ha la maggioranza relativa da sola */
  esito: Destinazione | null;
  divergente: boolean;
  votanti: number;
}

export interface EsitoServizio {
  esiti: EsitoAttivita[];
  /** Somma delle quote a maggioranza UMANO, normalizzata sul totale delle quote. */
  residuoPct: number;
  totaleQuote: number;
  /** Quote la cui destinazione è in pareggio: non entrano nel residuo. */
  quoteInPareggio: number;
}

/**
 * Il residuo è la somma delle quote di prezzo delle attività a maggioranza
 * UMANO. Due casi limite, entrambi testati:
 *  - le quote non sommano a 100: si normalizza sul totale effettivo, così il
 *    residuo resta una percentuale leggibile anche con un catalogo a metà;
 *  - pareggio fra destinazioni: l'attività non ha esito, non entra nel residuo
 *    e viene marcata divergente. Il tool non scioglie il pareggio al posto del
 *    team (§10, "mediare automaticamente le posizioni").
 */
export function esitiServizio(servizio: Servizio, commits: Commit[]): EsitoServizio {
  const voti = commits
    .map((c) => (c.payload.tipo === 'M1' ? c.payload.destinazioni : null))
    .filter((d): d is Record<string, Destinazione> => d !== null);

  const esiti: EsitoAttivita[] = servizio.attivita.map((a) => {
    const conteggi: Record<Destinazione, number> = { AI: 0, UMANO: 0, MORTA: 0 };
    let votanti = 0;
    for (const v of voti) {
      const scelta = v[a.id];
      if (scelta && DESTINAZIONI.includes(scelta)) {
        conteggi[scelta] += 1;
        votanti += 1;
      }
    }
    const max = Math.max(conteggi.AI, conteggi.UMANO, conteggi.MORTA);
    const vincitrici = DESTINAZIONI.filter((d) => conteggi[d] === max && max > 0);
    const esito = vincitrici.length === 1 ? vincitrici[0] : null;
    const distinte = DESTINAZIONI.filter((d) => conteggi[d] > 0).length;
    return {
      attivitaId: a.id,
      nome: a.nome,
      quotaPct: a.quotaPrezzoPct,
      conteggi,
      esito,
      divergente: distinte > 1,
      votanti,
    };
  });

  const totaleQuote = esiti.reduce((s, e) => s + e.quotaPct, 0);
  const quoteUmane = esiti.filter((e) => e.esito === 'UMANO').reduce((s, e) => s + e.quotaPct, 0);
  const quoteInPareggio = esiti.filter((e) => e.esito === null && e.votanti > 0).reduce((s, e) => s + e.quotaPct, 0);
  const residuoPct = totaleQuote > 0 ? (quoteUmane / totaleQuote) * 100 : 0;

  return { esiti, residuoPct, totaleQuote, quoteInPareggio };
}

/* ------------------------------------------------------------------ */
/* M3 — flussi                                                         */
/* ------------------------------------------------------------------ */

/** Chiave non orientata: A→B e B→A sono la stessa relazione. */
function chiaveArco(da: string, a: string): string {
  return [da, a].sort().join('|');
}

/**
 * Numero di flussi distinti su cui siede WDA. Gli archi duplicati — stesso
 * collegamento tracciato da più persone, o lo stesso collegamento abilitato da
 * più servizi — contano una volta sola. I cappi (attore su se stesso) non
 * contano: non collegano nulla.
 */
export function flussiDistinti(flussi: Pick<Flusso, 'attoreDa' | 'attoreA'>[]): number {
  const set = new Set<string>();
  for (const f of flussi) {
    if (!f.attoreDa || !f.attoreA || f.attoreDa === f.attoreA) continue;
    set.add(chiaveArco(f.attoreDa, f.attoreA));
  }
  return set.size;
}

export type DiagnosiPosizione = 'Intermediario sostituibile' | 'Layer parziale' | 'Infrastruttura';

export function diagnosiPosizione(distinti: number): DiagnosiPosizione {
  if (distinti <= 1) return 'Intermediario sostituibile';
  if (distinti <= 3) return 'Layer parziale';
  return 'Infrastruttura';
}

/** Peso di ogni arco: quante persone lo hanno tracciato. */
export function archiAggregati(
  flussi: Flusso[],
): { da: string; a: string; peso: number; persone: string[]; servizi: string[] }[] {
  const mappa = new Map<string, { da: string; a: string; persone: Set<string>; servizi: Set<string> }>();
  for (const f of flussi) {
    if (!f.attoreDa || !f.attoreA || f.attoreDa === f.attoreA) continue;
    const k = chiaveArco(f.attoreDa, f.attoreA);
    const esistente = mappa.get(k);
    if (esistente) {
      esistente.persone.add(f.partecipanteId);
      esistente.servizi.add(f.servizioId);
    } else {
      mappa.set(k, {
        da: f.attoreDa,
        a: f.attoreA,
        persone: new Set([f.partecipanteId]),
        servizi: new Set([f.servizioId]),
      });
    }
  }
  return [...mappa.values()].map((v) => ({
    da: v.da,
    a: v.a,
    peso: v.persone.size,
    persone: [...v.persone],
    servizi: [...v.servizi],
  }));
}

/* ------------------------------------------------------------------ */
/* M4 — posizionamento                                                 */
/* ------------------------------------------------------------------ */

export interface Punto {
  x: number;
  y: number;
}

export function centroide(punti: Punto[]): Punto | null {
  if (punti.length === 0) return null;
  const x = punti.reduce((s, p) => s + p.x, 0) / punti.length;
  const y = punti.reduce((s, p) => s + p.y, 0) / punti.length;
  return { x, y };
}

/** Distanza media dal centroide, in unità dello spazio (0-1 per asse). */
export function dispersione(punti: Punto[]): number {
  const c = centroide(punti);
  if (!c || punti.length < 2) return 0;
  const somma = punti.reduce((s, p) => s + Math.hypot(p.x - c.x, p.y - c.y), 0);
  return somma / punti.length;
}

/** Oltre questa dispersione su OGGI il Tavolo mostra l'avviso diagnostico. */
export const SOGLIA_DIVERGENZA_OGGI = 0.22;

export function vettoreStrategia(posizionamenti: Posizionamento[]): {
  oggi: Punto | null;
  futuro: Punto | null;
  dispersioneOggi: number;
  dispersioneFuturo: number;
  lunghezza: number;
  altaDivergenzaOggi: boolean;
} {
  const oggiPunti = posizionamenti.map((p) => p.oggi);
  const futuriPunti = posizionamenti.map((p) => p.futuro);
  const oggi = centroide(oggiPunti);
  const futuro = centroide(futuriPunti);
  const dispersioneOggi = dispersione(oggiPunti);
  return {
    oggi,
    futuro,
    dispersioneOggi,
    dispersioneFuturo: dispersione(futuriPunti),
    lunghezza: oggi && futuro ? Math.hypot(futuro.x - oggi.x, futuro.y - oggi.y) : 0,
    altaDivergenzaOggi: dispersioneOggi > SOGLIA_DIVERGENZA_OGGI,
  };
}

/* ------------------------------------------------------------------ */
/* M6 — soglia                                                         */
/* ------------------------------------------------------------------ */

/** Distanza fra la soglia più prudente e la più aggressiva. */
export function forbice(soglie: Pick<Soglia, 'sogliaPct'>[]): {
  min: number | null;
  max: number | null;
  ampiezza: number;
} {
  if (soglie.length === 0) return { min: null, max: null, ampiezza: 0 };
  const valori = soglie.map((s) => s.sogliaPct);
  const min = Math.min(...valori);
  const max = Math.max(...valori);
  return { min, max, ampiezza: max - min };
}

/* ------------------------------------------------------------------ */
/* M2 — erosione                                                       */
/* ------------------------------------------------------------------ */

/** Percentuale di fatturato che poggia su una base in erosione (GIORNATA). */
export function pctErosione(servizi: Servizio[]): number {
  const vivi = servizi.filter((s) => s.bucket !== 'CHIUSO');
  const totale = vivi.reduce((s, x) => s + (x.fatturato12m || 0), 0);
  if (totale <= 0) return 0;
  const eroso = vivi
    .filter((s) => !s.basePrezzo || s.basePrezzo.primaria === 'GIORNATA')
    .reduce((s, x) => s + (x.fatturato12m || 0), 0);
  return (eroso / totale) * 100;
}

/* ------------------------------------------------------------------ */
/* §4.3 — indicatori                                                   */
/* ------------------------------------------------------------------ */

export interface Indicatori {
  allineamento: number | null;
  serieAllineamento: number[];
  coperturaFatti: number;
  coperturaPrevisti: number;
  esposizionePct: number;
  vulnerabilitaAperte: number;
}

/**
 * Allineamento: dispersione media dei commit degli ultimi 3 round, invertita e
 * normalizzata 0-100. Non è un punteggio da massimizzare: un 100 al primo round
 * significa che il commit cieco non sta funzionando (§4.3).
 */
export function allineamentoRound(sessione: Sessione, commits: Commit[]): number | null {
  const dellaSessione = commits.filter((c) => c.sessioneId === sessione.id);
  if (dellaSessione.length < 2) return null;

  switch (sessione.modulo) {
    case 'M1': {
      const chiavi = new Set<string>();
      for (const c of dellaSessione) {
        if (c.payload.tipo === 'M1') Object.keys(c.payload.destinazioni).forEach((k) => chiavi.add(k));
      }
      if (chiavi.size === 0) return null;
      let accordo = 0;
      for (const k of chiavi) {
        const scelte = dellaSessione
          .map((c) => (c.payload.tipo === 'M1' ? c.payload.destinazioni[k] : undefined))
          .filter(Boolean) as Destinazione[];
        if (scelte.length === 0) continue;
        const conteggi = DESTINAZIONI.map((d) => scelte.filter((s) => s === d).length);
        accordo += Math.max(...conteggi) / scelte.length;
      }
      return (accordo / chiavi.size) * 100;
    }
    case 'M4': {
      const punti = dellaSessione
        .map((c) => (c.payload.tipo === 'M4' ? c.payload.futuro : null))
        .filter((p): p is Punto => p !== null);
      if (punti.length < 2) return null;
      // dispersione massima teorica su un quadrato unitario ≈ 0.7
      return Math.max(0, 100 - (dispersione(punti) / 0.7) * 100);
    }
    case 'M6': {
      const valori = dellaSessione
        .map((c) => (c.payload.tipo === 'M6' ? c.payload.sogliaPct : null))
        .filter((v): v is number => v !== null);
      if (valori.length < 2) return null;
      return Math.max(0, 100 - (Math.max(...valori) - Math.min(...valori)));
    }
    case 'M2': {
      const scelte = dellaSessione
        .map((c) => (c.payload.tipo === 'M2' ? c.payload.primaria : null))
        .filter(Boolean) as string[];
      if (scelte.length < 2) return null;
      const conteggi = [...new Set(scelte)].map((s) => scelte.filter((x) => x === s).length);
      return (Math.max(...conteggi) / scelte.length) * 100;
    }
    case 'M7': {
      const chiavi = new Set<string>();
      for (const c of dellaSessione) {
        if (c.payload.tipo === 'M7') Object.keys(c.payload.voti).forEach((k) => chiavi.add(k));
      }
      if (chiavi.size === 0) return null;
      let accordo = 0;
      for (const k of chiavi) {
        const scelte = dellaSessione
          .map((c) => (c.payload.tipo === 'M7' ? c.payload.voti[k] : undefined))
          .filter(Boolean) as string[];
        if (scelte.length === 0) continue;
        const conteggi = [...new Set(scelte)].map((s) => scelte.filter((x) => x === s).length);
        accordo += Math.max(...conteggi) / scelte.length;
      }
      return (accordo / chiavi.size) * 100;
    }
    case 'M5': {
      const scelte = dellaSessione
        .map((c) => (c.payload.tipo === 'M5' ? c.payload.convincente : null))
        .filter((v): v is boolean => v !== null);
      if (scelte.length < 2) return null;
      const si = scelte.filter(Boolean).length;
      return (Math.max(si, scelte.length - si) / scelte.length) * 100;
    }
    default:
      return null;
  }
}

export function indicatori(
  sessioni: Sessione[],
  commits: Commit[],
  lock: Lock[],
  servizi: Servizio[],
  vulnerabilitaAperte: number,
  lockPrevisti: number,
): Indicatori {
  const rilevanti = sessioni
    .filter((s) => s.stato === 'REVEAL' || s.stato === 'DISCUSSIONE' || s.stato === 'LOCKED')
    .sort((a, b) => a.ordine - b.ordine);
  const serie = rilevanti
    .map((s) => allineamentoRound(s, commits))
    .filter((v): v is number => v !== null);
  const ultimi = serie.slice(-3);
  return {
    allineamento: ultimi.length ? ultimi.reduce((a, b) => a + b, 0) / ultimi.length : null,
    serieAllineamento: serie.slice(-12),
    coperturaFatti: lock.filter((l) => l.riapertoA === null).length,
    coperturaPrevisti: lockPrevisti,
    esposizionePct: pctErosione(servizi),
    vulnerabilitaAperte,
  };
}

/* ------------------------------------------------------------------ */
/* §4.1 — cappelli                                                     */
/* ------------------------------------------------------------------ */

/**
 * Assegnazione a rotazione con due vincoli: nessuno riceve due volte lo stesso
 * cappello, e se i presenti sono meno dei cappelli, CASHFLOW e COMPRATORE si
 * assegnano per primi.
 */
export function assegnaCappelli(
  presenti: Partecipante[],
  storico: Record<string, Cappello[]>,
): Record<string, Cappello> {
  const ordineCappelli = [
    ...CAPPELLI_OBBLIGATORI,
    ...CAPPELLI.filter((c) => !CAPPELLI_OBBLIGATORI.includes(c)),
  ];
  const risultato: Record<string, Cappello> = {};
  const liberi = new Set(presenti.map((p) => p.id));

  for (const cappello of ordineCappelli) {
    if (liberi.size === 0) break;
    const candidati = [...liberi].filter((pid) => !(storico[pid] ?? []).includes(cappello));
    // Se tutti l'hanno già portato, si riparte da chi lo ha portato meno di recente.
    const scelta =
      candidati[0] ??
      [...liberi].sort(
        (a, b) =>
          (storico[a] ?? []).lastIndexOf(cappello) - (storico[b] ?? []).lastIndexOf(cappello),
      )[0];
    if (!scelta) break;
    risultato[scelta] = cappello;
    liberi.delete(scelta);
  }
  return risultato;
}

export function storicoCappelli(sessioni: Sessione[]): Record<string, Cappello[]> {
  const out: Record<string, Cappello[]> = {};
  for (const s of [...sessioni].sort((a, b) => a.ordine - b.ordine)) {
    for (const [pid, cappello] of Object.entries(s.cappelli)) {
      (out[pid] ??= []).push(cappello);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* M8 — distribuzione delle azioni                                     */
/* ------------------------------------------------------------------ */

export const QUOTA_MASSIMA_OWNER = 0.4;

export interface ControlliM8 {
  perOwner: { ownerId: string; conteggio: number; quota: number; sovraccarico: boolean }[];
  senzaOwner: string[];
  senzaScadenza: string[];
  lockSenzaAzione: string[];
  chiudibile: boolean;
}

export function controlliM8(azioni: Azione[], lock: Lock[]): ControlliM8 {
  const totale = azioni.length;
  const conteggi = new Map<string, number>();
  for (const a of azioni) {
    if (a.ownerId) conteggi.set(a.ownerId, (conteggi.get(a.ownerId) ?? 0) + 1);
  }
  const perOwner = [...conteggi.entries()].map(([ownerId, conteggio]) => ({
    ownerId,
    conteggio,
    quota: totale > 0 ? conteggio / totale : 0,
    sovraccarico: totale > 0 && conteggio / totale > QUOTA_MASSIMA_OWNER,
  }));
  const senzaOwner = azioni.filter((a) => !a.ownerId).map((a) => a.id);
  const senzaScadenza = azioni.filter((a) => !a.scadenza).map((a) => a.id);
  const conAzione = new Set(azioni.map((a) => a.lockOrigine).filter(Boolean));
  const lockSenzaAzione = lock.filter((l) => !conAzione.has(l.id)).map((l) => l.id);
  return {
    perOwner: perOwner.sort((a, b) => b.conteggio - a.conteggio),
    senzaOwner,
    senzaScadenza,
    lockSenzaAzione,
    chiudibile: senzaOwner.length === 0 && senzaScadenza.length === 0 && azioni.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* §3.3 — riapertura e decisioni a valle                               */
/* ------------------------------------------------------------------ */

export function daRiconvalidare(lock: Lock[]): { riaperti: Lock[]; aValle: Lock[] } {
  const riaperti = lock.filter((l) => l.riapertoA !== null);
  const ids = new Set(riaperti.flatMap((l) => l.aValle));
  return { riaperti, aValle: lock.filter((l) => ids.has(l.id)) };
}

/* ------------------------------------------------------------------ */
/* Timer                                                               */
/* ------------------------------------------------------------------ */

export function secondiRimanenti(
  timer: { durataS: number; avviatoA: number | null } | null,
  ora: number,
): number | null {
  if (!timer || timer.avviatoA === null) return null;
  return Math.max(0, Math.round((timer.avviatoA + timer.durataS * 1000 - ora) / 1000));
}

/* ------------------------------------------------------------------ */
/* Reveal anonimo — mescolamento deterministico                        */
/* ------------------------------------------------------------------ */

function hashStringa(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ordine mescolato ma stabile: lo stesso seme di sessione dà sempre la stessa
 * permutazione, così gli indici anonimi non ballano fra un polling e l'altro.
 */
export function mescolaConSeme<T>(elementi: T[], seme: string): T[] {
  const rnd = mulberry32(hashStringa(seme));
  const out = [...elementi];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
