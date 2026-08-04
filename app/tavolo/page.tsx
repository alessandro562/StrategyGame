'use client';

/**
 * /tavolo — la vista proiettata in sala.
 * Densa, tutto sempre a schermo, nessun accordion durante una sessione attiva.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { daRiconvalidare, indicatori, storicoCappelli } from '@/lib/calc';
import { CODICE_STANZA_DEFAULT } from '@/lib/seed';
import { CtxStore, useContestoMemo, useStore } from '@/net/useStore';
import { usaPid, usePolling } from '@/net/usePolling';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { FacilitatorPanel } from '@/components/FacilitatorPanel';
import { MappaCappelli } from '@/components/HatBadge';
import { IndicatorStrip } from '@/components/IndicatorStrip';
import { BannerRiapertura } from '@/components/LockButton';
import { Logo } from '@/components/Logo';
import { Timer } from '@/components/Timer';
import { VulnerabilityRail } from '@/components/VulnerabilityRail';
import { M0Tavolo } from '@/modules/M0Setup';
import { M1Tavolo } from '@/modules/M1Smontaggio';
import { M2Tavolo } from '@/modules/M2Ripricing';
import { M3Tavolo } from '@/modules/M3Flussi';
import { M4Tavolo } from '@/modules/M4Posizionamento';
import { M5Tavolo } from '@/modules/M5Competitor';
import { M6Tavolo } from '@/modules/M6Soglia';
import { M7Tavolo } from '@/modules/M7Invarianti';
import { M8Tavolo } from '@/modules/M8ActionPlan';
import { M9Tavolo } from '@/modules/M9Verbale';
import { Vuoto } from '@/modules/comune';

export default function Pagina() {
  return (
    <Suspense fallback={null}>
      <Tavolo />
    </Suspense>
  );
}

function Tavolo() {
  const params = useSearchParams();
  const stanza = params.get('r') ?? CODICE_STANZA_DEFAULT;
  const pid = usaPid('tavolo');
  const polling = usePolling(pid, 'tavolo', stanza);
  const { invia } = polling;
  const ctx = useContestoMemo(polling);
  const [pannello, setPannello] = useState(false);
  const [urlMano, setUrlMano] = useState('');

  useEffect(() => {
    setUrlMano(`${window.location.origin}/mano?r=${encodeURIComponent(stanza)}`);
  }, [stanza]);

  // Il Tavolo è il primo client ad aprirsi: se nessuno ha ancora il ruolo, lo
  // prende. Se ce l'ha già un altro schermo non glielo strappa da solo — serve
  // un gesto esplicito, altrimenti due Tavoli aperti se lo passerebbero avanti
  // e indietro a ogni polling.
  const facilitatoreAltrove = !!polling.stato && !polling.stato.sonoFacilitatore;
  const rivendicato = useRef(false);
  const senzaFacilitatore = polling.stato?.workshop.facilitatoreId === null;
  useEffect(() => {
    // Una volta sola: la rivendicazione impiega un giro di polling ad arrivare,
    // e nel frattempo ogni render rimetterebbe in coda la stessa azione.
    if (!pid || !senzaFacilitatore || rivendicato.current) return;
    rivendicato.current = true;
    invia('participant.join', { nome: 'Tavolo', comeFacilitatore: true });
  }, [pid, senzaFacilitatore, invia]);

  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPannello((v) => !v);
      }
    };
    window.addEventListener('keydown', suTasto);
    return () => window.removeEventListener('keydown', suTasto);
  }, []);

  const s = polling.stato;
  const sessione = ctx.sessioneAttiva;

  const ind = useMemo(() => {
    if (!s) return null;
    return indicatori(
      s.sessioni,
      s.commits,
      s.lock,
      s.servizi,
      s.vulnerabilita.filter((v) => v.chiusaA === null).length,
      s.workshop.lockPrevisti,
    );
  }, [s]);

  const riaperture = useMemo(() => (s ? daRiconvalidare(s.lock) : { riaperti: [], aValle: [] }), [s]);
  const storico = useMemo(() => (s ? storicoCappelli(s.sessioni) : {}), [s]);

  return (
    <CtxStore.Provider value={ctx}>
      <div className="h-screen flex flex-col" style={{ background: 'var(--bg-deep)' }}>
        {/* Barra superiore: timer onnipresente, marchio, stato rete */}
        <header
          className="flex items-center gap-6 px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-panel)' }}
        >
          <Logo altezza={22} />
          <span className="etichetta">{s?.workshop.nome ?? 'WDA Strategy Room'}</span>
          <div className="flex-1" />
          {sessione && (
            <span className="mono text-[13px]" style={{ color: 'var(--wda-bright)' }}>
              {sessione.modulo} · {sessione.stato}
            </span>
          )}
          <Timer sessione={sessione} ora={polling.ora} />
          <ConnectionBanner rete={polling.rete} inCoda={polling.inCoda} soloLettura={polling.soloLettura} />
          {facilitatoreAltrove && (
            <button
              className="bottone text-[12px]"
              style={{ borderColor: 'var(--tension)', color: 'var(--tension)' }}
              onClick={() => polling.invia('participant.join', { nome: 'Tavolo', comeFacilitatore: true })}
            >
              Prendi il ruolo
            </button>
          )}
          <button className="bottone text-[12px]" onClick={() => setPannello(true)}>
            Facilitatore
          </button>
        </header>

        {ind && (
          <div className="px-5 py-2 shrink-0">
            <IndicatorStrip i={ind} />
          </div>
        )}

        {riaperture.riaperti.length > 0 && (
          <div className="px-5 pb-2 shrink-0">
            <BannerRiapertura
              riaperti={riaperture.riaperti}
              aValle={riaperture.aValle}
              onRiconferma={(lockId) => polling.invia('lock.reconfirm', { lockId })}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-4 px-5 pb-4">
          <main className="flex-1 min-w-0 overflow-y-auto barra-scorrimento">
            {!s ? (
              <Vuoto>Collegamento in corso…</Vuoto>
            ) : !sessione ? (
              <M0Tavolo urlMano={urlMano} />
            ) : (
              <VistaModulo />
            )}
          </main>

          {s && <VulnerabilityRail vulnerabilita={s.vulnerabilita} competitor={s.competitor} />}
        </div>

        {sessione && Object.keys(sessione.cappelli).length > 0 && (
          <footer className="px-5 py-2 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
            <MappaCappelli cappelli={sessione.cappelli} nome={ctx.nome} />
          </footer>
        )}

        {!sessione && Object.keys(storico).length > 0 && (
          <footer className="px-5 py-2 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
            <span className="etichetta">cappelli già portati: </span>
            <span className="text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              {Object.entries(storico)
                .map(([pidx, c]) => `${ctx.nome(pidx)} ${c.join('/')}`)
                .join(' · ')}
            </span>
          </footer>
        )}

        {pannello && <FacilitatorPanel ctx={ctx} chiudi={() => setPannello(false)} />}
      </div>
    </CtxStore.Provider>
  );
}

function VistaModulo() {
  const { sessioneAttiva, stato } = useStore();
  const [urlMano, setUrlMano] = useState('');
  useEffect(() => setUrlMano(`${window.location.origin}/mano`), []);
  if (!sessioneAttiva || !stato) return null;

  switch (sessioneAttiva.modulo) {
    case 'M0':
      return <M0Tavolo urlMano={urlMano} />;
    case 'M1':
      return <M1Tavolo sessione={sessioneAttiva} />;
    case 'M2':
      return <M2Tavolo sessione={sessioneAttiva} />;
    case 'M3':
      return <M3Tavolo sessione={sessioneAttiva} />;
    case 'M4':
      return <M4Tavolo sessione={sessioneAttiva} />;
    case 'M5':
      return <M5Tavolo sessione={sessioneAttiva} />;
    case 'M6':
      return <M6Tavolo sessione={sessioneAttiva} />;
    case 'M7':
      return <M7Tavolo sessione={sessioneAttiva} />;
    case 'M8':
      return <M8Tavolo sessione={sessioneAttiva} />;
    case 'M9':
      return <M9Tavolo />;
    default:
      return <Vuoto>Modulo non riconosciuto.</Vuoto>;
  }
}
