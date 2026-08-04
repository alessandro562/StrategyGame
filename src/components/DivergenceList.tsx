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
        <div className="etichetta mb-3">divergenze</div>
        <p className="text-[13px] m-0" style={{ color: 'var(--ink-dim)' }}>
          Nessuna divergenza registrata.
        </p>
      </div>
    );
  }

  const ordinate = [...voci].sort((a, b) => b.intensita - a.intensita);

  return (
    <div className="pannello p-4">
      <div className="etichetta mb-3">divergenze</div>
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
              <span
                className="mono text-[13px] whitespace-nowrap"
                style={{ color: 'var(--ink-dim)' }}
              >
                {v.dettaglio}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
