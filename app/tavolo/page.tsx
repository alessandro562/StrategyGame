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
import { usePolling } from '@/net/usePolling';
import { AttesaCommit } from '@/components/AttesaCommit';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { Entra } from '@/components/Entra';
import { FasciaFase, nomeFase } from '@/components/FasciaFase';
import { FacilitatorPanel } from '@/components/FacilitatorPanel';
import { IndiceProgramma } from '@/components/IndiceProgramma';
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
import { MQTavolo } from '@/modules/MQQuadro';
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
  const polling = usePolling('tavolo', stanza);
  const { invia } = polling;
  const ctx = useContestoMemo(polling);
  const [pannello, setPannello] = useState(false);
  const [urlMano, setUrlMano] = useState('');
  const [scala, setScala] = useScalaSala();

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
    if (!senzaFacilitatore || rivendicato.current) return;
    rivendicato.current = true;
    invia('workshop.rivendicaFacilitatore', {});
  }, [senzaFacilitatore, invia]);

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

  // Dopo tutti gli hook, mai prima: l'ordine degli hook non può cambiare fra un
  // render e l'altro.
  if (polling.nonAutenticato) {
    return <Entra onEntrato={polling.riprendi} />;
  }

  return (
    <CtxStore.Provider value={ctx}>
      <div
        className="h-screen flex flex-col sala"
        style={{ background: 'var(--bg-deep)', ['--scala' as string]: scala }}
      >
        {/* Barra superiore: marchio e nome della stanza a sinistra, le letture
            (round, timer, rete) al centro, i comandi a destra dopo un filetto.
            Va a capo invece di tagliare: a scala 2 la riga non ci sta, e un
            comando che finisce fuori dal proiettore è un comando perso. */}
        <header
          className="flex items-center flex-wrap gap-x-5 gap-y-2 px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-panel)' }}
        >
          {/* Su fondo chiaro il marchio va nella variante blu. */}
          <Logo altezza={22} variante="blu" />
          {/* Il nome della stanza è contenuto, non un'etichetta: in
              maiuscoletto spaziato si leggeva come intestazione di un campo. */}
          <span className="text-[15px]">{s?.workshop.nome ?? 'WDA Strategy Room'}</span>
          <div className="flex-1" />

          {sessione && (
            <span className="flex items-baseline gap-2">
              <span className="etichetta">round</span>
              {/* Il nome della fase è quello della fascia, non la chiave
                  dell'enum: sullo stesso schermo la stessa cosa si chiama in
                  un modo solo. */}
              <span className="mono text-[13px]" style={{ color: 'var(--wda-bright)' }}>
                {sessione.modulo} · {nomeFase(sessione.stato)}
              </span>
            </span>
          )}
          <Timer sessione={sessione} ora={polling.ora} />
          <ConnectionBanner rete={polling.rete} inCoda={polling.inCoda} soloLettura={polling.soloLettura} />

          <span aria-hidden className="self-stretch" style={{ width: 1, background: 'var(--line)' }} />

          <div className="flex items-center gap-2">
            <ControlloScala scala={scala} setScala={setScala} />
            {facilitatoreAltrove && (
              <button
                className="bottone text-[13px]"
                style={{ borderColor: 'var(--tension)', color: 'var(--tension)' }}
                onClick={() => polling.invia('workshop.rivendicaFacilitatore', {})}
              >
                Prendi il ruolo
              </button>
            )}
            <button className="bottone text-[13px]" onClick={() => setPannello(true)}>
              Facilitatore
            </button>
          </div>
        </header>

        {/* Dove siamo nell'arco delle nove tappe. Sta sopra la fascia di fase
            perché risponde a una domanda che viene prima: non "cosa sto
            facendo adesso" ma "a che punto siamo". */}
        <div className="px-5 pt-3 shrink-0">
          <IndiceProgramma sessioni={s?.sessioni ?? []} moduloCorrente={sessione?.modulo ?? null} />
        </div>

        <div className="px-5 py-3 shrink-0 flex gap-3 items-stretch flex-wrap">
          <div className="flex-1 min-w-[420px]">
            <FasciaFase sessione={sessione} ruolo="tavolo" />
          </div>
          {ind && <IndicatorStrip i={ind} />}
        </div>

        {riaperture.riaperti.length > 0 && (
          <div className="px-5 pb-3 shrink-0">
            <BannerRiapertura
              riaperti={riaperture.riaperti}
              aValle={riaperture.aValle}
              onRiconferma={(lockId) => polling.invia('lock.reconfirm', { lockId })}
            />
          </div>
        )}

        <div className="flex-1 min-h-0 flex gap-3 px-5 pb-3">
          <main className="flex-1 min-w-0 overflow-y-auto barra-scorrimento flex flex-col gap-3">
            {!s ? (
              <Vuoto>Collegamento in corso…</Vuoto>
            ) : !sessione ? (
              <M0Tavolo urlMano={urlMano} />
            ) : (
              <>
                <VistaModulo />
                {/* M5 ha già il proprio timer dominante: non se ne mostrano due. */}
                {sessione.stato === 'COMMIT' && sessione.modulo !== 'M5' && (
                  <AttesaCommit sessione={sessione} ora={polling.ora} nome={ctx.nome} />
                )}
              </>
            )}
          </main>

          {s && <VulnerabilityRail vulnerabilita={s.vulnerabilita} competitor={s.competitor} />}
        </div>

        {sessione && Object.keys(sessione.cappelli).length > 0 && (
          <footer className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
            <MappaCappelli cappelli={sessione.cappelli} nome={ctx.nome} />
          </footer>
        )}

        {!sessione && Object.keys(storico).length > 0 && (
          // Etichetta e contenuto su due colonne, non un'unica riga con i due
          // punti dentro l'etichetta: l'elenco parte sempre dallo stesso punto.
          <footer
            className="px-5 py-3 shrink-0 flex items-baseline gap-3"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <span className="etichetta shrink-0">cappelli già portati</span>
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
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

/**
 * Ingrandimento della vista di sala, regolabile e ricordato.
 * Nessun valore fisso va bene: dipende da quanto è grande il muro e da quanto
 * lontano siedono le persone, e lo si scopre solo una volta lì.
 */
function useScalaSala(): [number, (v: number) => void] {
  const [scala, setScalaStato] = useState(1);
  useEffect(() => {
    const salvata = Number(window.localStorage.getItem('wda:scala') ?? '1');
    if (salvata >= 0.8 && salvata <= 2) setScalaStato(salvata);
  }, []);
  const setScala = (v: number) => {
    const limitata = Math.min(2, Math.max(0.8, Number(v.toFixed(2))));
    setScalaStato(limitata);
    window.localStorage.setItem('wda:scala', String(limitata));
  };
  return [scala, setScala];
}

function ControlloScala({ scala, setScala }: { scala: number; setScala: (v: number) => void }) {
  return (
    // I due bottoni tornano all'altezza standard degli altri comandi della
    // barra: con un padding proprio restavano più bassi e la riga si scaleggiava.
    // La percentuale è un valore letto da lontano, non una didascalia: sta alla
    // scala del testo, non a quella delle etichette, e in una casella di
    // larghezza fissa perché passando da 90% a 100% i bottoni non si spostino.
    <div className="flex items-center gap-2" title="Dimensione della vista di sala">
      <span className="etichetta">scala</span>
      <div className="flex items-center gap-1">
        <button
          className="bottone mono text-[13px]"
          onClick={() => setScala(scala - 0.1)}
          disabled={scala <= 0.8}
          aria-label="Riduci la vista di sala"
        >
          A−
        </button>
        <span className="mono text-[13px] w-12 text-center" style={{ color: 'var(--ink)' }}>
          {Math.round(scala * 100)}%
        </span>
        <button
          className="bottone mono text-[13px]"
          onClick={() => setScala(scala + 0.1)}
          disabled={scala >= 2}
          aria-label="Ingrandisci la vista di sala"
        >
          A+
        </button>
      </div>
    </div>
  );
}

function VistaModulo() {
  const { sessioneAttiva, stato } = useStore();
  const [urlMano, setUrlMano] = useState('');
  useEffect(() => setUrlMano(`${window.location.origin}/mano`), []);
  if (!sessioneAttiva || !stato) return null;

  switch (sessioneAttiva.modulo) {
    case 'MQ':
      return <MQTavolo sessione={sessioneAttiva} />;
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
