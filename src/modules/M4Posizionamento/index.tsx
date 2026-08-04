'use client';

/**
 * M4 — Mappa di posizionamento.
 * Il vettore fra il centroide di oggi e quello a 12 mesi è la strategia,
 * disegnata. È l'artefatto principale del modulo.
 *
 * «Vettore» da solo non dice niente a chi non l'ha mai visto usare così:
 * ovunque compaia, accanto c'è la frase che lo definisce — da dove siamo a
 * dove vogliamo essere. Lo stesso per le due dispersioni, che sono distanze
 * medie e non punteggi.
 */

import { useState, type ReactNode } from 'react';
import { SOGLIA_DIVERGENZA_OGGI, vettoreStrategia } from '@/lib/calc';
import { FASI, MODULI, TERMINI } from '@/lib/glossario';
import { ASSI_PROPOSTI } from '@/lib/seed';
import type { Sessione } from '@/lib/types';
import { CompitoMano, StatoCommitMano } from '../comune';
import { TestataModulo } from '@/components/TestataModulo';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { useRevealPartito } from '@/components/RevealStage';
import { useStore } from '@/net/useStore';

const LATO = 560;

/**
 * Etichette dei quattro poli: nel campo si legge dove finisce quel testo sulla
 * mappa, non il nome della chiave. «x sinistra» chiedeva di conoscere la
 * convenzione degli assi prima di poter scrivere.
 */
const POLO = {
  xSinistra: 'polo sinistro',
  xDestra: 'polo destro',
  ySotto: 'polo in basso',
  ySopra: 'polo in alto',
} as const;

/** Riga di istruzione: cosa si deve fare adesso, senza incoraggiamenti. */
function Istruzione({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
      {children}
    </p>
  );
}

