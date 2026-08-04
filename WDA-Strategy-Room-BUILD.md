# WDA Strategy Room — Specifica di implementazione

**Destinatario** Claude Code
**Obiettivo** Applicazione web multi-dispositivo per condurre il ritiro strategico WDA del 5-6 agosto 2026
**Vincolo temporale** Deve essere funzionante e testato prima delle 12:00 del 5 agosto

---

## 0. Come usare questo documento

Questo documento è eseguibile. Le sezioni sono ordinate come vanno costruite. Ogni modulo ha criteri di accettazione verificabili: non considerare un modulo finito finché tutti i criteri passano.

**Regola di priorità.** Se il tempo stringe, taglia moduli interi partendo dal fondo della sequenza di build (§12). Non tagliare la qualità del ciclo commit/reveal/lock: è il cuore del prodotto e un ciclo fragile rende inutile tutto il resto.

**Regola di ambiguità.** Dove questo documento non specifica, scegli l'opzione più semplice che soddisfa i criteri di accettazione. Non aggiungere funzionalità non richieste.

---

## 1. Contesto reale

### 1.1 L'evento

| | |
|---|---|
| Evento | Ritiro WDA, 5-6 agosto 2026 |
| Luogo | Fuori sede, connettività non garantita |
| Partecipanti | 6 |
| Sessioni di lavoro | Giorno 5 pomeriggio (15:00-18:00), giorno 6 mattina e pomeriggio |
| Obiettivo dichiarato | Nuova proposition WDA (80% core + 20% Forge) e action plan con owner e scadenze verso gennaio 2027 |

### 1.2 Il team

Roberto, Valentina, Alessandro, Grazia, Michela, Sofia.

Il profilo di ciascuno (founder / operativo / board / non-operativo) si imposta in M0 ed è modificabile. Non hardcodare i profili.

### 1.3 Il modello in transizione

WDA passa da consulenza e venture building per terzi a un modello ibrido:

- **Core (80% o più)** — consulenza, open innovation, corporate venture building, consulenza AI a PMI e corporate
- **Forge (20%)** — costruzione di startup AI-native interne, con exit prevalentemente per vendita rapida

Il tool serve al lato **core**. Forge entra solo come vincolo (consuma tempo) e come opportunità (Impacta come possibile buyer network per le micro-acquisizioni).

### 1.4 La tesi che il tool deve testare

> L'AI ha azzerato il costo di produzione di gran parte di ciò che WDA vendeva — analisi di mercato, deck, benchmark, business plan. Quel che resta vendibile va identificato, ridefinito e ri-prezzato. E forse WDA oggi è più un layer fra operatori che un consulente.

Ogni modulo esiste per portare evidenza su questa tesi.

### 1.5 Lo scenario branding

Il rebranding dipende dalla trattativa con partner industriali (es. Impacta Strategy, con possibile sub-brand "Impacta Innovation") contro brand autonomo. **Il tool non decide il brand.** Lavora sulla proposition di contenuto e, in M7, fissa gli invarianti validi in entrambi gli scenari.

---

## 2. Decisione architetturale

### 2.1 Vercel, serverless, senza WebSocket

**Scelta: Next.js su Vercel, stato su Redis serverless, sincronizzazione via polling versionato.**

Vercel non ospita server WebSocket persistenti: le funzioni serverless non vivono abbastanza a lungo. Qualsiasi soluzione basata su `ws` va scartata.

**Il polling è la scelta giusta qui, non un ripiego.** Con 7 client che interrogano ogni secondo si parla di 7 richieste al secondo — irrilevante per Vercel, e in cambio si elimina l'intera classe di problemi legata a connessioni cadute, riconnessioni e stato desincronizzato. Con un pubblico di sei persone in una stanza, la latenza percepita di un secondo è invisibile ovunque tranne che nel reveal, e per quello c'è un accorgimento specifico (§2.5).

**Non usare Server-Sent Events.** Sulle funzioni Vercel lo streaming ha limiti di durata che costringono a riconnessioni periodiche: si paga la complessità di una connessione persistente senza averne l'affidabilità.

### 2.2 Topologia

```
Vercel
├── Next.js App Router
│   ├── /tavolo                    proiettato in sala
│   ├── /mano                      dispositivi partecipanti
│   ├── /api/state    GET          polling versionato
│   ├── /api/action   POST         ogni mutazione passa da qui
│   └── /api/export   GET          verbale markdown
│
└── Upstash Redis (via Vercel Marketplace, integrazione a un click)
    ├── room:version               contatore INCR
    ├── room:state                 JSON dello stato strutturale
    ├── commit:{sessioneId}:{partecipanteId}   una chiave per commit
    └── backup:{timestamp}         snapshot a ogni lock
```

L'integrazione Upstash dal marketplace Vercel inietta le variabili d'ambiente da sola. Nessuna configurazione manuale.

### 2.3 Stack

| Livello | Scelta | Note |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | |
| Rotte | `/tavolo`, `/mano` | Due layout distinti, non responsive dello stesso |
| Stile | Tailwind + CSS custom properties per i token | |
| Sincronizzazione | Polling `GET /api/state` ogni 1000ms | Nessuna libreria realtime |
| Stato | Upstash Redis (`@upstash/redis`, client REST) | Compatibile serverless |
| Animazione | Framer Motion, solo nel reveal | |
| Canvas M3/M4 | SVG puro + pointer events | Nessuna libreria di grafi |
| Export | Generazione markdown lato server, `/api/export` | |
| Accesso | Codice stanza in URL, nessun account | |

### 2.4 Schema delle chiavi Redis

Il punto delicato è la concorrenza: sei client che scrivono su un unico blob JSON producono sovrascritture. Lo schema evita il problema per costruzione.

| Chiave | Contenuto | Chi scrive | Rischio collisione |
|---|---|---|---|
| `room:version` | Contatore, `INCR` a ogni mutazione | Tutti | Nessuno, `INCR` è atomico |
| `room:state` | Stato strutturale: sessioni, servizi, lock, azioni | Quasi solo il facilitatore | Basso |
| `commit:{sess}:{part}` | Un commit individuale | Solo il proprietario | **Nullo per costruzione** |
| `backup:{ts}` | Snapshot completo | Server, a ogni lock | Nessuno |

