'use client';

/**
 * "4 su 6 hanno confermato" — chi ha confermato, mai cosa.
 * Il payload non arriva nemmeno al client: lo filtra il server (§3.1 regola 4).
 */

import type { Partecipante, StatoCommit } from '@/lib/types';

export function CommitBar({
  stato,
  presenti,
  nome,
}: {
  stato: StatoCommit | undefined;
  presenti: Partecipante[];
  nome: (pid: string) => string;
}) {
  const committed = stato?.committed ?? 0;
  const total = stato?.total ?? presenti.length;
  const confermati = new Set(stato?.confermatiIds ?? []);

  return (
    <div className="pannello p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="etichetta">conferme</span>
        <span className="mono text-[15px]" style={{ color: committed === total && total > 0 ? 'var(--live)' : 'var(--ink)' }}>
          {committed} su {total} hanno confermato
        </span>
      </div>

      <div className="flex gap-1 mb-3" role="img" aria-label={`${committed} su ${total}`}>
        {Array.from({ length: Math.max(total, 1) }, (_, i) => (
          <div
            key={i}
            className="h-1 flex-1"
            style={{ background: i < committed ? 'var(--live)' : 'var(--line-strong)' }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {presenti.map((p) => {
          const ok = confermati.has(p.id);
          return (
            <span key={p.id} className="flex items-center gap-2 text-[13px]">
              <span
                className="inline-block w-2 h-2"
                style={{
                  background: ok ? 'var(--live)' : p.socketConnesso ? 'var(--line-strong)' : 'transparent',
                  border: p.socketConnesso ? 'none' : '1px solid var(--erosion)',
                }}
              />
              <span style={{ color: ok ? 'var(--ink)' : 'var(--ink-dim)' }}>{nome(p.id)}</span>
              {!p.socketConnesso && <span className="etichetta" style={{ color: 'var(--erosion)' }}>rete</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
