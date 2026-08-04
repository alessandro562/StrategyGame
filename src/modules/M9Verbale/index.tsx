'use client';

/**
 * M9 — Il verbale. Nessuno deve scriverlo.
 * L'export è disponibile in qualsiasi momento, non solo a fine ritiro.
 */

import { useEffect, useState } from 'react';
import { CompitoMano, Intestazione } from '../comune';
import { useStore } from '@/net/useStore';

export function M9Tavolo() {
  const { version } = useStore();
  const [markdown, setMarkdown] = useState<string>('');
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let vivo = true;
    void fetch('/api/export')
      .then((r) => r.text())
      .then((t) => {
        if (vivo) {
          setMarkdown(t);
          setCaricato(true);
        }
      });
    return () => {
      vivo = false;
    };
  }, [version]);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <Intestazione
        modulo="M9"
        titolo="Il verbale"
        sottotitolo="Generato dai dati del ritiro. Scaricabile anche con moduli incompleti."
        destra={
          <div className="flex items-center gap-2 shrink-0">
            <a
              className="bottone bottone-primario inline-flex items-center text-[13px]"
              href="/api/export?scarica=1"
            >
              Scarica markdown
            </a>
            <a
              className="bottone inline-flex items-center text-[13px]"
              href="/api/export?formato=json"
            >
              Scarica stato
            </a>
          </div>
        }
      />

      <div className="pannello p-4 flex-1 min-h-0 flex flex-col gap-3">
        <div className="etichetta">anteprima</div>
        <div className="flex-1 min-h-0 overflow-y-auto barra-scorrimento">
          {!caricato ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Generazione in corso…
            </span>
          ) : (
            <pre
              className="mono text-[13px] m-0 whitespace-pre-wrap"
              style={{ color: 'var(--ink)', lineHeight: 1.6 }}
            >
              {markdown}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export function M9Mano() {
  return (
    <CompitoMano titolo="Il verbale" sottotitolo="Disponibile in qualsiasi momento">
      <a
        className="bottone bottone-primario flex items-center justify-center text-center text-[15px]"
        style={{ minHeight: 52 }}
        href="/api/export?scarica=1"
      >
        Scarica il verbale
      </a>
    </CompitoMano>
  );
}
