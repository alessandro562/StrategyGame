/**
 * GLOSSARIO — la lingua del prodotto, in un posto solo.
 *
 * Il tool era scritto in una lingua sua: «lo smontaggio», «gli invarianti»,
 * «la forbice», «il commit cieco». Evocativa, ma opaca per chi entra in stanza
 * e deve capire in tre secondi cosa gli si sta chiedendo. Dove esiste già un
 * termine che chi fa consulenza o startup riconosce, si usa quello — unbundling,
 * no-regret, retainer, success fee, spread, runway — e la parola evocativa
 * resta come glossa, non come titolo.
 *
 * Ogni modulo dichiara quattro cose, sempre le stesse, nello stesso ordine:
 *   nome        come si chiama, con il termine standard davanti
 *   obiettivo   a che domanda risponde. Una riga, nessuna metafora
 *   comeFunziona cosa si fa concretamente, adesso
 *   output      cosa esce da qui, e quindi perché vale la pena farlo
 *
 * Regola di copy (§8.5): sentence case, verbi attivi, nessun punto
 * esclamativo, nessun incoraggiamento. Il tool riporta e spiega l'esercizio,
 * non commenta i risultati.
 */

import type { DiagnosiPosizione } from './calc';
import type {
  BasePrezzo,
  Bucket,
  ColonnaQuadro,
  Destinazione,
  Modulo,
  OrizzonteQuadro,
  RigaQuadro,
  Scenario,
  StatoSessione,
} from './types';

export interface VoceModulo {
  codice: Modulo;
  /** Titolo completo, con il termine standard in testa. */
  nome: string;
  /** Per liste strette e pannelli. */
  breve: string;
  obiettivo: string;
  comeFunziona: string;
  output: string;
  /** Minuti indicativi, per dare il passo. */
  durataMin?: number;
}

export const MODULI: Record<Modulo, VoceModulo> = {
  MQ: {
    codice: 'MQ',
    nome: 'Quadro d’insieme',
    breve: 'Quadro',
    obiettivo:
      'Mettere sotto gli occhi di tutti cosa facciamo oggi, cosa fanno gli altri e dove vogliamo arrivare.',
    comeFunziona:
      'Una tabella condivisa: sei righe — servizi, prodotti, mercato, clienti, partner, revenue model — e tre colonne. Chiunque aggiunge una voce dal proprio telefono, e compare qui.',
    output: 'La fotografia condivisa da cui parte tutto il resto del ritiro.',
    durataMin: 30,
  },
  M0: {
    codice: 'M0',
    nome: 'Setup della sessione',
    breve: 'Setup',
    obiettivo: 'Mettere sul tavolo chi c’è, cosa vendiamo oggi e quali risorse sono davvero scarse.',
    comeFunziona: 'Si compilano insieme il portafoglio dei servizi e i tre vincoli di capacità.',
    output: 'Un tavolo pronto: partecipanti, catalogo, vincoli.',
    durataMin: 15,
  },
  M1: {
    codice: 'M1',
    nome: 'Unbundling del servizio',
    breve: 'Unbundling',
    obiettivo:
      'Capire quale parte di un servizio l’AI ha già reso quasi gratuita, e quale parte regge ancora il prezzo.',
    comeFunziona:
      'Si scompone il servizio nelle attività che lo compongono, e ognuno assegna in privato ogni attività a chi la farà d’ora in poi.',
    output: 'Il residuo umano: la quota di prezzo che poggia ancora su lavoro umano. Poi il servizio va in uno dei tre bucket.',
    durataMin: 20,
  },
  M2: {
    codice: 'M2',
    nome: 'Modello di pricing',
    breve: 'Pricing',
    obiettivo: 'Decidere su cosa poggia il prezzo, ora che produrre l’artefatto costa quasi zero.',
    comeFunziona: 'Per ogni servizio del nucleo, ognuno sceglie in privato su quale base si dovrebbe far pagare.',
    output: 'La percentuale di fatturato che poggia ancora sul tempo venduto, cioè su una base in erosione.',
    durataMin: 15,
  },
  M3: {
    codice: 'M3',
    nome: 'Mappa dell’ecosistema',
    breve: 'Ecosistema',
    obiettivo: 'Verificare se WDA è un layer fra operatori o un intermediario sostituibile.',
    comeFunziona:
      'Ognuno traccia in privato quali due attori quel servizio mette in contatto. Non cosa consegna: cosa collega.',
    output: 'Il numero di flussi distinti su cui WDA siede, e la diagnosi che ne consegue.',
    durataMin: 20,
  },
  M4: {
    codice: 'M4',
    nome: 'Mappa di posizionamento',
    breve: 'Posizionamento',
    obiettivo: 'Vedere se siamo d’accordo su dove siamo oggi, prima ancora che su dove vogliamo andare.',
    comeFunziona: 'Si scelgono due assi, poi ognuno piazza in privato un punto per oggi e uno per fra dodici mesi.',
    output: 'Il vettore fra i due centroidi: è la strategia, disegnata.',
    durataMin: 15,
  },
  M5: {
    codice: 'M5',
    nome: 'Stress test competitivo',
    breve: 'Stress test',
    obiettivo: 'Verificare se abbiamo davvero una risposta al «perché voi e non loro», o se ce la costruiamo mentre parliamo.',
    comeFunziona: 'Si pesca un concorrente, chi tocca ha novanta secondi per rispondere a voce, poi gli altri votano.',
    output: 'Le vulnerabilità aperte, che restano visibili in tutti i moduli successivi finché non si chiudono.',
    durataMin: 20,
  },
  M6: {
    codice: 'M6',
    nome: 'Revenue floor e runway',
    breve: 'Soglia',
    obiettivo:
      'Trovare il minimo di ricavi da servizi che tiene in vita il team mentre le nuove iniziative maturano.',
    comeFunziona:
      'Ognuno scrive in privato la propria soglia di sicurezza, i mesi di autonomia e cosa lo farebbe suonare l’allarme. Le risposte restano anonime.',
    output: 'Lo spread fra la persona più prudente e la più aggressiva. È il dato che di solito non arriva mai sul tavolo.',
    durataMin: 20,
  },
  M7: {
    codice: 'M7',
    nome: 'No-regret moves',
    breve: 'No-regret',
    obiettivo: 'Separare ciò che si può cominciare subito da ciò che dipende dall’esito della trattativa sul brand.',
    comeFunziona: 'Per ogni affermazione sulla proposition, ognuno vota in privato se regge in entrambi gli scenari o in uno solo.',
    output: 'Due liste: le no-regret, che partono adesso, e le condizionate, che restano in attesa.',
    durataMin: 15,
  },
  M8: {
    codice: 'M8',
    nome: 'Action plan',
    breve: 'Action plan',
    obiettivo: 'Trasformare le decisioni prese in cose che qualcuno farà, entro una data.',
    comeFunziona: 'Ogni decisione bloccata propone la sua azione. Si accetta, si modifica o si scarta, e si assegna un owner.',
    output: 'Il piano per owner e per orizzonte: novanta giorni e gennaio 2027.',
    durataMin: 30,
  },
  M9: {
    codice: 'M9',
    nome: 'Verbale',
    breve: 'Verbale',
    obiettivo: 'Portarsi via il ritiro scritto, senza che nessuno abbia dovuto prendere appunti.',
    comeFunziona: 'Si genera da solo dai dati della sessione. È scaricabile in qualsiasi momento, anche a metà.',
    output: 'Un documento con le decisioni, i dissensi, il piano e la mappa dei ruoli.',
  },
};

