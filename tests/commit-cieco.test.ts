/**
 * Test #1, #2, #3 di §11.1 — i requisiti che, se falliscono, rendono inutile
 * tutto il resto del prodotto.
 */

import { describe, expect, it } from 'vitest';
import { ErroreGuardia, eFacilitatore, filterStateFor, verificaAzione } from '@/lib/guards';
import { statoIniziale } from '@/lib/seed';
import type { Commit, Sessione, Store } from '@/lib/types';

/** Nel test il segreto è fisso; in produzione vive solo su Redis. */
const SEGRETO = 'segreto-di-prova';

function sessioneDi(store: Store, over: Partial<Sessione> = {}): Sessione {
  const s: Sessione = {
    id: 'sess-1',
    modulo: 'M1',
    titolo: 'Analisi di mercato',
    stato: 'COMMIT',
    timer: null,
    cappelli: {},
    soggettoId: 'analisi-mercato',
    revealAnonimo: false,
    revealAt: null,
    creataA: 0,
    ordine: 0,
    ...over,
  };
  store.sessioni.push(s);
  return s;
}

const SEGRETO_DI_A = 'segreto-visibile-solo-ad-A';

function commitDiA(sessioneId: string): Commit {
  return {
    sessioneId,
    partecipanteId: 'p1',
    payload: { tipo: 'M1', destinazioni: { [SEGRETO_DI_A]: 'MORTA' } },
    confermato: true,
    aggiornatoA: 1,
  };
}

describe('#1 commit cieco', () => {
  it('la stringa JSON servita a B non contiene in nessuna forma il commit di A', () => {
    const store = statoIniziale();
    const s = sessioneDi(store);
    const commits = [commitDiA(s.id)];

    const perB = filterStateFor({
      state: store,
      commits,
      pid: 'p2',
      ruolo: 'mano',
      visti: {},
      ora: 1000,
      segretoAnonimo: SEGRETO,
    });

    // Verifica sulla stringa grezza, non sull'oggetto deserializzato.
    const grezzo = JSON.stringify(perB);
    expect(grezzo).not.toContain(SEGRETO_DI_A);
    expect(grezzo).not.toContain('"partecipanteId":"p1"');
    expect(perB.commits).toHaveLength(0);
  });

  it('al proprietario il proprio commit resta visibile', () => {
    const store = statoIniziale();
    const s = sessioneDi(store);
    const perA = filterStateFor({
      state: store,
      commits: [commitDiA(s.id)],
      pid: 'p1',
      ruolo: 'mano',
      visti: {},
      ora: 1000,
      segretoAnonimo: SEGRETO,
    });
    expect(perA.commits).toHaveLength(1);
    expect(JSON.stringify(perA)).toContain(SEGRETO_DI_A);
  });

  it('al Tavolo durante COMMIT arriva il conteggio, mai il contenuto', () => {
    const store = statoIniziale();
    const s = sessioneDi(store);
    const perTavolo = filterStateFor({
      state: store,
      commits: [commitDiA(s.id)],
      pid: 'p9',
      ruolo: 'tavolo',
      visti: {},
      ora: 1000,
      segretoAnonimo: SEGRETO,
    });

    const grezzo = JSON.stringify(perTavolo);
    expect(grezzo).not.toContain(SEGRETO_DI_A);
    expect(perTavolo.commits).toHaveLength(0);
    expect(perTavolo.statiCommit[0]).toMatchObject({
      sessioneId: s.id,
      committed: 1,
      total: 6,
      confermatiIds: ['p1'],
    });
  });

  it('la Mano non riceve aggregati sugli altri durante COMMIT', () => {
    const store = statoIniziale();
    const s = sessioneDi(store);
    const commits = [
      commitDiA(s.id),
      { ...commitDiA(s.id), partecipanteId: 'p3' },
      { ...commitDiA(s.id), partecipanteId: 'p4' },
    ];
    const perB = filterStateFor({
      state: store,
      commits,
      pid: 'p2',
      ruolo: 'mano',
      visti: {},
      ora: 1000,
      segretoAnonimo: SEGRETO,
    });
    // total = 1 significa "solo io": nessuna informazione sugli altri.
    expect(perB.statiCommit[0]).toMatchObject({ committed: 0, total: 1, confermatiIds: [] });
  });

  it('dopo il reveal i commit diventano visibili e attribuiti', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { stato: 'REVEAL' });
    const perB = filterStateFor({
      state: store,
      commits: [commitDiA(s.id)],
      pid: 'p2',
      ruolo: 'mano',
      visti: {},
      ora: 1000,
      segretoAnonimo: SEGRETO,
    });
    expect(perB.commits).toHaveLength(1);
    expect(perB.commits[0].partecipanteId).toBe('p1');
  });

  it('anche in SETUP i commit residui di un round riaperto restano segreti', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { stato: 'SETUP' });
    const perB = filterStateFor({
      state: store,
      commits: [commitDiA(s.id)],
      pid: 'p2',
      ruolo: 'tavolo',
      visti: {},
      ora: 1000,
      segretoAnonimo: SEGRETO,
    });
    expect(JSON.stringify(perB)).not.toContain(SEGRETO_DI_A);
  });
});