I commit — l'unico caso in cui sei persone scrivono simultaneamente — vivono su chiavi separate. Non si toccano mai.

Per le scritture su `room:state` usa un lock ottimistico: leggi `room:version`, applica la mutazione, scrivi con una transazione `MULTI` che rilegge la versione. Se è cambiata, riprova. Massimo 3 tentativi, poi errore all'utente.

### 2.5 Il polling, in dettaglio

```
GET /api/state?v=42&pid=xyz

  se room:version == 42  →  204 No Content   (nessun trasferimento)
  se room:version  > 42  →  200 + stato completo, filtrato per pid
```

Il client conserva la versione corrente e la manda a ogni giro. Nella stragrande maggioranza dei tick la risposta è un 204 vuoto: il costo è trascurabile.

**Cadenza adattiva.** Il client cambia frequenza in base allo stato della sessione:

| Stato | Intervallo | Motivo |
|---|---|---|
| `COMMIT` | 1000ms | Serve vedere il contatore salire |
| `REVEAL` | 400ms | Il momento va sincronizzato |
| `DISCUSSIONE`, `LOCKED` | 2000ms | Nulla cambia in fretta |
| Tab in background | 5000ms | `visibilitychange` |

**Il reveal.** Il facilitatore, premendo reveal, scrive `revealAt = now + 1500ms` nello stato. Tutti i client vedono il campo entro il tick successivo e fanno partire l'animazione all'orario indicato, non alla ricezione. Il risultato è che il reveal parte sincronizzato su tutti i dispositivi anche se le risposte arrivano scaglionate — che è l'unico momento in cui questo conta.

### 2.6 Il rischio da mettere in conto

Vercel significa che il tool dipende dalla connettività della sede. È un rischio reale e va gestito, non ignorato:

- **Hotspot da telefono come piano B.** Verificalo prima di partire, non in sala
- **Il client tiene in cache l'ultimo stato in `localStorage`** e resta leggibile offline, in sola lettura, con un banner esplicito
- **Le azioni fatte offline si accodano** e si rigiocano alla riconnessione, con id idempotente per evitare doppioni
- **Export del verbale scaricabile in qualsiasi momento**, così se cade tutto avete comunque il documento

### 2.7 Struttura del repository

```
wda-strategy-room/
├── app/
│   ├── tavolo/page.tsx
│   ├── mano/page.tsx
│   └── api/
│       ├── state/route.ts      GET polling versionato + FILTRO
│       ├── action/route.ts     POST, tutte le mutazioni
│       └── export/route.ts     GET verbale markdown
├── lib/
│   ├── redis.ts                client Upstash
│   ├── store.ts                load/save, lock ottimistico, backup
│   ├── handlers.ts             un handler per tipo di azione
│   ├── guards.ts               ENFORCEMENT DEL COMMIT CIECO — file critico
│   ├── seed.ts                 dati iniziali del ritiro
│   ├── types.ts                tipi condivisi
│   ├── actions.ts              unione discriminata delle azioni
│   └── calc.ts                 calcoli derivati, puri e testabili
├── src/
│   ├── net/
│   │   ├── usePolling.ts   polling adattivo, cache locale, coda offline
│   │   └── useStore.ts     hook sullo stato sincronizzato
│   ├── modules/
│   │   ├── M0Setup/
│   │   ├── M1Smontaggio/
│   │   ├── M2Ripricing/
│   │   ├── M3Flussi/
│   │   ├── M4Posizionamento/
│   │   ├── M5Competitor/
│   │   ├── M6Soglia/
│   │   ├── M7Invarianti/
│   │   ├── M8ActionPlan/
│   │   └── M9Verbale/
│   ├── components/
│   │   ├── Timer.tsx
│   │   ├── CommitBar.tsx       "4 su 6 hanno confermato"
│   │   ├── RevealStage.tsx     coreografia del reveal
│   │   ├── DivergenceList.tsx
│   │   ├── LockButton.tsx
│   │   ├── HatBadge.tsx
│   │   ├── IndicatorStrip.tsx
│   │   └── VulnerabilityRail.tsx
│   └── styles/tokens.css
└── package.json
```

### 2.8 Deploy e accesso

`vercel --prod` a ogni modifica. Nessun passo manuale.

I partecipanti accedono da un URL breve con codice stanza, es. `wda.vercel.app/mano?r=ritiro`. Il Tavolo mostra in permanenza un QR code che punta a quell'URL, così chi perde la connessione rientra in due secondi senza chiedere niente a nessuno.

**Prima di partire per la sede**, apri l'app da rete mobile e verifica il ciclo completo. Un deploy che funziona in ufficio e non in sede è il fallimento più stupido possibile.

---

## 3. Il ciclo di gioco

Tutti i moduli girano lo stesso ciclo. Implementalo una volta sola come macchina a stati condivisa.

```
SETUP → COMMIT → REVEAL → DISCUSSIONE → LOCKED
                                            ↓
                                       (riapertura)
                                            ↓
                                         COMMIT
```

| Stato | Tavolo mostra | Mano mostra | Chi può cambiare stato |
|---|---|---|---|
| `SETUP` | Preparazione del round, contenuto in sola lettura | "In attesa" | Facilitatore |
| `COMMIT` | Timer, contatore commit, mai i contenuti | Form di commit privato | Facilitatore, o scadenza timer |
| `REVEAL` | Tutti i commit, attribuiti | Il proprio commit, in sola lettura | Facilitatore |
| `DISCUSSIONE` | Lista divergenze, strumenti di negoziazione | Annotazioni personali | Facilitatore |
| `LOCKED` | Artefatto bloccato | Artefatto bloccato | Facilitatore (riapertura) |

### 3.1 Il commit cieco — requisito critico

Questo è il punto in cui l'implementazione può fallire silenziosamente. Trattalo come il requisito di sicurezza che è.

**Il rischio specifico dell'architettura serverless.** Con il polling, la tentazione naturale è far restituire a `/api/state` lo stato intero e lasciare che il client mostri solo ciò che deve. **Questo è il modo in cui il prodotto fallisce.** Chiunque apra gli strumenti di sviluppo vede i commit degli altri, e uno solo che lo fa distrugge il valore di tutti i round successivi.

**Regole di enforcement, tutte in `guards.ts`, applicate dentro `/api/state`:**

