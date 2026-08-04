'use client';

/**
 * /mano — i dispositivi dei partecipanti.
 *
 * Interfaccia separata, non una versione ridotta del Tavolo:
 * un solo compito a schermo, bersagli da 48px, completabile con un pollice.
 * Mostra sempre il proprio cappello, il timer, lo stato del proprio commit.
 * Non mostra mai dati aggregati durante la fase COMMIT.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CODICE_STANZA_DEFAULT } from '@/lib/seed';
import { CtxStore, useContestoMemo, useStore } from '@/net/useStore';
import { reimpostaIdentita, usaPid, usePolling } from '@/net/usePolling';
import { ConnectionBanner } from '@/components/ConnectionBanner';
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
  const pid = usaPid('mano');
  const polling = usePolling(pid, 'mano', stanza);
  const ctx = useContestoMemo(polling);

  return (
    <CtxStore.Provider value={ctx}>
      <div className="h-[100dvh] flex flex-col p-4 gap-3" style={{ background: 'var(--bg-deep)' }}>
        <header className="flex items-center gap-3 shrink-0">
          <Monogramma altezza={20} variante="bianco" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] truncate">{ctx.io?.nome ?? 'non identificato'}</div>
            <ConnectionBanner rete={polling.rete} inCoda={polling.inCoda} soloLettura={polling.soloLettura} />
          </div>
          <Timer sessione={ctx.sessioneAttiva} ora={polling.ora} />
        </header>

        {ctx.mioCappello && (
          <div className="shrink-0">
            <HatBadge cappello={ctx.mioCappello} />
          </div>
        )}

        <main className="flex-1 min-h-0 flex flex-col">
          <VistaModulo />
        </main>

        <footer className="shrink-0 flex items-center justify-between">
          <span className="etichetta">
            {ctx.sessioneAttiva ? `${ctx.sessioneAttiva.modulo} · ${ctx.sessioneAttiva.stato}` : 'in attesa'}
          </span>
          <button className="etichetta" onClick={() => reimpostaIdentita('mano')}>
            cambia identità
          </button>
        </footer>
      </div>
    </CtxStore.Provider>
  );
}

function VistaModulo() {
  const { sessioneAttiva, stato, io } = useStore();

  if (!stato) {
    return <AttesaMano sessione={null} />;
  }

  // Finché non sai chi sei, l'unico compito è dirlo.
  if (!io) return <M0Mano />;

  if (!sessioneAttiva) return <AttesaMano sessione={null} />;

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
