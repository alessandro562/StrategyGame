# WDA Strategy Room

Applicazione per condurre il ritiro strategico WDA del 5-6 agosto 2026.
Implementazione di [`WDA-Strategy-Room-BUILD.md`](./WDA-Strategy-Room-BUILD.md), che resta il documento di riferimento: dove questo README e la specifica divergono, vince la specifica.

Next.js 15 su Vercel, stato su Redis serverless, sincronizzazione via polling versionato. Nessun WebSocket, nessun account: si entra con il codice stanza nell'URL.

---

## Avvio in locale

```bash
npm install
npm run dev            # http://localhost:3000
```

Senza credenziali Upstash lo stato vive in memoria: comodo per sviluppare, inutilizzabile per il ritiro (sparisce a ogni riavvio del processo e non è condiviso fra istanze). La home lo dice in chiaro con un avviso.

Per lavorare con Redis vero, copiare `.env.example` in `.env.local` e riempire `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

## Deploy

```bash
vercel --prod
```

Su Vercel: aggiungere l'integrazione **Upstash Redis** dal marketplace. Inietta le variabili d'ambiente da sola, non c'è configurazione manuale.

## Le due viste

| Rotta | A chi serve |
|---|---|
| `/tavolo?r=ritiro` | Proiettata in sala. Mostra il QR di accesso in permanenza |
| `/mano?r=ritiro` | I dispositivi dei partecipanti |

Il primo Tavolo che si apre prende il ruolo di facilitatore. Se il ruolo è già di un altro schermo compare **Prendi il ruolo** in alto a destra: serve un gesto esplicito, così due Tavoli aperti non se lo passano avanti e indietro.

Il pannello facilitatore si apre dal bottone in alto a destra o con `Cmd/Ctrl+F`.

---

## Il commit cieco

È il cuore del prodotto, ed è il punto in cui l'implementazione può fallire in silenzio. Le regole vivono tutte in [`lib/guards.ts`](./lib/guards.ts).

**Esiste una sola funzione da cui esce stato verso un client: `filterStateFor()`.** Nessuna route serializza `Store` direttamente. Per verificarlo: ogni `NextResponse.json` dentro `app/api` o passa da lì, o restituisce un oggetto senza stato (`{ version }`).

- durante `COMMIT` la Mano riceve solo il proprio commit, il Tavolo nessuno — al Tavolo arriva `{ committed, total, confermatiIds }`, chi ha confermato e mai cosa;
- `commit.set` dopo il reveal risponde `409`. Un cambio di opinione si registra come `discussion.note`;
- con `revealAnonimo` i `partecipanteId` spariscono anche dopo il reveal, sostituiti da indici mescolati.

**Il seme dell'anonimato è un segreto di server** (`room:anon-secret`), non l'id di sessione. L'id di sessione e la lista dei partecipanti sono entrambi pubblici e la funzione di mescolamento è nel bundle: derivare la permutazione da quelli renderebbe M6 de-anonimizzabile con gli strumenti di sviluppo. La specifica chiede che l'anonimato sia garantito lato server, non nell'interfaccia.

Il `pid` è identità, non autorizzazione: un pid inventato non apre nessuna porta, perché chi non possiede un commit non lo riceve. Il controllo vero è il filtro.

---

## Test

```bash
npm test               # 70 test unitari
```

Coprono i punti di §11.1: commit cieco verificato **sulla stringa JSON grezza**, immutabilità dopo il reveal, anonimato di M6, idempotenza, sei commit simultanei, lock ottimistico, residuo con quote che non sommano a 100 e con pareggi, flussi distinti con archi duplicati, chiusura di M8, export con dati parziali.

### Prova generale

```bash
npm run build && npm start &
BASE=http://127.0.0.1:3000 npm run prova
```

61 controlli sul ciclo completo contro il server HTTP reale, su una stanza vergine. **Prima di partire per la sede, ripeterla contro il deploy di produzione da rete mobile, con almeno due dispositivi fisici diversi.** È l'unico test che verifica davvero le condizioni del ritiro: un deploy che funziona in ufficio e non in sede è il fallimento più stupido possibile.

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
