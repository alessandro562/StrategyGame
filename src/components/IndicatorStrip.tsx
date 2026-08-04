'use client';

/**
 * §4.3 — tre indicatori sempre visibili. Non sono punteggi.
 * Nessun vincitore, nessun livello, nessuna celebrazione, nessuna soglia
 * presentata come obiettivo.
 */

import type { Indicatori } from '@/lib/calc';

function Sparkline({ serie }: { serie: number[] }) {
  // Sotto i due punti non c'è una tendenza da disegnare. Il posto resta vuoto:
  // il trattino di "dato assente" lo porta già il numero della cella, e due
  // trattini in fila nella stessa cella si leggevano come un errore.
  if (serie.length < 2) return null;
  const w = 52;
  const h = 14;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const span = max - min || 1;
  // Mezzo pixel di margine sopra e sotto: con la serie piatta, o al massimo,
  // il tratto cadrebbe esattamente sul bordo del riquadro e verrebbe tagliato
  // a metà.
  const pad = 0.5;
  const punti = serie
    .map((v, i) => `${(i / (serie.length - 1)) * w},${pad + (1 - (v - min) / span) * (h - pad * 2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden style={{ display: 'block' }}>
      <polyline
        points={punti}
        fill="none"
        stroke="var(--ink-dim)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cella({
  etichetta,
  ultima = false,
  children,
}: {
  etichetta: string;
  ultima?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 whitespace-nowrap"
      // L'ultima cella non porta il filetto: raddoppiava il bordo del pannello.
      style={ultima ? undefined : { borderRight: '1px solid var(--line)' }}
    >
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

      {/* I due numeri stavano affiancati senza distinzione: "12% 3" non si
          legge. Il secondo prende la sua etichetta. */}
      <Cella etichetta="esposizione" ultima>
        <span className="mono text-[15px]" style={{ color: i.esposizionePct > 0 ? 'var(--erosion)' : 'var(--ink)' }}>
          {Math.round(i.esposizionePct)}%
        </span>
        <span className="etichetta">vulnerabilità</span>
        <span
          className="mono text-[15px]"
          style={{ color: i.vulnerabilitaAperte > 0 ? 'var(--erosion)' : 'var(--ink)' }}
        >
          {i.vulnerabilitaAperte}
        </span>
      </Cella>
    </div>
  );
}