1. `GET /api/state` accetta obbligatoriamente un `pid` (id partecipante). Senza `pid` valido risponde 401
2. Esiste **una sola funzione** da cui esce stato: `filterStateFor(state, pid, role)`. Nessuna route può serializzare stato bypassandola. Verificalo: cerca nel codice ogni `NextResponse.json` dentro `/api` e accertati che passi da lì
3. Con sessione in `COMMIT`, la funzione rimuove ogni chiave `commit:{sess}:{altro_pid}` dal payload. Al richiedente resta solo il proprio
4. Alla vista `/tavolo` durante `COMMIT` arriva soltanto `{ committed: number, total: number, confermatiIds: string[] }` — chi ha confermato, mai cosa
5. Con `revealAnonimo: true` (M6), la funzione elimina i `partecipanteId` dai commit **anche dopo** il reveal, e li sostituisce con indici mescolati con seed fisso per sessione
6. `POST /api/action` con `commit.set` su sessione in stato diverso da `COMMIT` risponde 409. I commit sono immutabili dopo il reveal
7. Un cambio di opinione dopo il reveal si registra come `discussion.note`, mai come modifica del commit

**Test obbligatorio.** Un test che: crea una sessione in `COMMIT`, scrive un commit per il partecipante A, chiama `GET /api/state?pid=B`, e verifica che la risposta serializzata non contenga il payload di A in nessuna forma. Verifica la stringa JSON grezza, non l'oggetto deserializzato. Questo test esiste e passa prima di considerare finito qualsiasi modulo.

### 3.2 Il reveal

