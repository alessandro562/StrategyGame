'use client';

/**
 * La divergenza è il dato, non un torto. Si riporta, non si commenta.
 */

export interface Divergenza {
  etichetta: string;
  dettaglio: string;
  intensita: number; // 0-1
}

export function DivergenceList({ voci }: { voci: Divergenza[] }) {
  if (voci.length === 0) {
    return (
      <div className="pannello p-4">
        <div className="etichetta mb-2">divergenze</div>
        <p className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          Nessuna divergenza registrata.
        </p>
      </div>
    );
  }

  const ordinate = [...voci].sort((a, b) => b.intensita - a.intensita);

  return (
    <div className="pannello p-4">
      <div className="etichetta mb-3">divergenze</div>
      <ul className="flex flex-col gap-2">
        {ordinate.map((v, i) => (
          <li key={`${v.etichetta}-${i}`} className="flex items-center gap-3">
            <div className="w-16 h-1 shrink-0" style={{ background: 'var(--line-strong)' }}>
              <div className="h-full" style={{ width: `${v.intensita * 100}%`, background: 'var(--tension)' }} />
            </div>
            <span className="text-[13px] shrink-0" style={{ color: 'var(--ink)' }}>
              {v.etichetta}
            </span>
            <span className="mono text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              {v.dettaglio}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
