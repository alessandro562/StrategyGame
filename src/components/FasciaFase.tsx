'use client';

/**
 * Cosa sta succedendo, adesso.
 *
 * Mancava, e si vedeva: chi guardava il Tavolo doveva dedurre la fase dal
 * fatto che comparisse un contatore, e chi aveva la Mano in mano non sapeva se
 * stava aspettando o se toccava a lui.
 *
 * Il coinvolgimento qui non arriva da badge o incoraggiamenti — il documento
 * li vieta, e con un team senior brucerebbero la credibilità in un minuto.
 * Arriva dal sapere sempre tre cose: in che punto siamo, cosa ci si aspetta da
 * me, quanto manca.
 */

import type { Sessione, StatoSessione } from '@/lib/types';

interface Testo {
  fase: string;
  tavolo: string;
  mano: string;
  colore: string;
}

const TESTI: Record<StatoSessione, Testo> = {
  SETUP: {
    fase: 'preparazione',
    tavolo: 'Si prepara il round. Il contenuto è in sola lettura.',
    mano: 'Non tocca ancora a te. Guarda lo schermo grande.',
    colore: 'var(--ink-faint)',
  },
  COMMIT: {
    fase: 'commit cieco',
    tavolo: 'Ognuno risponde in privato. Nessuno vede le risposte degli altri, nemmeno questo schermo.',
    mano: 'Rispondi. Nessuno vede la tua risposta finché non si rivela.',
    colore: 'var(--live)',
  },
  REVEAL: {
    fase: 'reveal',
    tavolo: 'Tutte le posizioni insieme.',
    mano: 'Le risposte sono sullo schermo grande. La tua non si può più cambiare.',
    colore: 'var(--wda-bright)',
  },
  DISCUSSIONE: {
    fase: 'discussione',
    tavolo: 'Si negozia. Le divergenze restano registrate.',
    mano: 'Hai cambiato idea? Si annota, non si riscrive il commit.',
    colore: 'var(--tension)',
  },
  LOCKED: {
    fase: 'bloccato',
    tavolo: 'Decisione registrata, dissensi compresi.',
    mano: 'Deciso. Si passa oltre.',
    colore: 'var(--locked)',
  },
};

export function FasciaFase({
  sessione,
  ruolo,
  destra,
}: {
  sessione: Sessione | null;
  ruolo: 'tavolo' | 'mano';
  destra?: React.ReactNode;
}) {
  if (!sessione) {
    return (
      <div className="pannello px-4 py-2 flex items-center gap-3">
        <span className="etichetta">nessun round aperto</span>
        <span className="text-[14px]" style={{ color: 'var(--ink-dim)' }}>
          {ruolo === 'tavolo' ? 'Apri un modulo dal pannello facilitatore.' : 'In attesa che il round venga aperto.'}
        </span>
      </div>
    );
  }

  const t = TESTI[sessione.stato];

  return (
    <div
      className="pannello px-4 py-2 flex items-center gap-4 flex-wrap"
      style={{ borderLeft: `3px solid ${t.colore}` }}
    >
      <span className="mono text-[13px] shrink-0" style={{ color: t.colore, letterSpacing: '0.08em' }}>
        {sessione.modulo} · {t.fase.toUpperCase()}
      </span>
      <span className="text-[15px] flex-1 min-w-[200px]" style={{ color: 'var(--ink)' }}>
        {ruolo === 'tavolo' ? t.tavolo : t.mano}
      </span>
      {destra}
    </div>
  );
}

/** Versione a una riga per la Mano, dove lo spazio verticale è tutto. */
export function FaseMano({ sessione }: { sessione: Sessione | null }) {
  if (!sessione) {
    return (
      <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        In attesa che il round venga aperto.
      </span>
    );
  }
  const t = TESTI[sessione.stato];
  return (
    <span className="text-[13px] flex items-center gap-2">
      <span className="inline-block w-2 h-2 shrink-0" style={{ background: t.colore }} />
      <span style={{ color: 'var(--ink-dim)' }}>{t.mano}</span>
    </span>
  );
}
