/**
 * Test #7 (residuo, casi limite) e #8 (flussi distinti) di §11.1,
 * più i calcoli che finiscono a schermo grande.
 */

import { describe, expect, it } from 'vitest';
import {
  assegnaCappelli,
  controlliM8,
  diagnosiPosizione,
  dispersione,
  esitiServizio,
  flussiDistinti,
  forbice,
  mescolaConSeme,
  pctErosione,
  vettoreStrategia,
} from '@/lib/calc';
import type { Commit, Flusso, Partecipante, Servizio } from '@/lib/types';

function servizio(quote: number[]): Servizio {
  return {
    id: 'sv',
    nome: 'Servizio',
    descrizione: '',
    fatturato12m: 100,
    attivita: quote.map((q, i) => ({ id: `a${i + 1}`, nome: `Attività ${i + 1}`, quotaPrezzoPct: q })),
    destinazioni: [],
    bucket: null,
    valoreResiduo: null,
    basePrezzo: null,
  };
}

function commitM1(pid: string, destinazioni: Record<string, 'AI' | 'UMANO' | 'MORTA'>): Commit {
  return { sessioneId: 's', partecipanteId: pid, payload: { tipo: 'M1', destinazioni }, confermato: true, aggiornatoA: 0 };
}

describe('#7 residuo umano', () => {
  it('somma le quote a maggioranza UMANO', () => {
    const s = servizio([40, 30, 30]);
    const r = esitiServizio(s, [
      commitM1('p1', { a1: 'AI', a2: 'UMANO', a3: 'AI' }),
      commitM1('p2', { a1: 'AI', a2: 'UMANO', a3: 'MORTA' }),
      commitM1('p3', { a1: 'UMANO', a2: 'UMANO', a3: 'AI' }),
    ]);
    expect(r.esiti.map((e) => e.esito)).toEqual(['AI', 'UMANO', 'AI']);
    expect(r.residuoPct).toBe(30);
  });

  it('normalizza quando le quote non sommano a 100', () => {
    const s = servizio([30, 30]); // totale 60
    const r = esitiServizio(s, [commitM1('p1', { a1: 'UMANO', a2: 'AI' })]);
    expect(r.totaleQuote).toBe(60);
    expect(r.residuoPct).toBe(50); // 30 su 60
  });

  it('quote oltre il 100 restano leggibili', () => {
    const s = servizio([80, 80]); // totale 160
    const r = esitiServizio(s, [commitM1('p1', { a1: 'UMANO', a2: 'MORTA' })]);
    expect(r.residuoPct).toBe(50);
  });

  it('il pareggio non produce un esito e non entra nel residuo', () => {
    const s = servizio([50, 50]);
    const r = esitiServizio(s, [
      commitM1('p1', { a1: 'UMANO', a2: 'UMANO' }),
      commitM1('p2', { a1: 'AI', a2: 'UMANO' }),
    ]);
    expect(r.esiti[0].esito).toBeNull();
    expect(r.esiti[0].divergente).toBe(true);
    expect(r.quoteInPareggio).toBe(50);
    expect(r.residuoPct).toBe(50); // solo a2
  });

  it('pareggio a tre destinazioni', () => {
    const s = servizio([100]);
    const r = esitiServizio(s, [
      commitM1('p1', { a1: 'AI' }),
      commitM1('p2', { a1: 'UMANO' }),
      commitM1('p3', { a1: 'MORTA' }),
    ]);
    expect(r.esiti[0].esito).toBeNull();
    expect(r.residuoPct).toBe(0);
  });

  it('senza voti il residuo è zero e nulla è divergente', () => {
    const r = esitiServizio(servizio([50, 50]), []);
    expect(r.residuoPct).toBe(0);
    expect(r.esiti.every((e) => e.esito === null && !e.divergente)).toBe(true);
  });

  it('un servizio senza attività non divide per zero', () => {
    const r = esitiServizio(servizio([]), [commitM1('p1', {})]);
    expect(r.residuoPct).toBe(0);
    expect(r.totaleQuote).toBe(0);
  });

  it('conta i votanti per attività, ignorando le attività non votate', () => {
    const s = servizio([50, 50]);
    const r = esitiServizio(s, [commitM1('p1', { a1: 'UMANO' }), commitM1('p2', { a1: 'UMANO' })]);
    expect(r.esiti[0].votanti).toBe(2);
    expect(r.esiti[1].votanti).toBe(0);
  });
});

