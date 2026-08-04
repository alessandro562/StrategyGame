/**
 * Modello dati condiviso fra server e client.
 * Riferimento: WDA-Strategy-Room-BUILD.md §5.
 */

export type Profilo = 'founder' | 'operativo' | 'board' | 'non_operativo';
export type StatoSessione = 'SETUP' | 'COMMIT' | 'REVEAL' | 'DISCUSSIONE' | 'LOCKED';
export type Destinazione = 'AI' | 'UMANO' | 'MORTA';
export type Bucket = 'NUCLEO' | 'PORTA' | 'CHIUSO';
export type BasePrezzo = 'ACCESSO' | 'ESITO' | 'PARTECIPAZIONE' | 'VOLUME' | 'GIORNATA';
export type Cappello = 'CASHFLOW' | 'COSTRUTTORE' | 'COMPRATORE' | 'CLIENTE' | 'PARTNER' | 'ESTERNO';
export type Modulo = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9';
export type Qualitativo = 'basso' | 'medio' | 'alto';
export type Vincolo = number | Qualitativo;
export type Scenario = 'ENTRAMBI' | 'AUTONOMO' | 'SUB_BRAND';
export type Orizzonte = '90_GIORNI' | 'A_GENNAIO_2027';
export type Ruolo = 'tavolo' | 'mano';

export const CAPPELLI: Cappello[] = [
  'CASHFLOW',
  'COMPRATORE',
  'COSTRUTTORE',
  'CLIENTE',
  'PARTNER',
  'ESTERNO',
];

/** §4.1 — CASHFLOW e COMPRATORE si assegnano per primi. */
export const CAPPELLI_OBBLIGATORI: Cappello[] = ['CASHFLOW', 'COMPRATORE'];

export const CAPPELLO_DIFENDE: Record<Cappello, string> = {
  CASHFLOW: 'I ricavi da servizi',
  COSTRUTTORE: 'Lo spazio per Forge',
  COMPRATORE: 'Il punto di vista di chi compra',
  CLIENTE: 'Il cliente corporate attuale',
  PARTNER: 'Lo scenario Impacta',
  ESTERNO: 'Niente',
};

export const CAPPELLO_DOMANDA: Record<Cappello, string> = {
  CASHFLOW: 'Con questo piano, come paghiamo gli stipendi a marzo?',
  COSTRUTTORE: 'Da dove esce il tempo per costruire, se teniamo tutto questo?',
  COMPRATORE: 'Perché dovrei pagare per questo?',
  CLIENTE: 'Se WDA cambia così, io ci sono ancora?',
  PARTNER: 'Questa cosa regge anche come sub-brand?',
  ESTERNO: 'Cosa non state dicendo?',
};

export const BASE_DOMANDA: Record<BasePrezzo, string> = {
  ACCESSO: 'Pagherebbero per averci disponibili anche in un mese in cui non serve nulla?',
  ESITO: 'Il risultato è misurabile e attribuibile a noi?',
  PARTECIPAZIONE: 'Siamo disposti a legare il nostro guadagno al loro?',
  VOLUME: 'Esiste un flusso che si ripete e che possiamo presidiare?',
  GIORNATA: 'Nessuna base regge: il prezzo resta sul tempo impiegato.',
};

export interface Partecipante {
  id: string;
  nome: string;
  profilo: Profilo;
  presente: boolean;
  /** Dedotto dal polling lato server (§9), mai scritto dal client. */
  socketConnesso: boolean;
  /** Ha sempre i diritti da facilitatore, a prescindere da chi ha rivendicato il ruolo. */
  master?: boolean;
}

export interface Sessione {
  id: string;
  modulo: Modulo;
  titolo: string;
  stato: StatoSessione;
  timer: { durataS: number; avviatoA: number | null } | null;
  /** partecipanteId -> cappello */
  cappelli: Record<string, Cappello>;
  /** es. quale servizio si sta smontando, quale carta si sta giocando */
  soggettoId?: string;
  /** M5: chi ha pescato la carta e deve rispondere */
  rispondenteId?: string;
  revealAnonimo: boolean;
  /** §2.5 — istante concordato di partenza dell'animazione di reveal */
  revealAt?: number | null;
  creataA: number;
  ordine: number;
}

export interface Attivita {
  id: string;
  nome: string;
  quotaPrezzoPct: number;
}

export interface Servizio {
  id: string;
  nome: string;
  descrizione: string;
  fatturato12m: number;
  attivita: Attivita[];
  /** Esito consolidato dopo il reveal, materializzato dai commit. */
  destinazioni: { attivitaId: string; partecipanteId: string; valore: Destinazione }[];
  bucket: Bucket | null;
  valoreResiduo: 'MENO' | 'UGUALE_O_PIU' | 'NIENTE' | null;
  basePrezzo: { primaria: BasePrezzo; secondaria?: BasePrezzo; nota?: string } | null;
  /** M3: true se nessun partecipante ha tracciato archi per questo servizio */
  nessunFlusso?: boolean;
}

export interface Attore {
  id: string;
  nome: string;
  categoria: string;
  x: number;
  y: number;
  /** WDA è fisso al centro e non spostabile (§M3 passo 1) */
  fisso?: boolean;
}

