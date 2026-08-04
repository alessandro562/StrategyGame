/**
 * Prova generale del ciclo completo contro il server HTTP reale (§11.2):
 * join -> sessione M1 -> COMMIT -> sei commit simultanei -> reveal -> lock ->
 * M6 anonimo -> action plan -> export.
 *
 * I controlli sul commit cieco guardano la stringa JSON grezza, non l'oggetto
 * deserializzato: è l'unico modo per accorgersi di un payload che viaggia e
 * viene solo nascosto dall'interfaccia.
 *
 * Uso:
 *   npm run build && npm start &
 *   BASE=http://127.0.0.1:3000 npm run prova
 *
 * Va eseguita su una stanza vergine: crea sessioni e commit propri, e i
 * conteggi presuppongono di partire da zero. Prima di partire per la sede,
 * ripetila contro il deploy di produzione da rete mobile.
 */

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
let falliti = 0;

function ok(cond, msg, extra = '') {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${msg}${extra ? ` — ${extra}` : ''}`);
  if (!cond) falliti++;
}

let contatore = 0;
async function azione(pid, type, payload = {}, actionId) {
  const res = await fetch(`${BASE}/api/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: actionId ?? `a${++contatore}-${Math.random()}`, pid, type, payload }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function stato(pid, ruolo = 'mano') {
  const res = await fetch(`${BASE}/api/state?v=-1&pv=&pid=${pid}&role=${ruolo}`);
  if (res.status !== 200) return { status: res.status, grezzo: '', dati: null };
  const grezzo = await res.text();
  return { status: res.status, grezzo, dati: JSON.parse(grezzo) };
}

console.log('\n— autenticazione ————————————————————————');
{
  const res = await fetch(`${BASE}/api/state?v=-1&pv=`);
  ok(res.status === 401, 'GET /api/state senza pid risponde 401', `ha risposto ${res.status}`);
}
{
  const res = await fetch(`${BASE}/api/state?v=-1&pv=&pid=sconosciuto-xyz`);
  ok(res.status === 401, 'pid sconosciuto risponde 401', `ha risposto ${res.status}`);
}

console.log('\n— join ——————————————————————————————————');
const NOMI = ['Roberto', 'Valentina', 'Alessandro', 'Grazia', 'Michela', 'Sofia'];
const pids = NOMI.map((_, i) => `mano-test-${i}`);
const TAVOLO = 'tavolo-test';

await azione(TAVOLO, 'participant.join', { nome: 'Tavolo', comeFacilitatore: true });
for (let i = 0; i < NOMI.length; i++) {
  const r = await azione(pids[i], 'participant.join', { nome: NOMI[i] });
  if (r.status !== 200) console.log('   join fallito', NOMI[i], r.status, JSON.stringify(r.body));
}
{
  const s = await stato(TAVOLO, 'tavolo');
  ok(s.dati?.state.partecipanti.length === 6, 'sei partecipanti registrati', `ne risultano ${s.dati?.state.partecipanti.length}`);
  ok(s.dati?.state.sonoFacilitatore === true, 'il Tavolo è facilitatore');
  ok(!s.dati?.state.partecipanti.some((p) => p.id === TAVOLO), 'il Tavolo non siede fra i partecipanti');
}

console.log('\n— sessione M1 ————————————————————————————');
await azione(TAVOLO, 'session.create', { modulo: 'M1', titolo: 'Analisi di mercato', soggettoId: 'analisi-mercato', durataS: 240 });
const s0 = await stato(TAVOLO, 'tavolo');
const sess = s0.dati.state.sessioni.at(-1);
ok(!!sess, 'sessione creata');

{
  const r = await azione(pids[0], 'commit.set', { sessioneId: sess.id, payload: { tipo: 'M1', destinazioni: {} } });
  ok(r.status === 409, 'commit in SETUP risponde 409', `ha risposto ${r.status}`);
}

await azione(TAVOLO, 'session.setState', { sessioneId: sess.id, stato: 'COMMIT' });
await azione(TAVOLO, 'session.startTimer', { sessioneId: sess.id, durataS: 240 });
await azione(TAVOLO, 'session.dealHats', { sessioneId: sess.id });