describe('#8 flussi distinti', () => {
  const f = (da: string, a: string, pid = 'p1', sv = 'sv1'): Flusso => ({
    id: Math.random().toString(),
    servizioId: sv,
    partecipanteId: pid,
    attoreDa: da,
    attoreA: a,
  });

  it('gli archi duplicati contano una volta', () => {
    expect(flussiDistinti([f('a', 'b'), f('a', 'b', 'p2'), f('a', 'b', 'p3')])).toBe(1);
  });

  it('la direzione non conta: a→b e b→a sono lo stesso flusso', () => {
    expect(flussiDistinti([f('a', 'b'), f('b', 'a')])).toBe(1);
  });

  it('i cappi non contano', () => {
    expect(flussiDistinti([f('a', 'a'), f('a', 'b')])).toBe(1);
  });

  it('archi diversi si sommano', () => {
    expect(flussiDistinti([f('a', 'b'), f('b', 'c'), f('c', 'd'), f('a', 'd')])).toBe(4);
  });

  it('la diagnosi segue le soglie del documento', () => {
    expect(diagnosiPosizione(0)).toBe('Intermediario sostituibile');
    expect(diagnosiPosizione(1)).toBe('Intermediario sostituibile');
    expect(diagnosiPosizione(2)).toBe('Layer parziale');
    expect(diagnosiPosizione(3)).toBe('Layer parziale');
    expect(diagnosiPosizione(4)).toBe('Infrastruttura');
  });
});

describe('posizionamento', () => {
  it('il vettore va dal centroide oggi a quello a 12 mesi', () => {
    const v = vettoreStrategia([
      { partecipanteId: 'p1', asseId: 'x', oggi: { x: 0, y: 0 }, futuro: { x: 1, y: 0 } },
      { partecipanteId: 'p2', asseId: 'x', oggi: { x: 0.2, y: 0 }, futuro: { x: 1, y: 0 } },
    ]);
    expect(v.oggi).toEqual({ x: 0.1, y: 0 });
    expect(v.futuro).toEqual({ x: 1, y: 0 });
    expect(v.lunghezza).toBeCloseTo(0.9);
  });

  it('segnala alta divergenza su oggi', () => {
    const lontani = vettoreStrategia([
      { partecipanteId: 'p1', asseId: 'x', oggi: { x: 0, y: 0 }, futuro: { x: 0, y: 0 } },
      { partecipanteId: 'p2', asseId: 'x', oggi: { x: 1, y: 1 }, futuro: { x: 0, y: 0 } },
    ]);
    expect(lontani.altaDivergenzaOggi).toBe(true);
  });

  it('dispersione zero con un solo punto', () => {
    expect(dispersione([{ x: 0.4, y: 0.4 }])).toBe(0);
  });
});

describe('forbice ed erosione', () => {
  it('la forbice è la distanza fra la soglia più prudente e la più aggressiva', () => {
    const f = forbice([{ sogliaPct: 95 }, { sogliaPct: 70 }, { sogliaPct: 82 }]);
    expect(f).toEqual({ min: 70, max: 95, ampiezza: 25 });
  });

  it('senza soglie la forbice è zero', () => {
    expect(forbice([]).ampiezza).toBe(0);
  });

  it('la percentuale di erosione pesa il fatturato, non il numero di servizi', () => {
    const s = (id: string, fatturato: number, base: 'ACCESSO' | null): Servizio => ({
      ...servizio([100]),
      id,
      fatturato12m: fatturato,
      basePrezzo: base ? { primaria: base } : null,
    });
    expect(pctErosione([s('a', 300, 'ACCESSO'), s('b', 100, null)])).toBe(25);
  });

  it('i servizi chiusi non entrano nel calcolo', () => {
    const vivo: Servizio = { ...servizio([100]), id: 'a', fatturato12m: 100, basePrezzo: { primaria: 'ESITO' } };
    const chiuso: Servizio = { ...servizio([100]), id: 'b', fatturato12m: 900, bucket: 'CHIUSO' };
    expect(pctErosione([vivo, chiuso])).toBe(0);
  });
});

