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
  /**
   * Come si lavora in questa fase. È la distinzione che si perdeva di più:
   * dal nome della fase non si capiva se fosse un momento di gruppo o
   * individuale, e "SETUP" sembrava un'attesa del proprio turno invece che
   * una discussione a voce. In COMMIT nessuno aspetta nessuno: i sei
   * rispondono in parallelo.
   */
  modo: 'insieme' | 'ognuno';
}

const TESTI: Record<StatoSessione, Testo> = {
  SETUP: {
    fase: 'preparazione',
    tavolo: 'Tutti insieme, a voce. Si prepara il round guardando questo schermo.',
    mano: 'Si lavora tutti insieme sullo schermo grande. Qui non serve fare nulla.',
    colore: 'var(--ink-faint)',
    modo: 'insieme',
  },
  COMMIT: {
    fase: 'commit cieco',
    tavolo: 'Ognuno per sé, tutti nello stesso momento. Nessuno vede le risposte degli altri, nemmeno questo schermo.',
    mano: 'Tocca a te, adesso. Rispondi quando vuoi: nessuno aspetta il tuo turno e nessuno vede finché non si rivela.',
    colore: 'var(--live)',
    modo: 'ognuno',
  },
  REVEAL: {
    fase: 'reveal',
    tavolo: 'Tutte le posizioni insieme, nello stesso istante.',
    mano: 'Si guarda insieme sullo schermo grande. La tua risposta non si può più cambiare.',
    colore: 'var(--wda-bright)',
    modo: 'insieme',
  },
  DISCUSSIONE: {
    fase: 'discussione',
    tavolo: 'Tutti insieme. Si negozia, e le divergenze restano registrate.',
    mano: 'Si discute insieme. Hai cambiato idea? Si annota, non si riscrive il commit.',
    colore: 'var(--tension)',
    modo: 'insieme',
  },
  LOCKED: {
    fase: 'bloccato',
    tavolo: 'Decisione registrata, dissensi compresi.',
    mano: 'Deciso. Si passa oltre.',
    colore: 'var(--locked)',
    modo: 'insieme',
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
      <EtichettaModo modo={t.modo} />
      <span className="text-[15px] flex-1 min-w-[200px]" style={{ color: 'var(--ink)' }}>
        {ruolo === 'tavolo' ? t.tavolo : t.mano}
      </span>
      {destra}
    </div>
  );
}

/**
 * Insieme o ognuno per sé. Sta accanto al nome della fase perché è la domanda
 * a cui si risponde per prima entrando in stanza, prima ancora di leggere cosa
 * c'è da fare.
 */
function EtichettaModo({ modo }: { modo: 'insieme' | 'ognuno' }) {
  const insieme = modo === 'insieme';
  return (
    <span
      className="mono text-[11px] shrink-0 px-2 py-1"
      style={{
        letterSpacing: '0.1em',
        border: `1px solid ${insieme ? 'var(--line-strong)' : 'var(--live)'}`,
        color: insieme ? 'var(--ink-dim)' : 'var(--live)',
      }}
    >
      {insieme ? 'TUTTI INSIEME' : 'OGNUNO PER SÉ'}
    </span>
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
    <div className="flex items-start gap-2">
      <EtichettaModo modo={t.modo} />
      <span className="text-[13px] flex-1" style={{ color: 'var(--ink-dim)' }}>
        {t.mano}
      </span>
    </div>
  );
}
