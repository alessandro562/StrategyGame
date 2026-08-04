/**
 * ENFORCEMENT DEL COMMIT CIECO — file critico (§3.1).
 *
 * Regola d'oro: esiste UNA SOLA funzione da cui esce stato verso un client,
 * ed è filterStateFor(). Nessuna route può serializzare Store direttamente.
 * Per verificarlo: ogni NextResponse.json() dentro app/api deve o passare da
 * qui, o restituire un oggetto che non contiene stato (es. { version }).
 *
 * Il rischio che questo file esiste per neutralizzare: con il polling è
 * naturale restituire tutto lo stato e lasciare che sia il client a nascondere.
 * Chiunque apra gli strumenti di sviluppo vedrebbe i commit altrui, e uno solo
 * che lo fa svuota di senso tutti i round successivi.
 */

import { mescolaConSeme } from './calc';
import type {
  Commit,
  Nota,
  Ruolo,
  Sessione,
  Soglia,
  StatoCommit,
  StatoFiltrato,
  Store,
} from './types';
import { AZIONI_FACILITATORE, type Action } from './actions';

export class ErroreGuardia extends Error {
  constructor(
    readonly stato: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErroreGuardia';
  }
}

/** Le fasi in cui i commit di una sessione sono ancora segreti. */
function segreta(s: Sessione): boolean {
  return s.stato === 'SETUP' || s.stato === 'COMMIT';
}

function etichettaAnonima(indice: number): string {
  return `anon-${indice + 1}`;
}

/**
 * Mappa partecipanteId -> etichetta anonima, stabile per sessione.
 * L'ordine è mescolato: non è quello di conferma, non è alfabetico, e non
 * cambia fra un polling e l'altro.
 *
 * Il seme contiene un segreto che vive solo su Redis e non esce mai verso i
 * client. Senza, la permutazione sarebbe ricalcolabile da chiunque: l'id di
 * sessione e la lista dei partecipanti sono entrambi pubblici, la funzione di
 * mescolamento è nel bundle, e l'anonimato di M6 sarebbe una tenda, non un
 * muro. Il documento chiede che sia garantito lato server, non nell'interfaccia.
 */
function mappaAnonima(sessioneId: string, pids: string[], segreto: string): Map<string, string> {
  const mescolati = mescolaConSeme([...pids].sort(), `${segreto}:${sessioneId}`);
  const m = new Map<string, string>();
  mescolati.forEach((pid, i) => m.set(pid, etichettaAnonima(i)));
  return m;
}

export interface IngressoFiltro {
  state: Store;
  commits: Commit[];
  pid: string;
  ruolo: Ruolo;
  visti: Record<string, number>;
  ora: number;
  /** Segreto lato server per il mescolamento anonimo. Non esce mai. */
  segretoAnonimo: string;
}

/**
 * L'unica uscita di stato verso i client.
 *
 *  - sessione in COMMIT: la Mano riceve solo il proprio commit, il Tavolo
 *    nessuno. Al Tavolo arriva il conteggio, mai il contenuto (regola 4);
 *  - revealAnonimo: i partecipanteId spariscono anche dopo il reveal e vengono
 *    sostituiti da indici mescolati con seme fisso (regola 5). Vale per i
 *    commit e per tutto ciò che ne deriva (soglie, note);
 *  - le annotazioni personali di un partecipante non escono verso gli altri.
 */
