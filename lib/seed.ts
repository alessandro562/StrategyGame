/**
 * Dati iniziali del ritiro (§M0). Tutto modificabile a runtime: il seed serve a
 * far partire il tavolo in meno di cinque minuti, non a fissare la verità.
 */

import type { Attivita, ColonnaQuadro, RigaQuadro, Store, VoceQuadro } from './types';

export const CODICE_STANZA_DEFAULT = process.env.NEXT_PUBLIC_ROOM_CODE || 'ritiro';

const NOMI = ['Roberto', 'Valentina', 'Alessandro', 'Grazia', 'Michela', 'Sofia'];

/** Suggerimenti di scomposizione precaricati (§M1 passo 1). Ignorabili. */
export const SCOMPOSIZIONI_SUGGERITE: Record<string, string[]> = {
  'analisi-mercato': [
    'Raccolta dati',
    'Sintesi e benchmark',
    'Interpretazione',
    'Confezionamento',
    'Accesso e relazioni',
  ],
  'cxo-as-a-service': [
    'Presenza e disponibilità',
    'Decisioni prese',
    'Esecuzione operativa',
    'Reporting',
    'Rete attivata',
  ],
  'venture-building': [
    "Selezione dell'opportunità",
    'Costruzione',
    'Go-to-market',
    'Gestione dei rapporti',
    'Uscita',
  ],
};

function attivitaDa(nomi: string[], prefisso: string): Attivita[] {
  const quota = Math.floor(100 / nomi.length);
  const resto = 100 - quota * nomi.length;
  return nomi.map((nome, i) => ({
    id: `${prefisso}-a${i + 1}`,
    nome,
    quotaPrezzoPct: quota + (i === 0 ? resto : 0),
  }));
}


/**
 * Il quadro parte già pieno di ciò che WDA fa davvero oggi, e di chi ha di
 * fronte. Una tabella vuota è un invito a non compilarla: davanti a sei
 * caselle bianche nessuno comincia. Davanti a quello che già facciamo, si
 * comincia a discutere.
 *
 * Le colonne «futuro» restano vuote apposta: quelle sono la domanda.
 */
export function quadroIniziale(): VoceQuadro[] {
  const voci: [RigaQuadro, ColonnaQuadro, string][] = [
    ['SERVIZI', 'OGGI', 'Venture building per conto di terzi'],
    ['SERVIZI', 'OGGI', 'CXO as a Service'],
    ['SERVIZI', 'OGGI', 'Programmi di open innovation'],
    ['SERVIZI', 'OGGI', 'Analisi di mercato e deck strategici'],
    ['SERVIZI', 'OGGI', 'Consulenza AI a PMI e corporate'],
    ['SERVIZI', 'COMPETITOR', 'Big consulting: stessa offerta, firma che nessuno contesta'],
    ['SERVIZI', 'COMPETITOR', 'Boutique AI: più verticali e più economiche'],

    ['PRODOTTI', 'OGGI', 'Nessun prodotto ricorrente: tutto su commessa'],
    ['PRODOTTI', 'COMPETITOR', 'Venture builder con portafoglio proprio'],

    ['MERCATO', 'OGGI', 'Corporate e PMI italiane, innovazione e AI'],
    ['MERCATO', 'COMPETITOR', 'Freelance senior con stack AI, costo marginale'],

    ['CLIENTI', 'OGGI', 'Direzioni innovazione e general management'],
    ['CLIENTI', 'COMPETITOR', 'Il cliente che si fa le cose da solo con l’AI'],

    ['PARTNER', 'OGGI', 'Impacta Strategy — trattativa in corso'],
    ['PARTNER', 'OGGI', 'Startup, investitori, vendor tecnologici'],

    ['REVENUE', 'OGGI', 'Prevalentemente a giornata e a progetto'],
    ['REVENUE', 'COMPETITOR', 'Chi lavora a success fee o con equity'],
  ];
  return voci.map(([riga, colonna, testo], i) => ({
    id: `q-seed-${i + 1}`,
    riga,
    colonna,
    testo,
    autoreId: 'seed',
    ts: 0,
  }));
}

