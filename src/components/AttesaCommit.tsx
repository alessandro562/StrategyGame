'use client';

/**
 * Cosa mostra il Tavolo mentre le sei persone rispondono in privato.
 *
 * Prima: quasi nulla — un contatore in alto e mezzo schermo nero, proprio nel
 * momento in cui tutti hanno gli occhi sul muro. Adesso: il tempo che resta,
 * grande, e le domande dei cappelli, che sono esattamente ciò a cui le persone
 * dovrebbero pensare mentre decidono.
 *
 * Non è decorazione: il cappello vincola le domande, e averlo davanti mentre si
 * risponde è la differenza fra un ruolo assegnato e un ruolo giocato.
 */

import { CAPPELLO_DOMANDA, type Cappello, type Sessione } from '@/lib/types';
import { Timer } from './Timer';

export function AttesaCommit({
  sessione,
  ora,
  nome,
}: {
  sessione: Sessione;
  ora: () => number;
  nome: (pid: string) => string;
}) {
  const cappelli = Object.entries(sessione.cappelli) as [string, Cappello][];

  return (
    <div className="pannello p-6 flex flex-col gap-6">
      <div className="flex items-center justify-center">
        <Timer sessione={sessione} ora={ora} grande />
      </div>

      {cappelli.length > 0 && (
        <div>
          <div className="etichetta mb-3 text-center">le domande di questo round</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {cappelli.map(([pid, cappello]) => (
              <div key={pid} className="rialzato p-3" style={{ borderColor: 'var(--wda-deep)' }}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[14px]">{nome(pid)}</span>
                  <span className="mono text-[11px]" style={{ color: 'var(--wda-bright)', letterSpacing: '0.08em' }}>
                    {cappello}
                  </span>
                </div>
                <p className="m-0 text-[14px]" style={{ color: 'var(--ink-dim)' }}>
                  “{CAPPELLO_DOMANDA[cappello]}”
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
