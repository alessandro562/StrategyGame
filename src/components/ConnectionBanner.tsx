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
  const connesso = rete === 'connesso' && !soloLettura;

  // Nominale: pastiglia verde, testo neutro come le altre etichette. Fuori
  // nominale: il testo prende il colore dello stato. Un solo accento per volta.
  const [colore, testo]: [string, React.ReactNode] = connesso
    ? ['var(--live)', 'connesso']
    : rete === 'errore'
      ? ['var(--erosion)', 'errore di sincronizzazione']
      : inCoda > 0
        ? [
            'var(--tension)',
            <>
              offline — <span className="mono">{inCoda}</span>{' '}
              {inCoda === 1 ? 'azione' : 'azioni'} in coda
            </>,
          ]
        : soloLettura
          ? ['var(--tension)', 'stato dalla cache locale — sola lettura']
          : ['var(--tension)', 'offline'];

  return (
    <span className="etichetta flex items-center gap-2" style={connesso ? undefined : { color: colore }}>
      <span className="inline-block w-2 h-2 shrink-0" style={{ background: colore }} />
      {testo}
    </span>
  );
}