describe('#2 immutabilità del commit', () => {
  it('commit.set dopo il reveal risponde 409', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { stato: 'REVEAL' });
    expect(() =>
      verificaAzione(store, 'p1', {
        type: 'commit.set',
        payload: { sessioneId: s.id, payload: { tipo: 'M1', destinazioni: {} } },
      }),
    ).toThrowError(
      expect.objectContaining({ stato: 409 }) as unknown as ErroreGuardia,
    );
  });

  it('commit.set in COMMIT passa', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { stato: 'COMMIT' });
    expect(() =>
      verificaAzione(store, 'p1', {
        type: 'commit.set',
        payload: { sessioneId: s.id, payload: { tipo: 'M1', destinazioni: {} } },
      }),
    ).not.toThrow();
  });

  it('commit.set su sessione LOCKED risponde 409', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { stato: 'LOCKED' });
    let stato = 0;
    try {
      verificaAzione(store, 'p1', {
        type: 'commit.confirm',
        payload: { sessioneId: s.id },
      });
    } catch (e) {
      stato = (e as ErroreGuardia).stato;
    }
    expect(stato).toBe(409);
  });
});

describe('#3 anonimato M6', () => {
  it('le risposte di M6 non contengono partecipanteId, nemmeno dopo il reveal', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { modulo: 'M6', stato: 'REVEAL', revealAnonimo: true, soggettoId: undefined });
    const commits: Commit[] = store.partecipanti.map((p, i) => ({
      sessioneId: s.id,
      partecipanteId: p.id,
      payload: { tipo: 'M6', sogliaPct: 70 + i * 3, mesiAutonomia: 6, trigger: `trigger di ${p.nome}` },
      confermato: true,
      aggiornatoA: 1,
    }));
    store.soglie = commits.map((c) => ({
      partecipanteId: c.partecipanteId,
      sogliaPct: (c.payload as { sogliaPct: number }).sogliaPct,
      mesiAutonomia: 6,
      trigger: 'x',
    }));

    for (const richiedente of ['p1', 'p4']) {
      const filtrato = filterStateFor({
        state: store,
        commits,
        pid: richiedente,
        ruolo: 'tavolo',
        visti: {},
        ora: 1000,
        segretoAnonimo: SEGRETO,
      });
      const grezzo = JSON.stringify(filtrato.commits) + JSON.stringify(filtrato.soglie);
      for (const p of store.partecipanti) {
        expect(grezzo).not.toContain(`"partecipanteId":"${p.id}"`);
      }
      expect(filtrato.commits.every((c) => c.partecipanteId.startsWith('anon-'))).toBe(true);
      expect(filtrato.soglie.every((s2) => s2.partecipanteId.startsWith('anon-'))).toBe(true);
    }
  });

  it("l'etichetta anonima è stabile fra due letture successive", () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { modulo: 'M6', stato: 'REVEAL', revealAnonimo: true });
    const commits: Commit[] = store.partecipanti.map((p) => ({
      sessioneId: s.id,
      partecipanteId: p.id,
      payload: { tipo: 'M6', sogliaPct: 80, mesiAutonomia: 6, trigger: '' },
      confermato: true,
      aggiornatoA: 1,
    }));
    const a = filterStateFor({ state: store, commits, pid: 'p1', ruolo: 'tavolo', visti: {}, ora: 1, segretoAnonimo: SEGRETO });
    const b = filterStateFor({ state: store, commits, pid: 'p1', ruolo: 'tavolo', visti: {}, ora: 2, segretoAnonimo: SEGRETO });
    expect(a.commits.map((c) => c.partecipanteId)).toEqual(b.commits.map((c) => c.partecipanteId));
  });

  it('la permutazione dipende dal segreto di server, non è ricalcolabile dal client', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { modulo: 'M6', stato: 'REVEAL', revealAnonimo: true });
    const commits: Commit[] = store.partecipanti.map((p, i) => ({
      sessioneId: s.id,
      partecipanteId: p.id,
      payload: { tipo: 'M6', sogliaPct: 60 + i, mesiAutonomia: 6, trigger: '' },
      confermato: true,
      aggiornatoA: 1,
    }));
    const con = (segreto: string) =>
      filterStateFor({ state: store, commits, pid: 'p1', ruolo: 'tavolo', visti: {}, ora: 1, segretoAnonimo: segreto })
        .commits.map((c) => `${c.partecipanteId}:${(c.payload as { sogliaPct: number }).sogliaPct}`)
        .sort();

    // Un client che conoscesse solo id di sessione e partecipanti — entrambi
    // pubblici — otterrebbe un abbinamento diverso da quello vero.
    expect(con('segreto-vero')).not.toEqual(con(`anon:${s.id}`));
    expect(con('segreto-vero')).not.toEqual(con('altro-segreto'));
    // Con lo stesso segreto, invece, resta identico.
    expect(con('segreto-vero')).toEqual(con('segreto-vero'));
  });

  it("l'ordine anonimo non coincide con l'ordine dei partecipanti", () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { modulo: 'M6', stato: 'REVEAL', revealAnonimo: true });
    const commits: Commit[] = store.partecipanti.map((p) => ({
      sessioneId: s.id,
      partecipanteId: p.id,
      payload: { tipo: 'M6', sogliaPct: 80, mesiAutonomia: 6, trigger: '' },
      confermato: true,
      aggiornatoA: 1,
    }));
    const f = filterStateFor({ state: store, commits, pid: 'p1', ruolo: 'tavolo', visti: {}, ora: 1, segretoAnonimo: SEGRETO });
    const etichette = f.commits.map((c) => c.partecipanteId);
    expect(etichette).not.toEqual(['anon-1', 'anon-2', 'anon-3', 'anon-4', 'anon-5', 'anon-6']);
  });
});