export function statoIniziale(codiceStanza = CODICE_STANZA_DEFAULT): Store {
  return {
    workshop: {
      nome: 'Ritiro WDA — 5/6 agosto 2026',
      codiceStanza,
      vincoli: { R: 8, G: 12, B: 5 },
      modalitaVincoli: 'numerica',
      facilitatoreId: null,
      asseCorrenteId: 'asse-1',
      sogliaCondivisaPct: null,
      forbiceOriginale: null,
      lockPrevisti: 9,
    },
    quadro: quadroIniziale(),
    partecipanti: NOMI.map((nome, i) => ({
      id: `p${i + 1}`,
      nome,
      profilo: 'operativo' as const,
      presente: true,
      socketConnesso: false,
    })),
    sessioni: [],
    servizi: [
      {
        id: 'venture-building',
        nome: 'Venture Building',
        descrizione: 'Costruzione di nuove iniziative per conto di terzi',
        fatturato12m: 0,
        attivita: attivitaDa(SCOMPOSIZIONI_SUGGERITE['venture-building'], 'venture-building'),
        destinazioni: [],
        bucket: null,
        valoreResiduo: null,
        basePrezzo: null,
      },
      {
        id: 'cxo-as-a-service',
        nome: 'CXO as a Service',
        descrizione: 'Figura executive a tempo parziale dentro il cliente',
        fatturato12m: 0,
        attivita: attivitaDa(SCOMPOSIZIONI_SUGGERITE['cxo-as-a-service'], 'cxo-as-a-service'),
        destinazioni: [],
        bucket: null,
        valoreResiduo: null,
        basePrezzo: null,
      },
      {
        id: 'open-innovation',
        nome: 'Programmi di Open Innovation',
        descrizione: 'Scouting, call, percorsi di collaborazione corporate-startup',
        fatturato12m: 0,
        attivita: attivitaDa(
          ['Disegno del programma', 'Scouting', 'Selezione', 'Gestione del percorso', 'Racconto dei risultati'],
          'open-innovation',
        ),
        destinazioni: [],
        bucket: null,
        valoreResiduo: null,
        basePrezzo: null,
      },
      {
        id: 'analisi-mercato',
        nome: 'Analisi di mercato e deck strategici',
        descrizione: 'Ricerca, benchmark, documenti di posizionamento',
        fatturato12m: 0,
        attivita: attivitaDa(SCOMPOSIZIONI_SUGGERITE['analisi-mercato'], 'analisi-mercato'),
        destinazioni: [],
        bucket: null,
        valoreResiduo: null,
        basePrezzo: null,
      },
      {
        id: 'consulenza-ai',
        nome: 'Consulenza AI a PMI e corporate',
        descrizione: 'Adozione, casi d’uso, messa a terra di strumenti AI',
        fatturato12m: 0,
        attivita: attivitaDa(
          ['Assessment', 'Selezione dei casi d’uso', 'Implementazione', 'Formazione', 'Presidio nel tempo'],
          'consulenza-ai',
        ),
        destinazioni: [],
        bucket: null,
        valoreResiduo: null,
        basePrezzo: null,
      },
    ],
    attori: [
      { id: 'wda', nome: 'WDA', categoria: 'noi', x: 0.5, y: 0.5, fisso: true },
      { id: 'corporate', nome: 'Corporate', categoria: 'domanda', x: 0.18, y: 0.18 },
      { id: 'pmi', nome: 'PMI', categoria: 'domanda', x: 0.18, y: 0.5 },
      { id: 'startup', nome: 'Startup', categoria: 'offerta', x: 0.82, y: 0.2 },
      { id: 'investitori', nome: 'Investitori', categoria: 'capitale', x: 0.82, y: 0.52 },
      { id: 'vendor', nome: 'Vendor tecnologici', categoria: 'offerta', x: 0.82, y: 0.84 },
      { id: 'talenti', nome: 'Talenti', categoria: 'offerta', x: 0.5, y: 0.88 },
      { id: 'enti', nome: 'Enti pubblici', categoria: 'istituzioni', x: 0.18, y: 0.84 },
      { id: 'impacta', nome: 'Impacta Strategy', categoria: 'partner', x: 0.5, y: 0.12 },
    ],
    flussi: [],
    competitor: [
      {
        id: 'venture-builder',
        nome: 'Venture builder tradizionali',
        categoria: 'strutturati',
        descrizione: 'Costruiscono aziende con capitale e team dedicato',
        puntiForza: ['Capitale proprio', 'Track record di exit', 'Team di costruzione interno'],
        sfide: [],
      },
      {
        id: 'boutique-ai',
        nome: 'Boutique di consulenza AI',
        categoria: 'specialisti',
        descrizione: 'Piccole strutture verticali, molto tecniche',
        puntiForza: ['Profondità tecnica', 'Prezzo aggressivo', 'Tempi di consegna corti'],
        sfide: [],
      },
      {
        id: 'big-consulting',
        nome: 'Big consulting in movimento sull’AI',
        categoria: 'strutturati',
        descrizione: 'Le grandi firme che hanno riconvertito le practice',
        puntiForza: ['Relazioni al vertice', 'Copertura globale', 'Nessuno viene licenziato per averli scelti'],
        sfide: [],
      },
      {
        id: 'innovation-hub',
        nome: 'Innovation hub interni al cliente',
        categoria: 'interni',
        descrizione: 'La struttura di innovazione che il cliente si è costruito in casa',
        puntiForza: ['Conoscenza del contesto', 'Costo già a budget', 'Accesso permanente'],
        sfide: [],
      },
      {
        id: 'freelance-senior',
        nome: 'Freelance senior con stack AI',
        categoria: 'individuali',
        descrizione: 'Singoli professionisti con leva AI molto alta',
        puntiForza: ['Costo marginale', 'Velocità', 'Nessuna struttura da mantenere'],
        sfide: [],
      },
      {
        id: 'cliente-da-solo',
        nome: 'Il cliente che si fa le cose da solo con l’AI',
        categoria: 'sostituzione',
        descrizione: 'Il compratore che smette di comprare',
        puntiForza: ['Costo quasi zero', 'Nessun brief da scrivere', 'Il risultato è "abbastanza buono"'],
        sfide: [],
        fisso: true,
      },
    ],
    soglie: [],
    invarianti: [
      { id: 'inv-1', testo: 'Vendiamo accesso e giudizio, non produzione di documenti', scenario: 'ENTRAMBI', votiTenere: [] },
      { id: 'inv-2', testo: 'Il prezzo non poggia sulle giornate', scenario: 'ENTRAMBI', votiTenere: [] },
      { id: 'inv-3', testo: 'Manteniamo un nostro portafoglio di relazioni dirette con le corporate', scenario: 'ENTRAMBI', votiTenere: [] },
      { id: 'inv-4', testo: 'Costruiamo startup interne e ce le teniamo fino alla vendita', scenario: 'ENTRAMBI', votiTenere: [] },
    ],
    azioni: [],
    lock: [],
    note: [],
    assi: [
      {
        id: 'asse-1',
        xSinistra: 'leva umana',
        xDestra: 'leva AI',
        ySotto: 'fee-for-service',
        ySopra: 'skin in the game',
        creatoA: 0,
      },
    ],
    posizionamenti: [],
    vulnerabilita: [],
    traiettoria: [
      { id: 't1', etichetta: 'Q4 2026', quotaServiziPct: 90, consumo: { R: 6, G: 8, B: 4 } },
      { id: 't2', etichetta: 'Q1 2027', quotaServiziPct: 85, consumo: { R: 6, G: 9, B: 4 } },
      { id: 't3', etichetta: 'Q2 2027', quotaServiziPct: 82, consumo: { R: 7, G: 10, B: 5 } },
      { id: 't4', etichetta: 'Q3 2027', quotaServiziPct: 80, consumo: { R: 7, G: 10, B: 5 } },
    ],
  };
}

/** Proposte di assi per M4, non imposte. */
export const ASSI_PROPOSTI = [
  { xSinistra: 'leva umana', xDestra: 'leva AI', ySotto: 'fee-for-service', ySopra: 'skin in the game' },
  { xSinistra: 'esecuzione', xDestra: 'advisory', ySotto: 'molti clienti leggeri', ySopra: 'pochi clienti profondi' },
  { xSinistra: 'leva umana', xDestra: 'leva AI', ySotto: 'esecuzione', ySopra: 'advisory' },
  { xSinistra: 'fee-for-service', xDestra: 'skin in the game', ySotto: 'molti clienti leggeri', ySopra: 'pochi clienti profondi' },
];
