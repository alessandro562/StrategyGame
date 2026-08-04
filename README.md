# WDA Strategy Room

Applicazione per condurre il ritiro strategico WDA del 5-6 agosto 2026.
Implementazione di [`WDA-Strategy-Room-BUILD.md`](./WDA-Strategy-Room-BUILD.md), che resta il documento di riferimento: dove questo README e la specifica divergono, vince la specifica.

Next.js 15 su Vercel, stato su Redis serverless, sincronizzazione via polling versionato. Nessun WebSocket.

---

## Avvio in locale

```bash
npm install
npm run dev            # http://localhost:3000
```

Senza credenziali Upstash lo stato vive in memoria: comodo per sviluppare, inutilizzabile per il ritiro (sparisce a ogni riavvio del processo e non è condiviso fra istanze). La home lo dice in chiaro con un avviso.

Per lavorare con Redis vero, copiare `.env.example` in `.env.local` e riempire `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

## Deploy

Su Vercel serve un database Redis: aggiungere **Upstash for Redis** dal marketplace (Storage → Create Database), collegarlo al progetto e **rifare il deploy** — le variabili si leggono all'avvio, un deploy precedente non le vede.

L'app accetta due nomenclature, perché cambiano a seconda di come è collegato il database: `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (integrazione Upstash classica) oppure `KV_REST_API_URL` / `KV_REST_API_TOKEN` (marketplace Vercel). Ne basta una.

**Se mancano entrambe, su Vercel l'app si rifiuta di partire** e lo dice in chiaro. È voluto: lì lo store in memoria non fallirebbe, farebbe di peggio — ogni invocazione atterra su un'istanza diversa, quindi perderebbe commit a caso e ve ne accorgereste al reveal. La home mostra `redis collegato` o `redis non configurato`: è il primo posto da guardare dopo un deploy.

**Tenere `next` aggiornato.** Quando una versione di Next ha una vulnerabilità nota, npm la marca deprecata e **Vercel rifiuta di deployarla**: il build compila fino in fondo, stampa la tabella delle route, e poi il deployment fallisce senza che il log dica granché. Se succede, il sintomo è un `npm warn deprecated next@<versione>: This version has a security vulnerability` fra le prime righe del log. Si verifica con:

```bash
npm view next@$(node -p "require('./package.json').dependencies.next.replace('^','')") deprecated
```

Vuoto significa che va bene; una frase significa che serve aggiornare.

## Le due viste

| Rotta | A chi serve |
|---|---|
| `/tavolo?r=ritiro` | Proiettata in sala. Mostra il QR di accesso in permanenza |
| `/mano?r=ritiro` | I dispositivi dei partecipanti |

Il primo che entra prende il ruolo di facilitatore. Se il ruolo è già di un altro schermo compare **Prendi il ruolo** in alto a destra: serve un gesto esplicito, così due Tavoli aperti non se lo passano avanti e indietro.

Il pannello facilitatore si apre dal bottone in alto a destra o con `Cmd/Ctrl+F`.

**Dimensione della vista di sala.** In alto a destra, `A−` / `A+`. Il Tavolo sta a tre metri dalle persone, non a cinquanta centimetri, e nessun valore fisso va bene per tutti i proiettori: si regola una volta in sala e resta. La preferenza è locale allo schermo.

## Accessi

Ogni persona entra con **email e password**, volutamente leggere: nessuna verifica via mail, nessun requisito di complessità, minimo quattro caratteri. Al primo ingresso si sceglie il proprio nome dalla lista con un tocco — l'account prende quel posto al tavolo invece di aggiungerne un settimo.

Due cose però non sono negoziabili, e non costano nulla:

- **le password non esistono mai in chiaro** (scrypt con sale per utente, confronto a tempo costante);
- **l'identità viene dal cookie di sessione firmato dal server, mai da un parametro nell'URL**. Prima bastava cambiare un campo JSON per presentarsi come chiunque; ora il commit cieco poggia su una base vera. Il punto unico da cui si ricava chi sta parlando è `lib/sessione.ts`.

Il segreto di firma vive su Redis e si crea da solo: non serve configurare nulla su Vercel.

---

## Il commit cieco

È il cuore del prodotto, ed è il punto in cui l'implementazione può fallire in silenzio. Le regole vivono tutte in [`lib/guards.ts`](./lib/guards.ts).

**Esiste una sola funzione da cui esce stato verso un client: `filterStateFor()`.** Nessuna route serializza `Store` direttamente. Per verificarlo: ogni `NextResponse.json` dentro `app/api` o passa da lì, o restituisce un oggetto senza stato (`{ version }`).

- durante `COMMIT` la Mano riceve solo il proprio commit, il Tavolo nessuno — al Tavolo arriva `{ committed, total, confermatiIds }`, chi ha confermato e mai cosa;
- `commit.set` dopo il reveal risponde `409`. Un cambio di opinione si registra come `discussion.note`;
- con `revealAnonimo` i `partecipanteId` spariscono anche dopo il reveal, sostituiti da indici mescolati.

