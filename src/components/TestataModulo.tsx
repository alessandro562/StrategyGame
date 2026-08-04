'use client';

/**
 * La testata di ogni modulo.
 *
 * Prima il titolo diceva il nome del servizio e il sottotitolo ripeteva il nome
 * del modulo: «Analisi di mercato» / «Lo smontaggio». Circolare — non diceva a
 * cosa serve il round, cosa si deve fare, né cosa ne esce.
 *
 * Adesso le tre domande hanno una risposta fissa, sempre nello stesso posto e
 * nello stesso ordine, così dopo due moduli si sa già dove guardare:
 *   A COSA SERVE   la domanda a cui il round risponde
 *   COSA SI FA     l'azione concreta, adesso
 *   COSA NE ESCE   l'artefatto, cioè perché vale la pena
 */

import { MODULI } from '@/lib/glossario';
import type { Modulo } from '@/lib/types';

export function TestataModulo({
  modulo,
  soggetto,
  destra,
  senzaComeFunziona,
}: {
  modulo: Modulo;
  /** Su cosa si sta lavorando adesso, es. il nome del servizio in esame. */
  soggetto?: string;
  destra?: React.ReactNode;
  /**
   * Per i moduli che spiegano già altrove come si fa — MQ ha una riga di
   * comandi sotto la testata, e «trascina una carta» detto due volte a
   * quattro centimetri di distanza costa una riga della mappa senza aggiungere
   * niente.
   */
  senzaComeFunziona?: boolean;
}) {
  const m = MODULI[modulo];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="mono text-[13px] shrink-0" style={{ color: 'var(--wda-bright)' }}>
              {m.codice}
            </span>
            <h1 className="m-0 text-[22px] font-normal" style={{ letterSpacing: '-0.01em' }}>
              {soggetto ?? m.nome}
            </h1>
            {soggetto && (
              <span className="text-[15px]" style={{ color: 'var(--ink-dim)' }}>
                — {m.nome}
              </span>
            )}
          </div>
        </div>
        {destra}
      </div>

      <dl className="m-0 grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: 'auto 1fr' }}>
        <Voce etichetta="a cosa serve" testo={m.obiettivo} />
        {!senzaComeFunziona && <Voce etichetta="cosa si fa" testo={m.comeFunziona} />}
        <Voce etichetta="cosa ne esce" testo={m.output} />
      </dl>
    </div>
  );
}

function Voce({ etichetta, testo }: { etichetta: string; testo: string }) {
  return (
    <>
      <dt className="etichetta whitespace-nowrap" style={{ paddingTop: 2 }}>
        {etichetta}
      </dt>
      <dd className="m-0 text-[15px]" style={{ color: 'var(--ink)' }}>
        {testo}
      </dd>
    </>
  );
}

/** Versione compatta per la Mano, dove lo spazio verticale è tutto. */
export function TestataModuloMano({ modulo, soggetto }: { modulo: Modulo; soggetto?: string }) {
  const m = MODULI[modulo];
  return (
    <div className="flex flex-col gap-1">
      <h2 className="m-0 text-[17px] font-normal">{soggetto ?? m.nome}</h2>
      <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        {m.obiettivo}
      </p>
    </div>
  );
}
