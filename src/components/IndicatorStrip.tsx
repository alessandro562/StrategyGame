'use client';

/**
 * §4.3 — tre indicatori sempre visibili. Non sono punteggi.
 * Nessun vincitore, nessun livello, nessuna celebrazione, nessuna soglia
 * presentata come obiettivo.
 */

import type { Indicatori } from '@/lib/calc';

function Sparkline({ serie }: { serie: number[] }) {
  if (serie.length < 2) return <span className="etichetta">—</span>;
  const w = 52;
  const h = 14;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const span = max - min || 1;
  const punti = serie
    .map((v, i) => `${(i / (serie.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden style={{ display: 'block' }}>
      <polyline points={punti} fill="none" stroke="var(--ink-faint)" strokeWidth="1" />
    </svg>
  );
}

function Cella({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2" style={{ borderRight: '1px solid var(--line)' }}>
      <span className="etichetta">{etichetta}</span>
      {children}
    </div>
  );
}

export function IndicatorStrip({ i }: { i: Indicatori }) {
  return (
    <div className="pannello flex flex-wrap items-stretch" aria-label="Indicatori">
      <Cella etichetta="allineamento">
        <span className="mono text-[15px]">{i.allineamento === null ? '—' : Math.round(i.allineamento)}</span>
        <Sparkline serie={i.serieAllineamento} />
      </Cella>

      <Cella etichetta="copertura">
        <span className="mono text-[15px]">
          {i.coperturaFatti}/{i.coperturaPrevisti}
        </span>
      </Cella>

      <Cella etichetta="esposizione">
        <span className="mono text-[15px]" style={{ color: i.esposizionePct > 0 ? 'var(--erosion)' : 'var(--ink)' }}>
          {Math.round(i.esposizionePct)}%
        </span>
        <span
          className="mono text-[15px]"
          style={{ color: i.vulnerabilitaAperte > 0 ? 'var(--erosion)' : 'var(--ink-dim)' }}
        >
          {i.vulnerabilitaAperte}
        </span>
      </Cella>
    </div>
  );
}
