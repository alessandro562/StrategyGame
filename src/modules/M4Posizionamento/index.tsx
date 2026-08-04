'use client';

/**
 * M4 — Il posizionamento.
 * Il vettore fra il centroide di oggi e quello a 12 mesi è la strategia,
 * disegnata. È l'artefatto principale del modulo.
 */

import { useState } from 'react';
import { vettoreStrategia } from '@/lib/calc';
import { ASSI_PROPOSTI } from '@/lib/seed';
import type { Sessione } from '@/lib/types';
import { CompitoMano, Intestazione, StatoCommitMano } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { useRevealPartito } from '@/components/RevealStage';
import { useStore } from '@/net/useStore';

const LATO = 560;

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
      <Intestazione modulo="M4" titolo="Il posizionamento" sottotitolo="Dove siamo, dove saremo fra 12 mesi" />

      {sessione.stato === 'SETUP' && asse && (
        <div className="pannello p-4 flex flex-col gap-3">
          <span className="etichetta">assi — proposte, non imposte</span>
          <div className="grid grid-cols-2 gap-2">
            {ASSI_PROPOSTI.map((p, i) => (
              <button
                key={i}
                className="bottone text-left text-[13px] p-3"
                onClick={() => invia('entity.upsert', { tipo: 'asse', dati: { ...p, creatoA: Date.now() } })}
              >
                <div>
                  {p.xSinistra} ↔ {p.xDestra}
                </div>
                <div style={{ color: 'var(--ink-dim)' }}>
                  {p.ySotto} ↔ {p.ySopra}
                </div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(['xSinistra', 'xDestra', 'ySotto', 'ySopra'] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="etichetta">{k}</span>
                <input
                  className="text-[13px]"
                  defaultValue={asse[k]}
                  onBlur={(e) => invia('entity.upsert', { tipo: 'asse', dati: { id: asse.id, [k]: e.target.value } })}
                />
              </label>
            ))}
          </div>
          {stato.assi.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <span className="etichetta self-center">versioni</span>
              {stato.assi.map((a, i) => (
                <button
                  key={a.id}
                  className="bottone text-[12px]"
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
        <div className="pannello p-4" style={{ width: LATO + 120 }}>
          <div className="text-center etichetta mb-1">{asse?.ySopra}</div>
          <div className="flex items-center gap-2">
            <div
              className="etichetta"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: LATO, textAlign: 'center' }}
            >
              {asse?.xSinistra}
            </div>
            <svg viewBox={`0 0 ${LATO} ${LATO}`} width={LATO} height={LATO} style={{ display: 'block' }}>
              <rect width={LATO} height={LATO} fill="var(--bg-deep)" stroke="var(--line)" />
              <line x1={LATO / 2} y1={0} x2={LATO / 2} y2={LATO} stroke="var(--line)" />
              <line x1={0} y1={LATO / 2} x2={LATO} y2={LATO / 2} stroke="var(--line)" />

              {rivelato &&
                partito &&
                posizionamenti.map((p) => (
                  <g key={p.partecipanteId}>
                    <circle cx={px(p.oggi.x)} cy={py(p.oggi.y)} r={4} fill="var(--ink-faint)" />
                    <circle
                      cx={px(p.futuro.x)}
                      cy={py(p.futuro.y)}
                      r={4}
                      fill="none"
                      stroke="var(--ink-dim)"
                      strokeWidth={1}
                    />
                    <line
                      x1={px(p.oggi.x)}
                      y1={py(p.oggi.y)}
                      x2={px(p.futuro.x)}
                      y2={py(p.futuro.y)}
                      stroke="var(--line-strong)"
                      strokeWidth={1}
                    />
                    <text
                      x={px(p.oggi.x) + 7}
                      y={py(p.oggi.y) + 3}
                      fontSize={10}
                      fill="var(--ink-faint)"
                      fontFamily="var(--font-mono)"
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
            <div
              className="etichetta"
              style={{ writingMode: 'vertical-rl', height: LATO, textAlign: 'center' }}
            >
              {asse?.xDestra}
            </div>
          </div>
          <div className="text-center etichetta mt-1">{asse?.ySotto}</div>
        </div>

        <div className="flex flex-col gap-4">
          {sessione.stato === 'COMMIT' && <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />}

          {rivelato && (
            <>
              {v.altaDivergenzaOggi && (
                <div className="pannello p-4" style={{ borderColor: 'var(--tension)' }}>
                  <p className="m-0 text-[15px]" style={{ color: 'var(--tension)' }}>
                    Alta divergenza su dove siete adesso. Non essere d’accordo su dove andare è normale. Non essere
                    d’accordo su dove si è già significa che state lavorando in aziende diverse.
                  </p>
                </div>
              )}

              <div className="pannello p-4 grid grid-cols-2 gap-3">
                <Misura etichetta="dispersione oggi" valore={(v.dispersioneOggi * 100).toFixed(1)} allarme={v.altaDivergenzaOggi} />
                <Misura etichetta="dispersione 12 mesi" valore={(v.dispersioneFuturo * 100).toFixed(1)} />
                <Misura etichetta="lunghezza del vettore" valore={(v.lunghezza * 100).toFixed(1)} />
                <Misura etichetta="piazzamenti" valore={String(posizionamenti.length)} />
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

function Misura({ etichetta, valore, allarme }: { etichetta: string; valore: string; allarme?: boolean }) {
  return (
    <div>
      <div className="etichetta">{etichetta}</div>
      <div className="mono text-[24px]" style={{ color: allarme ? 'var(--tension)' : 'var(--ink)' }}>
        {valore}
      </div>
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
      sottotitolo={sola ? 'In sola lettura' : 'Tocca il punto sulla mappa'}
      azione={
        sola ? undefined : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <button className="bottone flex-1" style={{ minHeight: 44 }} aria-pressed={fase === 'oggi'} onClick={() => setFase('oggi')}>
                oggi {p?.oggi ? '✓' : ''}
              </button>
              <button className="bottone flex-1" style={{ minHeight: 44 }} aria-pressed={fase === 'futuro'} onClick={() => setFase('futuro')}>
                12 mesi {p?.futuro ? '✓' : ''}
              </button>
            </div>
            <StatoCommitMano confermato={mio?.confermato ?? false} />
            <button
              className="bottone bottone-primario"
              style={{ minHeight: 52 }}
              disabled={!p || mio?.confermato}
              onClick={() => invia('commit.confirm', { sessioneId: sessione.id })}
            >
              {mio?.confermato ? 'Confermato' : 'Conferma'}
            </button>
          </div>
        )
      }
    >
      <div className="flex flex-col items-center gap-1">
        <span className="etichetta">{asse?.ySopra}</span>
        <div className="flex items-center gap-1">
          <span className="etichetta" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            {asse?.xSinistra}
          </span>
          <svg
            viewBox={`0 0 ${lato} ${lato}`}
            width={lato}
            height={lato}
            style={{ display: 'block', touchAction: 'none' }}
            onPointerDown={(e) => {
              if (sola) return;
              const r = e.currentTarget.getBoundingClientRect();
              salva({
                x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
                y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
              });
            }}
          >
            <rect width={lato} height={lato} fill="var(--bg-panel)" stroke="var(--line-strong)" />
            <line x1={lato / 2} y1={0} x2={lato / 2} y2={lato} stroke="var(--line)" />
            <line x1={0} y1={lato / 2} x2={lato} y2={lato / 2} stroke="var(--line)" />
            {p?.oggi && <circle cx={p.oggi.x * lato} cy={(1 - p.oggi.y) * lato} r={8} fill="var(--ink-dim)" />}
            {p?.futuro && (
              <circle
                cx={p.futuro.x * lato}
                cy={(1 - p.futuro.y) * lato}
                r={8}
                fill="none"
                stroke="var(--wda-bright)"
                strokeWidth={2}
              />
            )}
          </svg>
          <span className="etichetta" style={{ writingMode: 'vertical-rl' }}>
            {asse?.xDestra}
          </span>
        </div>
        <span className="etichetta">{asse?.ySotto}</span>
      </div>
    </CompitoMano>
  );
}
