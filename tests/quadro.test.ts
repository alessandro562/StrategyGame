/**
 * MQ — il quadro d'insieme.
 *
 * È l'unico modulo a scrittura libera del prodotto, quindi è anche l'unico in
 * cui un errore di permessi non si vede: se chiunque potesse cancellare
 * qualsiasi voce nessuno se ne accorgerebbe finché non succede, in sala, con
 * sei persone che guardano lo schermo.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { _resetRedis } from '@/lib/redis';
import { caricaStato, muta } from '@/lib/store';
import { redis } from '@/lib/redis';
import { applica } from '@/lib/handlers';
import { ErroreGuardia, verificaAzione } from '@/lib/guards';
import { quadroIniziale, statoIniziale } from '@/lib/seed';
import { generaVerbale } from '@/lib/verbale';
import { COLONNE_QUADRO, ORIZZONTI_QUADRO, RIGHE_QUADRO } from '@/lib/glossario';
import type { Action } from '@/lib/actions';
import type { Store } from '@/lib/types';

beforeEach(() => {
  _resetRedis();
});

function contesto(state: Store, pid: string) {
  return { state, pid, commits: [], ora: 1_000 };
}

function esegui(state: Store, pid: string, azione: Action) {
  verificaAzione(state, pid, azione);
  applica(contesto(state, pid), azione);
}

describe('struttura del quadro', () => {
  it('sei righe e tre colonne, come chiesto', () => {
    expect(RIGHE_QUADRO.map((r) => r.chiave)).toEqual([
      'SERVIZI',
      'PRODOTTI',
      'MERCATO',
      'CLIENTI',
      'PARTNER',
      'REVENUE',
    ]);
    expect(COLONNE_QUADRO.map((c) => c.chiave)).toEqual(['OGGI', 'COMPETITOR', 'FUTURO']);
  });

  it('le prime due colonne partono piene, la terza vuota', () => {
    const q = quadroIniziale();
    expect(q.filter((v) => v.colonna === 'OGGI').length).toBeGreaterThan(0);
    expect(q.filter((v) => v.colonna === 'COMPETITOR').length).toBeGreaterThan(0);
    // La colonna Futuro è la domanda del modulo: se il seed la riempisse, il
    // modulo non avrebbe più niente da chiedere.
    expect(q.filter((v) => v.colonna === 'FUTURO')).toEqual([]);
  });

  it('ogni riga ha almeno una voce di partenza', () => {
    const q = quadroIniziale();
    for (const r of RIGHE_QUADRO) {
      expect(q.some((v) => v.riga === r.chiave)).toBe(true);
    }
  });
});

describe('scrittura', () => {
  it('chiunque aggiunge, anche chi non facilita', () => {
    const s = statoIniziale();
    s.workshop.facilitatoreId = 'p1';
    esegui(s, 'p3', {
      type: 'quadro.aggiungi',
      payload: { riga: 'REVENUE', colonna: 'FUTURO', testo: 'Abbonamento annuale', orizzonte: 'LUMINOSO' },
    });
    const v = s.quadro.find((x) => x.autoreId === 'p3');
    expect(v?.testo).toBe('Abbonamento annuale');
    expect(v?.orizzonte).toBe('LUMINOSO');
  });

  it("l'orizzonte esiste solo nel futuro", () => {
    const s = statoIniziale();
    esegui(s, 'p2', {
      type: 'quadro.aggiungi',
      // Un client sbagliato può mandarlo su qualsiasi colonna: qui si scarta.
      payload: { riga: 'SERVIZI', colonna: 'OGGI', testo: 'Formazione', orizzonte: 'LONTANO' },
    });
    expect(s.quadro.find((x) => x.autoreId === 'p2')?.orizzonte).toBeUndefined();
  });

  it('il testo vuoto non produce una voce', () => {
    const s = statoIniziale();
    const prima = s.quadro.length;
    esegui(s, 'p2', {
      type: 'quadro.aggiungi',
      payload: { riga: 'CLIENTI', colonna: 'OGGI', testo: '   ' },
    });
    expect(s.quadro.length).toBe(prima);
  });
});

describe('cancellazione', () => {
  it('ognuno toglie le proprie voci', () => {
    const s = statoIniziale();
    esegui(s, 'p2', {
      type: 'quadro.aggiungi',
      payload: { riga: 'PARTNER', colonna: 'FUTURO', testo: 'Rete europea' },
    });
    const id = s.quadro.find((x) => x.autoreId === 'p2')!.id;
    esegui(s, 'p2', { type: 'quadro.rimuovi', payload: { id } });
    expect(s.quadro.some((x) => x.id === id)).toBe(false);
  });

  it("nessuno tocca la voce di un altro", () => {
    const s = statoIniziale();
    s.workshop.facilitatoreId = 'p1';
    esegui(s, 'p2', {
      type: 'quadro.aggiungi',
      payload: { riga: 'PARTNER', colonna: 'FUTURO', testo: 'Rete europea' },
    });
    const id = s.quadro.find((x) => x.autoreId === 'p2')!.id;
    expect(() => esegui(s, 'p3', { type: 'quadro.rimuovi', payload: { id } })).toThrow(ErroreGuardia);
    expect(() =>
      esegui(s, 'p3', { type: 'quadro.modifica', payload: { id, testo: 'altro' } }),
    ).toThrow(ErroreGuardia);
    expect(s.quadro.some((x) => x.id === id)).toBe(true);
  });

  it('il facilitatore corregge anche le voci precaricate', () => {
    const s = statoIniziale();
    s.workshop.facilitatoreId = 'p1';
    const seme = s.quadro.find((x) => x.autoreId === 'seed')!;
    esegui(s, 'p1', { type: 'quadro.modifica', payload: { id: seme.id, testo: 'Riscritto' } });
    expect(s.quadro.find((x) => x.id === seme.id)?.testo).toBe('Riscritto');
  });

  it('una voce inesistente è un 404, non un silenzio', () => {
    const s = statoIniziale();
    expect(() => verificaAzione(s, 'p1', { type: 'quadro.rimuovi', payload: { id: 'q-mai' } })).toThrow(
      ErroreGuardia,
    );
  });
});

describe('stanze aperte prima che MQ esistesse', () => {
  it('lo stato senza quadro viene riempito in lettura, non esplode alla prima scrittura', async () => {
    // Si simula esattamente ciò che c'è su Redis dopo un deploy: lo stato
    // serializzato da una versione del codice che il campo non lo aveva.
    const vecchio = statoIniziale() as Partial<Store>;
    delete vecchio.quadro;
    await redis().set('room:state', JSON.stringify(vecchio));

    const { state } = await caricaStato();
    expect(Array.isArray(state.quadro)).toBe(true);
    expect(state.quadro.length).toBeGreaterThan(0);

    // E la scrittura successiva passa invece di prendere un TypeError.
    await muta((s) => {
      applica(contesto(s, 'p2'), {
        type: 'quadro.aggiungi',
        payload: { riga: 'MERCATO', colonna: 'FUTURO', testo: 'Spagna' },
      });
    });
    const dopo = await caricaStato();
    expect(dopo.state.quadro.some((v) => v.testo === 'Spagna')).toBe(true);
  });
});

describe('verbale', () => {
  it('il quadro apre il verbale, con il futuro diviso per orizzonte', () => {
    const s = statoIniziale();
    esegui(s, 'p1', {
      type: 'quadro.aggiungi',
      payload: { riga: 'PRODOTTI', colonna: 'FUTURO', testo: 'Piattaforma di diagnosi', orizzonte: 'VICINO' },
    });
    const md = generaVerbale(s, [], 0);
    expect(md).toContain('## 1. Quadro d’insieme');
    expect(md).toContain('Piattaforma di diagnosi');
    expect(md).toContain(ORIZZONTI_QUADRO[0].etichetta);
    // Le voci precaricate non hanno una firma da attribuire a nessuno.
    expect(md).toContain('- CXO as a Service\n');
    // Quelle scritte in sala sì.
    expect(md).toMatch(/Piattaforma di diagnosi — \w+/);
  });
});