/* ------------------------------------------------------------------ */
/* Le fasi del ciclo                                                   */
/* ------------------------------------------------------------------ */

/**
 * «Commit» e «reveal» vengono dal gergo di git e delle aste: qui diventano
 * «risposta in cieco» e «confronto», che dicono la stessa cosa senza chiedere
 * di conoscere il gergo.
 */
export const FASI: Record<StatoSessione, { nome: string; verbo: string }> = {
  SETUP: { nome: 'Preparazione', verbo: 'Si prepara il round insieme' },
  COMMIT: { nome: 'Risposta in cieco', verbo: 'Ognuno risponde per sé' },
  REVEAL: { nome: 'Confronto', verbo: 'Si guardano tutte le risposte insieme' },
  DISCUSSIONE: { nome: 'Discussione', verbo: 'Si negozia' },
  LOCKED: { nome: 'Deciso', verbo: 'La decisione è registrata' },
};

/* ------------------------------------------------------------------ */
/* M0 — le tre risorse scarse, che ricompaiono in M6 e M8              */
/* ------------------------------------------------------------------ */

export type ChiaveVincolo = 'R' | 'G' | 'B';

/**
 * Le sigle R/G/B restano: `lib/verbale.ts` le stampa come intestazioni di
 * colonna, e devono restare corte. I nomi invece stanno qui e non dentro M0,
 * perché il verbale che il cliente si porta via deve scioglierle con le stesse
 * parole che si sono lette a schermo — altrimenti la tabella dei trimestri è
 * tre lettere senza legenda.
 */
