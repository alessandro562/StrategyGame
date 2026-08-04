'use client';

/**
 * M3 — Mappa dell'ecosistema.
 * Serve a verificare o smentire l'ipotesi che WDA sia un layer fra operatori:
 * è una domanda a cui non si risponde ragionando, ma guardando i flussi.
 *
 * A schermo si dice «collegamento», non «arco»: la parola del grafo resta nel
 * codice. Il numero dominante — i flussi distinti — non compare mai senza la
 * sua glossa, e la diagnosi che ne deriva porta accanto la soglia che la
 * produce, altrimenti «layer parziale» è solo un'etichetta.
 *
 * SVG puro e pointer events, nessuna libreria di grafi.
 */

import { useState, type ReactNode } from 'react';
import { archiAggregati, diagnosiPosizione, flussiDistinti, type DiagnosiPosizione } from '@/lib/calc';
import { BUCKET_GLOSSA, FASI, MODULI, TERMINI } from '@/lib/glossario';
import type { Attore, Sessione } from '@/lib/types';
import { CompitoMano, StatoCommitMano, Vuoto } from '../comune';
import { TestataModulo } from '@/components/TestataModulo';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { useRevealPartito } from '@/components/RevealStage';
import { useBozzaCommit } from '@/net/useBozza';
import { useStore } from '@/net/useStore';

const LATO = 720;
const RAGGIO = 30;

function posizione(a: Attore) {
  return { cx: a.x * LATO, cy: a.y * LATO };
}

/** Riga di istruzione: cosa si deve fare adesso, senza incoraggiamenti. */
function Istruzione({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
      {children}
    </p>
  );
}

/**
 * Le tre diagnosi con la soglia che le produce e cosa vogliono dire.
 * Le soglie sono quelle di diagnosiPosizione(), riportate qui solo per
 * leggerle: la classificazione resta in lib/calc.
 */
const DIAGNOSI_GLOSSA: Record<DiagnosiPosizione, { soglia: string; aiuto: string }> = {
  'Intermediario sostituibile': {
    soglia: '0–1',
    aiuto: 'Chi sta ai due capi può parlarsi direttamente. Togliere WDA di mezzo non rompe niente.',
  },
  'Layer parziale': {
    soglia: '2–3',
    aiuto: 'Presidiamo qualche collegamento, non l’ecosistema. Sostituibili, ma con fatica.',
  },
  Infrastruttura: {
    soglia: '4+',
    aiuto: 'L’ecosistema passa da qui: senza WDA i collegamenti vanno ricostruiti uno per uno.',
  },
};

const SCALA_DIAGNOSI: DiagnosiPosizione[] = [
  'Intermediario sostituibile',
  'Layer parziale',
  'Infrastruttura',
];