export interface Flusso {
  id: string;
  servizioId: string;
  partecipanteId: string;
  attoreDa: string;
  attoreA: string;
}

export interface SfidaCompetitor {
  sessioneId: string;
  rispondenteId: string;
  risposta: string;
  voti: { partecipanteId: string; convincente: boolean }[];
  aperta: boolean;
}

export interface Competitor {
  id: string;
  nome: string;
  categoria: string;
  descrizione: string;
  puntiForza: string[];
  sfide: SfidaCompetitor[];
  /** La carta "il cliente che si fa le cose da solo con l'AI" non è rimuovibile. */
  fisso?: boolean;
}

export interface Soglia {
  partecipanteId: string;
  sogliaPct: number;
  mesiAutonomia: number;
  trigger: string;
}

export interface Invariante {
  id: string;
  testo: string;
  scenario: Scenario;
  votiTenere: string[];
  /** Distribuzione dei voti dopo il reveal, per il verbale. */
  voti?: { partecipanteId: string; scenario: Scenario }[];
}

export interface Azione {
  id: string;
  testo: string;
  ownerId: string;
  scadenza: string;
  orizzonte: Orizzonte;
  lockOrigine: string;
  stato: 'APERTA' | 'FATTA';
}

export interface Lock {
  id: string;
  sessioneId: string;
  modulo: Modulo;
  titolo: string;
  timestamp: number;
  contenuto: unknown;
  dissensi: { partecipanteId: string; nota: string }[];
  riapertoA: number | null;
  aValle: string[];
}

export interface Nota {
  id: string;
  sessioneId: string;
  partecipanteId: string;
  testo: string;
  /** Le annotazioni personali della Mano non finiscono nel verbale né sul Tavolo. */
  privata: boolean;
  ts: number;
}

export interface Asse {
  id: string;
  xSinistra: string;
  xDestra: string;
  ySotto: string;
  ySopra: string;
  creatoA: number;
}

export interface Posizionamento {
  partecipanteId: string;
  asseId: string;
  oggi: { x: number; y: number };
  futuro: { x: number; y: number };
}

export interface Vulnerabilita {
  id: string;
  competitorId: string;
  testo: string;
  apertaDa: number;
  chiusaA: number | null;
}

export interface Trimestre {
  id: string;
  etichetta: string;
  quotaServiziPct: number;
  consumo: { R: number; G: number; B: number };
}

export interface Workshop {
  nome: string;
  codiceStanza: string;
  vincoli: { R: Vincolo; G: Vincolo; B: Vincolo };
  modalitaVincoli: 'numerica' | 'qualitativa';
  facilitatoreId: string | null;
  asseCorrenteId: string | null;
  /** M6 passo 4 */
  sogliaCondivisaPct: number | null;
  forbiceOriginale: number | null;
  /** Denominatore dell'indicatore Copertura (§4.3) */
  lockPrevisti: number;
}

export interface Store {
  workshop: Workshop;
  partecipanti: Partecipante[];
  sessioni: Sessione[];
  servizi: Servizio[];
  attori: Attore[];
  flussi: Flusso[];
  competitor: Competitor[];
  soglie: Soglia[];
  invarianti: Invariante[];
  azioni: Azione[];
  lock: Lock[];
  note: Nota[];
  assi: Asse[];
  posizionamenti: Posizionamento[];
  vulnerabilita: Vulnerabilita[];
  traiettoria: Trimestre[];
}

/* ------------------------------------------------------------------ */
/* Commit                                                              */
/* ------------------------------------------------------------------ */

export type CommitPayload =
  | { tipo: 'M1'; destinazioni: Record<string, Destinazione> }
  | { tipo: 'M2'; primaria: BasePrezzo; secondaria?: BasePrezzo; nota?: string }
  | { tipo: 'M3'; archi: { da: string; a: string }[] }
  | { tipo: 'M4'; oggi: { x: number; y: number }; futuro: { x: number; y: number } }
  | { tipo: 'M5'; convincente: boolean }
  | { tipo: 'M6'; sogliaPct: number; mesiAutonomia: number; trigger: string }
  | { tipo: 'M7'; voti: Record<string, Scenario> };

export interface Commit {
  sessioneId: string;
  /** Sostituito da un indice mescolato quando la sessione è a reveal anonimo. */
  partecipanteId: string;
  payload: CommitPayload;
  confermato: boolean;
  aggiornatoA: number;
}

/** Ciò che il Tavolo può sapere durante COMMIT: chi, mai cosa (§3.1 regola 4). */
export interface StatoCommit {
  sessioneId: string;
  committed: number;
  total: number;
  confermatiIds: string[];
}

/** Il payload che esce da filterStateFor() e nient'altro. */
export interface StatoFiltrato extends Store {
  commits: Commit[];
  statiCommit: StatoCommit[];
  serverNow: number;
  /** partecipanteId -> ultimo polling in ms epoch */
  visti: Record<string, number>;
  /** pid del richiedente, per comodità del client */
  io: string;
  sonoFacilitatore: boolean;
}