export const VINCOLI: { chiave: ChiaveVincolo; nome: string; descrizione: string; unita: string }[] = [
  {
    chiave: 'R',
    nome: 'Relazioni di fiducia',
    descrizione:
      'Quanti clienti o partner riusciamo a seguire davvero nello stesso periodo, prima che la relazione si degradi.',
    unita: 'relazioni in parallelo',
  },
  {
    chiave: 'G',
    nome: 'Decisioni con la nostra firma',
    descrizione:
      'Quante volte al mese qualcuno del team può mettere la faccia su una scelta: approvare, garantire, esporsi.',
    unita: 'al mese',
  },
  {
    chiave: 'B',
    nome: 'Trattative aperte',
    descrizione:
      'Quante conversazioni di vendita vere possiamo tenere aperte insieme, dal primo contatto alla firma.',
    unita: 'in parallelo',
  },
];

/* ------------------------------------------------------------------ */
/* MQ — righe e colonne del quadro                                     */
/* ------------------------------------------------------------------ */

export const RIGHE_QUADRO: { chiave: RigaQuadro; etichetta: string; aiuto: string }[] = [
  { chiave: 'SERVIZI', etichetta: 'Servizi', aiuto: 'Quello che vendiamo a ore, a progetto o a percorso.' },
  { chiave: 'PRODOTTI', etichetta: 'Prodotti', aiuto: 'Quello che esiste anche quando non ci lavoriamo sopra.' },
  { chiave: 'MERCATO', etichetta: 'Mercato', aiuto: 'Dove giochiamo: settori, geografie, dimensioni d’impresa.' },
  { chiave: 'CLIENTI', etichetta: 'Clienti', aiuto: 'Chi firma l’ordine e chi usa quello che consegniamo.' },
  { chiave: 'PARTNER', etichetta: 'Partner', aiuto: 'Chi ci porta lavoro, capacità o accesso.' },
  { chiave: 'REVENUE', etichetta: 'Revenue model', aiuto: 'Come entrano i soldi, non quanti.' },
];

export const COLONNE_QUADRO: { chiave: ColonnaQuadro; etichetta: string; aiuto: string }[] = [
  { chiave: 'OGGI', etichetta: 'Cosa facciamo', aiuto: 'Com’è adesso, senza abbellirlo.' },
  { chiave: 'COMPETITOR', etichetta: 'Competitor', aiuto: 'Cosa fanno gli altri e come si posizionano.' },
  { chiave: 'FUTURO', etichetta: 'Futuro', aiuto: 'Dove vogliamo essere. È la colonna che parte vuota.' },
];

/**
 * I tre orizzonti dentro la colonna Futuro, dal Future Canvas.
 * Le etichette dicono *quando*, non *quanto è ambizioso*: «un giorno» è una
 * data vaga e si vede, mentre «visione di lungo termine» suona come una cosa
 * seria anche quando non lo è.
 */
export const ORIZZONTI_QUADRO: {
  chiave: OrizzonteQuadro;
  etichetta: string;
  quando: string;
  aiuto: string;
}[] = [
  {
    chiave: 'VICINO',
    etichetta: 'Da domani',
    quando: 'settimane',
    aiuto: 'Cose che possiamo fare da soli, senza chiedere il permesso a nessuno.',
  },
  {
    chiave: 'LUMINOSO',
    etichetta: 'Entro l’anno',
    quando: '6–18 mesi',
    aiuto: 'Sviluppi di medio termine che portano valore nuovo, non solo più lavoro.',
  },
  {
    chiave: 'LONTANO',
    etichetta: 'Un giorno',
    quando: 'oltre',
    aiuto: 'Il cambio di sistema: dove finisce WDA se le cose vanno come speriamo.',
  },
];

/* ------------------------------------------------------------------ */
/* M1 — dove finisce ogni attività                                     */
/* ------------------------------------------------------------------ */

export const DESTINAZIONI_GLOSSA: Record<Destinazione, { etichetta: string; aiuto: string }> = {
  AI: {
    etichetta: 'AI',
    aiuto: 'La fa l’AI, a costo quasi zero. Il cliente può farsela da solo.',
  },
  UMANO: {
    etichetta: 'Umano',
    aiuto: 'Richiede giudizio, relazione o responsabilità: regge ancora un prezzo.',
  },
  MORTA: {
    etichetta: 'Morta',
    aiuto: 'Non serve più a nessuno. Nessuno la pagherebbe, nemmeno poco.',
  },
};

export const BUCKET_GLOSSA: Record<Bucket, { etichetta: string; standard: string; aiuto: string }> = {
  NUCLEO: {
    etichetta: 'Nucleo',
    standard: 'core',
    aiuto: 'Stesso prezzo, un decimo del lavoro. Facevamo pagare la parte sbagliata.',
  },
  PORTA: {
    etichetta: 'Apriporta',
    standard: 'loss leader',
    aiuto: 'In commoditizzazione. Si tiene solo se apre relazioni, e si regala.',
  },
  CHIUSO: {
    etichetta: 'Da dismettere',
    standard: 'sunset',
    aiuto: 'Il servizio muore. Smettiamo di venderlo.',
  },
};