export function M3Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const [soloIo, setSoloIo] = useState(false);
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const servizio = stato.servizi.find((s) => s.id === sessione.soggettoId);
  const candidati = stato.servizi.filter((s) => s.bucket === 'NUCLEO' || s.bucket === 'PORTA');
  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';

  const flussi = soloIo ? stato.flussi.filter((f) => f.partecipanteId === stato.io) : stato.flussi;
  const archi = rivelato && partito ? archiAggregati(flussi) : [];
  const distinti = flussiDistinti(stato.flussi);
  const diagnosi = diagnosiPosizione(distinti);

  return (
    <div className="flex flex-col gap-4">
      <TestataModulo
        modulo="M3"
        soggetto={servizio?.nome}
        destra={
          <div className="flex flex-col items-end gap-1 text-right" style={{ maxWidth: '22rem' }}>
            <span className="etichetta">flussi distinti su cui siede WDA</span>
            <span className="mono text-[36px] leading-none">{distinti}</span>
            {/* Il numero grande non resta mai da solo: la definizione arriva
                dal glossario, la diagnosi dice come si legge. */}
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              {TERMINI['flussi distinti']}
            </span>
            <span className="text-[13px]" style={{ color: coloreDiagnosi(distinti) }}>
              {diagnosi}
            </span>
          </div>
        }
      />

      {!servizio && (
        <div className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">
            servizi nel {BUCKET_GLOSSA.NUCLEO.etichetta.toLowerCase()} ({BUCKET_GLOSSA.NUCLEO.standard}) o{' '}
            {BUCKET_GLOSSA.PORTA.etichetta.toLowerCase()} ({BUCKET_GLOSSA.PORTA.standard})
          </span>
          {candidati.length === 0 ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessun servizio classificato: i bucket si assegnano in M1, {MODULI.M1.nome.toLowerCase()}.
            </span>
          ) : (
            <>
              <Istruzione>Apri il round sul servizio da mappare. Si lavora su un servizio per volta.</Istruzione>
              <div className="grid grid-cols-3 gap-2">
                {candidati.map((s) => (
                  <button
                    key={s.id}
                    className="bottone p-3 text-left text-[13px]"
                    onClick={() =>
                      invia('session.create', { modulo: 'M3', titolo: s.nome, soggettoId: s.id, durataS: 240 })
                    }
                  >
                    {s.nome}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="pannello p-2" style={{ width: LATO + 18 }}>
          <svg
            viewBox={`0 0 ${LATO} ${LATO}`}
            width={LATO}
            height={LATO}
            style={{ display: 'block', touchAction: 'none' }}
            onPointerMove={(e) => {
              if (!trascinato) return;
              const r = e.currentTarget.getBoundingClientRect();
              invia('attore.move', {
                attoreId: trascinato,
                x: (e.clientX - r.left) / r.width,
                y: (e.clientY - r.top) / r.height,
              });
            }}
            onPointerUp={() => setTrascinato(null)}
            onPointerLeave={() => setTrascinato(null)}
          >
            <rect width={LATO} height={LATO} style={{ fill: 'var(--bg-deep)' }} />
            {archi.map((a) => {
              const da = stato.attori.find((x) => x.id === a.da);
              const ad = stato.attori.find((x) => x.id === a.a);
              if (!da || !ad) return null;
              const p1 = posizione(da);
              const p2 = posizione(ad);
              return (
                <line
                  key={`${a.da}-${a.a}`}
                  x1={p1.cx}
                  y1={p1.cy}
                  x2={p2.cx}
                  y2={p2.cy}
                  strokeWidth={Math.min(1.5 + a.peso * 1.5, 10)}
                  strokeLinecap="round"
                  style={{ stroke: a.peso > 1 ? 'var(--wda-bright)' : 'var(--ink-faint)' }}
                >
                  <title>{`${da.nome} ↔ ${ad.nome} — ${a.peso} ${a.peso === 1 ? 'persona' : 'persone'}`}</title>
                </line>
              );
            })}
            {stato.attori.map((a) => {
              const { cx, cy } = posizione(a);
              return (
                <g
                  key={a.id}
                  onPointerDown={() => !a.fisso && setTrascinato(a.id)}
                  style={{ cursor: a.fisso ? 'default' : 'grab' }}
                >
                  <title>{a.nome}</title>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={a.fisso ? RAGGIO + 6 : RAGGIO}
                    strokeWidth={a.fisso ? 2 : 1.5}
                    style={{
                      fill: a.fisso ? 'var(--wda)' : 'var(--bg-raised)',
                      stroke: a.fisso ? 'var(--wda-deep)' : 'var(--line-strong)',
                    }}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    style={{
                      fill: a.fisso ? 'var(--ink-inverso)' : 'var(--ink)',
                      fontFamily: 'var(--font-mono)',
                      pointerEvents: 'none',
                    }}
                  >
                    {a.nome.length > 12 ? `${a.nome.slice(0, 11)}…` : a.nome}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="m-0 px-2 pt-2 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Trascina gli attori per disporli. Ogni linea è un collegamento: più è spessa, più persone lo hanno
            tracciato.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {sessione.stato === 'SETUP' && servizio && (
            <Istruzione>
              Disponete gli attori sulla mappa trascinandoli, poi aprite la {FASI.COMMIT.nome.toLowerCase()}: da lì
              ognuno traccia i collegamenti dal proprio telefono.
            </Istruzione>
          )}

          {sessione.stato === 'COMMIT' && (
            <>
              <Istruzione>
                {FASI.COMMIT.nome}: ognuno segna sul telefono quali due attori questo servizio mette in contatto. Non
                cosa consegna: cosa collega. Le risposte restano invisibili finché il round non passa al{' '}
                {FASI.REVEAL.nome.toLowerCase()}.
              </Istruzione>
              <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
            </>
          )}

          <div className="pannello p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="etichetta">come si legge il numero</span>
              <Istruzione>
                La diagnosi dipende da quanti collegamenti distinti passano da noi. La riga in evidenza è quella in cui
                cade il numero adesso.
              </Istruzione>
            </div>
            <div className="flex flex-col gap-2">
              {SCALA_DIAGNOSI.map((d) => {
                const attiva = d === diagnosi;
                return (
                  <div key={d} className="flex items-baseline gap-3">
                    <span
                      className="mono text-[13px] w-8 shrink-0 text-right"
                      style={{ color: attiva ? coloreDiagnosi(distinti) : 'var(--ink-faint)' }}
                    >
                      {DIAGNOSI_GLOSSA[d].soglia}
                    </span>
                    <span className="flex flex-col leading-snug">
                      <span
                        className="text-[15px]"
                        style={{ color: attiva ? coloreDiagnosi(distinti) : 'var(--ink-dim)' }}
                      >
                        {d}
                      </span>
                      <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                        {DIAGNOSI_GLOSSA[d].aiuto}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {rivelato && (
            <div className="pannello p-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="etichetta">collegamenti tracciati</span>
                <Istruzione>
                  Una riga per collegamento: il numero dice quante persone lo hanno tracciato.
                </Istruzione>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="etichetta">vista</span>
                <div className="flex gap-2">
                  <button className="bottone text-[13px]" aria-pressed={!soloIo} onClick={() => setSoloIo(false)}>
                    Tutti
                  </button>
                  <button className="bottone text-[13px]" aria-pressed={soloIo} onClick={() => setSoloIo(true)}>
                    Solo io
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {archi.length === 0 && (
                  <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                    Nessun collegamento tracciato.
                  </span>
                )}
                {[...archi]
                  .sort((a, b) => b.peso - a.peso)
                  .map((a) => (
                    <div key={`${a.da}-${a.a}`} className="flex items-baseline gap-3 text-[13px]">
                      <span className="mono w-8 text-right shrink-0" style={{ color: 'var(--wda-bright)' }}>
                        {a.peso}
                      </span>
                      <span>
                        {stato.attori.find((x) => x.id === a.da)?.nome} ↔{' '}
                        {stato.attori.find((x) => x.id === a.a)?.nome}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {servizio?.nessunFlusso && (
            <div className="pannello p-4 flex flex-col gap-1" style={{ borderColor: 'var(--erosion)' }}>
              <span className="text-[15px]" style={{ color: 'var(--erosion)' }}>
                {servizio.nome}: nessun collegamento
              </span>
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Il servizio consegna un output e basta: non tiene insieme nessuna relazione fra due attori. È
                consulenza tradizionale, la parte del mercato che l’AI sta erodendo.
              </span>
            </div>
          )}

          {rivelato && sessione.stato !== 'LOCKED' && (
            <LockButton
              contenuto={{ servizio: servizio?.nome, flussiDistinti: distinti, diagnosi: diagnosiPosizione(distinti) }}
              lockAValle={stato.lock}
              partecipanti={presenti}
              nome={nome}
              onLock={(contenuto, dissensi, aValle) =>
                invia('lock.create', { sessioneId: sessione.id, contenuto, dissensi, aValle })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function coloreDiagnosi(n: number): string {
  if (n <= 1) return 'var(--erosion)';
  if (n <= 3) return 'var(--tension)';
  return 'var(--live)';
}

/* ------------------------------------------------------------------ */
/* Mano — tap sul nodo di partenza, tap su quello di arrivo            */
/* ------------------------------------------------------------------ */

export function M3Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia } = ctx;
  const [da, setDa] = useState<string | null>(null);
  const servizio = ctx.servizio(sessione.soggettoId);
  const mio = ctx.mioCommit(sessione.id);
  const dalServer = mio?.payload.tipo === 'M3' ? mio.payload.archi : [];
  const [archi, aggiornaArchi] = useBozzaCommit(sessione.id, dalServer);

  if (!stato || !servizio) return <Vuoto>Nessun servizio in mappatura.</Vuoto>;
  const nomeAttore = (id: string) => stato.attori.find((a) => a.id === id)?.nome ?? id;

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano
        titolo={servizio.nome}
        sottotitolo={`${MODULI.M3.breve} — i tuoi collegamenti, in sola lettura`}
      >
        <div className="flex flex-col gap-2">
          {archi.length === 0 ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessun collegamento tracciato.
            </span>
          ) : (
            archi.map((a, i) => (
              <div key={i} className="text-[15px]">
                {nomeAttore(a.da)} ↔ {nomeAttore(a.a)}
              </div>
            ))
          )}
        </div>
      </CompitoMano>
    );
  }

  const salva = (fn: (a: { da: string; a: string }[]) => { da: string; a: string }[]) => {
    const nuovi = aggiornaArchi(fn);
    invia('commit.set', { sessioneId: sessione.id, payload: { tipo: 'M3', archi: nuovi } });
  };

  const tap = (id: string) => {
    if (!da) {
      setDa(id);
      return;
    }
    if (da === id) {
      setDa(null);
      return;
    }
    salva((correnti) =>
      correnti.some((x) => (x.da === da && x.a === id) || (x.da === id && x.a === da))
        ? correnti
        : [...correnti, { da, a: id }],
    );
    setDa(null);
  };

  return (
    <CompitoMano
      titolo={servizio.nome}
      sottotitolo={
        da
          ? `Da ${nomeAttore(da)} — tocca chi sta all’altro capo`
          : 'Tocca due attori che questo servizio mette in contatto'
      }
      azione={
        <div className="flex flex-col gap-2">
          <StatoCommitMano confermato={mio?.confermato ?? false} />
          <button
            className="bottone bottone-primario"
            style={{ minHeight: 52 }}
            disabled={mio?.confermato}
            onClick={() => {
              if (!mio) salva(() => []); // "non collega nulla" è un esito valido e informativo
              invia('commit.confirm', { sessioneId: sessione.id });
            }}
          >
            {mio?.confermato ? 'Confermato' : archi.length === 0 ? 'Conferma: non collega nulla' : 'Conferma'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Istruzione>
          Segna quali attori questo servizio mette in contatto fra loro: non cosa consegna, cosa collega. Tocca prima
          uno, poi l’altro. Se non collega nessuno, conferma senza tracciare nulla.
        </Istruzione>

        <div className="flex flex-col gap-2">
          <span className="etichetta">attori</span>
          <div className="grid grid-cols-2 gap-2">
            {stato.attori.map((a) => (
              <button
                key={a.id}
                className="px-3 text-left text-[15px]"
                aria-pressed={da === a.id}
                style={{
                  minHeight: 48,
                  border: `1px solid ${da === a.id ? 'var(--wda-bright)' : 'var(--line-strong)'}`,
                  background: da === a.id ? 'var(--wda-wash)' : 'var(--bg-raised)',
                  color: a.fisso || da === a.id ? 'var(--wda-bright)' : 'var(--ink)',
                }}
                onClick={() => tap(a.id)}
              >
                {a.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="etichetta">i tuoi collegamenti</span>
          {archi.length === 0 && (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuno. Un servizio può non collegare nulla.
            </span>
          )}
          {archi.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rialzato pl-3 pr-1">
              <span className="text-[15px]">
                {nomeAttore(a.da)} ↔ {nomeAttore(a.a)}
              </span>
              <button
                className="bottone text-[15px] shrink-0"
                style={{ minHeight: 48, minWidth: 48 }}
                aria-label={`Rimuovi il collegamento ${nomeAttore(a.da)} ↔ ${nomeAttore(a.a)}`}
                onClick={() => salva((a) => a.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </CompitoMano>
  );
}
