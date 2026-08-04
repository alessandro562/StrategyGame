/**
 * Un handler per tipo di azione. Gli handler mutano lo Store in memoria;
 * la persistenza e il lock ottimistico li mette store.ts intorno.
 */

import { assegnaCappelli, esitiServizio, forbice, storicoCappelli } from './calc';
import { ErroreGuardia } from './guards';
import type { Action, TipoEntita } from './actions';
import type {
  Azione,
  Cappello,
  Commit,
  Destinazione,
  Scenario,
  Sessione,
  Store,
} from './types';

/** §2.5 — quanto anticipo dare ai client perché partano insieme. */
export const ANTICIPO_REVEAL_MS = 1500;

export function nuovoId(prefisso: string): string {
  return `${prefisso}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface Contesto {
  state: Store;
  pid: string;
  commits: Commit[];
  ora: number;
}

function sessione(state: Store, id: string): Sessione {
  const s = state.sessioni.find((x) => x.id === id);
  if (!s) throw new ErroreGuardia(404, 'sessione inesistente');
  return s;
}

/* ------------------------------------------------------------------ */
/* Materializzazione al reveal                                         */
/* ------------------------------------------------------------------ */

/**
 * Quando una sessione entra in REVEAL, i commit smettono di essere privati e
 * diventano dati del workshop. Qui si travasano nelle entità che alimentano
 * calcoli, indicatori e verbale. I commit restano dove sono: sono la storia
 * delle posizioni, e non si riscrive.
 */
export function materializza(state: Store, s: Sessione, commits: Commit[]): void {
  const dellaSessione = commits.filter((c) => c.sessioneId === s.id);
  if (dellaSessione.length === 0) return;

  switch (s.modulo) {
    case 'M1': {
      const servizio = state.servizi.find((x) => x.id === s.soggettoId);
      if (!servizio) return;
      servizio.destinazioni = [];
      for (const c of dellaSessione) {
        if (c.payload.tipo !== 'M1') continue;
        for (const [attivitaId, valore] of Object.entries(c.payload.destinazioni)) {
          servizio.destinazioni.push({
            attivitaId,
            partecipanteId: c.partecipanteId,
            valore: valore as Destinazione,
          });
        }
      }
      return;
    }

    case 'M3': {
      state.flussi = state.flussi.filter((f) => f.servizioId !== s.soggettoId);
      for (const c of dellaSessione) {
        if (c.payload.tipo !== 'M3') continue;
        for (const arco of c.payload.archi) {
          state.flussi.push({
            id: nuovoId('fl'),
            servizioId: s.soggettoId ?? '',
            partecipanteId: c.partecipanteId,
            attoreDa: arco.da,
            attoreA: arco.a,
          });
        }
      }
      const servizio = state.servizi.find((x) => x.id === s.soggettoId);
      if (servizio) {
        servizio.nessunFlusso = !state.flussi.some((f) => f.servizioId === servizio.id);
      }
      return;
    }

    case 'M4': {
      const asseId = state.workshop.asseCorrenteId ?? '';
      state.posizionamenti = state.posizionamenti.filter((p) => p.asseId !== asseId);
      for (const c of dellaSessione) {
        if (c.payload.tipo !== 'M4') continue;
        state.posizionamenti.push({
          partecipanteId: c.partecipanteId,
          asseId,
          oggi: c.payload.oggi,
          futuro: c.payload.futuro,
        });
      }
      return;
    }

    case 'M5': {
      const competitor = state.competitor.find((x) => x.id === s.soggettoId);
      if (!competitor) return;
      const voti = dellaSessione
        .filter((c) => c.payload.tipo === 'M5')
        .map((c) => ({
          partecipanteId: c.partecipanteId,
          convincente: (c.payload as { tipo: 'M5'; convincente: boolean }).convincente,
        }));
      const contrari = voti.filter((v) => !v.convincente).length;
      const aperta = voti.length > 0 && contrari > voti.length / 2;

      const esistente = competitor.sfide.find((x) => x.sessioneId === s.id);
      if (esistente) {
        esistente.voti = voti;
        esistente.aperta = aperta;
      } else {
        competitor.sfide.push({
          sessioneId: s.id,
          rispondenteId: s.rispondenteId ?? '',
          risposta: '',
          voti,
          aperta,
        });
      }

      const giaAperta = state.vulnerabilita.find(
        (v) => v.competitorId === competitor.id && v.chiusaA === null,
      );
      if (aperta && !giaAperta) {
        state.vulnerabilita.push({
          id: nuovoId('vuln'),
          competitorId: competitor.id,
          testo: competitor.nome,
          apertaDa: Date.now(),
          chiusaA: null,
        });
      } else if (!aperta && giaAperta) {
        // Una risposta convincente in un round successivo chiude la vulnerabilità.
        giaAperta.chiusaA = Date.now();
      }
      return;
    }

    case 'M6': {
      state.soglie = [];
      for (const c of dellaSessione) {
        if (c.payload.tipo !== 'M6') continue;
        state.soglie.push({
          partecipanteId: c.partecipanteId,
          sogliaPct: c.payload.sogliaPct,
          mesiAutonomia: c.payload.mesiAutonomia,
          trigger: c.payload.trigger,
        });
      }
      state.workshop.forbiceOriginale = forbice(state.soglie).ampiezza;
      return;
    }

    case 'M7': {
      for (const inv of state.invarianti) {
        const voti: { partecipanteId: string; scenario: Scenario }[] = [];
        for (const c of dellaSessione) {
          if (c.payload.tipo !== 'M7') continue;
          const scelta = c.payload.voti[inv.id];
          if (scelta) voti.push({ partecipanteId: c.partecipanteId, scenario: scelta });
        }
        if (voti.length === 0) continue;
        inv.voti = voti;
        const conteggi: Record<Scenario, number> = { ENTRAMBI: 0, AUTONOMO: 0, SUB_BRAND: 0 };
        voti.forEach((v) => (conteggi[v.scenario] += 1));
        const max = Math.max(conteggi.ENTRAMBI, conteggi.AUTONOMO, conteggi.SUB_BRAND);
        const vincitrici = (Object.keys(conteggi) as Scenario[]).filter((k) => conteggi[k] === max);
        // In pareggio l'affermazione non è invariante: resta condizionata.
        inv.scenario = vincitrici.length === 1 ? vincitrici[0] : 'AUTONOMO';
        inv.votiTenere = voti.filter((v) => v.scenario === 'ENTRAMBI').map((v) => v.partecipanteId);
      }
      return;
    }

    default:
      return;
  }
}

/**
 * Transizioni che devono avvenire anche se nessuno preme niente: senza un
 * processo persistente, la scadenza del timer si applica pigramente alla prima
 * lettura utile (§3.4).
 */
export function transizioniPigre(state: Store, commits: Commit[], ora: number): boolean {
  let cambiato = false;
  for (const s of state.sessioni) {
    if (s.stato !== 'COMMIT' || !s.timer?.avviatoA) continue;
    const scade = s.timer.avviatoA + s.timer.durataS * 1000;
    if (ora < scade) continue;
    s.stato = 'REVEAL';
    s.revealAt = ora + ANTICIPO_REVEAL_MS;
    s.timer = { ...s.timer, avviatoA: null };
    materializza(state, s, commits);
    cambiato = true;
  }
  return cambiato;
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export function applica(ctx: Contesto, azione: Action): void {
  const { state, pid, ora } = ctx;

  switch (azione.type) {
    // Chiunque sia autenticato può prendere il timone: in una stanza di sei
    // persone è la regola più semplice che funziona, e serve quando il
    // portatile del facilitatore muore a metà pomeriggio.
    case 'workshop.rivendicaFacilitatore':
      state.workshop.facilitatoreId = pid;
      return;

    case 'participant.setPresence': {
      const p = state.partecipanti.find((x) => x.id === azione.payload.partecipanteId);
      if (p) p.presente = azione.payload.presente;
      return;
    }

    case 'workshop.setFacilitatore':
      state.workshop.facilitatoreId = azione.payload.partecipanteId;
      return;

    case 'workshop.update':
      Object.assign(state.workshop, azione.payload);
      return;

    case 'session.create': {
      const { modulo, titolo, soggettoId, revealAnonimo, durataS } = azione.payload;
      const s: Sessione = {
        id: nuovoId('s'),
        modulo,
        titolo,
        stato: 'SETUP',
        timer: durataS ? { durataS, avviatoA: null } : null,
        cappelli: {},
        soggettoId,
        revealAnonimo: revealAnonimo ?? modulo === 'M6',
        revealAt: null,
        creataA: ora,
        ordine: state.sessioni.length,
      };
      state.sessioni.push(s);
      return;
    }

    case 'session.setState': {
      const s = sessione(state, azione.payload.sessioneId);
      s.stato = azione.payload.stato;
      if (s.stato === 'REVEAL') {
        s.revealAt = ora + ANTICIPO_REVEAL_MS;
        materializza(state, s, ctx.commits);
      }
      if (s.stato === 'COMMIT') s.revealAt = null;
      return;
    }

    case 'session.startTimer': {
      const s = sessione(state, azione.payload.sessioneId);
      s.timer = { durataS: azione.payload.durataS, avviatoA: ora };
      return;
    }

    case 'session.addTime': {
      const s = sessione(state, azione.payload.sessioneId);
      if (s.timer) s.timer.durataS += azione.payload.secondi;
      return;
    }

    case 'session.stopTimer': {
      const s = sessione(state, azione.payload.sessioneId);
      if (s.timer) s.timer.avviatoA = null;
      return;
    }

    case 'session.dealHats': {
      const s = sessione(state, azione.payload.sessioneId);
      const presenti = state.partecipanti.filter((p) => p.presente);
      const storico = storicoCappelli(state.sessioni.filter((x) => x.id !== s.id));
      s.cappelli = assegnaCappelli(presenti, storico) as Record<string, Cappello>;
      return;
    }

    case 'session.reveal': {
      const s = sessione(state, azione.payload.sessioneId);
      s.stato = 'REVEAL';
      s.revealAt = ora + ANTICIPO_REVEAL_MS;
      if (s.timer) s.timer.avviatoA = null;
      materializza(state, s, ctx.commits);
      return;
    }

    case 'session.setAnonimo': {
      const s = sessione(state, azione.payload.sessioneId);
      s.revealAnonimo = azione.payload.revealAnonimo;
      return;
    }

    case 'session.setRispondente': {
      const s = sessione(state, azione.payload.sessioneId);
      s.rispondenteId = azione.payload.rispondenteId;
      return;
    }

    case 'discussion.note': {
      state.note.push({
        id: nuovoId('n'),
        sessioneId: azione.payload.sessioneId,
        partecipanteId: pid,
        testo: azione.payload.testo,
        privata: azione.payload.privata ?? false,
        ts: ora,
      });
      return;
    }

    case 'lock.create': {
      const s = sessione(state, azione.payload.sessioneId);
      s.stato = 'LOCKED';
      state.lock.push({
        id: nuovoId('lk'),
        sessioneId: s.id,
        modulo: s.modulo,
        titolo: s.titolo,
        timestamp: ora,
        contenuto: azione.payload.contenuto,
        dissensi: azione.payload.dissensi ?? [],
        riapertoA: null,
        aValle: azione.payload.aValle ?? [],
      });
      return;
    }

    case 'lock.reopen': {
      const l = state.lock.find((x) => x.id === azione.payload.lockId);
      if (!l) throw new ErroreGuardia(404, 'lock inesistente');
      l.riapertoA = ora;
      const s = state.sessioni.find((x) => x.id === l.sessioneId);
      if (s) s.stato = 'DISCUSSIONE';
      return;
    }

    case 'lock.reconfirm': {
      const l = state.lock.find((x) => x.id === azione.payload.lockId);
      if (!l) throw new ErroreGuardia(404, 'lock inesistente');
      l.riapertoA = null;
      l.timestamp = ora;
      const s = state.sessioni.find((x) => x.id === l.sessioneId);
      if (s) s.stato = 'LOCKED';
      return;
    }

    case 'servizio.setBucket': {
      const s = state.servizi.find((x) => x.id === azione.payload.servizioId);
      if (!s) throw new ErroreGuardia(404, 'servizio inesistente');
      s.bucket = azione.payload.bucket;
      s.valoreResiduo = azione.payload.valoreResiduo;
      return;
    }

    case 'servizio.setDestinazione': {
      const s = state.servizi.find((x) => x.id === azione.payload.servizioId);
      if (!s) return;
      const esistente = s.destinazioni.find(
        (d) =>
          d.attivitaId === azione.payload.attivitaId &&
          d.partecipanteId === azione.payload.partecipanteId,
      );
      if (esistente) esistente.valore = azione.payload.valore;
      else s.destinazioni.push({ ...azione.payload });
      return;
    }

    case 'servizio.setBasePrezzo': {
      const s = state.servizi.find((x) => x.id === azione.payload.servizioId);
      if (!s) return;
      s.basePrezzo = {
        primaria: azione.payload.primaria as never,
        secondaria: azione.payload.secondaria as never,
        nota: azione.payload.nota,
      };
      return;
    }

    case 'attore.move': {
      const a = state.attori.find((x) => x.id === azione.payload.attoreId);
      if (!a || a.fisso) return;
      a.x = Math.min(1, Math.max(0, azione.payload.x));
      a.y = Math.min(1, Math.max(0, azione.payload.y));
      return;
    }

    case 'vulnerabilita.close': {
      const v = state.vulnerabilita.find((x) => x.id === azione.payload.vulnerabilitaId);
      if (v) v.chiusaA = ora;
      return;
    }

    case 'azione.upsert': {
      const p = azione.payload;
      const esistente = p.id ? state.azioni.find((a) => a.id === p.id) : undefined;
      const dati: Azione = {
        id: esistente?.id ?? nuovoId('az'),
        testo: p.testo,
        ownerId: p.ownerId,
        scadenza: p.scadenza,
        orizzonte: p.orizzonte,
        lockOrigine: p.lockOrigine,
        stato: p.stato ?? esistente?.stato ?? 'APERTA',
      };
      if (esistente) Object.assign(esistente, dati);
      else state.azioni.push(dati);
      return;
    }

    case 'invariante.setScenario': {
      const inv = state.invarianti.find((x) => x.id === azione.payload.invarianteId);
      if (inv) inv.scenario = azione.payload.scenario;
      return;
    }

    case 'entity.upsert':
      upsert(state, azione.payload.tipo, azione.payload.dati);
      return;

    case 'entity.delete':
      rimuovi(state, azione.payload.tipo, azione.payload.id);
      return;

    // Le azioni di panico non passano da qui: agiscono direttamente sulle
    // chiavi Redis, fuori dal lock ottimistico.
    case 'panic.restore':
    case 'panic.write':
    case 'panic.reset':
      return;

    // commit.set e commit.confirm scrivono su chiavi separate, non su room:state.
    case 'commit.set':
    case 'commit.confirm':
      return;

    default: {
      const esaustivo: never = azione;
      throw new ErroreGuardia(400, `azione sconosciuta: ${JSON.stringify(esaustivo)}`);
    }
  }
}

const COLLEZIONI: Record<TipoEntita, keyof Store> = {
  servizio: 'servizi',
  attore: 'attori',
  competitor: 'competitor',
  invariante: 'invarianti',
  azione: 'azioni',
  partecipante: 'partecipanti',
  asse: 'assi',
  trimestre: 'traiettoria',
};

const PREFISSI: Record<TipoEntita, string> = {
  servizio: 'sv',
  attore: 'at',
  competitor: 'cp',
  invariante: 'inv',
  azione: 'az',
  partecipante: 'p',
  asse: 'asse',
  trimestre: 't',
};

function upsert(state: Store, tipo: TipoEntita, dati: Record<string, unknown>): void {
  const chiave = COLLEZIONI[tipo];
  if (!chiave) throw new ErroreGuardia(400, `tipo sconosciuto: ${tipo}`);
  const lista = state[chiave] as unknown as { id: string }[];
  const id = typeof dati.id === 'string' && dati.id ? dati.id : nuovoId(PREFISSI[tipo]);
  const esistente = lista.find((x) => x.id === id);
  if (esistente) Object.assign(esistente, dati, { id });
  else lista.push({ ...(dati as object), id } as { id: string });

  if (tipo === 'asse') state.workshop.asseCorrenteId = id;
}

function rimuovi(state: Store, tipo: TipoEntita, id: string): void {
  const chiave = COLLEZIONI[tipo];
  if (!chiave) throw new ErroreGuardia(400, `tipo sconosciuto: ${tipo}`);
  const lista = state[chiave] as unknown as { id: string }[];
  const i = lista.findIndex((x) => x.id === id);
  if (i >= 0) lista.splice(i, 1);
}

/* ------------------------------------------------------------------ */
/* Proposte di azione a partire dai lock (§M8)                         */
/* ------------------------------------------------------------------ */

export interface PropostaAzione {
  lockId: string;
  testo: string;
  modulo: string;
}

/** Il modulo si alimenta da solo: ogni lock propone la sua azione. */
export function proposteAzioni(state: Store): PropostaAzione[] {
  const coperti = new Set(state.azioni.map((a) => a.lockOrigine));
  return state.lock
    .filter((l) => !coperti.has(l.id))
    .map((l) => ({
      lockId: l.id,
      modulo: l.modulo,
      testo: testoProposta(state, l.modulo, l.titolo),
    }));
}

function testoProposta(state: Store, modulo: string, titolo: string): string {
  switch (modulo) {
    case 'M1':
      return `Comunicare al mercato il nuovo perimetro di ${titolo}`;
    case 'M2':
      return `Riscrivere il contratto tipo di ${titolo} sulla nuova base di prezzo`;
    case 'M3':
      return 'Attivare il primo flusso fra due attori della mappa';
    case 'M4':
      return 'Tradurre il vettore di posizionamento in una pagina di offerta';
    case 'M5':
      return `Preparare la risposta alla carta ${titolo}`;
    case 'M6':
      return `Impostare il monitoraggio mensile della soglia (${state.workshop.sogliaCondivisaPct ?? '—'}%)`;
    case 'M7':
      return `Portare la no-regret move "${titolo}" in una pagina pubblica`;
    default:
      return `Dare seguito a: ${titolo}`;
  }
}

/** §M1 passo 4 — il residuo è la sola cosa che conta in quel passaggio. */
export function residuoDiServizio(state: Store, servizioId: string, commits: Commit[]) {
  const servizio = state.servizi.find((s) => s.id === servizioId);
  if (!servizio) return null;
  const sessioniM1 = state.sessioni.filter((s) => s.modulo === 'M1' && s.soggettoId === servizioId);
  const ids = new Set(sessioniM1.map((s) => s.id));
  return esitiServizio(
    servizio,
    commits.filter((c) => ids.has(c.sessioneId)),
  );
}