console.log('\n— sei commit simultanei —————————————————');
const servizio = s0.dati.state.servizi.find((x) => x.id === 'analisi-mercato');
const attivita = servizio.attivita;
const scelte = ['AI', 'UMANO', 'MORTA'];

await Promise.all(
  pids.map((pid, i) =>
    azione(pid, 'commit.set', {
      sessioneId: sess.id,
      payload: {
        tipo: 'M1',
        destinazioni: Object.fromEntries(attivita.map((a, j) => [a.id, scelte[(i + j) % 3]])),
      },
    }).then(() => azione(pid, 'commit.confirm', { sessioneId: sess.id })),
  ),
);

console.log('\n— commit cieco (test #1) ————————————————');
{
  const perB = await stato(pids[1], 'mano');
  ok(perB.dati.state.commits.length === 1, 'la Mano vede solo il proprio commit', `ne vede ${perB.dati.state.commits.length}`);
  ok(perB.dati.state.commits[0].partecipanteId === pids[1], 'ed è davvero il proprio');
  const altri = pids.filter((p) => p !== pids[1]);
  const trapelati = altri.filter((p) => perB.grezzo.includes(`"partecipanteId":"${p}"`));
  ok(trapelati.length === 0, 'nessun partecipanteId altrui nella stringa JSON grezza', trapelati.join(','));
  ok(!perB.grezzo.includes('statiCommit":[{"sessioneId":"' + sess.id + '","committed":6'), 'nessun aggregato a 6 verso la Mano');
}
{
  const perTavolo = await stato(TAVOLO, 'tavolo');
  ok(perTavolo.dati.state.commits.length === 0, 'il Tavolo non riceve alcun commit durante COMMIT', `ne riceve ${perTavolo.dati.state.commits.length}`);
  const sc = perTavolo.dati.state.statiCommit.find((x) => x.sessioneId === sess.id);
  ok(sc?.committed === 6 && sc?.total === 6, 'il Tavolo riceve il conteggio 6 su 6', JSON.stringify(sc));
  ok(!perTavolo.grezzo.includes('"destinazioni"') || !perTavolo.grezzo.includes('"tipo":"M1"'), 'nessun payload di commit verso il Tavolo');
}

console.log('\n— idempotenza (test #4) —————————————————');
{
  const id = `idem-${Math.random()}`;
  const prima = await azione(TAVOLO, 'discussion.note', { sessioneId: sess.id, testo: 'nota unica' }, id);
  const dopo = await azione(TAVOLO, 'discussion.note', { sessioneId: sess.id, testo: 'nota unica' }, id);
  const s = await stato(TAVOLO, 'tavolo');
  const n = s.dati.state.note.filter((x) => x.testo === 'nota unica').length;
  ok(prima.status === 200 && dopo.status === 200, 'entrambe le POST rispondono 200');
  ok(dopo.body.duplicato === true, 'la seconda è marcata duplicato');
  ok(n === 1, 'la nota è stata scritta una volta sola', `ne risultano ${n}`);
}

console.log('\n— permessi ——————————————————————————————');
{
  const r = await azione(pids[2], 'session.reveal', { sessioneId: sess.id });
  ok(r.status === 403, 'un partecipante non può fare reveal', `ha risposto ${r.status}`);
}

console.log('\n— reveal ————————————————————————————————');
await azione(TAVOLO, 'session.reveal', { sessioneId: sess.id });
{
  const s = await stato(TAVOLO, 'tavolo');
  const sx = s.dati.state.sessioni.find((x) => x.id === sess.id);
  ok(sx.stato === 'REVEAL', 'la sessione è in REVEAL');
  ok(typeof sx.revealAt === 'number' && sx.revealAt > Date.now(), 'revealAt è nel futuro', String(sx.revealAt - Date.now()) + 'ms');
  ok(s.dati.state.commits.length === 6, 'dopo il reveal il Tavolo vede tutti e sei i commit', `ne vede ${s.dati.state.commits.length}`);
  const sv = s.dati.state.servizi.find((x) => x.id === 'analisi-mercato');
  ok(sv.destinazioni.length === 6 * attivita.length, 'le destinazioni sono materializzate', `${sv.destinazioni.length}`);
  ok(Object.keys(sx.cappelli).length === 6, 'sei cappelli distribuiti');
  ok(new Set(Object.values(sx.cappelli)).size === 6, 'sei cappelli distinti');
  ok(Object.values(sx.cappelli).includes('CASHFLOW') && Object.values(sx.cappelli).includes('COMPRATORE'), 'CASHFLOW e COMPRATORE assegnati');
}

