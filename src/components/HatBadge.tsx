'use client';

/**
 * §4.1 — il cappello vincola le domande, non i voti.
 */

import { CAPPELLO_DIFENDE, CAPPELLO_DOMANDA, type Cappello } from '@/lib/types';

export function HatBadge({ cappello, compatto = false }: { cappello: Cappello | null; compatto?: boolean }) {
  if (!cappello) {
    return <span className="etichetta">nessun cappello</span>;
  }

  if (compatto) {
    // Stesso trattamento del nome del cappello nelle altre due rese (scheda
    // estesa e MappaCappelli): mono 13px in --wda-bright. Con .etichetta lo
    // stesso valore usciva a 11px con un'altra crenatura, cioè la stessa cosa
    // scritta in due modi a seconda di dove capitava.
    return (
      <span
        className="mono text-[13px] px-2 py-1"
        style={{ border: '1px solid var(--wda)', color: 'var(--wda-bright)', letterSpacing: '0.08em' }}
      >
        {cappello}
      </span>
    );
  }

  return (
    <div className="rialzato p-3" style={{ borderLeft: '3px solid var(--wda)' }}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="mono text-[13px] shrink-0" style={{ color: 'var(--wda-bright)', letterSpacing: '0.08em' }}>
          {cappello}
        </span>
        {/* .etichetta solo sulla parola "difende": il valore è contenuto, e in
            maiuscoletto spaziato diventava illeggibile. */}
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="etichetta shrink-0">difende</span>
          <span className="text-[13px] text-right" style={{ color: 'var(--ink-dim)' }}>
            {CAPPELLO_DIFENDE[cappello]}
          </span>
        </span>
      </div>
      <p className="text-[15px] m-0" style={{ color: 'var(--ink)' }}>
        “{CAPPELLO_DOMANDA[cappello]}”
      </p>
    </div>
  );
}

export function MappaCappelli({
  cappelli,
  nome,
}: {
  cappelli: Record<string, Cappello>;
  nome: (pid: string) => string;
}) {
  const voci = Object.entries(cappelli);
  if (voci.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {voci.map(([pid, c]) => (
        <span key={pid} className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          {nome(pid)}{' '}
          <span className="mono" style={{ color: 'var(--wda-bright)' }}>
            {c}
          </span>
        </span>
      ))}
    </div>
  );
}
