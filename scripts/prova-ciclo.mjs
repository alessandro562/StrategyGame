/**
 * Prova generale del ciclo completo contro il server HTTP reale (§11.2):
 * registrazione -> sessione M1 -> COMMIT -> sei commit simultanei -> reveal ->
 * lock -> M6 anonimo -> action plan -> export.
 *
 * I controlli sul commit cieco guardano la stringa JSON grezza, non l'oggetto
 * deserializzato: è l'unico modo per accorgersi di un payload che viaggia e
 * viene solo nascosto dall'interfaccia.
 *
 * Uso:
 *   npm run build && npm start &
 *   BASE=http://127.0.0.1:3000 npm run prova
 *
 * Va eseguita su una stanza vergine: crea account, sessioni e commit propri, e
 * i conteggi presuppongono di partire da zero. Dopo averla eseguita in
 * produzione, azzerare dal pannello facilitatore.
 */

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
let falliti = 0;

function ok(cond, msg, extra = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) falliti++;
}

/* --- identità: ogni partecipante porta con sé il proprio cookie ------- */

function estraiCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    if (c.startsWith('wda_sessione=')) return c.split(';')[0];
  }
  return null;
}

async function registra(nome, email, password = 'prova') {
  const res = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ azione: 'registra', nome, email, password }),
  });
  const corpo = await res.json().catch(() => ({}));
  return { status: res.status, cookie: estraiCookie(res), id: corpo?.io?.id ?? null, nome, corpo };
}

let contatore = 0;
async function azione(chi, type, payload = {}, actionId) {
  const res = await fetch(`${BASE}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(chi?.cookie ? { cookie: chi.cookie } : {}) },
    body: JSON.stringify({ actionId: actionId ?? `a${++contatore}-${Math.random()}`, type, payload }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function stato(chi, ruolo = 'mano') {
  const res = await fetch(`${BASE}/api/state?v=-1&pv=&role=${ruolo}`, {
    headers: chi?.cookie ? { cookie: chi.cookie } : {},
  });
  if (res.status !== 200) return { status: res.status, grezzo: '', dati: null };
  const grezzo = await res.text();
  return { status: res.status, grezzo, dati: JSON.parse(grezzo) };
}

/* --- accessi ---------------------------------------------------------- */

console.log('\n— accessi ———————————————————————————————');
{
  const res = await fetch(`${BASE}/api/state?v=-1&pv=`);
  ok(res.status === 401, 'senza sessione /api/state risponde 401', `ha risposto ${res.status}`);
}
{
  const res = await fetch(`${BASE}/api/state?v=-1&pv=`, { headers: { cookie: 'wda_sessione=inventato' } });
  ok(res.status === 401, 'un cookie inventato risponde 401', `ha risposto ${res.status}`);
}
{
  const res = await fetch(`${BASE}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'x1', type: 'session.reveal', payload: { sessioneId: 'qualsiasi' } }),
  });
  ok(res.status === 401, 'senza sessione nessuna azione passa', `ha risposto ${res.status}`);
}

const NOMI = ['Roberto', 'Valentina', 'Alessandro', 'Grazia', 'Michela', 'Sofia'];
const suffisso = Math.random().toString(36).slice(2, 7);
const gente = [];
for (const nome of NOMI) {
  const u = await registra(nome, `${nome.toLowerCase()}.${suffisso}@prova.it`);
  if (u.status !== 200) console.log('   registrazione fallita', nome, u.status, JSON.stringify(u.corpo));
  gente.push(u);
}
ok(gente.every((g) => g.cookie), 'tutti hanno ricevuto un cookie di sessione');
ok(new Set(gente.map((g) => g.id)).size === 6, 'sei identità distinte');

