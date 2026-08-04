'use client';

/**
 * La divergenza è il dato, non un torto. Si riporta, non si commenta.
 */

import type { ReactNode } from 'react';
import { TERMINI } from '@/lib/glossario';

export interface Divergenza {
  etichetta: string;
  /**
   * `ReactNode` e non `string`: il dettaglio contiene cifre e nomi insieme
   * («3 AI / 2 Umano»), e con una stringa unica finiva tutto in monospaziato,
   * nomi delle destinazioni compresi. Chi chiama marca le cifre in `.mono` e
   * lascia le parole nel carattere di interfaccia.
   */
  dettaglio: ReactNode;
  intensita: number; // 0-1
}

/** Il titolo del pannello non era mai glossato: «divergenza» ora sta in TERMINI. */
function Titolo() {
  return (
    <>
      <div className="etichetta mb-1">divergenze</div>
      <p className="text-[13px] m-0 mb-3" style={{ color: 'var(--ink-dim)' }}>
        {TERMINI.divergenza}
      </p>
    </>
  );
}

export function DivergenceList({ voci }: { voci: Divergenza[] }) {
  if (voci.length === 0) {
    return (
      <div className="pannello p-4">
        <Titolo />
        <p className="text-[13px] m-0" style={{ color: 'var(--ink-dim)' }}>
          Nessuna divergenza registrata.
        </p>
      </div>
    );
  }

  const ordinate = [...voci].sort((a, b) => b.intensita - a.intensita);

  return (
    <div className="pannello p-4">
      <Titolo />
      {/* Impilate, non in riga. Questo pannello vive in una colonna stretta
          accanto al residuo: con nome, barra e conteggi sulla stessa riga il
          nome andava a capo e finiva sotto i numeri, sovrapposto. Il nome ha
          bisogno di tutta la larghezza, i numeri di non andare mai a capo. */}
      <ul className="flex flex-col gap-3 m-0 p-0 list-none">
        {ordinate.map((v, i) => (
          <li key={`${v.etichetta}-${i}`} className="flex flex-col gap-1">
            <span className="text-[13px]" style={{ color: 'var(--ink)' }}>
              {v.etichetta}
            </span>
            <div className="flex items-center gap-2">
              {/* Stessa corsia delle barre di M1/M2/M6: canale --bg-raised con
                  filetto --line, riempimento sopra. */}
              <div
                className="w-16 h-1 shrink-0"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
              >
                <div className="h-full" style={{ width: `${v.intensita * 100}%`, background: 'var(--tension)' }} />
              </div>
              <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--ink-dim)' }}>
                {v.dettaglio}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