console.log('\n— immutabilità (test #2) ————————————————');
{
  const r = await azione(pids[0], 'commit.set', { sessioneId: sess.id, payload: { tipo: 'M1', destinazioni: {} } });
  ok(r.status === 409, 'commit.set dopo il reveal risponde 409', `ha risposto ${r.status}`);
  const r2 = await azione(pids[0], 'discussion.note', { sessioneId: sess.id, testo: 'ho cambiato idea' });
  ok(r2.status === 200, 'il cambio di opinione passa come nota');
}

console.log('\n— polling versionato ————————————————————');
{
  const s = await stato(TAVOLO, 'tavolo');
  const v = s.dati.version;
  const pv = s.dati.presence;
  const res = await fetch(`${BASE}/api/state?v=${v}&pv=${encodeURIComponent(pv)}&pid=${TAVOLO}&role=tavolo`);
  ok(res.status === 204, 'versione e presenza invariate danno 204', `ha risposto ${res.status}`);
  const corpo = await res.text();
  ok(corpo.length === 0, 'il 204 non trasferisce corpo');
}

console.log('\n— bucket e lock —————————————————————————');
{
  const r = await azione(TAVOLO, 'servizio.setBucket', { servizioId: 'analisi-mercato', bucket: 'CHIUSO', valoreResiduo: 'NIENTE' });
  ok(r.status === 409, 'chiusura senza richiedente esplicito respinta', `ha risposto ${r.status}`);
}
await azione(TAVOLO, 'servizio.setBucket', { servizioId: 'analisi-mercato', bucket: 'PORTA', valoreResiduo: 'MENO' });
await azione(TAVOLO, 'lock.create', {
  sessioneId: sess.id,
  contenuto: { servizio: 'Analisi di mercato', bucket: 'PORTA' },
  dissensi: [{ partecipanteId: pids[2], nota: 'Lo terrei in NUCLEO' }],
});
{
  const s = await stato(TAVOLO, 'tavolo');
  ok(s.dati.state.lock.length === 1, 'lock registrato');
  ok(s.dati.state.lock[0].dissensi.length === 1, 'il dissenso è registrato nel lock');
  const sx = s.dati.state.sessioni.find((x) => x.id === sess.id);
  ok(sx.stato === 'LOCKED', 'la sessione è LOCKED');
}

console.log('\n— M6 anonimo (test #3) ——————————————————');
await azione(TAVOLO, 'session.create', { modulo: 'M6', titolo: 'La soglia', durataS: 240, revealAnonimo: true });
const s6 = await stato(TAVOLO, 'tavolo');
const sess6 = s6.dati.state.sessioni.at(-1);
ok(sess6.revealAnonimo === true, 'M6 nasce con reveal anonimo');
await azione(TAVOLO, 'session.setState', { sessioneId: sess6.id, stato: 'COMMIT' });
await Promise.all(
  pids.map((pid, i) =>
    azione(pid, 'commit.set', {
      sessioneId: sess6.id,
      payload: { tipo: 'M6', sogliaPct: 70 + i * 5, mesiAutonomia: 4 + i, trigger: `perdiamo il cliente numero ${i + 1}` },
    }).then(() => azione(pid, 'commit.confirm', { sessioneId: sess6.id })),
  ),
);
await azione(TAVOLO, 'session.reveal', { sessioneId: sess6.id });
{
  for (const chi of [TAVOLO, pids[0], pids[3]]) {
    const s = await stato(chi, chi === TAVOLO ? 'tavolo' : 'mano');
    // Si guarda solo la fetta M6: il resto dello stato è attribuito per scelta.
    const fettaM6 = JSON.stringify({
      commits: s.dati.state.commits.filter((c) => c.sessioneId === sess6.id),
      soglie: s.dati.state.soglie,
      note: s.dati.state.note.filter((n) => n.sessioneId === sess6.id),
    });
    const trapelati = pids.filter((p) => fettaM6.includes(p));
    ok(trapelati.length === 0, `nessun partecipanteId nei dati di M6 visti da ${chi}`, trapelati.join(','));
    const nomiTrapelati = NOMI.filter((n) => fettaM6.includes(n));
    ok(nomiTrapelati.length === 0, `nessun nome nei dati di M6 visti da ${chi}`, nomiTrapelati.join(','));
  }
  const s = await stato(TAVOLO, 'tavolo');
  ok(s.dati.state.soglie.length === 6, 'sei soglie materializzate', `ne risultano ${s.dati.state.soglie.length}`);
  ok(s.dati.state.soglie.every((x) => x.partecipanteId.startsWith('anon-')), 'tutte le soglie sono anonime');
  ok(s.dati.state.workshop.forbiceOriginale === 25, 'la forbice è 25 punti', String(s.dati.state.workshop.forbiceOriginale));
  const etichette = s.dati.state.commits.filter((c) => c.sessioneId === sess6.id).map((c) => c.partecipanteId);
  ok(new Set(etichette).size === 6, 'sei etichette anonime distinte');
  ok(!s.grezzo.includes('anon-secret'), 'il segreto di anonimato non compare nella risposta');
  // Nessuna correlazione fra ordine anonimo e ordine di conferma/alfabetico:
  // le soglie erano crescenti per indice, le etichette non devono seguirle.
  const perEtichetta = s.dati.state.commits
    .filter((c) => c.sessioneId === sess6.id)
    .sort((a, b) => a.partecipanteId.localeCompare(b.partecipanteId))
    .map((c) => c.payload.sogliaPct);
  const crescente = perEtichetta.every((v, i) => i === 0 || v >= perEtichetta[i - 1]);
  ok(!crescente, 'le etichette anonime non seguono l\'ordine dei partecipanti', JSON.stringify(perEtichetta));
}