describe('identità', () => {
  it('un pid non riconducibile a una sessione non apre nessun commit altrui', () => {
    const store = statoIniziale();
    const s = sessioneDi(store);
    const perIntruso = filterStateFor({
      state: store,
      commits: [commitDiA(s.id)],
      pid: 'mano-intruso0',
      ruolo: 'mano',
      visti: {},
      ora: 1,
      segretoAnonimo: SEGRETO,
    });
    expect(JSON.stringify(perIntruso)).not.toContain(SEGRETO_DI_A);
    expect(perIntruso.commits).toHaveLength(0);
  });
});

describe('utente master', () => {
  it('ha diritti da facilitatore anche se il ruolo è di un altro', () => {
    const store = statoIniziale();
    store.workshop.facilitatoreId = 'p1';
    store.partecipanti.push({
      id: 'u-master',
      nome: 'Alessandro',
      profilo: 'operativo',
      presente: true,
      socketConnesso: true,
      master: true,
    });
    expect(eFacilitatore(store, 'u-master')).toBe(true);
    // e chi non è né facilitatore né master resta escluso
    expect(eFacilitatore(store, 'p2')).toBe(false);
  });

  it('un\'azione riservata al facilitatore passa per il master', () => {
    const store = statoIniziale();
    store.workshop.facilitatoreId = 'p1';
    store.partecipanti.push({
      id: 'u-master',
      nome: 'Alessandro',
      profilo: 'operativo',
      presente: true,
      socketConnesso: true,
      master: true,
    });
    const s = sessioneDi(store);
    expect(() => verificaAzione(store, 'u-master', { type: 'session.reveal', payload: { sessioneId: s.id } })).not.toThrow();
  });

  it('sonoFacilitatore è vero per il master anche senza il ruolo', () => {
    const store = statoIniziale();
    store.workshop.facilitatoreId = 'p1';
    store.partecipanti.push({
      id: 'u-master',
      nome: 'Alessandro',
      profilo: 'operativo',
      presente: true,
      socketConnesso: true,
      master: true,
    });
    const filtrato = filterStateFor({
      state: store,
      commits: [],
      pid: 'u-master',
      ruolo: 'mano',
      visti: {},
      ora: 1,
      segretoAnonimo: SEGRETO,
    });
    expect(filtrato.sonoFacilitatore).toBe(true);
  });

  it('senza il flag master, non facilitatore resta senza diritti', () => {
    const store = statoIniziale();
    store.workshop.facilitatoreId = 'p1';
    expect(eFacilitatore(store, 'p2')).toBe(false);
  });
});