**Il seme dell'anonimato è un segreto di server** (`room:anon-secret`), non l'id di sessione. L'id di sessione e la lista dei partecipanti sono entrambi pubblici e la funzione di mescolamento è nel bundle: derivare la permutazione da quelli renderebbe M6 de-anonimizzabile con gli strumenti di sviluppo. La specifica chiede che l'anonimato sia garantito lato server, non nell'interfaccia.

Le due difese sono indipendenti e si sommano: l'autenticazione stabilisce **chi** sei, il filtro decide **cosa** ti arriva. Anche riuscendo a presentarsi come un altro non si otterrebbe nulla di più, perché il filtro consegna solo ciò che quella persona possiede.

---

## Test

```bash
npm test               # 87 test unitari
```

Coprono i punti di §11.1 più gli accessi: password mai in chiaro, sessioni non falsificabili, commit cieco verificato **sulla stringa JSON grezza**, immutabilità dopo il reveal, anonimato di M6, idempotenza, sei commit simultanei, lock ottimistico, residuo con quote che non sommano a 100 e con pareggi, flussi distinti con archi duplicati, chiusura di M8, export con dati parziali.

### Prova generale

```bash
npm run build && npm start &
BASE=http://127.0.0.1:3000 npm run prova
```

65 controlli sul ciclo completo contro il server HTTP reale, su una stanza vergine. **Prima di partire per la sede, ripeterla contro il deploy di produzione da rete mobile, con almeno due dispositivi fisici diversi.** È l'unico test che verifica davvero le condizioni del ritiro: un deploy che funziona in ufficio e non in sede è il fallimento più stupido possibile.

```bash
BASE=https://<progetto>.vercel.app npm run prova
```

La prova lascia dentro le sue sessioni e i suoi commit — c'è una sola stanza per deploy. Dopo averla eseguita in produzione, **azzerare dal pannello facilitatore → Modalità panico → Riporta tutto al seed**, altrimenti il ritiro comincia con dentro la roba di prova. L'azzeramento prende uno snapshot prima di cancellare, quindi è reversibile.

---

## Marchio

I file del logo caricati nel repository stanno in `public/brand/`. Il blu WDA campionato dai PNG è **`#3D6C92`**.

Il sistema visivo resta quello della specifica — control room densa e scura, un solo accento per volta, il colore codifica stato e mai decorazione — con il marchio innestato in tre punti:

| Token | Valore | Uso |
|---|---|---|
| `--wda` | `#3D6C92` | Riempimenti e superfici: nodo WDA sulla mappa, barre di traiettoria |
| `--wda-bright` | `#6FA3CE` | Testi e tratti fini: sul fondo scuro il blu del logo non ha contrasto sufficiente |
| `--locked` | `#6FA3CE` | Artefatto bloccato — era `#6B8AFF` nella specifica |

`--locked` è l'unico token semantico spostato, e non è una scelta estetica: un artefatto bloccato è WDA che ha deciso, quindi identità e semantica coincidono senza forzature. I colori di stato — `--live`, `--tension`, `--erosion` — restano quelli della specifica: sono lì per dire cosa sta succedendo, non per assomigliare al marchio.

Sui fondi scuri si usa la variante bianca del logo; la blu resta per superfici chiare (stampe, export).

Tipografia: stack di sistema, nessun font scaricato (**mai Inter, mai Roboto**). Tutti i numeri in mono con cifre tabulari: non ballano mentre si aggiornano, ed è da lì che viene la percezione di strumentazione.

### Leggibilità e ritmo

Il documento vieta badge, punti, livelli e celebrazioni: con un team senior bruciano la credibilità in un minuto. Il coinvolgimento quindi non viene da lì, ma dal sapere sempre tre cose — in che punto siamo, cosa ci si aspetta da me, quanto manca:

- una **fascia di fase** su entrambe le viste dice cosa sta succedendo adesso e cosa tocca a chi guarda;
- durante il `COMMIT` il Tavolo mostra il **tempo che resta, grande**, e le **domande dei cappelli** — che sono esattamente ciò a cui le persone dovrebbero pensare mentre decidono. Prima quello schermo era quasi vuoto, proprio nel momento in cui tutti lo guardavano;
- i toni di grigio del testo secondario sono stati alzati: su un proiettore, e su uno schermo lucido in una stanza illuminata, i valori della prima stesura sparivano.

---

## Struttura