const FAC = gente[0]; // il primo che entra prende il timone
{
  const s = await stato(FAC, 'tavolo');
  ok(s.dati?.state.partecipanti.length === 6, 'sei partecipanti al tavolo', `ne risultano ${s.dati?.state.partecipanti.length}`);
  ok(s.dati?.state.sonoFacilitatore === true, 'il primo entrato è facilitatore');
}
{
  // Password sbagliata: stesso messaggio di utente inesistente.
  const res = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ azione: 'entra', email: `grazia.${suffisso}@prova.it`, password: 'sbagliata' }),
  });
  ok(res.status === 401, 'password sbagliata respinta', `ha risposto ${res.status}`);
  const d = await res.json();
  ok(!/password/i.test(d.errore ?? '') || /non corretti/.test(d.errore ?? ''), 'l’errore non dice quale dei due è sbagliato');
}
{
  const res = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ azione: 'entra', email: `grazia.${suffisso}@prova.it`, password: 'prova' }),
  });
  ok(res.status === 200, 'rientro con le credenziali giuste');
  ok(!!estraiCookie(res), 'il rientro dà una nuova sessione');
}

/* --- sessione M1 ------------------------------------------------------ */

console.log('\n— sessione M1 ————————————————————————————');
await azione(FAC, 'session.create', { modulo: 'M1', titolo: 'Analisi di mercato', soggettoId: 'analisi-mercato', durataS: 240 });
const s0 = await stato(FAC, 'tavolo');
const sess = s0.dati.state.sessioni.at(-1);
ok(!!sess, 'sessione creata');

{
  const r = await azione(gente[1], 'commit.set', { sessioneId: sess.id, payload: { tipo: 'M1', destinazioni: {} } });
  ok(r.status === 409, 'commit in SETUP risponde 409', `ha risposto ${r.status}`);
}

await azione(FAC, 'session.setState', { sessioneId: sess.id, stato: 'COMMIT' });
await azione(FAC, 'session.startTimer', { sessioneId: sess.id, durataS: 240 });
await azione(FAC, 'session.dealHats', { sessioneId: sess.id });

console.log('\n— sei commit simultanei —————————————————');
const servizio = s0.dati.state.servizi.find((x) => x.id === 'analisi-mercato');
const attivita = servizio.attivita;
const scelte = ['AI', 'UMANO', 'MORTA'];

await Promise.all(
  gente.map((chi, i) =>
    azione(chi, 'commit.set', {
      sessioneId: sess.id,
      payload: {
        tipo: 'M1',
        destinazioni: Object.fromEntries(attivita.map((a, j) => [a.id, scelte[(i + j) % 3]])),
      },
    }).then(() => azione(chi, 'commit.confirm', { sessioneId: sess.id })),
  ),
);

console.log('\n— commit cieco (test #1) ————————————————');
{
  const perB = await stato(gente[1], 'mano');
  ok(perB.dati.state.commits.length === 1, 'la Mano vede solo il proprio commit', `ne vede ${perB.dati.state.commits.length}`);
  ok(perB.dati.state.commits[0].partecipanteId === gente[1].id, 'ed è davvero il proprio');
  const altri = gente.filter((g) => g.id !== gente[1].id).map((g) => g.id);
  const trapelati = altri.filter((id) => perB.grezzo.includes(`"partecipanteId":"${id}"`));
  ok(trapelati.length === 0, 'nessun partecipanteId altrui nella stringa JSON grezza', trapelati.join(','));
}
{
  const perTavolo = await stato(FAC, 'tavolo');
  ok(perTavolo.dati.state.commits.length === 0, 'il Tavolo non riceve alcun commit durante COMMIT', `ne riceve ${perTavolo.dati.state.commits.length}`);
  const sc = perTavolo.dati.state.statiCommit.find((x) => x.sessioneId === sess.id);
  ok(sc?.committed === 6 && sc?.total === 6, 'il Tavolo riceve il conteggio 6 su 6', JSON.stringify(sc));
  ok(!perTavolo.grezzo.includes('"destinazioni"') || !perTavolo.grezzo.includes('"tipo":"M1"'), 'nessun payload di commit verso il Tavolo');
}

