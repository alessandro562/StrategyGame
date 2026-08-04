'use client';

/**
 * Pezzi condivisi fra i moduli. Tutto sempre a schermo: nessun accordion,
 * nessun tab durante una sessione attiva (§8.4).
 */

import type { ReactNode } from 'react';
import type { Sessione } from '@/lib/types';

export function Intestazione({
  modulo,
  titolo,
  sottotitolo,
  destra,
}: {
  modulo: string;
  titolo: string;
  sottotitolo?: string;
  destra?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="flex items-baseline gap-3">
          <span className="mono text-[13px]" style={{ color: 'var(--wda-bright)' }}>
            {modulo}
          </span>
          <h1 className="m-0 text-[22px] font-normal" style={{ letterSpacing: '-0.01em' }}>
            {titolo}
          </h1>
        </div>
        {sottotitolo && (
          <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            {sottotitolo}
          </p>
        )}
      </div>
      {destra}
    </div>
  );
}

export function Premessa({ children }: { children: ReactNode }) {
  return (
    <div className="pannello px-4 py-3" style={{ borderLeft: '2px solid var(--wda)' }}>
      <p className="m-0 text-[14px]" style={{ color: 'var(--ink)' }}>
        {children}
      </p>
    </div>
  );
}

export function Vuoto({ children }: { children: ReactNode }) {
  return (
    <div className="pannello p-6 flex items-center justify-center">
      <span className="text-[14px]" style={{ color: 'var(--ink-dim)' }}>
        {children}
      </span>
    </div>
  );
}

/** Un solo compito a schermo per volta, sulla Mano (§8.6). */
export function CompitoMano({
  titolo,
  sottotitolo,
  children,
  azione,
}: {
  titolo: string;
  sottotitolo?: string;
  children: ReactNode;
  azione?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div>
        <h2 className="m-0 text-[17px] font-normal">{titolo}</h2>
        {sottotitolo && (
          <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            {sottotitolo}
          </p>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto barra-scorrimento">{children}</div>
      {azione}
    </div>
  );
}

/** Bersagli di tocco minimo 48px, completabile con un pollice (§8.6). */
export function BottoneTocco({
  attivo,
  colore,
  onClick,
  children,
  disabilitato,
}: {
  attivo?: boolean;
  colore?: string;
  onClick: () => void;
  children: ReactNode;
  disabilitato?: boolean;
}) {
  const c = colore ?? 'var(--wda-bright)';
  return (
    <button
      className="flex-1 flex items-center justify-center text-center px-2"
      style={{
        minHeight: 48,
        border: `1px solid ${attivo ? c : 'var(--line-strong)'}`,
        background: attivo ? c : 'var(--bg-raised)',
        color: attivo ? 'var(--ink-inverso)' : 'var(--ink-dim)',
        fontWeight: attivo ? 500 : 400,
        borderRadius: 'var(--radius)',
      }}
      disabled={disabilitato}
      aria-pressed={attivo}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AttesaMano({ sessione }: { sessione: Sessione | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
      <span className="etichetta">{sessione ? 'si lavora insieme' : 'in attesa'}</span>
      <p className="m-0 text-[17px] text-center" style={{ color: 'var(--ink)' }}>
        {sessione ? `${sessione.modulo} — ${sessione.titolo}` : 'Nessun round aperto'}
      </p>
      <p className="m-0 text-[14px] text-center" style={{ color: 'var(--ink-dim)' }}>
        {sessione
          ? 'Questo momento si fa a voce, guardando lo schermo grande. Quando toccherà a te rispondere in privato, questa schermata cambia da sola.'
          : 'Chi facilita non ha ancora aperto un round.'}
      </p>
    </div>
  );
}

export function StatoCommitMano({ confermato }: { confermato: boolean }) {
  return (
    <span className="etichetta" style={{ color: confermato ? 'var(--live)' : 'var(--tension)' }}>
      {confermato ? 'commit confermato' : 'commit non confermato'}
    </span>
  );
}

export const COLORE_DESTINAZIONE = {
  AI: 'var(--ink-faint)',
  UMANO: 'var(--live)',
  MORTA: 'var(--erosion)',
} as const;
