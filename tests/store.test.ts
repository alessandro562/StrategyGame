/**
 * Test #4 (idempotenza), #5 (concorrenza sui commit), #6 (lock ottimistico),
 * #12 (export con dati parziali) di §11.1.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { _resetRedis } from '@/lib/redis';
import {
  azzera,
  caricaCommits,
  caricaStato,
  connessi,
  elencaBackup,
  firmaPresenza,
  muta,
  registraAzione,
  ripristina,
  scriviCommit,
  segnalaPresenza,
  segretoAnonimo,
  snapshot,
} from '@/lib/store';
import { applica, transizioniPigre } from '@/lib/handlers';
import { generaVerbale } from '@/lib/verbale';
import { statoIniziale } from '@/lib/seed';
import type { Commit } from '@/lib/types';

beforeEach(() => {
  _resetRedis();
});

describe('#4 idempotenza', () => {
  it('la stessa actionId registrata due volte produce un solo effetto', async () => {
    expect(await registraAzione('uuid-1')).toBe(true);
    expect(await registraAzione('uuid-1')).toBe(false);
    expect(await registraAzione('uuid-2')).toBe(true);
  });

  it('rigiocare la coda offline non duplica le entità', async () => {
    const ids = ['a', 'b', 'a', 'c', 'b'];
    let applicate = 0;
    for (const id of ids) {
      if (await registraAzione(id)) {
        applicate++;
        await muta((s) => {
          applica(
            { state: s, pid: 'p1', commits: [], ora: 1 },
            { type: 'entity.upsert', payload: { tipo: 'invariante', dati: { id: `coda-${id}`, testo: id, scenario: 'ENTRAMBI', votiTenere: [] } } },
          );
        });
      }
    }
    expect(applicate).toBe(3);
    const { state } = await caricaStato();
    expect(state.invarianti.filter((i) => i.id.startsWith('coda-'))).toHaveLength(3);
  });
});

describe('#5 concorrenza sui commit', () => {
  it('sei commit simultanei sulla stessa sessione sono tutti persistiti', async () => {
    const commits: Commit[] = Array.from({ length: 6 }, (_, i) => ({
      sessioneId: 'sess-1',
      partecipanteId: `p${i + 1}`,
      payload: { tipo: 'M1', destinazioni: { a1: 'UMANO' } },
      confermato: true,
      aggiornatoA: i,
    }));

    await Promise.all(commits.map((c) => scriviCommit(c)));

    const letti = await caricaCommits();
    expect(letti).toHaveLength(6);
    expect(new Set(letti.map((c) => c.partecipanteId)).size).toBe(6);
  });

  it('un secondo commit dello stesso partecipante sostituisce il primo', async () => {
    const base: Commit = {
      sessioneId: 's1',
      partecipanteId: 'p1',
      payload: { tipo: 'M1', destinazioni: { a1: 'AI' } },
      confermato: false,
      aggiornatoA: 1,
    };
    await scriviCommit(base);
    await scriviCommit({ ...base, payload: { tipo: 'M1', destinazioni: { a1: 'UMANO' } }, confermato: true });
    const letti = await caricaCommits();
    expect(letti).toHaveLength(1);
    expect(letti[0].confermato).toBe(true);
  });
});

describe('#6 lock ottimistico', () => {
  it('due upsert simultanei non si sovrascrivono', async () => {
    await caricaStato();
    await Promise.all([
      muta((s) => {
        applica(
          { state: s, pid: 'p1', commits: [], ora: 1 },
          { type: 'entity.upsert', payload: { tipo: 'attore', dati: { id: 'nuovo-1', nome: 'Uno', categoria: 'x', x: 0.1, y: 0.1 } } },
        );
      }),
      muta((s) => {
        applica(
          { state: s, pid: 'p2', commits: [], ora: 1 },
          { type: 'entity.upsert', payload: { tipo: 'attore', dati: { id: 'nuovo-2', nome: 'Due', categoria: 'x', x: 0.2, y: 0.2 } } },
        );
      }),
    ]);
    const { state } = await caricaStato();
    expect(state.attori.find((a) => a.id === 'nuovo-1')).toBeTruthy();
    expect(state.attori.find((a) => a.id === 'nuovo-2')).toBeTruthy();
  });

  it('la versione avanza a ogni scrittura', async () => {
    const prima = (await caricaStato()).version;
    const dopo = await muta((s) => {
      s.workshop.nome = 'cambiato';
    });
    expect(dopo).toBeGreaterThan(prima);
  });

  it('con sei scrittori concorrenti nulla si perde in silenzio', async () => {
    await caricaStato();
    // Il documento fissa a 3 i tentativi di CAS, poi errore all'utente: con più
    // scrittori di così un 409 è un esito legittimo. Ciò che non è ammesso è
    // che una scrittura risulti riuscita e poi sparisca.
    const esiti = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        muta((s) => {
          applica(
            { state: s, pid: `p${i}`, commits: [], ora: 1 },
            { type: 'discussion.note', payload: { sessioneId: 'x', testo: `nota ${i}` } },
          );
        }),
      ),
    );
    const riuscite = esiti.filter((e) => e.status === 'fulfilled').length;
    const { state } = await caricaStato();
    expect(state.note).toHaveLength(riuscite);
    expect(new Set(state.note.map((n) => n.testo)).size).toBe(riuscite);
    // Il jitter fra i tentativi deve fare il suo lavoro: non è accettabile che
    // metà del tavolo veda un errore.
    expect(riuscite).toBeGreaterThanOrEqual(5);
  });
});

describe('presenza', () => {
  it('un partecipante silenzioso da più di 10 secondi risulta disconnesso', () => {
    const ora = 100_000;
    const visti = { p1: ora - 1_000, p2: ora - 30_000 };
    expect(connessi(visti, ora)).toEqual(['p1']);
  });

  it('la firma cambia solo quando cambia chi è connesso', async () => {
    const ora = 100_000;
    const a = firmaPresenza({ p1: ora - 1000, p2: ora - 2000 }, ora);
    const b = firmaPresenza({ p1: ora - 1500, p2: ora - 500 }, ora);
    const c = firmaPresenza({ p1: ora - 1000 }, ora);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('segnalaPresenza registra il pid', async () => {
    await segnalaPresenza('p1');
    const { state } = await caricaStato();
    expect(state.partecipanti.length).toBeGreaterThan(0);
  });
});

describe('segreto per l’anonimato', () => {
  it('è stabile fra letture successive', async () => {
    const a = await segretoAnonimo();
    const b = await segretoAnonimo();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });

  it('non compare in nessuna chiave leggibile dal client', async () => {
    const segreto = await segretoAnonimo();
    const { state } = await caricaStato();
    expect(JSON.stringify(state)).not.toContain(segreto);
  });
});

describe('backup e ripristino', () => {
  it('uno snapshot ripristina stato e commit', async () => {
    await muta((s) => {
      s.workshop.nome = 'prima del disastro';
    });
    await scriviCommit({
      sessioneId: 's1',
      partecipanteId: 'p1',
      payload: { tipo: 'M1', destinazioni: { a1: 'UMANO' } },
      confermato: true,
      aggiornatoA: 1,
    });
    const chiave = await snapshot();

    await muta((s) => {
      s.workshop.nome = 'dopo il disastro';
      s.servizi = [];
    });
    expect((await caricaStato()).state.servizi).toHaveLength(0);

    await ripristina(chiave);
    const { state } = await caricaStato();
    expect(state.workshop.nome).toBe('prima del disastro');
    expect(state.servizi.length).toBeGreaterThan(0);
    expect(await caricaCommits()).toHaveLength(1);
  });
});

describe('azzeramento', () => {
  it('riporta la stanza al seed e cancella i commit', async () => {
    await muta((s) => {
      s.workshop.nome = 'prova generale';
      s.lock.push({
        id: 'lk1', sessioneId: 's', modulo: 'M1', titolo: 'di prova', timestamp: 1,
        contenuto: null, dissensi: [], riapertoA: null, aValle: [],
      });
    });
    await scriviCommit({
      sessioneId: 's', partecipanteId: 'p1',
      payload: { tipo: 'M1', destinazioni: { a1: 'UMANO' } }, confermato: true, aggiornatoA: 1,
    });

    await azzera();

    const { state } = await caricaStato();
    expect(state.workshop.nome).toBe('Ritiro WDA — 5/6 agosto 2026');
    expect(state.lock).toHaveLength(0);
    expect(state.sessioni).toHaveLength(0);
    expect(await caricaCommits()).toHaveLength(0);
    // Il seed torna intero: si riparte da un tavolo utilizzabile, non da vuoto.
    expect(state.servizi.length).toBeGreaterThan(0);
    expect(state.competitor.some((c) => c.fisso)).toBe(true);
  });

  it('lascia uno snapshot da cui tornare indietro', async () => {
    await muta((s) => {
      s.workshop.nome = 'da recuperare';
    });
    await azzera();
    const backup = await elencaBackup();
    expect(backup.length).toBeGreaterThan(0);
    await ripristina(backup[0]);
    expect((await caricaStato()).state.workshop.nome).toBe('da recuperare');
  });
});

describe('timer', () => {
  it('alla scadenza la sessione passa a REVEAL con i commit allo stato in cui sono', () => {
    const state = statoIniziale();
    state.sessioni.push({
      id: 's1',
      modulo: 'M1',
      titolo: 'x',
      stato: 'COMMIT',
      timer: { durataS: 240, avviatoA: 1_000_000 },
      cappelli: {},
      soggettoId: 'analisi-mercato',
      revealAnonimo: false,
      revealAt: null,
      creataA: 0,
      ordine: 0,
    });
    const commits: Commit[] = [
      {
        sessioneId: 's1',
        partecipanteId: 'p1',
        payload: { tipo: 'M1', destinazioni: { 'analisi-mercato-a1': 'UMANO' } },
        confermato: false,
        aggiornatoA: 1,
      },
    ];

    expect(transizioniPigre(state, commits, 1_000_000 + 100_000)).toBe(false);
    expect(state.sessioni[0].stato).toBe('COMMIT');

    expect(transizioniPigre(state, commits, 1_000_000 + 240_000)).toBe(true);
    expect(state.sessioni[0].stato).toBe('REVEAL');
    expect(state.sessioni[0].revealAt).toBeGreaterThan(1_000_000 + 240_000);
    // Il commit non confermato viene acquisito comunque.
    expect(state.servizi.find((s) => s.id === 'analisi-mercato')!.destinazioni).toHaveLength(1);
  });
});

describe('#12 export con dati parziali', () => {
  it('il verbale si genera su uno stato appena inizializzato', () => {
    const md = generaVerbale(statoIniziale(), [], 1_700_000_000_000);
    expect(md).toContain('# Ritiro WDA');
    expect(md).toContain('Nessuna decisione bloccata.');
    expect(md).toContain('## 10. Action plan');
    expect(md).toContain('## 12. Decisioni riaperte');
  });

  it('il dissenso non viene cancellato dal lock', () => {
    const state = statoIniziale();
    state.lock.push({
      id: 'lk1',
      sessioneId: 's1',
      modulo: 'M1',
      titolo: 'Analisi di mercato',
      timestamp: 1_700_000_000_000,
      contenuto: 'Il servizio va in PORTA',
      dissensi: [{ partecipanteId: 'p2', nota: 'Lo terrei in NUCLEO' }],
      riapertoA: null,
      aValle: [],
    });
    const md = generaVerbale(state, [], 1_700_000_000_000);
    expect(md).toContain('Dissensi registrati');
    expect(md).toContain('Valentina');
    expect(md).toContain('Lo terrei in NUCLEO');
  });

  it('il verbale non contiene punteggi né classifiche', () => {
    const md = generaVerbale(statoIniziale(), [], 1_700_000_000_000);
    for (const parola of ['punteggi?', 'classifiche?', 'vincitor[ei]', 'livell[oi]', 'medagli']) {
      expect(md).not.toMatch(new RegExp(`\\b${parola}\\b`, 'i'));
    }
  });

  it('riporta le decisioni a valle da riconvalidare', () => {
    const state = statoIniziale();
    const base = {
      sessioneId: 's',
      timestamp: 1,
      contenuto: null,
      dissensi: [],
      riapertoA: null as number | null,
      aValle: [] as string[],
    };
    state.lock.push({ ...base, id: 'lk1', modulo: 'M1', titolo: 'Round 1', riapertoA: 2, aValle: ['lk2'] });
    state.lock.push({ ...base, id: 'lk2', modulo: 'M2', titolo: 'Round 2' });
    const md = generaVerbale(state, [], 1_700_000_000_000);
    expect(md).toContain('Decisioni a valle da riconvalidare: **1**');
  });
});