export function filterStateFor(input: IngressoFiltro): StatoFiltrato {
  const { state, commits, pid, ruolo, visti, ora, segretoAnonimo } = input;

  const perSessione = new Map<string, Sessione>();
  for (const s of state.sessioni) perSessione.set(s.id, s);

  const anonime = new Map<string, Map<string, string>>();
  const mappaPer = (s: Sessione) => {
    if (!anonime.has(s.id)) {
      anonime.set(
        s.id,
        mappaAnonima(s.id, state.partecipanti.map((p) => p.id), segretoAnonimo),
      );
    }
    return anonime.get(s.id)!;
  };

  /* ---------- commit ---------- */
  const commitVisibili: Commit[] = [];
  for (const c of commits) {
    const s = perSessione.get(c.sessioneId);
    if (!s) continue;

    if (segreta(s)) {
      // Regola 3: durante COMMIT resta al richiedente solo il proprio commit,
      // e il Tavolo non ne riceve nessuno.
      if (ruolo === 'mano' && c.partecipanteId === pid) commitVisibili.push(c);
      continue;
    }

    if (s.revealAnonimo) {
      // Regola 5: nessun partecipanteId esce, nemmeno il proprio — altrimenti
      // per differenza si ricostruiscono gli altri quando i presenti sono pochi.
      commitVisibili.push({
        ...c,
        partecipanteId: mappaPer(s).get(c.partecipanteId) ?? etichettaAnonima(0),
      });
      continue;
    }

    commitVisibili.push(c);
  }

  /* ---------- stati di commit: solo al Tavolo, solo il conteggio ---------- */
  const presenti = state.partecipanti.filter((p) => p.presente);
  const statiCommit: StatoCommit[] =
    ruolo === 'tavolo'
      ? state.sessioni
          .filter((s) => s.stato === 'COMMIT')
          .map((s) => {
            const dellaSessione = commits.filter((c) => c.sessioneId === s.id && c.confermato);
            return {
              sessioneId: s.id,
              committed: dellaSessione.length,
              total: presenti.length,
              // Chi ha confermato si può dire anche in un round anonimo: è il
              // contenuto a dover restare segreto, non la partecipazione. E al
              // facilitatore serve distinguere "non ha deciso" da "wifi caduto".
              confermatiIds: dellaSessione.map((c) => c.partecipanteId).sort(),
            };
          })
      : // La Mano riceve solo lo stato del proprio commit, mai un aggregato (§8.6).
        state.sessioni
          .filter((s) => s.stato === 'COMMIT')
          .map((s) => {
            const mio = commits.find((c) => c.sessioneId === s.id && c.partecipanteId === pid);
            return {
              sessioneId: s.id,
              committed: mio?.confermato ? 1 : 0,
              total: 1,
              confermatiIds: mio?.confermato ? [pid] : [],
            };
          });

  /* ---------- soglie M6: anonime se la sessione lo è ---------- */
  const sessioniM6Anonime = new Set(
    state.sessioni.filter((s) => s.modulo === 'M6' && s.revealAnonimo).map((s) => s.id),
  );
  const soglieAnonime = sessioniM6Anonime.size > 0;
  const mappaM6 = soglieAnonime ? mappaPer(state.sessioni.find((s) => sessioniM6Anonime.has(s.id))!) : null;
  const soglie: Soglia[] = state.soglie.map((s, i) =>
    soglieAnonime ? { ...s, partecipanteId: mappaM6?.get(s.partecipanteId) ?? etichettaAnonima(i) } : s,
  );

  /* ---------- note: le private restano al proprietario ---------- */
  const note: Nota[] = state.note
    .filter((n) => !n.privata || n.partecipanteId === pid)
    .map((n) => {
      const s = perSessione.get(n.sessioneId);
      if (s?.revealAnonimo && n.partecipanteId !== pid) {
        return { ...n, partecipanteId: mappaPer(s).get(n.partecipanteId) ?? 'anon' };
      }
      return n;
    });

  /* ---------- presenza ---------- */
  const partecipanti = state.partecipanti.map((p) => ({
    ...p,
    socketConnesso: ora - (visti[p.id] ?? 0) < 10_000,
  }));

  return {
    ...state,
    partecipanti,
    soglie,
    note,
    commits: commitVisibili,
    statiCommit,
    serverNow: ora,
    visti,
    io: pid,
    sonoFacilitatore: state.workshop.facilitatoreId === pid,
  };
}

/* ------------------------------------------------------------------ */
/* Validazione delle azioni (§6.2)                                     */
/* ------------------------------------------------------------------ */

/** Id generato dal client al primo avvio e conservato in localStorage. */
const FORMA_PID = /^(mano|tavolo)-[a-z0-9-]{4,64}$/;