describe('cappelli', () => {
  const persone = (n: number): Partecipante[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      nome: `P${i + 1}`,
      profilo: 'operativo' as const,
      presente: true,
      socketConnesso: true,
    }));

  it('con meno presenti dei cappelli, CASHFLOW e COMPRATORE vanno per primi', () => {
    const c = assegnaCappelli(persone(3), {});
    const assegnati = Object.values(c);
    expect(assegnati).toContain('CASHFLOW');
    expect(assegnati).toContain('COMPRATORE');
    expect(assegnati).toHaveLength(3);
  });

  it('nessuno riceve due volte lo stesso cappello', () => {
    const p = persone(6);
    const c = assegnaCappelli(p, { p1: ['CASHFLOW'], p2: ['COMPRATORE'] });
    expect(c.p1).not.toBe('CASHFLOW');
    expect(c.p2).not.toBe('COMPRATORE');
  });

  it('ogni cappello va a una persona sola', () => {
    const c = assegnaCappelli(persone(6), {});
    expect(new Set(Object.values(c)).size).toBe(6);
  });
});

describe('controlli M8', () => {
  const azione = (id: string, ownerId: string, scadenza = '2026-10-30') => ({
    id,
    testo: 'Fare qualcosa',
    ownerId,
    scadenza,
    orizzonte: '90_GIORNI' as const,
    lockOrigine: 'lk1',
    stato: 'APERTA' as const,
  });

  it('segnala chi ha più del 40% delle azioni', () => {
    const c = controlliM8([azione('1', 'p1'), azione('2', 'p1'), azione('3', 'p2')], []);
    expect(c.perOwner[0]).toMatchObject({ ownerId: 'p1', conteggio: 2, sovraccarico: true });
    expect(c.perOwner[1].sovraccarico).toBe(false);
  });

  it('blocca la chiusura se manca un owner o una data', () => {
    expect(controlliM8([azione('1', '')], []).chiudibile).toBe(false);
    expect(controlliM8([azione('1', 'p1', '')], []).chiudibile).toBe(false);
    expect(controlliM8([azione('1', 'p1')], []).chiudibile).toBe(true);
  });

  it('senza nessuna azione il modulo non è chiudibile', () => {
    expect(controlliM8([], []).chiudibile).toBe(false);
  });

  it('segnala i lock senza azione discendente', () => {
    const lock = [
      { id: 'lk1', sessioneId: 's', modulo: 'M1' as const, titolo: 'x', timestamp: 0, contenuto: null, dissensi: [], riapertoA: null, aValle: [] },
      { id: 'lk2', sessioneId: 's', modulo: 'M2' as const, titolo: 'y', timestamp: 0, contenuto: null, dissensi: [], riapertoA: null, aValle: [] },
    ];
    expect(controlliM8([azione('1', 'p1')], lock).lockSenzaAzione).toEqual(['lk2']);
  });
});

describe('mescolamento con seme', () => {
  it('è deterministico', () => {
    const a = mescolaConSeme([1, 2, 3, 4, 5, 6], 'seme');
    const b = mescolaConSeme([1, 2, 3, 4, 5, 6], 'seme');
    expect(a).toEqual(b);
  });

  it('semi diversi danno ordini diversi', () => {
    const a = mescolaConSeme([1, 2, 3, 4, 5, 6, 7, 8], 'uno');
    const b = mescolaConSeme([1, 2, 3, 4, 5, 6, 7, 8], 'due');
    expect(a).not.toEqual(b);
  });

  it('non perde né duplica elementi', () => {
    const a = mescolaConSeme([1, 2, 3, 4, 5, 6], 'x');
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