console.log('\n— non ci si spaccia per un altro —————————');
{
  // Il corpo della richiesta non decide chi sei: l'identità è nel cookie.
  // L'azione non viene respinta — viene attribuita a chi possiede la sessione,
  // che è la cosa che conta. Si rimanda lo stesso payload di Valentina, così il
  // round non ne esce alterato e si può guardare solo l'attribuzione.
  const suo = Object.fromEntries(attivita.map((a, j) => [a.id, scelte[(1 + j) % 3]]));
  const res = await fetch(`${BASE}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: gente[1].cookie },
    body: JSON.stringify({
      actionId: `finto-${Math.random()}`,
      pid: gente[2].id, // ← la bugia
      type: 'commit.set',
      payload: { sessioneId: sess.id, payload: { tipo: 'M1', destinazioni: suo } },
    }),
  });
  ok(res.status === 200, 'la richiesta passa, ma non come chi dice di essere', `ha risposto ${res.status}`);

  const perB = await stato(gente[1], 'mano');
  const mio = perB.dati.state.commits.find((c) => c.sessioneId === sess.id);
  ok(mio?.partecipanteId === gente[1].id, 'il commit resta attribuito al proprietario del cookie', mio?.partecipanteId);

  const perC = await stato(gente[2], 'mano');
  const suoCommit = perC.dati.state.commits.find((c) => c.sessioneId === sess.id);
  ok(
    JSON.stringify(suoCommit?.payload?.destinazioni) ===
      JSON.stringify(Object.fromEntries(attivita.map((a, j) => [a.id, scelte[(2 + j) % 3]]))),
    'il commit della vittima designata è rimasto intatto',
  );
}
{
  const r = await azione(gente[2], 'session.reveal', { sessioneId: sess.id });
  ok(r.status === 403, 'un partecipante non può fare reveal', `ha risposto ${r.status}`);
}

console.log('\n— idempotenza (test #4) —————————————————');
{
  const id = `idem-${Math.random()}`;
  const prima = await azione(FAC, 'discussion.note', { sessioneId: sess.id, testo: 'nota unica' }, id);
  const dopo = await azione(FAC, 'discussion.note', { sessioneId: sess.id, testo: 'nota unica' }, id);
  const s = await stato(FAC, 'tavolo');
  const n = s.dati.state.note.filter((x) => x.testo === 'nota unica').length;
  ok(prima.status === 200 && dopo.status === 200, 'entrambe le POST rispondono 200');
  ok(dopo.body.duplicato === true, 'la seconda è marcata duplicato');
  ok(n === 1, 'la nota è stata scritta una volta sola', `ne risultano ${n}`);
}

console.log('\n— reveal ————————————————————————————————');
await azione(FAC, 'session.reveal', { sessioneId: sess.id });
{
  const s = await stato(FAC, 'tavolo');
  const sx = s.dati.state.sessioni.find((x) => x.id === sess.id);
  ok(sx.stato === 'REVEAL', 'la sessione è in REVEAL');
  ok(typeof sx.revealAt === 'number' && sx.revealAt > Date.now(), 'revealAt è nel futuro', `${sx.revealAt - Date.now()}ms`);
  ok(s.dati.state.commits.length === 6, 'dopo il reveal il Tavolo vede tutti e sei i commit', `ne vede ${s.dati.state.commits.length}`);
  const sv = s.dati.state.servizi.find((x) => x.id === 'analisi-mercato');
  ok(sv.destinazioni.length === 6 * attivita.length, 'le destinazioni sono materializzate', `${sv.destinazioni.length}`);
  ok(Object.keys(sx.cappelli).length === 6, 'sei cappelli distribuiti');
  ok(new Set(Object.values(sx.cappelli)).size === 6, 'sei cappelli distinti');
  ok(Object.values(sx.cappelli).includes('CASHFLOW') && Object.values(sx.cappelli).includes('COMPRATORE'), 'CASHFLOW e COMPRATORE assegnati');
}

console.log('\n— immutabilità (test #2) ————————————————');
{
  const r = await azione(gente[0], 'commit.set', { sessioneId: sess.id, payload: { tipo: 'M1', destinazioni: {} } });
  ok(r.status === 409, 'commit.set dopo il reveal risponde 409', `ha risposto ${r.status}`);
  const r2 = await azione(gente[0], 'discussion.note', { sessioneId: sess.id, testo: 'ho cambiato idea' });
  ok(r2.status === 200, 'il cambio di opinione passa come nota');
}

console.log('\n— polling versionato ————————————————————');
{
  const s = await stato(FAC, 'tavolo');
  const res = await fetch(
    `${BASE}/api/state?v=${s.dati.version}&pv=${encodeURIComponent(s.dati.presence)}&role=tavolo`,
    { headers: { cookie: FAC.cookie } },
  );
  ok(res.status === 204, 'versione e presenza invariate danno 204', `ha risposto ${res.status}`);
  ok((await res.text()).length === 0, 'il 204 non trasferisce corpo');
}

console.log('\n— bucket e lock —————————————————————————');
{
  const r = await azione(FAC, 'servizio.setBucket', { servizioId: 'analisi-mercato', bucket: 'CHIUSO', valoreResiduo: 'NIENTE' });
  ok(r.status === 409, 'chiusura senza richiedente esplicito respinta', `ha risposto ${r.status}`);
}
await azione(FAC, 'servizio.setBucket', { servizioId: 'analisi-mercato', bucket: 'PORTA', valoreResiduo: 'MENO' });
await azione(FAC, 'lock.create', {
  sessioneId: sess.id,
  contenuto: { servizio: 'Analisi di mercato', bucket: 'PORTA' },
  dissensi: [{ partecipanteId: gente[2].id, nota: 'Lo terrei in NUCLEO' }],
});
{
  const s = await stato(FAC, 'tavolo');
  ok(s.dati.state.lock.length === 1, 'lock registrato');
  ok(s.dati.state.lock[0].dissensi.length === 1, 'il dissenso è registrato nel lock');
  ok(s.dati.state.sessioni.find((x) => x.id === sess.id).stato === 'LOCKED', 'la sessione è LOCKED');
}

console.log('\n— M6 anonimo (test #3) ——————————————————');
await azione(FAC, 'session.create', { modulo: 'M6', titolo: 'La soglia', durataS: 240, revealAnonimo: true });
const s6 = await stato(FAC, 'tavolo');
const sess6 = s6.dati.state.sessioni.at(-1);
ok(sess6.revealAnonimo === true, 'M6 nasce con reveal anonimo');
await azione(FAC, 'session.setState', { sessioneId: sess6.id, stato: 'COMMIT' });
await Promise.all(
  gente.map((chi, i) =>
    azione(chi, 'commit.set', {
      sessioneId: sess6.id,
      payload: { tipo: 'M6', sogliaPct: 70 + i * 5, mesiAutonomia: 4 + i, trigger: `perdiamo il cliente numero ${i + 1}` },
    }).then(() => azione(chi, 'commit.confirm', { sessioneId: sess6.id })),
  ),
);
await azione(FAC, 'session.reveal', { sessioneId: sess6.id });
{
  for (const chi of [FAC, gente[1], gente[4]]) {
    const s = await stato(chi, chi === FAC ? 'tavolo' : 'mano');
    const fettaM6 = JSON.stringify({
      commits: s.dati.state.commits.filter((c) => c.sessioneId === sess6.id),
      soglie: s.dati.state.soglie,
    });
    const trapelati = gente.filter((g) => fettaM6.includes(g.id)).map((g) => g.nome);
    ok(trapelati.length === 0, `nessun id nei dati di M6 visti da ${chi.nome}`, trapelati.join(','));
    const nomi = NOMI.filter((n) => fettaM6.includes(n));
    ok(nomi.length === 0, `nessun nome nei dati di M6 visti da ${chi.nome}`, nomi.join(','));
  }
  const s = await stato(FAC, 'tavolo');
  ok(s.dati.state.soglie.length === 6, 'sei soglie materializzate', `${s.dati.state.soglie.length}`);
  ok(s.dati.state.soglie.every((x) => x.partecipanteId.startsWith('anon-')), 'tutte le soglie sono anonime');
  ok(s.dati.state.workshop.forbiceOriginale === 25, 'la forbice è 25 punti', String(s.dati.state.workshop.forbiceOriginale));
  const etichette = s.dati.state.commits.filter((c) => c.sessioneId === sess6.id).map((c) => c.partecipanteId);
  ok(new Set(etichette).size === 6, 'sei etichette anonime distinte');
  ok(!s.grezzo.includes('anon-secret'), 'il segreto di anonimato non compare nella risposta');
  const perEtichetta = s.dati.state.commits
    .filter((c) => c.sessioneId === sess6.id)
    .sort((a, b) => a.partecipanteId.localeCompare(b.partecipanteId))
    .map((c) => c.payload.sogliaPct);
  const crescente = perEtichetta.every((v, i) => i === 0 || v >= perEtichetta[i - 1]);
  ok(!crescente, 'le etichette anonime non seguono l’ordine dei partecipanti', JSON.stringify(perEtichetta));
}

console.log('\n— M8 ————————————————————————————————————');
{
  const s = await stato(FAC, 'tavolo');
  const lockId = s.dati.state.lock[0].id;
  const base = { testo: 'Riscrivere la pagina servizi', orizzonte: '90_GIORNI', lockOrigine: lockId };
  ok((await azione(FAC, 'azione.upsert', { ...base, ownerId: '', scadenza: '2026-10-31' })).status === 409, 'azione senza owner respinta');
  ok((await azione(FAC, 'azione.upsert', { ...base, ownerId: gente[0].id, scadenza: '' })).status === 409, 'azione senza scadenza respinta');
  ok((await azione(FAC, 'azione.upsert', { ...base, ownerId: gente[0].id, scadenza: '2026-10-31' })).status === 200, 'azione completa accettata');
}

console.log('\n— carta obbligatoria —————————————————————');
{
  const r = await azione(FAC, 'entity.delete', { tipo: 'competitor', id: 'cliente-da-solo' });
  ok(r.status === 409, 'la carta "il cliente che si fa le cose da solo" non è rimuovibile', `ha risposto ${r.status}`);
}

console.log('\n— export (test #12) —————————————————————');
{
  const res = await fetch(`${BASE}/api/export`);
  const md = await res.text();
  ok(res.status === 200, 'export risponde 200');
  ok(md.includes('# Ritiro WDA'), 'il verbale ha il titolo');
  ok(md.includes('Lo terrei in NUCLEO'), 'il dissenso è nel verbale');
  ok(md.includes('Alessandro'), 'il dissenziente è nominato');
  ok(/forbice/i.test(md), 'la forbice è nel verbale');
  ok(!NOMI.some((n) => md.includes(`${n}: perdiamo il cliente`)), 'i trigger di M6 non sono attribuiti');
  ok(md.includes('Riscrivere la pagina servizi'), 'l’action plan è nel verbale');
  ok(md.includes('Mappa cappello × persona'), 'la mappa cappelli è nel verbale');

  const resJson = await fetch(`${BASE}/api/export?formato=json`);
  ok(resJson.status === 200, 'scarica stato risponde 200');
  ok(resJson.headers.get('content-disposition')?.includes('attachment'), 'lo stato si scarica come file');
}

console.log('\n— backup —————————————————————————————————');
{
  const d = await (await fetch(`${BASE}/api/export?formato=backup-list`)).json();
  ok(Array.isArray(d.backup) && d.backup.length >= 1, 'esiste almeno uno snapshot dal lock', `${d.backup?.length}`);
}

console.log(`\n${falliti === 0 ? 'TUTTO VERDE' : `${falliti} CONTROLLI FALLITI`}\n`);
process.exit(falliti === 0 ? 0 : 1);