describe('altre guardie', () => {
  it('la carta obbligatoria non è rimuovibile dal mazzo', () => {
    const store = statoIniziale();
    let stato = 0;
    try {
      verificaAzione(store, 'p1', {
        type: 'entity.delete',
        payload: { tipo: 'competitor', id: 'cliente-da-solo' },
      });
    } catch (e) {
      stato = (e as ErroreGuardia).stato;
    }
    expect(stato).toBe(409);
  });

  it('un servizio non si chiude senza che qualcuno lo abbia chiesto', () => {
    const store = statoIniziale();
    expect(() =>
      verificaAzione(store, 'p1', {
        type: 'servizio.setBucket',
        payload: { servizioId: 'venture-building', bucket: 'CHIUSO', valoreResiduo: 'NIENTE' },
      }),
    ).toThrow();
    expect(() =>
      verificaAzione(store, 'p1', {
        type: 'servizio.setBucket',
        payload: { servizioId: 'venture-building', bucket: 'CHIUSO', valoreResiduo: 'NIENTE', richiestoDa: 'p3' },
      }),
    ).not.toThrow();
  });

  it('le azioni riservate al facilitatore sono negate agli altri', () => {
    const store = statoIniziale();
    store.workshop.facilitatoreId = 'p1';
    let stato = 0;
    try {
      verificaAzione(store, 'p2', { type: 'session.reveal', payload: { sessioneId: 'x' } });
    } catch (e) {
      stato = (e as ErroreGuardia).stato;
    }
    expect(stato).toBe(403);
  });

  it('le annotazioni private di un partecipante non escono verso gli altri', () => {
    const store = statoIniziale();
    const s = sessioneDi(store, { stato: 'DISCUSSIONE' });
    store.note.push({
      id: 'n1',
      sessioneId: s.id,
      partecipanteId: 'p1',
      testo: 'appunto-personale-di-A',
      privata: true,
      ts: 1,
    });
    const perB = filterStateFor({ state: store, commits: [], pid: 'p2', ruolo: 'mano', visti: {}, ora: 1, segretoAnonimo: SEGRETO });
    expect(JSON.stringify(perB)).not.toContain('appunto-personale-di-A');
    const perA = filterStateFor({ state: store, commits: [], pid: 'p1', ruolo: 'mano', visti: {}, ora: 1, segretoAnonimo: SEGRETO });
    expect(JSON.stringify(perA)).toContain('appunto-personale-di-A');
  });
});
