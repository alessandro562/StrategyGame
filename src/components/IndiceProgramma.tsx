'use client';

/**
 * Dove siamo nell'arco del ritiro.
 *
 * L'indicatore «copertura 4/9» diceva quante decisioni erano chiuse, ma non
 * quali, non in che ordine, e non dove ci si trovava. Chi entrava in stanza a
 * metà pomeriggio non aveva modo di orientarsi.
 *
 * Non è una barra di avanzamento e non celebra nulla: è un indice, come quello
 * di un documento. Tre stati soltanto — fatto, in corso, da fare — perché è
 * l'unica cosa che serve sapere guardando il muro.
 */

import { MODULI, ORDINE_MODULI } from '@/lib/glossario';
import type { Modulo, Sessione } from '@/lib/types';

export function IndiceProgramma({
  sessioni,
  moduloCorrente,
}: {
  sessioni: Sessione[];
  moduloCorrente: Modulo | null;
}) {
  // Un modulo è concluso quando almeno una sua sessione è stata bloccata.
  const conclusi = new Set(sessioni.filter((s) => s.stato === 'LOCKED').map((s) => s.modulo));

  return (
    <nav className="pannello px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap" aria-label="Programma del ritiro">
      <span className="etichetta shrink-0">programma</span>
      {ORDINE_MODULI.map((codice) => {
        const corrente = codice === moduloCorrente;
        const fatto = conclusi.has(codice) && !corrente;
        return (
          <span
            key={codice}
            className="flex items-baseline gap-1 shrink-0"
            title={MODULI[codice].obiettivo}
            aria-current={corrente ? 'step' : undefined}
          >
            <span
              className="mono text-[12px]"
              style={{
                color: corrente ? 'var(--wda-bright)' : fatto ? 'var(--live)' : 'var(--ink-faint)',
                fontWeight: corrente ? 500 : 400,
              }}
            >
              {codice}
            </span>
            <span
              className="text-[13px]"
              style={{
                color: corrente ? 'var(--ink)' : fatto ? 'var(--ink-dim)' : 'var(--ink-faint)',
                // Il modulo in corso è l'unica cosa che deve saltare all'occhio.
                borderBottom: corrente ? '2px solid var(--wda-bright)' : '2px solid transparent',
              }}
            >
              {MODULI[codice].breve}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