/**
 * Il pid è identità, non autorizzazione.
 *
 * Un pid inventato non apre nessuna porta: chi non possiede un commit non lo
 * riceve, e chi si presenta come Tavolo durante COMMIT non riceve alcun commit
 * — il controllo vero è filterStateFor(), non questa funzione. Qui si respinge
 * il rumore e si lascia passare il caso che deve funzionare in sala: un
 * dispositivo appena aperto che non ha ancora scelto il proprio nome.
 *
 * Senza questa apertura il prodotto si blocca al primo minuto: per fare join
 * bisogna leggere la lista dei nomi, e per leggerla bisognerebbe aver già fatto
 * join.
 */
export function verificaPid(state: Store, pid: string | null): string {
  if (!pid) throw new ErroreGuardia(401, 'pid mancante');
  const noto =
    state.partecipanti.some((p) => p.id === pid) || state.workshop.facilitatoreId === pid;
  if (!noto && !FORMA_PID.test(pid)) {
    throw new ErroreGuardia(401, 'pid sconosciuto');
  }
  return pid;
}

export function verificaStanza(state: Store, codice: string | null): void {
  if (!codice) return;
  if (codice !== state.workshop.codiceStanza) {
    throw new ErroreGuardia(404, 'codice stanza non valido');
  }
}

export function eFacilitatore(state: Store, pid: string): boolean {
  // Se nessuno ha ancora rivendicato il ruolo, il primo che agisce lo prende:
  // in una stanza di sei persone è la regola più semplice che funziona.
  return state.workshop.facilitatoreId === null || state.workshop.facilitatoreId === pid;
}

export function verificaAzione(state: Store, pid: string, azione: Action): void {
  if (AZIONI_FACILITATORE.has(azione.type) && !eFacilitatore(state, pid)) {
    throw new ErroreGuardia(403, 'azione riservata al facilitatore');
  }

  // Regola 6: i commit sono immutabili dopo il reveal.
  if (azione.type === 'commit.set' || azione.type === 'commit.confirm') {
    const p = azione.payload as { sessioneId: string };
    const s = state.sessioni.find((x) => x.id === p.sessioneId);
    if (!s) throw new ErroreGuardia(404, 'sessione inesistente');
    if (s.stato !== 'COMMIT') {
      throw new ErroreGuardia(409, `commit non ammesso: la sessione è in ${s.stato}`);
    }
  }

  // Regola 7: dopo il reveal un cambio di opinione è una nota, mai una modifica
  // del commit. Nulla da bloccare qui, ma la nota richiede una sessione viva.
  if (azione.type === 'discussion.note') {
    const p = azione.payload as { sessioneId: string };
    if (!state.sessioni.some((x) => x.id === p.sessioneId)) {
      throw new ErroreGuardia(404, 'sessione inesistente');
    }
  }

  if (azione.type === 'entity.delete') {
    const p = azione.payload as { tipo: string; id: string };
    if (p.tipo === 'competitor') {
      const c = state.competitor.find((x) => x.id === p.id);
      if (c?.fisso) {
        throw new ErroreGuardia(409, 'questa carta non è rimuovibile dal mazzo');
      }
    }
    if (p.tipo === 'attore' && state.attori.find((a) => a.id === p.id)?.fisso) {
      throw new ErroreGuardia(409, 'WDA non è rimuovibile dalla mappa');
    }
  }

  // §M1: un servizio non si chiude per inerzia.
  if (azione.type === 'servizio.setBucket') {
    const p = azione.payload as { bucket: string; richiestoDa?: string };
    if (p.bucket === 'CHIUSO' && !p.richiestoDa) {
      throw new ErroreGuardia(409, 'la chiusura richiede che qualcuno la chieda esplicitamente');
    }
  }

  // §M8: nessuna azione senza owner o senza data.
  if (azione.type === 'azione.upsert') {
    const p = azione.payload as { ownerId?: string; scadenza?: string };
    if (!p.ownerId) throw new ErroreGuardia(409, 'ogni azione ha un solo owner, mai "il team"');
    if (!p.scadenza) throw new ErroreGuardia(409, 'ogni azione ha una scadenza');
  }
}
