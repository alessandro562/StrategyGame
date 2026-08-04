'use client';

/**
 * §6.4 — il banner distingue tre casi, perché per il facilitatore sono
 * situazioni diverse: connesso, offline con azioni in coda, errore di
 * sincronizzazione.
 */

import type { StatoRete } from '@/net/usePolling';

export function ConnectionBanner({
  rete,
  inCoda,
  soloLettura,
}: {
  rete: StatoRete;
  inCoda: number;
  soloLettura: boolean;
}) {
  if (rete === 'connesso' && !soloLettura) {
    return (
      <span className="flex items-center gap-2 etichetta">
        <span className="inline-block w-2 h-2" style={{ background: 'var(--live)' }} />
        connesso
      </span>
    );
  }

  const [colore, testo] =
    rete === 'errore'
      ? ['var(--erosion)', 'errore di sincronizzazione']
      : inCoda > 0
        ? ['var(--tension)', `offline — ${inCoda} ${inCoda === 1 ? 'azione' : 'azioni'} in coda`]
        : soloLettura
          ? ['var(--tension)', 'stato dalla cache locale — sola lettura']
          : ['var(--tension)', 'offline'];

  return (
    <span className="flex items-center gap-2 etichetta" style={{ color: colore }}>
      <span className="inline-block w-2 h-2" style={{ background: colore }} />
      {testo}
    </span>
  );
}