```
app/
  tavolo/page.tsx        vista di sala
  mano/page.tsx          vista partecipante
  api/state/route.ts     GET polling versionato + filtro
  api/action/route.ts    POST, tutte le mutazioni
  api/export/route.ts    GET verbale markdown, stato JSON, backup
lib/
  guards.ts              ENFORCEMENT DEL COMMIT CIECO — file critico
  store.ts               load/save, lock ottimistico, backup, presenza
  handlers.ts            un handler per tipo di azione
  calc.ts                calcoli derivati, puri e testati
  verbale.ts             generazione del verbale
  redis.ts               Upstash via REST, con fallback in memoria
  seed.ts, types.ts, actions.ts
src/
  net/                   polling adattivo, coda offline, bozza locale
  modules/M0…M9/         un file per modulo, esporta la vista Tavolo e la Mano
  components/            Timer, CommitBar, RevealStage, LockButton, …
  styles/tokens.css      sistema visivo
scripts/prova-ciclo.mjs  prova generale contro il server reale
tests/                   test unitari
```

---

## Come funziona la sincronizzazione

`GET /api/state?v={versione}&pv={presenza}&pid={id}&r={stanza}` → `204` se nulla è cambiato, `200 { version, presence, state }` altrimenti. Nella stragrande maggioranza dei tick la risposta è un 204 vuoto.

Cadenza adattiva: `COMMIT` 1000ms, `REVEAL` 400ms, `DISCUSSIONE`/`LOCKED` 2000ms, tab in background 5000ms.

**Il reveal** parte all'orario indicato da `revealAt` (server + 1500ms), non alla ricezione: è ciò che lo fa partire insieme su sei dispositivi anche se le risposte arrivano scaglionate.

**La presenza** si deduce dal polling: ogni `GET` aggiorna `lastSeen`, oltre 10 secondi di silenzio il partecipante risulta disconnesso. Serve al facilitatore per distinguere "non ha deciso" da "wifi caduto". La firma della presenza viaggia insieme alla versione, così un cambio di connessione produce un `200` anche a stato invariato senza incrementare `room:version` a ogni giro.

**La concorrenza**: i commit vivono su chiavi separate (`commit:{sessione}:{partecipante}`) e non collidono mai per costruzione. Le scritture su `room:state` usano una compare-and-set atomica (script Lua su Upstash) con tre tentativi e ritardo casuale crescente — senza il ritardo due scrittori in conflitto riproverebbero nello stesso istante e continuerebbero a scontrarsi.

**Offline**: l'ultimo stato resta in `localStorage` e la vista è leggibile in sola lettura con banner esplicito. Le azioni si accodano e si rigiocano alla riconnessione; l'idempotenza su `actionId` rende sicuro ritentare anche quando la richiesta era passata ma la risposta no. Il banner distingue `connesso`, `offline — N azioni in coda`, `errore di sincronizzazione`.

**La bozza locale**: il polling ha sempre un giro di ritardo, quindi la Mano tiene una copia locale del commit in compilazione. Senza, due tocchi ravvicinati leggono lo stesso stato vecchio e il secondo cancella il primo — chi compila cinque righe con il pollice in dieci secondi si ritroverebbe con una sola scelta registrata.

---

## Scelte non fissate dalla specifica

Dove il documento non specifica, si è scelta l'opzione più semplice che soddisfa i criteri di accettazione.

- **Fallback in memoria per Redis.** Senza credenziali l'app parte lo stesso, così `next dev` non richiede dipendenze esterne. La home avvisa che lo stato è effimero.
- **`workshop.setFacilitatore` e `workshop.update`** aggiunte all'elenco delle azioni: servivano un modo per rivendicare il ruolo e uno per modificare vincoli e soglia condivisa.
- **Il Tavolo non è un partecipante.** Si presenta per prendere il ruolo, non per sedersi: altrimenti falserebbe ogni "4 su 6" e ogni distribuzione di cappelli.
- **Pareggio nelle destinazioni**: l'attività non ha esito, non entra nel residuo e viene marcata divergente. Il tool non scioglie il pareggio al posto del team.
- **Quote che non sommano a 100**: il residuo si normalizza sul totale effettivo, così resta leggibile anche con un catalogo a metà.
- **Scadenza del timer**: senza un processo persistente la transizione a `REVEAL` si applica pigramente alla prima lettura utile, acquisendo i commit incompleti allo stato in cui sono.
- **Backup su Redis, non su filesystem.** Le funzioni Vercel non hanno disco scrivibile; la modalità panico copre il caso file con *scarica stato* / *carica stato*.
- **Chi ha confermato è visibile anche nei round anonimi.** È il contenuto a dover restare segreto, non la partecipazione, e al facilitatore serve sapere chi manca.

## Cosa il tool non fa, per scelta

Nessun punteggio, nessun livello, nessun vincitore, nessuna celebrazione. Il verbale non contiene valutazioni delle persone.

**Nessun suggerimento AI durante il commit.** Se il tool suggerisce, i commit convergono verso il suggerimento e il reveal non dice più niente.