/* ------------------------------------------------------------------ */
/* M2 — su cosa poggia il prezzo                                       */
/* ------------------------------------------------------------------ */

export const BASI_GLOSSA: Record<BasePrezzo, { etichetta: string; standard: string; aiuto: string }> = {
  ACCESSO: {
    etichetta: 'Accesso',
    standard: 'retainer',
    aiuto: 'Si paga per averci disponibili, anche nei mesi in cui non serve nulla.',
  },
  ESITO: {
    etichetta: 'Esito',
    standard: 'success fee',
    aiuto: 'Si paga il risultato, quando arriva ed è attribuibile a noi.',
  },
  PARTECIPAZIONE: {
    etichetta: 'Partecipazione',
    standard: 'equity o revenue share',
    aiuto: 'Il nostro guadagno è legato al loro. Si sale sulla stessa barca.',
  },
  VOLUME: {
    etichetta: 'Volume',
    standard: 'usage-based',
    aiuto: 'Si paga a consumo, su un flusso che si ripete e che presidiamo.',
  },
  GIORNATA: {
    etichetta: 'A giornata',
    standard: 'time & materials',
    aiuto: 'Si paga il tempo impiegato. È la base che l’AI sta erodendo.',
  },
};

/* ------------------------------------------------------------------ */
/* M3 — cosa dice il numero di flussi distinti                         */
/* ------------------------------------------------------------------ */

/**
 * Le tre diagnosi con la soglia che le produce e cosa vogliono dire.
 * Le soglie sono quelle di `diagnosiPosizione()`, riportate qui solo per
 * leggerle: la classificazione resta in lib/calc.
 */
export const DIAGNOSI_GLOSSA: Record<DiagnosiPosizione, { soglia: string; aiuto: string }> = {
  'Intermediario sostituibile': {
    soglia: '0–1',
    aiuto: 'Chi sta ai due capi può parlarsi direttamente. Togliere WDA di mezzo non rompe niente.',
  },
  'Layer parziale': {
    soglia: '2–3',
    aiuto: 'Presidiamo qualche collegamento, non l’ecosistema. Sostituibili, ma con fatica.',
  },
  Infrastruttura: {
    soglia: '4+',
    aiuto: 'L’ecosistema passa da qui: senza WDA i collegamenti vanno ricostruiti uno per uno.',
  },
};

/* ------------------------------------------------------------------ */
/* M7 — scenari di brand                                               */
/* ------------------------------------------------------------------ */

export const SCENARI_GLOSSA: Record<Scenario, { etichetta: string; aiuto: string }> = {
  ENTRAMBI: {
    etichetta: 'Regge sempre',
    aiuto: 'Vale sia con brand autonomo sia come sub-brand. Si può cominciare adesso.',
  },
  AUTONOMO: {
    etichetta: 'Solo autonomi',
    aiuto: 'Ha senso solo se restiamo un brand indipendente.',
  },
  SUB_BRAND: {
    etichetta: 'Solo sub-brand',
    aiuto: 'Ha senso solo dentro l’accordo con il partner industriale.',
  },
};

/* ------------------------------------------------------------------ */
/* Termini che compaiono a schermo e vanno spiegati una volta          */
/* ------------------------------------------------------------------ */

export const TERMINI: Record<string, string> = {
  'residuo umano':
    'La quota del prezzo che poggia su attività che restano umane. Se è bassa, il servizio si sta commoditizzando.',
  spread: 'La distanza fra la soglia più prudente e la più aggressiva del gruppo.',
  'flussi distinti': 'Quante relazioni diverse fra due attori passano da noi. Contate una volta sola.',
  vettore: 'La freccia fra dove il gruppo si colloca oggi e dove si vede fra dodici mesi.',
  allineamento: 'Quanto le risposte individuali coincidono. Non è un voto: al primo round dovrebbe essere basso.',
  divergenza: 'Dove le risposte non coincidono. Si riporta e resta a verbale: non è un torto di nessuno.',
  copertura: 'Quante decisioni sono state chiuse sulle nove previste.',
  esposizione: 'Quanta parte del fatturato poggia su basi di prezzo in erosione.',
  vulnerabilità: 'Una domanda del mercato a cui non abbiamo ancora una risposta convincente.',
  'no-regret': 'Una mossa che conviene in entrambi gli scenari di brand. Non serve aspettare la trattativa per cominciarla.',
  dispersione: 'Quanto sono lontani fra loro i punti del gruppo, in centesimi del lato della mappa.',
};

/** L'arco completo, nell'ordine in cui si affronta. */
export const ORDINE_MODULI: Modulo[] = ['MQ', 'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'];
