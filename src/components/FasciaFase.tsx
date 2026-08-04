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

import type { Modulo, Sessione, StatoSessione } from '@/lib/types';
import { FASI } from '@/lib/glossario';

interface Testo {
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

/**
 * Il nome della fase non si scrive qui: viene da `FASI`. Questa fascia diceva
 * «commit cieco», «reveal», «bloccato» mentre il resto dello schermo, dopo il
 * passaggio al glossario, diceva «risposta in cieco», «confronto», «deciso».
 * Era la contraddizione più visibile del prodotto, su entrambe le viste.
 */
const TESTI: Record<StatoSessione, Testo> = {
  SETUP: {
    tavolo: 'Tutti insieme, a voce. Si prepara il round guardando questo schermo.',
    mano: 'Si lavora tutti insieme sullo schermo grande. Qui non serve fare nulla.',
    colore: 'var(--ink-faint)',
    modo: 'insieme',
  },
  COMMIT: {
    tavolo: 'Ognuno per sé, tutti nello stesso momento. Nessuno vede le risposte degli altri, nemmeno questo schermo.',
    mano: 'Tocca a te, adesso. Rispondi quando vuoi: nessuno aspetta il tuo turno e nessuno vede le risposte finché il round non passa al confronto.',
    colore: 'var(--live)',
    modo: 'ognuno',
  },
  REVEAL: {
    tavolo: 'Tutte le posizioni insieme, nello stesso istante.',
    mano: 'Si guarda insieme sullo schermo grande. La tua risposta non si può più cambiare.',
    colore: 'var(--wda-bright)',
    modo: 'insieme',
  },
  DISCUSSIONE: {
    tavolo: 'Tutti insieme. Si negozia, e le divergenze restano registrate.',
    mano: 'Si discute insieme. Se hai cambiato idea si annota, non si riscrive la risposta.',
    colore: 'var(--tension)',
    modo: 'insieme',
  },
  LOCKED: {
    tavolo: 'Decisione registrata, dissensi compresi.',
    mano: 'Deciso. Si passa oltre.',
    colore: 'var(--locked)',
    modo: 'insieme',
  },
};

/**
 * Due moduli usano SETUP come fase di lavoro invece che di preparazione, e per
 * loro il testo standard è falso: diceva «qui non serve fare nulla» sul telefono
 * mentre lo stesso telefono, tre centimetri più sotto, chiedeva di scrivere. Una
 * fascia che contraddice la schermata che sormonta è peggio di nessuna fascia.
 */
const SETUP_PER_MODULO: Partial<Record<Modulo, Testo>> = {
  MQ: {
    tavolo:
      'Ognuno scrive dal proprio telefono, tutti insieme. Le voci compaiono qui appena arrivano.',
    mano: 'Scrivi tu, adesso. Quante voci vuoi, in qualsiasi casella: non è un voto e non c’è un turno.',
    colore: 'var(--live)',
    modo: 'ognuno',
  },
  M0: {
    tavolo: 'Ognuno si presenta dal proprio telefono. Il tavolo si popola da solo.',
    mano: 'Dì chi sei e che ruolo hai. Serve una volta sola, poi non te lo chiede più.',
    colore: 'var(--live)',
    modo: 'ognuno',
  },
};

function testoFase(sessione: Sessione): Testo {
  if (sessione.stato === 'SETUP') {
    const override = SETUP_PER_MODULO[sessione.modulo];
    if (override) return override;
  }
  return TESTI[sessione.stato];
}

/**
 * Il nome leggibile della fase. Esportato perché la barra del Tavolo e il
 * piede della Mano mostravano la chiave grezza dell'enum (`COMMIT`,
 * `DISCUSSIONE`) mentre questa fascia, sullo stesso schermo e a pochi
 * centimetri di distanza, mostrava lo stesso dato tradotto. Due nomi per la
 * stessa cosa: adesso entrambi leggono `FASI` dal glossario.
 */
export function nomeFase(stato: StatoSessione): string {
  return FASI[stato].nome.toLowerCase();
}

export function FasciaFase({
  sessione,
  ruolo,
  destra,
}: {
  sessione: Sessione | null;
  ruolo: 'tavolo' | 'mano';
  destra?: React.ReactNode;
}) {
  // Stessa griglia dello stato pieno — filetto a sinistra, titolo mono, testo a
  // 15px — così la fascia non si sposta di tre pixel quando si apre un round.
  if (!sessione) {
    return (
      <div
        className="pannello px-4 py-2 flex items-center gap-3 flex-wrap"
        style={{ borderLeft: '3px solid var(--line-strong)' }}
      >
        <span className="mono text-[13px] shrink-0" style={{ color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
          NESSUN ROUND APERTO
        </span>
        <span className="text-[15px] flex-1 min-w-[200px]" style={{ color: 'var(--ink-dim)' }}>
          {ruolo === 'tavolo' ? 'Apri un modulo dal pannello facilitatore.' : 'In attesa che il round venga aperto.'}
        </span>
      </div>
    );
  }

  const t = testoFase(sessione);

  return (
    <div
      className="pannello px-4 py-2 flex items-center gap-3 flex-wrap"
      style={{ borderLeft: `3px solid ${t.colore}` }}
    >
      <span className="mono text-[13px] shrink-0" style={{ color: t.colore, letterSpacing: '0.08em' }}>
        {sessione.modulo} · {FASI[sessione.stato].nome.toUpperCase()}
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
    // Classe .etichetta invece di mono+11px+spaziatura a mano: stessa scala e
    // stessa crenatura di tutte le altre etichette dello schermo.
    <span
      className="etichetta shrink-0 px-2 py-1"
      style={{
        border: `1px solid ${insieme ? 'var(--line-strong)' : 'var(--live)'}`,
        color: insieme ? 'var(--ink-dim)' : 'var(--live)',
      }}
    >
      {insieme ? 'tutti insieme' : 'ognuno per sé'}
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
  const t = testoFase(sessione);
  return (
    <div className="flex items-start gap-3">
      <EtichettaModo modo={t.modo} />
      <span className="text-[13px] flex-1" style={{ color: 'var(--ink-dim)' }}>
        {t.mano}
      </span>
    </div>
  );
}