L'unico momento coreografato dell'intero prodotto. Tutti i commit compaiono insieme sul Tavolo con stagger di 80ms, in ordine casuale (non alfabetico, non per ordine di conferma — l'ordine non deve suggerire nulla).

Durata totale dell'animazione: sotto i 600ms. Rispetta `prefers-reduced-motion`.

### 3.3 Il lock

Il lock registra:
- Il contenuto della decisione condivisa
- I dissensi: chi voleva altro e cosa. **Il dissenso non viene cancellato dal lock** — resta nel verbale
- Timestamp
- Riferimenti ai lock a valle che dipendono da questo

**Riapertura.** Riaprire un lock non blocca nulla, ma il Tavolo mostra un banner persistente: `Round 2 riaperto — 3 decisioni a valle da riconvalidare`, con la lista. Il banner sparisce solo quando ogni decisione a valle viene riconfermata o ri-bloccata.

### 3.4 Il timer

Sempre visibile su Tavolo e Mano, sincronizzato dal server (il client non conta da solo: riceve `startedAt` e `durationS` e calcola).

- Ultimi 20 secondi: colore `--tension`
- Alla scadenza: suono singolo, e lo stato passa automaticamente a `REVEAL` acquisendo i commit incompleti allo stato in cui sono
- Il facilitatore può aggiungere tempo (+30s, +2min) o chiudere in anticipo

---

## 4. Meccaniche trasversali

### 4.1 I cappelli

All'inizio di ogni sessione ogni partecipante riceve un cappello, visibile a tutti sul Tavolo.

| Cappello | Deve difendere | Domanda che deve fare |
|---|---|---|
| `CASHFLOW` | I ricavi da servizi | "Con questo piano, come paghiamo gli stipendi a marzo?" |
| `COSTRUTTORE` | Lo spazio per Forge | "Da dove esce il tempo per costruire, se teniamo tutto questo?" |
| `COMPRATORE` | Il punto di vista di chi compra | "Perché dovrei pagare per questo?" |
| `CLIENTE` | Il cliente corporate attuale | "Se WDA cambia così, io ci sono ancora?" |
| `PARTNER` | Lo scenario Impacta | "Questa cosa regge anche come sub-brand?" |
| `ESTERNO` | Niente | "Cosa non state dicendo?" |

**Regole implementative:**
- Assegnazione automatica a rotazione, con vincolo: nessuno riceve lo stesso cappello due volte
- `CASHFLOW` e `COMPRATORE` sono obbligatori: se il numero di presenti è inferiore ai cappelli, questi due vengono assegnati per primi
- Il cappello vincola le domande, non i voti. Nel commit cieco ognuno vota secondo il proprio giudizio
- Il tool registra la mappa cappello × persona: a fine ritiro è input diretto alla ridefinizione dei ruoli

### 4.2 I vincoli scarsi

**Non usare mai le giornate-uomo come risorsa scarsa.** Con la leva AI un team di 5 operativi produce l'output di un team molto più grande; vincolare sulle ore misura la risorsa che l'AI ha reso abbondante.

Le tre risorse scarse, impostate in M0 e consumate dai moduli di composizione:

| Codice | Nome | Descrizione |
|---|---|---|
| `R` | Relazioni contemporanee | Rapporti di fiducia reggibili in parallelo |
| `G` | Gate decisionali umani | Decisioni al mese in cui qualcuno mette la faccia |
| `B` | Banda commerciale | Conversazioni di vendita reale aperte in parallelo |

Se il team non riesce a dare numeri in M0, il tool accetta valori qualitativi (`basso` / `medio` / `alto`) e mostra il consumo in modo relativo anziché assoluto. Implementa entrambe le modalità.

### 4.3 Gli indicatori

Tre indicatori sempre visibili in una fascia sul Tavolo. **Non sono punteggi.** Nessun vincitore, nessun livello, nessuna celebrazione.

| Indicatore | Calcolo | Presentazione |
|---|---|---|
| Allineamento | Dispersione media dei commit negli ultimi 3 round, normalizzata 0-100 | Numero + micro-sparkline |
| Copertura | Lock effettuati / lock previsti | Frazione, es. `4/9` |
| Esposizione | % fatturato su basi in erosione + numero vulnerabilità aperte | Due numeri affiancati |

Non presentarli mai come obiettivi da massimizzare. Un allineamento del 100% al primo round significa che il commit cieco non funziona.

---

## 5. Modello dati

```typescript
type Profilo = 'founder' | 'operativo' | 'board' | 'non_operativo';
type StatoSessione = 'SETUP' | 'COMMIT' | 'REVEAL' | 'DISCUSSIONE' | 'LOCKED';
type Destinazione = 'AI' | 'UMANO' | 'MORTA';
type Bucket = 'NUCLEO' | 'PORTA' | 'CHIUSO';
type BasePrezzo = 'ACCESSO' | 'ESITO' | 'PARTECIPAZIONE' | 'VOLUME' | 'GIORNATA';
type Cappello = 'CASHFLOW' | 'COSTRUTTORE' | 'COMPRATORE' | 'CLIENTE' | 'PARTNER' | 'ESTERNO';

interface Store {
  workshop: {
    nome: string;
    vincoli: { R: number | 'basso'|'medio'|'alto'; G: ...; B: ... };
    modalitaVincoli: 'numerica' | 'qualitativa';
  };
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
}

interface Partecipante {
  id: string;
  nome: string;
  profilo: Profilo;
  presente: boolean;          // toggle rapido: la presenza è parziale
  socketConnesso: boolean;    // per distinguere "non ha deciso" da "wifi caduto"
}

interface Sessione {
  id: string;
  modulo: 'M0'|'M1'|'M2'|'M3'|'M4'|'M5'|'M6'|'M7'|'M8'|'M9';
  titolo: string;
  stato: StatoSessione;
  timer: { durataS: number; avviatoA: number | null } | null;
  cappelli: Record<string, Cappello>;   // partecipanteId -> cappello
  soggettoId?: string;                   // es. quale servizio si sta smontando
  revealAnonimo: boolean;                // true solo per M6
}

interface Servizio {
  id: string;
  nome: string;
  descrizione: string;
  fatturato12m: number;
  attivita: { id: string; nome: string; quotaPrezzoPct: number }[];
  destinazioni: { attivitaId: string; partecipanteId: string; valore: Destinazione }[];
  bucket: Bucket | null;
  valoreResiduo: 'MENO' | 'UGUALE_O_PIU' | 'NIENTE' | null;
  basePrezzo: { primaria: BasePrezzo; secondaria?: BasePrezzo } | null;
}

interface Attore { id: string; nome: string; categoria: string; x: number; y: number; }

interface Flusso {
  id: string;
  servizioId: string;
  partecipanteId: string;
  attoreDa: string;
  attoreA: string;
}

interface Competitor {
  id: string;
  nome: string;
  categoria: string;
  descrizione: string;
  puntiForza: string[];
  sfide: { sessioneId: string; rispondenteId: string; risposta: string;
           voti: { partecipanteId: string; convincente: boolean }[];
           aperta: boolean }[];
}

interface Soglia {
  partecipanteId: string;
  sogliaPct: number;
  mesiAutonomia: number;
  trigger: string;
}

interface Invariante {
  id: string;
  testo: string;
  scenario: 'ENTRAMBI' | 'AUTONOMO' | 'SUB_BRAND';
  votiTenere: string[];   // partecipanteId
}

interface Azione {
  id: string;
  testo: string;
  ownerId: string;
  scadenza: string;        // ISO date
  orizzonte: '90_GIORNI' | 'A_GENNAIO_2027';
  lockOrigine: string;     // da quale decisione discende
  stato: 'APERTA' | 'FATTA';
}

interface Lock {
  id: string;
  sessioneId: string;
  timestamp: number;
  contenuto: unknown;
  dissensi: { partecipanteId: string; nota: string }[];
  riapertoA: number | null;
  aValle: string[];        // lockId che dipendono da questo
}
```

**Regola sui commit.** Un commit non è mai modificabile dopo il reveal. La storia delle posizioni è parte del valore prodotto.

---

## 6. API

Tre route, nient'altro. Le azioni sono un'unione discriminata in `lib/actions.ts`, validate in `guards.ts` prima di essere applicate.

### 6.1 `GET /api/state`

```
GET /api/state?v={versione}&pid={partecipanteId}&r={codiceStanza}

204  →  versione invariata, nessun corpo
200  →  { version, state }   già filtrato da filterStateFor()
401  →  pid mancante o sconosciuto
```

### 6.2 `POST /api/action`

Corpo: `{ actionId, pid, type, payload }`.

`actionId` è un UUID generato dal client. Il server lo registra in un set Redis con TTL di un'ora e **scarta i duplicati**: è ciò che rende sicuro rigiocare la coda offline senza produrre doppioni.

```
participant.join          { nome }
participant.setPresence   { partecipanteId, presente }

session.create            { modulo, titolo, soggettoId? }
session.setState          { sessioneId, stato }        [facilitatore]
session.startTimer        { sessioneId, durataS }      [facilitatore]
session.addTime           { sessioneId, secondi }      [facilitatore]
session.dealHats          { sessioneId }               [facilitatore]
session.reveal            { sessioneId }               [facilitatore] — imposta revealAt

commit.set                { sessioneId, payload }      409 se stato != COMMIT
commit.confirm            { sessioneId }

discussion.note           { sessioneId, testo }
lock.create               { sessioneId, contenuto, dissensi }
lock.reopen               { lockId }

entity.upsert             { tipo, dati }
entity.delete             { tipo, id }
```

Risposte: `200 { version }` — il client usa la versione per forzare subito il giro di polling successivo invece di aspettare il tick. `409` conflitto di stato. `403` azione riservata al facilitatore.

### 6.3 `GET /api/export`

Restituisce il verbale in markdown. Disponibile sempre, anche a ritiro in corso e con moduli incompleti.

### 6.4 Coda offline

Il client accoda le azioni in `localStorage` quando una POST fallisce, e le rigioca in ordine al ripristino. L'idempotenza su `actionId` rende l'operazione sicura anche se una richiesta era in realtà andata a buon fine prima di perdere la risposta.

Il banner di stato distingue tre casi, perché per il facilitatore sono situazioni diverse: `connesso`, `offline — 3 azioni in coda`, `errore di sincronizzazione`.

---

## 7. I moduli

### M0 — Setup

**Tetto rigido: 15 minuti.** Se il setup si mangia mezz'ora, il ritiro è già compromesso. Precarica tutto ciò che è precaricabile.

**Seed obbligatorio** in `server/seed.ts`, tutto modificabile a runtime:

```
Partecipanti: Roberto, Valentina, Alessandro, Grazia, Michela, Sofia

Servizi (fatturato a 0, da compilare a voce):
  - Venture Building
  - CXO as a Service
  - Programmi di Open Innovation
  - Analisi di mercato e deck strategici
  - Consulenza AI a PMI e corporate

Attori ecosistema:
  Corporate, PMI, Startup, Investitori, Vendor tecnologici,
  Talenti, Enti pubblici, Impacta Strategy

Competitor:
  - Venture builder tradizionali
  - Boutique di consulenza AI
  - Big consulting in movimento sull'AI
  - Innovation hub interni al cliente
  - Freelance senior con stack AI
  - Il cliente che si fa le cose da solo con l'AI     [OBBLIGATORIA — non rimuovibile]

Vincoli: R=8, G=12, B=5   (placeholder, da rivedere in sala)
```

**Criteri di accettazione**
- Il facilitatore arriva a un tavolo utilizzabile in meno di 5 minuti partendo dal seed
- Ogni campo ha default sensato; nessun campo blocca l'avanzamento
- I partecipanti si uniscono scansionando il QR e scegliendo il proprio nome da una lista
- Toggle di presenza su ogni partecipante, un tap

---

### M1 — Lo smontaggio

**Il modulo centrale. Tutto il resto dipende dal suo output.** Con 5 servizi e 6 persone, un servizio sta in 15-20 minuti.

#### Passo 1 — Scomposizione (plenaria, sul Tavolo, non commit cieco)

Il facilitatore scompone il servizio in 4-7 attività e assegna a ciascuna una **quota del prezzo storico**. Le quote devono sommare a 100%: il tool lo forza con un vincolo visivo (barra che si riempie).

Testo da mostrare nell'interfaccia, letteralmente:

> La quota è del **prezzo**, non dello sforzo. Sono cose diverse, ed è la differenza tra le due che stiamo cercando.

Suggerimenti di scomposizione precaricati per i servizi seed (l'utente può ignorarli):
- *Analisi di mercato*: raccolta dati, sintesi e benchmark, interpretazione, confezionamento, accesso e relazioni
- *CXO as a Service*: presenza e disponibilità, decisioni prese, esecuzione operativa, reporting, rete attivata
- *Venture Building*: selezione dell'opportunità, costruzione, go-to-market, gestione dei rapporti, uscita

#### Passo 2 — Destinazione (commit cieco, 4 minuti)

Sulla Mano, ogni partecipante assegna a ciascuna attività: `AI`, `UMANO`, `MORTA`.

UI della Mano: una lista di attività, tre bottoni grandi per riga. Deve essere completabile con un pollice in meno di 60 secondi.

#### Passo 3 — Reveal

Il Tavolo mostra la barra del servizio segmentata per attività, larga, dominante. Colori:
- `AI` → `--ink-faint`, riempimento pieno
- `UMANO` → `--live`, riempimento pieno
- `MORTA` → `--erosion`, tratteggio
- Divergenza → segmento a strisce diagonali, con etichetta `3 AI / 2 UMANO / 1 MORTA`

#### Passo 4 — Il residuo

Grande, al centro, in mono: **residuo umano = somma delle quote a maggioranza `UMANO`**.

Poi la domanda del modulo, che è la sola cosa che conta:

> Il residuo, venduto da solo, quanto vale?

Tre risposte, votate in plenaria, con esito automatico:

| Risposta | Bucket | Significato |
|---|---|---|
| Meno del vecchio prezzo | `PORTA` | In commoditizzazione. Si tiene solo se apre relazioni — e si regala |
| Uguale o più | `NUCLEO` | Facevate pagare la parte sbagliata. Stesso prezzo, un decimo del lavoro |
| Niente | `CHIUSO` | Il servizio muore |

#### Passo 5 — Lock

Il catalogo si blocca nei tre bucket.

**Criteri di accettazione**
- Il residuo si aggiorna in tempo reale mentre si spostano le destinazioni in fase di discussione
- Vista di confronto: tutti i servizi già smontati, barre affiancate, ordinabili per residuo
- Un servizio non può essere marcato `CHIUSO` senza che almeno una persona lo abbia esplicitamente richiesto — evita chiusure per inerzia
- Il calcolo del residuo è una funzione pura in `shared/calc.ts` con test unitari

---

### M2 — Il ripricing

**Premessa da mostrare in testa al modulo:** se l'artefatto è quasi gratis, il prezzo non può più stare sul tempo impiegato.

Per ogni servizio in `NUCLEO`, commit cieco su una base primaria (e opzionalmente una secondaria):

| Base | Domanda di validazione mostrata accanto all'opzione |
|---|---|
| `ACCESSO` | "Pagherebbero per averci disponibili anche in un mese in cui non serve nulla?" |
| `ESITO` | "Il risultato è misurabile e attribuibile a noi?" |
| `PARTECIPAZIONE` | "Siamo disposti a legare il nostro guadagno al loro?" |
| `VOLUME` | "Esiste un flusso che si ripete e che possiamo presidiare?" |

Un servizio che non si aggancia a nessuna base resta `GIORNATA` e il tool lo marca `A GIORNATA — EROSIONE ATTESA`, in `--erosion`.

**Output del modulo, mostrato grande:**

> `X%` del fatturato futuro poggia su una base in erosione

**Criteri di accettazione**
- La percentuale di erosione alimenta l'indicatore Esposizione
- Il caso `PARTECIPAZIONE` mostra un campo libero per annotare la struttura ipotizzata (equity, revenue share, success fee)

---

### M3 — La mappa dei flussi

**Scopo: verificare o smentire l'ipotesi che WDA sia un layer fra operatori.** È una domanda a cui non si risponde ragionando, ma guardando i flussi.

**Passo 1.** Gli attori compaiono su un canvas SVG come nodi trascinabili. WDA è un nodo fisso al centro, non spostabile.

**Passo 2 — commit cieco.** Per ogni servizio in `NUCLEO` o `PORTA`, ogni partecipante traccia in privato quale connessione fra due attori quel servizio abilita. Non cosa consegna: cosa collega. Un servizio può non collegare nulla — è un esito valido e informativo.

Interazione: trascinamento da nodo a nodo. Su mobile deve funzionare con un tap sul nodo di partenza e un tap su quello di arrivo (il drag su touch è troppo fragile).

**Passo 3 — reveal sovrapposto.** Tutte le mappe si sovrappongono. Spessore dell'arco proporzionale al numero di persone che l'hanno tracciato. Gli archi tracciati da una sola persona restano visibili sottili: sono ipotesi individuali, non rumore.

**Passo 4 — le due letture.**

*Sul servizio*: un servizio che non genera archi è consulenza tradizionale in erosione. Marcato automaticamente.

*Sulla posizione*: conteggio dei flussi **distinti** su cui siede WDA, sempre visibile in alto a destra.

| Flussi distinti | Diagnosi mostrata |
|---|---|
| 0-1 | Intermediario sostituibile |
| 2-3 | Layer parziale |
| 4+ | Infrastruttura |

**Criteri di accettazione**
- Il canvas funziona su touch senza drag continuo
- Toggle "solo io" / "tutti", disponibile solo dopo il reveal
- Il conteggio dei flussi distinti è una funzione pura testata

---

### M4 — Il posizionamento

**Passo 1 — assi (plenaria).** Il team definisce due assi. Proposte precaricate, non imposte:
- `leva AI ↔ leva umana`
- `fee-for-service ↔ skin in the game`
- `esecuzione ↔ advisory`
- `pochi clienti profondi ↔ molti clienti leggeri`

Gli assi si ridefiniscono in corsa; le mappe precedenti restano come versioni.

**Passo 2 — doppio piazzamento (commit cieco).** Ognuno piazza `OGGI` e `12 MESI`. I competitor sono opzionali.

**Passo 3 — reveal.** Il tool calcola: centroide `OGGI`, dispersione `OGGI`, centroide `12 MESI`, dispersione `12 MESI`, e il **vettore** fra i due centroidi.

> Il vettore è la strategia, disegnata. È l'artefatto principale del modulo.

**Comportamento diagnostico obbligatorio.** Se la dispersione su `OGGI` supera la soglia, il Tavolo mostra:

> Alta divergenza su dove siete adesso. Non essere d'accordo su dove andare è normale. Non essere d'accordo su dove si è già significa che state lavorando in aziende diverse.

**Criteri di accettazione**
- Piazzamento con tap su mobile, non solo drag
- Il vettore è visivamente dominante nella vista post-reveal
- Le versioni degli assi sono navigabili

---

### M5 — Le carte avversarie

**Il timer è il meccanismo, non decorazione.** Distingue "abbiamo una risposta" da "ce la costruiamo mentre parliamo".

**Passo 1.** Il facilitatore pesca. La carta compare sul Tavolo. Il tool assegna a rotazione a un partecipante presente.

**Passo 2 — 90 secondi.** Il timer diventa l'elemento visivo dominante dello schermo. Chi ha pescato risponde a voce a:

> Perché un cliente sceglie noi e non loro?

**Passo 3 — voto lampo.** Alla scadenza, tutti gli altri votano in privato: `convincente` / `non convincente`. Due bottoni grandi sulla Mano, nient'altro a schermo. Reveal immediato.

Maggioranza di "non convincente" → **vulnerabilità aperta**.

**Passo 4 — il tabellone.** Le vulnerabilità aperte restano visibili in una fascia laterale su **tutti** i moduli successivi, non solo in M5. Si chiudono solo quando qualcuno propone una risposta e il team la vota convincente in un round successivo.

**Criteri di accettazione**
- Il voto richiede un solo tap
- La fascia vulnerabilità è visibile in ogni modulo dopo M5
- La carta "Il cliente che si fa le cose da solo con l'AI" non è rimuovibile dal mazzo

---

### M6 — La soglia di sostenibilità

**Correzione di impostazione da mostrare in testa al modulo:** l'80% non è un tetto da rispettare, è un pavimento da difendere. All'inizio può essere 90% o più. La domanda non è come dividere la torta, ma qual è il minimo di ricavi da servizi che tiene in vita il team mentre Forge matura.

**Passo 1 — commit cieco, reveal anonimo.** Questo è l'unico modulo con reveal anonimo per default: una soglia di rischio personale è più onesta se non deve essere difesa.

Ognuno scrive: soglia di sicurezza (%), mesi di autonomia, trigger di allarme (testo libero).

**Passo 2 — reveal.** Le soglie compaiono come punti su un asse 0-100%, senza nomi. I trigger compaiono come lista, mescolata.

**Passo 3 — la forbice.** Distanza fra la soglia più prudente e la più aggressiva, mostrata grande.

> La forbice è il vero output del modulo. È il dato che in un team non viene mai messo sul tavolo, e che spiega retroattivamente metà dei conflitti operativi dei mesi successivi.

**Passo 4 — lock.** Si negozia una soglia unica. Il tool registra sia la soglia condivisa sia la forbice originale. Entrambe finiscono nel verbale.

**Passo 5 — traiettoria.** Distribuzione su 4 trimestri da qui a gennaio 2027, con mix risultante e consumo dei vincoli `R`, `G`, `B` per trimestre.

**Criteri di accettazione**
- L'anonimato del reveal è garantito lato server, non solo nell'interfaccia
- La forbice è la cosa più grande a schermo dopo il reveal
- La traiettoria è modificabile trascinando, non compilando campi

---

### M7 — Gli invarianti

Copre il blocco "criteri di naming/branding" dell'agenda. **Il tool non decide il brand.**

Il team elenca affermazioni sulla proposition e per ciascuna vota se resta valida in entrambi gli scenari (brand autonomo vs sub-brand con partner industriale tipo "Impacta Innovation") o solo in uno.

Commit cieco su ogni affermazione: `ENTRAMBI` / `SOLO AUTONOMO` / `SOLO SUB-BRAND`.

Output: due liste. **Gli invarianti** — ciò che si può cominciare a costruire da subito perché regge comunque. **I condizionati** — ciò che resta in sospeso fino all'esito della trattativa.

**Criteri di accettazione**
- Le due liste sono esportabili separatamente nel verbale
- Ogni condizionato porta con sé l'indicazione di quale scenario lo abilita

---

### M8 — L'action plan

**È l'output dichiarato del ritiro e non può mancare.** Senza questo modulo il tool produce diagnosi che nessuno esegue.

Il modulo si alimenta automaticamente: ogni lock genera una proposta di azione precompilata, che il team accetta, modifica o scarta.

Ogni azione richiede tre campi, tutti obbligatori:

| Campo | Vincolo |
|---|---|
| Testo | Verbo all'infinito, una riga |
| Owner | Un solo partecipante. **Mai "tutti", mai "il team"** |
| Scadenza | Data entro gennaio 2027 |

Due orizzonti: `90 GIORNI` (entro fine ottobre 2026) e `A GENNAIO 2027`.

**Controlli obbligatori mostrati sul Tavolo prima della chiusura:**
- Distribuzione delle azioni per owner. Se una persona ha più del 40% delle azioni, il tool lo segnala
- Azioni senza owner o senza data: bloccano la chiusura del modulo
- Lock senza nessuna azione discendente: segnalati come `decisione senza esecuzione`

**Criteri di accettazione**
- Impossibile chiudere M8 con anche una sola azione priva di owner o scadenza
- La vista per owner è disponibile e stampabile
- Ogni azione è tracciabile al lock da cui discende

---

### M9 — Il verbale

Genera un documento markdown scaricabile, senza che nessuno debba scriverlo.

Contenuto, in quest'ordine:

1. Le decisioni bloccate, cronologiche
2. Per ogni decisione, chi ha dissentito e su cosa — **il dissenso non viene cancellato dal lock**
3. Il catalogo nei tre bucket, con residuo umano per servizio
4. Le basi di prezzo e la percentuale in erosione
5. La diagnosi di posizione (layer / intermediario / infrastruttura)
6. Il vettore di posizionamento
7. Le vulnerabilità ancora aperte
8. La soglia condivisa e la forbice originale
9. Invarianti e condizionati
10. L'action plan, per owner e per orizzonte
11. La mappa cappello × persona
12. Le decisioni riaperte e quante a valle restano da riconvalidare

**Il verbale non contiene punteggi, classifiche o valutazioni delle persone.**

Export disponibile in qualsiasi momento, non solo a fine ritiro. Salvataggio automatico di una copia in `backups/` a ogni lock.

---

## 8. Sistema visivo

### 8.1 Direzione

**Control room, non workshop.** Densa, scura, strumentale. Il riferimento è una sala operativa, non un'app di produttività e non una lavagna da facilitazione.

Il tono comunica cosa ci si aspetta: un'interfaccia pastello con angoli tondi dice "esprimiti liberamente", una densa e strumentale dice "qui si decide". Serve la seconda.

### 8.2 Token

```css
:root {
  --bg-deep:      #0C0E11;
  --bg-panel:     #14171C;
  --bg-raised:    #1C2027;
  --line:         #262B33;
  --line-strong:  #39414D;

  --ink:          #E6E8EB;
  --ink-dim:      #8B939F;
  --ink-faint:    #5A626D;

  --live:         #4ADE9B;   /* attivo, commit ricevuto, residuo umano */
  --tension:      #F0A742;   /* divergenza, timer in scadenza */
  --erosion:      #E8674A;   /* erosione, vulnerabilità, chiuso */
  --locked:       #6B8AFF;   /* artefatto bloccato */

  --radius:       2px;
  --grid:         4px;
}
```

Un solo accento per volta a schermo. Il colore codifica stato, mai decorazione. Nessuna ombra, nessun gradiente.

### 8.3 Tipografia

| Ruolo | Scelta | Fallback |
|---|---|---|
| Interfaccia | Söhne, o Basis Grotesque, o Suisse Int'l | `system-ui` |
| Numeri e dati | Berkeley Mono, o JetBrains Mono | `ui-monospace` |
| Display (timer, residuo) | Lo stesso mono, taglia grande | |

**Mai Inter, mai Roboto.**

Tutti i numeri sono in mono con cifre tabulari, senza eccezioni. È una scelta funzionale: le cifre tabulari non ballano mentre si aggiornano in tempo reale, e la percezione di strumentazione viene da lì.

### 8.4 Regole di comportamento

- **Tutto sempre a schermo.** Nessun accordion, nessun tab durante una sessione attiva. Se non ci sta, il modulo è troppo carico
- **Le carte hanno peso.** Servizi e competitor si trascinano con inerzia e resistenza. È l'unico punto in cui si spende budget di animazione oltre al reveal
- **I numeri sono live.** Ogni valore calcolato si aggiorna mentre si manipola l'input, senza conferme
- **Il timer è onnipresente**, in alto, su entrambe le viste
- **Il reveal è l'unico momento coreografato**

### 8.5 Copy

Sentence case ovunque. Verbi attivi. Nessun punto esclamativo. Nessun incoraggiamento.

| Scrivi | Non scrivere |
|---|---|
| `4 su 6 hanno confermato` | `Quasi tutti hanno votato!` |
| `Divergenza massima: interpretazione` | `Ci sono opinioni diverse 🤔` |
| `Bloccato — 3 dissensi registrati` | `Decisione presa con successo!` |
| `Residuo umano 18%` | `Solo il 18% resta umano, attenzione` |

Il tool riporta. Non commenta, non incoraggia, non allarma.

### 8.6 La Mano

Interfaccia separata, non una versione ridotta del Tavolo.

- Un solo compito a schermo per volta
- Bersagli di tocco minimo 48px
- Completabile con un pollice
- Mostra sempre: il proprio cappello, il timer, lo stato del proprio commit
- Non mostra mai dati aggregati durante la fase `COMMIT`

---

## 9. Vista facilitatore

Il facilitatore ha un pannello di controllo sul Tavolo, accessibile con un tasto, che consente:

- Avviare, fermare, estendere il timer
- Forzare il passaggio di stato
- Distribuire i cappelli
- Vedere lo stato di ogni dispositivo — serve a distinguere "non ha deciso" da "wifi caduto"
- Marcare un partecipante come assente
- Riaprire un lock
- Esportare il verbale
- **Modalità panico**

**Presenza senza WebSocket.** Non esistendo una connessione persistente, la presenza si deduce dal polling: ogni `GET /api/state` aggiorna `lastSeen` per quel `pid`. Un partecipante silenzioso da più di 10 secondi viene mostrato come `disconnesso`. È il modo in cui il facilitatore capisce se un commit mancante è indecisione o rete.

**Modalità panico.** Tre funzioni, tutte necessarie:
- Ripristino da uno degli snapshot `backup:{ts}` in Redis, con anteprima prima di confermare
- Editor JSON grezzo dello stato, con validazione dello schema prima della scrittura
- Scarica stato / carica stato, come file, per poter riparare offline e ricaricare

Non è un lusso. In un ritiro di due giorni con un tool costruito in fretta, poter sistemare a mano uno stato corrotto è ciò che separa un intoppo da un disastro.

---

## 10. Anti-pattern

Cose che sembrano buone idee e degradano il prodotto.

| Anti-pattern | Perché degrada |
|---|---|
| Badge, punti, livelli, coriandoli | Con un team senior brucia la credibilità immediatamente |
| Un vincitore a fine sessione | Trasforma la divergenza in competizione. La divergenza è il dato, non un torto |
| Setup lungo e completo | Un terzo del tempo si perde a inserire dati che si riveleranno sbagliati |
| Canvas libero infinito | Produce superfici bellissime e decisioni zero |
| Anonimato ovunque | Toglie proprietà delle posizioni. Solo M6 lo richiede |
| Mediare automaticamente le posizioni | Il tool che calcola la media e la propone ammazza la discussione che deve avvenire |
| Commit modificabile dopo il reveal | Distrugge il commitment e rende il dato inutile |
| Vincolare sulle ore-uomo | Misura la risorsa che l'AI ha reso abbondante |
| **Suggerimenti AI durante il commit** | Se il tool suggerisce, i commit convergono verso il suggerimento e il reveal non dice più niente |

L'ultimo merita una riga in più. È forte la tentazione di mettere un assistente che propone destinazioni, basi di prezzo o posizionamenti. **Non implementarlo.** Se serve, va in una fase separata dopo il lock, dichiarata come tale: *"ecco cosa avrebbe risposto un osservatore esterno"*. Mai prima, mai durante.

---

## 11. Test

### 11.1 Test obbligatori prima del ritiro

| # | Test | Criterio |
|---|---|---|
| 1 | **Commit cieco** | `GET /api/state?pid=B` non contiene il commit di A nella stringa JSON grezza, con sessione in `COMMIT` |
| 2 | Immutabilità | `commit.set` dopo il reveal risponde 409 |
| 3 | Anonimato M6 | Le risposte di M6 non contengono `partecipanteId` associabile, nemmeno dopo il reveal |
| 4 | Idempotenza | Stessa `actionId` inviata due volte produce un solo effetto |
| 5 | Concorrenza | 6 `commit.set` simultanei sulla stessa sessione: tutti e 6 persistiti, nessuno perso |
| 6 | Lock ottimistico | Due `entity.upsert` simultanei su `room:state`: nessuna sovrascrittura silenziosa |
| 7 | Calcolo residuo | Funzione pura, casi limite: quote non sommanti a 100, pareggi nelle destinazioni |
| 8 | Flussi distinti | Funzione pura, archi duplicati contati una volta |
| 9 | Coda offline | Rete staccata durante il commit, riattivata: il commit accodato arriva senza doppioni |
| 10 | Reveal sincronizzato | 6 client, scarto di avvio animazione sotto i 300ms |
| 11 | Chiusura M8 | Impossibile chiudere con azioni prive di owner o data |
| 12 | Export | Verbale generato correttamente con dati parziali |

### 11.2 Prova generale

Due prove, entrambe obbligatorie.

**In locale**, `next dev` con Redis reale: ciclo completo di M1 con 6 tab. Cronometra. Se un round richiede più di 20 minuti, semplifica l'interfaccia della Mano.

**In produzione, da rete mobile**, prima di partire per la sede: stesso ciclo, su Vercel, con almeno due dispositivi fisici diversi. È l'unico test che verifica davvero le condizioni del ritiro.

---

## 12. Sequenza di build

Ordinata per valore decrescente. **Taglia dal fondo, mai dal principio.**

| Fase | Contenuto | Copre |
|---|---|---|
| **0** | Progetto Next.js su Vercel, integrazione Upstash, deploy vuoto funzionante | 20 minuti. Falla per prima: un deploy rotto scoperto a notte fonda è la cosa peggiore |
| **1** | `/api/state` con `filterStateFor`, `/api/action`, polling adattivo, ciclo commit/reveal/lock, due viste, timer, test #1 e #2 | Il cuore. Senza questo niente funziona |
| **2** | M0 seed + M1 smontaggio completo | Giorno 5 pomeriggio |
| **3** | M9 verbale + export | Rende utilizzabile qualsiasi cosa fatta finora |
| **4** | M2 ripricing + M8 action plan | Giorno 6, e l'output dichiarato del ritiro |
| **5** | M5 competitor + M6 soglia | Sessione 3 del giorno 6 |
| **6** | M4 posizionamento | Sostituibile con lavagna fisica senza gran danno |
| **7** | M3 flussi | Il più costoso. **Non sostituibile a mano** — su carta la mappa si sporca subito e si perde il confronto fra partecipanti, che è il suo unico valore |
| **8** | M7 invarianti, cappelli, indicatori, riapertura lock | Rifinitura |

**Se arrivi solo alla fase 3**, hai comunque un tool che regge tutto il pomeriggio del giorno 5 e produce un verbale. È una soglia di successo accettabile.

**Se arrivi alla fase 5**, copri l'intero ritiro.

---

## 13. Questioni aperte

Da risolvere in sala, non in codice. Il tool deve supportare entrambe le opzioni dove indicato.

1. **Il reveal attribuito di M1 regge?** Se l'attribuzione impedisce alle persone di marcare `MORTA` un servizio costruito da un collega presente, va reso anonimo. **Implementa il flag `revealAnonimo` come toggle per sessione**, così si può cambiare in corsa dopo il primo round.

2. **I vincoli R, G, B sono stimabili?** Se il team non riesce a dare numeri, il tool passa alla modalità qualitativa. Entrambe le modalità vanno implementate in M0.

3. **Forge resta fuori dai moduli.** Consapevole: il tool serve a decidere da cosa liberarsi per fare spazio. Forge entra solo come vincolo di tempo in M6 e come cappello `COSTRUTTORE`.

4. **Uso post-ritiro.** I lock e l'action plan hanno valore fino a gennaio 2027. Serve una vista di sola lettura e una revisione trimestrale. **Fuori scope per il 5 agosto**, ma non chiudere il modello dati in modo che lo impedisca.
