'use client';

/**
 * M9 — Il verbale. Nessuno deve scriverlo.
 * L'export è disponibile in qualsiasi momento, non solo a fine ritiro.
 */

import { useEffect, useState } from 'react';
import { MODULI } from '@/lib/glossario';
import { CompitoMano } from '../comune';
import { TestataModulo } from '@/components/TestataModulo';
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
      <TestataModulo
        modulo="M9"
        destra={
          <div className="flex flex-col items-end gap-2 shrink-0" style={{ maxWidth: '20rem' }}>
            <div className="flex items-center gap-2">
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
            <span className="text-[13px] text-right" style={{ color: 'var(--ink-dim)' }}>
              Il markdown è il verbale da leggere e girare. Lo stato è il file tecnico della sessione, serve per
              riaprirla altrove.
            </span>
          </div>
        }
      />

      <div className="pannello p-4 flex-1 min-h-0 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="etichetta">anteprima</div>
          <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            È il documento che si scarica, aggiornato a questo momento. Si riscrive da solo a ogni decisione chiusa:
            non serve prendere appunti.
          </p>
        </div>
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
    <CompitoMano titolo={MODULI.M9.nome} sottotitolo={MODULI.M9.obiettivo}>
      <div className="flex flex-col gap-2">
        <a
          className="bottone bottone-primario flex items-center justify-center text-center text-[15px]"
          style={{ minHeight: 52 }}
          href="/api/export?scarica=1"
        >
          Scarica il verbale
        </a>
        <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          {MODULI.M9.output} Si scarica anche a ritiro in corso, con i moduli ancora aperti.
        </span>
      </div>
    </CompitoMano>
  );
}
