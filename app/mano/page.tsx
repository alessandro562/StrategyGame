'use client';

/**
 * /mano — i dispositivi dei partecipanti.
 *
 * Interfaccia separata, non una versione ridotta del Tavolo:
 * un solo compito a schermo, bersagli da 48px, completabile con un pollice.
 * Mostra sempre il proprio cappello, il timer, lo stato del proprio commit.
 * Non mostra mai dati aggregati durante la fase COMMIT.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CODICE_STANZA_DEFAULT } from '@/lib/seed';
import { CtxStore, useContestoMemo, useStore } from '@/net/useStore';
import { esci, usePolling } from '@/net/usePolling';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { Entra } from '@/components/Entra';
import { FacilitatorPanel } from '@/components/FacilitatorPanel';
import { FaseMano, nomeFase } from '@/components/FasciaFase';
import { HatBadge } from '@/components/HatBadge';
import { Monogramma } from '@/components/Logo';
import { Timer } from '@/components/Timer';
import { M0Mano } from '@/modules/M0Setup';
import { M1Mano } from '@/modules/M1Smontaggio';
import { M2Mano } from '@/modules/M2Ripricing';
import { M3Mano } from '@/modules/M3Flussi';
import { M4Mano } from '@/modules/M4Posizionamento';
import { M5Mano } from '@/modules/M5Competitor';
import { M6Mano } from '@/modules/M6Soglia';
import { M7Mano } from '@/modules/M7Invarianti';
import { M8Mano } from '@/modules/M8ActionPlan';
import { M9Mano } from '@/modules/M9Verbale';
import { AttesaMano } from '@/modules/comune';

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <Mano />
    </Suspense>
  );
}

function Mano() {
  const params = useSearchParams();
  const stanza = params.get('r') ?? CODICE_STANZA_DEFAULT;
  const polling = usePolling('mano', stanza);
  const ctx = useContestoMemo(polling);
  const nomi = useNomiLiberi(polling.nonAutenticato);
  const [pannello, setPannello] = useState(false);

  if (polling.nonAutenticato) {
    return <Entra onEntrato={polling.riprendi} nomiSuggeriti={nomi} />;
  }

  // Chi ha i diritti da facilitatore (o il master, sempre) può aprire il
  // pannello anche da qui: non tutti hanno un portatile a portata di mano.
  const puoFacilitare = ctx.stato?.sonoFacilitatore ?? false;

  return (
    <CtxStore.Provider value={ctx}>
      <div className="h-[100dvh] flex flex-col p-4 gap-3" style={{ background: 'var(--bg-deep)' }}>
        <header className="flex items-center gap-3 shrink-0">
          {/* Su fondo chiaro il monogramma va nella variante blu: la bianca
              spariva dentro la pagina. */}
          <Monogramma altezza={20} variante="blu" />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Il proprio nome è il dato più importante dell'intestazione:
                sta alla scala del testo, non a quella secondaria. */}
            <span className="text-[15px] leading-tight truncate">{ctx.io?.nome ?? 'non identificato'}</span>
            <ConnectionBanner rete={polling.rete} inCoda={polling.inCoda} soloLettura={polling.soloLettura} />
          </div>
          <Timer sessione={ctx.sessioneAttiva} ora={polling.ora} />
          {puoFacilitare && (
            <button
              className="bottone text-[13px] shrink-0"
              style={{ minHeight: 48 }}
              onClick={() => setPannello(true)}
            >
              Facilitatore
            </button>
          )}
        </header>

        {pannello && <FacilitatorPanel ctx={ctx} chiudi={() => setPannello(false)} />}

        {ctx.mioCappello && (
          <div className="shrink-0">
            <HatBadge cappello={ctx.mioCappello} />
          </div>
        )}

        <div className="shrink-0">
          <FaseMano sessione={ctx.sessioneAttiva} />
        </div>

        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto barra-scorrimento">
          <VistaModulo />
        </main>

        {/* Il codice del round è contenuto e sta in mono; l'etichetta dice cosa
            si sta leggendo. "esci" era un'etichetta cliccabile alta undici
            pixel: ora è un bottone, con il bersaglio da 48px che vale per tutta
            la Mano. */}
        <footer
          className="shrink-0 flex items-center justify-between gap-3 pt-3"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="etichetta shrink-0">round</span>
            <span className="mono text-[13px] min-w-0 truncate" style={{ color: 'var(--ink-dim)' }}>
              {/* Stesso nome che porta la fascia di fase qui sopra. */}
              {ctx.sessioneAttiva
                ? `${ctx.sessioneAttiva.modulo} · ${nomeFase(ctx.sessioneAttiva.stato)}`
                : 'in attesa'}
            </span>
          </span>
          <button
            className="bottone text-[13px] shrink-0"
            style={{ minHeight: 48, minWidth: 72 }}
            onClick={() => void esci('mano')}
          >
            Esci
          </button>
        </footer>
      </div>
    </CtxStore.Provider>
  );
}

/** I nomi dei posti liberi, per far scegliere con un tocco invece di digitare. */
function useNomiLiberi(serve: boolean): string[] {
  const [nomi, setNomi] = useState<string[]>([]);
  useEffect(() => {
    if (!serve) return;
    void fetch('/api/auth')
      .then((r) => r.json())
      .then((d: { nomi?: string[] }) => setNomi(d.nomi ?? []))
      .catch(() => setNomi([]));
  }, [serve]);
  return nomi;
}

function VistaModulo() {
  const { sessioneAttiva, stato, io } = useStore();

  if (!stato) {
    return <AttesaMano sessione={null} />;
  }

  // Finché non sai chi sei, l'unico compito è dirlo.
  if (!io) return <M0Mano />;

  if (!sessioneAttiva) return <AttesaMano sessione={null} />;

  // In SETUP si lavora tutti insieme sullo schermo grande: mostrare qui il
  // modulo mezzo vuoto faceva sembrare un compito interrotto, o peggio un
  // turno da aspettare. M0 è l'eccezione — lì la Mano serve a presentarsi.
  if (sessioneAttiva.stato === 'SETUP' && sessioneAttiva.modulo !== 'M0') {
    return <AttesaMano sessione={sessioneAttiva} />;
  }

  switch (sessioneAttiva.modulo) {
    case 'M0':
      return <M0Mano />;
    case 'M1':
      return <M1Mano sessione={sessioneAttiva} />;
    case 'M2':
      return <M2Mano sessione={sessioneAttiva} />;
    case 'M3':
      return <M3Mano sessione={sessioneAttiva} />;
    case 'M4':
      return <M4Mano sessione={sessioneAttiva} />;
    case 'M5':
      return <M5Mano sessione={sessioneAttiva} />;
    case 'M6':
      return <M6Mano sessione={sessioneAttiva} />;
    case 'M7':
      return <M7Mano sessione={sessioneAttiva} />;
    case 'M8':
      return <M8Mano />;
    case 'M9':
      return <M9Mano />;
    default:
      return <AttesaMano sessione={sessioneAttiva} />;
  }
}
