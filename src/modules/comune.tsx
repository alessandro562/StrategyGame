'use client';

/**
 * Pezzi condivisi fra i moduli. Tutto sempre a schermo: nessun accordion,
 * nessun tab durante una sessione attiva (§8.4).
 */

import type { ReactNode } from 'react';
import type { Sessione } from '@/lib/types';
import { MODULI } from '@/lib/glossario';

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
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="mono text-[13px] shrink-0" style={{ color: 'var(--wda-bright)' }}>
            {modulo}
          </span>
          <h1
            className="m-0 text-[22px] font-normal leading-tight"
            style={{ letterSpacing: '-0.01em' }}
          >
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

/**
 * «Cosa fare adesso», sotto il titolo di una sezione. Stava duplicata identica
 * in sette moduli: la riga di istruzione è un elemento di lingua, e la lingua
 * sta in un posto solo. `centrata` serve ai pannelli a colonna centrata (M5).
 */
export function Istruzione({ children, centrata }: { children: ReactNode; centrata?: boolean }) {
  return (
    <p
      className={`m-0 text-[13px] max-w-[42rem] ${centrata ? 'text-center' : ''}`}
      style={{ color: 'var(--ink-dim)' }}
    >
      {children}
    </p>
  );
}

export function Premessa({ children }: { children: ReactNode }) {
  return (
    <div className="pannello px-4 py-3" style={{ borderLeft: '2px solid var(--wda)' }}>
      {/* 15px, non 14: la premessa è prosa primaria, e il 14 era un gradino
          che nel resto del prodotto non esiste più. */}
      <p className="m-0 text-[15px]" style={{ color: 'var(--ink)' }}>
        {children}
      </p>
    </div>
  );
}

export function Vuoto({ children }: { children: ReactNode }) {
  return (
    <div className="pannello p-6 flex items-center justify-center">
      {/* Stesso corpo e stesso colore dello stato vuoto di FasciaFase: i due
          "qui non c'è niente" dell'app si leggono alla stessa misura. */}
      <span className="text-[15px]" style={{ color: 'var(--ink-dim)' }}>
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
  // Lo stato disabilitato va dichiarato qui: questi colori sono inline e
  // vincono sulla regola `button:disabled` dei token, che quindi da sola non
  // spegnerebbe niente.
  const bordo = disabilitato ? 'var(--line)' : attivo ? c : 'var(--line-strong)';
  return (
    <button
      className="flex-1 flex items-center justify-center text-center px-2 py-2 leading-snug"
      style={{
        minHeight: 48,
        border: `1px solid ${bordo}`,
        background: attivo && !disabilitato ? c : 'var(--bg-raised)',
        color: disabilitato ? 'var(--ink-faint)' : attivo ? 'var(--ink-inverso)' : 'var(--ink-dim)',
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
      {/* Il nome del modulo viene dal glossario, non da `sessione.titolo`: il
          titolo è quello che ha scritto chi facilita, e sul telefono si leggeva
          una lingua diversa da quella dello schermo grande. */}
      <p className="m-0 text-[17px] text-center max-w-[32rem]" style={{ color: 'var(--ink)' }}>
        {sessione ? (
          <>
            <span className="mono" style={{ color: 'var(--wda-bright)' }}>
              {sessione.modulo}
            </span>{' '}
            — {MODULI[sessione.modulo]?.nome ?? sessione.titolo}
          </>
        ) : (
          'Nessun round aperto'
        )}
      </p>
      <p className="m-0 text-[15px] text-center max-w-[32rem]" style={{ color: 'var(--ink-dim)' }}>
        {sessione
          ? 'Questo momento si fa a voce, guardando lo schermo grande. Quando toccherà a te rispondere in privato, questa schermata cambia da sola.'
          : 'Chi facilita non ha ancora aperto un round.'}
      </p>
    </div>
  );
}

/**
 * Stava direttamente sopra ogni bottone di conferma della Mano, ed era l'ultimo
 * posto in cui restava «commit», il gergo che il glossario traduce con
 * «risposta in cieco». Compare su tutte le viste Mano: si riscrive qui una
 * volta per tutti i moduli.
 */
export function StatoCommitMano({ confermato }: { confermato: boolean }) {
  return (
    <span className="etichetta" style={{ color: confermato ? 'var(--live)' : 'var(--tension)' }}>
      {confermato ? 'risposta inviata' : 'risposta non inviata'}
    </span>
  );
}

export const COLORE_DESTINAZIONE = {
  AI: 'var(--ink-faint)',
  UMANO: 'var(--live)',
  MORTA: 'var(--erosion)',
} as const;