export function M4Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const asse = stato.assi.find((a) => a.id === stato.workshop.asseCorrenteId) ?? stato.assi[0];
  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';
  const posizionamenti = stato.posizionamenti.filter((p) => p.asseId === asse?.id);
  const v = vettoreStrategia(posizionamenti);

  const px = (x: number) => x * LATO;
  const py = (y: number) => (1 - y) * LATO;

  return (
    <div className="flex flex-col gap-4">
      {/* Il soggetto del round sono gli assi: stanno in testata, perché ai
          bordi della mappa si leggono ruotati e piccoli. */}
      <TestataModulo
        modulo="M4"
        destra={
          asse && (
            <div className="flex flex-col items-end gap-1 text-right" style={{ maxWidth: '22rem' }}>
              <span className="etichetta">assi in uso</span>
              <span className="text-[15px]">
                {asse.xSinistra} ↔ {asse.xDestra}
              </span>
              <span className="text-[15px]" style={{ color: 'var(--ink-dim)' }}>
                {asse.ySotto} ↔ {asse.ySopra}
              </span>
            </div>
          )
        }
      />

      {sessione.stato === 'SETUP' && asse && (
        <div className="pannello p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <span className="etichetta">assi — proposte, non imposte</span>
            <Istruzione>
              Scegliete la coppia di assi su cui piazzarvi, oppure riscrivete i quattro poli qui sotto. Gli assi
              valgono per tutti i piazzamenti di questo round.
            </Istruzione>
            <div className="grid grid-cols-2 gap-3">
              {ASSI_PROPOSTI.map((p, i) => (
                <button
                  key={i}
                  className="bottone text-left text-[13px] p-3 flex flex-col gap-1"
                  onClick={() => invia('entity.upsert', { tipo: 'asse', dati: { ...p, creatoA: Date.now() } })}
                >
                  <span>
                    {p.xSinistra} ↔ {p.xDestra}
                  </span>
                  <span style={{ color: 'var(--ink-dim)' }}>
                    {p.ySotto} ↔ {p.ySopra}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="etichetta">poli dell’asse in uso</span>
            <Istruzione>
              Quello che scrivete qui compare ai bordi della mappa, sul Tavolo e sui telefoni.
            </Istruzione>
            <div className="grid grid-cols-4 gap-3">
              {(['xSinistra', 'xDestra', 'ySotto', 'ySopra'] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="etichetta">{POLO[k]}</span>
                  <input
                    className="w-full text-[13px]"
                    defaultValue={asse[k]}
                    onBlur={(e) =>
                      invia('entity.upsert', { tipo: 'asse', dati: { id: asse.id, [k]: e.target.value } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          {stato.assi.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="etichetta">versioni</span>
              {stato.assi.map((a, i) => (
                <button
                  key={a.id}
                  className="bottone mono text-[13px]"
                  aria-pressed={a.id === asse.id}
                  onClick={() => invia('workshop.update', { asseCorrenteId: a.id })}
                >
                  v{i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="pannello p-4">
          <div className="flex items-center gap-3">
            <div
              className="etichetta"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: LATO, textAlign: 'center' }}
            >
              {asse?.xSinistra}
            </div>

            <div className="flex flex-col gap-2">
              <div className="etichetta text-center">{asse?.ySopra}</div>

              <svg viewBox={`0 0 ${LATO} ${LATO}`} width={LATO} height={LATO} style={{ display: 'block' }}>
                {/* Il contorno sta mezzo pixel dentro, altrimenti il viewBox ne taglia metà. */}
                <g shapeRendering="crispEdges">
                  <rect
                    x={0.5}
                    y={0.5}
                    width={LATO - 1}
                    height={LATO - 1}
                    fill="var(--bg-deep)"
                    stroke="var(--line-strong)"
                  />
                  <line x1={LATO / 2} y1={0} x2={LATO / 2} y2={LATO} stroke="var(--line-strong)" />
                  <line x1={0} y1={LATO / 2} x2={LATO} y2={LATO / 2} stroke="var(--line-strong)" />
                </g>

                {rivelato &&
                  partito &&
                  posizionamenti.map((p) => (
                    <g key={p.partecipanteId}>
                      <line
                        x1={px(p.oggi.x)}
                        y1={py(p.oggi.y)}
                        x2={px(p.futuro.x)}
                        y2={py(p.futuro.y)}
                        stroke="var(--line-strong)"
                        strokeWidth={1}
                      />
                      <circle cx={px(p.oggi.x)} cy={py(p.oggi.y)} r={4} fill="var(--ink-faint)" />
                      <circle
                        cx={px(p.futuro.x)}
                        cy={py(p.futuro.y)}
                        r={4}
                        fill="var(--bg-deep)"
                        stroke="var(--ink-dim)"
                        strokeWidth={1.5}
                      />
                      <text
                        className="mono"
                        x={px(p.oggi.x) + 8}
                        y={py(p.oggi.y) + 4}
                        fontSize={11}
                        fill="var(--ink-faint)"
                      >
                        {nome(p.partecipanteId)}
                      </text>
                    </g>
                  ))}

                {/* Il vettore è visivamente dominante */}
                {rivelato && partito && v.oggi && v.futuro && (
                  <>
                    <defs>
                      <marker id="punta" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L7,3 z" fill="var(--wda-bright)" />
                      </marker>
                    </defs>
                    <circle cx={px(v.oggi.x)} cy={py(v.oggi.y)} r={9} fill="var(--wda)" />
                    <line
                      x1={px(v.oggi.x)}
                      y1={py(v.oggi.y)}
                      x2={px(v.futuro.x)}
                      y2={py(v.futuro.y)}
                      stroke="var(--wda-bright)"
                      strokeWidth={4}
                      markerEnd="url(#punta)"
                    />
                  </>
                )}
              </svg>

              <div className="etichetta text-center">{asse?.ySotto}</div>
            </div>

            <div
              className="etichetta"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: LATO, textAlign: 'center' }}
            >
              {asse?.xDestra}
            </div>
          </div>

          {rivelato && <Legenda />}
        </div>

        <div className="flex flex-col gap-4">
          {sessione.stato === 'COMMIT' && (
            <>
              <Istruzione>
                {FASI.COMMIT.nome}: ognuno piazza sul telefono un punto per oggi e uno per fra dodici mesi. La mappa
                resta vuota finché il round non passa al {FASI.REVEAL.nome.toLowerCase()}.
              </Istruzione>
              <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
            </>
          )}

          {rivelato && (
            <>
              {v.altaDivergenzaOggi && (
                <div className="pannello p-4 flex flex-col gap-2" style={{ borderColor: 'var(--tension)' }}>
                  <p className="m-0 text-[15px]" style={{ color: 'var(--tension)' }}>
                    Alta divergenza su dove siete adesso.
                  </p>
                  <p className="m-0 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
                    Non essere d’accordo su dove andare è normale. Non essere d’accordo su dove si è già significa che
                    state lavorando in aziende diverse.
                  </p>
                </div>
              )}

              <div className="pannello px-4 py-1 flex flex-col divide-y divide-line">
                {/* Ogni misura porta con sé cosa misura: sono distanze sulla
                    mappa, contate in centesimi del lato, non punteggi. */}
                <Misura
                  etichetta="dispersione oggi"
                  valore={(v.dispersioneOggi * 100).toFixed(1)}
                  aiuto={`Quanto distano in media i punti di oggi dal centro del gruppo, in centesimi del lato della mappa. Sopra ${(SOGLIA_DIVERGENZA_OGGI * 100).toFixed(0)} il gruppo non sta descrivendo la stessa azienda.`}
                  allarme={v.altaDivergenzaOggi}
                />
                <Misura
                  etichetta="dispersione 12 mesi"
                  valore={(v.dispersioneFuturo * 100).toFixed(1)}
                  aiuto="La stessa distanza, misurata sui punti a dodici mesi. Qui il disaccordo è la discussione sulla direzione, e ci sta."
                />
                <Misura
                  etichetta="lunghezza del vettore"
                  valore={(v.lunghezza * 100).toFixed(1)}
                  aiuto="Quanto è lungo il salto da dove siamo a dove vogliamo essere. Vicino a zero significa che il gruppo si vede dov’è già."
                />
                <Misura
                  etichetta="piazzamenti"
                  valore={String(posizionamenti.length)}
                  aiuto="Quante persone hanno piazzato i loro due punti su questi assi."
                />
              </div>

              {sessione.stato !== 'LOCKED' && (
                <LockButton
                  contenuto={{ asse, centroidi: { oggi: v.oggi, futuro: v.futuro }, lunghezza: v.lunghezza }}
                  lockAValle={stato.lock}
                  partecipanti={presenti}
                  nome={nome}
                  onLock={(contenuto, dissensi, aValle) =>
                    invia('lock.create', { sessioneId: sessione.id, contenuto, dissensi, aValle })
                  }
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chiave della mappa: cerchio pieno, cerchio vuoto, vettore. */
function Legenda() {
  return (
    <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="flex items-center justify-center gap-6">
        <span className="flex items-center gap-2">
          <svg width={14} height={10} aria-hidden style={{ display: 'block' }}>
            <circle cx={7} cy={5} r={4} fill="var(--ink-faint)" />
          </svg>
          <span className="etichetta">oggi</span>
        </span>
        <span className="flex items-center gap-2">
          <svg width={14} height={10} aria-hidden style={{ display: 'block' }}>
            <circle cx={7} cy={5} r={4} fill="var(--bg-deep)" stroke="var(--ink-dim)" strokeWidth={1.5} />
          </svg>
          <span className="etichetta">12 mesi</span>
        </span>
        <span className="flex items-center gap-2">
          <svg width={24} height={10} aria-hidden style={{ display: 'block' }}>
            <line x1={4} y1={5} x2={24} y2={5} stroke="var(--wda-bright)" strokeWidth={3} />
            <circle cx={4} cy={5} r={4} fill="var(--wda)" />
          </svg>
          <span className="etichetta">vettore</span>
        </span>
      </div>
      {/* La freccia spessa è l'artefatto del modulo: la sua definizione arriva
          dal glossario, non da qui. */}
      <p className="m-0 text-[13px] text-center" style={{ color: 'var(--ink-dim)' }}>
        Vettore: {TERMINI.vettore.charAt(0).toLowerCase() + TERMINI.vettore.slice(1)}
      </p>
    </div>
  );
}

function Misura({
  etichetta,
  valore,
  aiuto,
  allarme,
}: {
  etichetta: string;
  valore: string;
  aiuto?: string;
  allarme?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="flex items-baseline justify-between gap-6">
        <span className="etichetta">{etichetta}</span>
        <span className="mono text-[22px] leading-none" style={{ color: allarme ? 'var(--tension)' : 'var(--ink)' }}>
          {valore}
        </span>
      </div>
      {aiuto && (
        <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          {aiuto}
        </p>
      )}
    </div>
  );
}

export function M4Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia } = ctx;
  const [fase, setFase] = useState<'oggi' | 'futuro'>('oggi');
  const mio = ctx.mioCommit(sessione.id);
  if (!stato) return null;

  const asse = stato.assi.find((a) => a.id === stato.workshop.asseCorrenteId) ?? stato.assi[0];
  const p = mio?.payload.tipo === 'M4' ? mio.payload : null;

  const salva = (punto: { x: number; y: number }) => {
    const prossimo = {
      tipo: 'M4' as const,
      oggi: fase === 'oggi' ? punto : (p?.oggi ?? punto),
      futuro: fase === 'futuro' ? punto : (p?.futuro ?? punto),
    };
    invia('commit.set', { sessioneId: sessione.id, payload: prossimo });
    if (fase === 'oggi') setFase('futuro');
  };

  const sola = sessione.stato !== 'COMMIT';
  const lato = 300;

  return (
    <CompitoMano
      titolo={sola ? 'Il tuo piazzamento' : fase === 'oggi' ? 'Dove siamo oggi' : 'Dove saremo fra 12 mesi'}
      sottotitolo={
        sola
          ? `${MODULI.M4.breve} — in sola lettura`
          : fase === 'oggi'
            ? 'Tocca il punto della mappa che descrive WDA adesso'
            : 'Tocca il punto in cui vuoi che WDA sia fra dodici mesi'
      }
      azione={
        sola ? undefined : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                className="bottone flex-1 flex items-center justify-center gap-2"
                style={{ minHeight: 48 }}
                aria-pressed={fase === 'oggi'}
                onClick={() => setFase('oggi')}
              >
                <span>Oggi</span>
                {p?.oggi && <SegnoPiazzato />}
              </button>
              <button
                className="bottone flex-1 flex items-center justify-center gap-2"
                style={{ minHeight: 48 }}
                aria-pressed={fase === 'futuro'}
                onClick={() => setFase('futuro')}
              >
                <span className="mono">12 mesi</span>
                {p?.futuro && <SegnoPiazzato />}
              </button>
            </div>
            <StatoCommitMano confermato={mio?.confermato ?? false} />
            <button
              className="bottone bottone-primario"
              style={{ minHeight: 56 }}
              disabled={!p || mio?.confermato}
              onClick={() => invia('commit.confirm', { sessioneId: sessione.id })}
            >
              {mio?.confermato ? 'Confermato' : 'Conferma'}
            </button>
          </div>
        )
      }
    >
      <div className="flex justify-center">
        {/* La mappa si adatta alla larghezza del telefono: il tocco resta in
            coordinate relative, quindi la scala non cambia il piazzamento. */}
        <div className="flex items-center gap-2 w-full" style={{ maxWidth: lato + 64 }}>
          <span
            className="etichetta self-center"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {asse?.xSinistra}
          </span>

          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <span className="etichetta text-center">{asse?.ySopra}</span>

            <svg
              viewBox={`0 0 ${lato} ${lato}`}
              style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
              onPointerDown={(e) => {
                if (sola) return;
                const r = e.currentTarget.getBoundingClientRect();
                salva({
                  x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
                  y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
                });
              }}
            >
              <g shapeRendering="crispEdges">
                <rect
                  x={0.5}
                  y={0.5}
                  width={lato - 1}
                  height={lato - 1}
                  fill="var(--bg-panel)"
                  stroke="var(--line-strong)"
                />
                <line x1={lato / 2} y1={0} x2={lato / 2} y2={lato} stroke="var(--line-strong)" />
                <line x1={0} y1={lato / 2} x2={lato} y2={lato / 2} stroke="var(--line-strong)" />
              </g>
              {p?.oggi && p?.futuro && (
                <line
                  x1={p.oggi.x * lato}
                  y1={(1 - p.oggi.y) * lato}
                  x2={p.futuro.x * lato}
                  y2={(1 - p.futuro.y) * lato}
                  stroke="var(--wda-bright)"
                  strokeWidth={2}
                />
              )}
              {p?.oggi && <circle cx={p.oggi.x * lato} cy={(1 - p.oggi.y) * lato} r={8} fill="var(--ink)" />}
              {p?.futuro && (
                <circle
                  cx={p.futuro.x * lato}
                  cy={(1 - p.futuro.y) * lato}
                  r={8}
                  fill="var(--bg-panel)"
                  stroke="var(--wda-bright)"
                  strokeWidth={2}
                />
              )}
            </svg>

            <span className="etichetta text-center">{asse?.ySotto}</span>
          </div>

          <span
            className="etichetta self-center"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {asse?.xDestra}
          </span>
        </div>
      </div>

      {/* Due punti e una linea: qui si dice cosa sono, perché è l'unico posto
          in cui il vettore si vede prima del confronto. */}
      <p className="m-0 mt-3 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        Il punto pieno è oggi, quello vuoto è fra dodici mesi. La linea fra i due è il tuo vettore: da dove siamo a
        dove vogliamo essere.{sola ? '' : ' Puoi tornare su un punto e rifarlo finché non confermi.'}
      </p>
    </CompitoMano>
  );
}

/** Il polo ha già un punto sulla mappa. */
function SegnoPiazzato() {
  return (
    <>
      <span aria-hidden style={{ width: 6, height: 6, background: 'var(--live)' }} />
      <span className="sr-only">piazzato</span>
    </>
  );
}