console.log('\n— M8 ————————————————————————————————————');
{
  const s = await stato(TAVOLO, 'tavolo');
  const lockId = s.dati.state.lock[0].id;
  const r = await azione(TAVOLO, 'azione.upsert', { testo: 'Riscrivere la pagina servizi', ownerId: '', scadenza: '2026-10-31', orizzonte: '90_GIORNI', lockOrigine: lockId });
  ok(r.status === 409, 'azione senza owner respinta', `ha risposto ${r.status}`);
  const r2 = await azione(TAVOLO, 'azione.upsert', { testo: 'Riscrivere la pagina servizi', ownerId: pids[0], scadenza: '', orizzonte: '90_GIORNI', lockOrigine: lockId });
  ok(r2.status === 409, 'azione senza scadenza respinta', `ha risposto ${r2.status}`);
  const r3 = await azione(TAVOLO, 'azione.upsert', { testo: 'Riscrivere la pagina servizi', ownerId: pids[0], scadenza: '2026-10-31', orizzonte: '90_GIORNI', lockOrigine: lockId });
  ok(r3.status === 200, 'azione completa accettata');
}

console.log('\n— carta obbligatoria —————————————————————');
{
  const r = await azione(TAVOLO, 'entity.delete', { tipo: 'competitor', id: 'cliente-da-solo' });
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
  ok(md.includes('forbice'.toLowerCase()) || md.includes('Forbice'), 'la forbice è nel verbale');
  ok(!NOMI.some((n) => md.includes(`${n}: perdiamo il cliente`)), 'i trigger di M6 non sono attribuiti');
  ok(md.includes('Riscrivere la pagina servizi'), "l'action plan è nel verbale");
  ok(md.includes('Mappa cappello × persona'), 'la mappa cappelli è nel verbale');

  const resJson = await fetch(`${BASE}/api/export?formato=json`);
  ok(resJson.status === 200, 'scarica stato risponde 200');
  ok(resJson.headers.get('content-disposition')?.includes('attachment'), 'lo stato si scarica come file');
}

console.log('\n— backup —————————————————————————————————');
{
  const res = await fetch(`${BASE}/api/export?formato=backup-list`);
  const d = await res.json();
  ok(Array.isArray(d.backup) && d.backup.length >= 1, 'esiste almeno uno snapshot dal lock', `${d.backup?.length}`);
}

console.log(`\n${falliti === 0 ? 'TUTTO VERDE' : `${falliti} CONTROLLI FALLITI`}\n`);
process.exit(falliti === 0 ? 0 : 1);
