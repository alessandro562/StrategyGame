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
    return (
      <span
        className="etichetta px-2 py-1"
        style={{ border: '1px solid var(--wda)', color: 'var(--wda-bright)' }}
      >
        {cappello}
      </span>
    );
  }

  return (
    <div className="rialzato p-3" style={{ borderColor: 'var(--wda-deep)' }}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="mono text-[13px]" style={{ color: 'var(--wda-bright)', letterSpacing: '0.08em' }}>
          {cappello}
        </span>
        <span className="etichetta">difende: {CAPPELLO_DIFENDE[cappello]}</span>
      </div>
      <p className="text-[14px] m-0" style={{ color: 'var(--ink)' }}>
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
        <span key={pid} className="text-[12px]" style={{ color: 'var(--ink-dim)' }}>
          {nome(pid)} <span className="mono" style={{ color: 'var(--wda-bright)' }}>{c}</span>
        </span>
      ))}
    </div>
  );
}
