'use client';

/**
 * M3 — La mappa dei flussi.
 * Serve a verificare o smentire l'ipotesi che WDA sia un layer fra operatori:
 * è una domanda a cui non si risponde ragionando, ma guardando i flussi.
 *
 * SVG puro e pointer events, nessuna libreria di grafi.
 */

import { useState } from 'react';
import { archiAggregati, diagnosiPosizione, flussiDistinti } from '@/lib/calc';
import type { Attore, Sessione } from '@/lib/types';
import { CompitoMano, Intestazione, StatoCommitMano, Vuoto } from '../comune';
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

  return (
    <div className="flex flex-col gap-4">
      <Intestazione
        modulo="M3"
        titolo={servizio?.nome ?? 'La mappa dei flussi'}
        sottotitolo="Non cosa consegna: cosa collega"
        destra={
          <div className="text-right">
            <div className="etichetta">flussi distinti su cui siede WDA</div>
            <div className="mono text-[36px] leading-none">{distinti}</div>
            <div className="mono text-[13px] mt-1" style={{ color: coloreDiagnosi(distinti) }}>
              {diagnosiPosizione(distinti)}
            </div>
          </div>
        }
      />

      {!servizio && (
        <div className="pannello p-4">
          <span className="etichetta">servizi in nucleo o porta</span>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {candidati.length === 0 && (
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Nessun servizio classificato: si passa da M1.
              </span>
            )}
            {candidati.map((s) => (
              <button
                key={s.id}
                className="bottone p-3 text-left"
                onClick={() => invia('session.create', { modulo: 'M3', titolo: s.nome, soggettoId: s.id, durataS: 240 })}
              >
                {s.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
        <div className="pannello p-2" style={{ width: LATO + 16 }}>
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
            <rect width={LATO} height={LATO} fill="var(--bg-panel)" />
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
                  stroke={a.peso > 1 ? 'var(--wda-bright)' : 'var(--ink-faint)'}
                  strokeWidth={Math.min(1 + a.peso * 1.6, 10)}
                  opacity={a.peso > 1 ? 0.85 : 0.55}
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
                  <circle
                    cx={cx}
                    cy={cy}
                    r={a.fisso ? RAGGIO + 6 : RAGGIO}
                    fill={a.fisso ? 'var(--wda)' : 'var(--bg-raised)'}
                    stroke={a.fisso ? 'var(--wda-bright)' : 'var(--line-strong)'}
                    strokeWidth={1}
                  />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fontSize={a.fisso ? 14 : 10}
                    fill={a.fisso ? '#fff' : 'var(--ink-dim)'}
                    fontFamily="var(--font-mono)"
                    style={{ pointerEvents: 'none' }}
                  >
                    {a.nome.length > 12 ? `${a.nome.slice(0, 11)}…` : a.nome}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          {sessione.stato === 'COMMIT' && <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />}

          {rivelato && (
            <div className="pannello p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="etichetta">vista</span>
                <div className="flex gap-1">
                  <button className="bottone text-[12px]" aria-pressed={!soloIo} onClick={() => setSoloIo(false)}>
                    tutti
                  </button>
                  <button className="bottone text-[12px]" aria-pressed={soloIo} onClick={() => setSoloIo(true)}>
                    solo io
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {archi.length === 0 && (
                  <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                    Nessun arco tracciato.
                  </span>
                )}
                {[...archi]
                  .sort((a, b) => b.peso - a.peso)
                  .map((a) => (
                    <div key={`${a.da}-${a.a}`} className="flex items-center gap-2 text-[13px]">
                      <span className="mono w-6 text-right" style={{ color: 'var(--wda-bright)' }}>
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
            <div className="pannello p-4" style={{ borderColor: 'var(--erosion)' }}>
              <span className="mono text-[13px]" style={{ color: 'var(--erosion)' }}>
                {servizio.nome}: nessun arco — consulenza tradizionale in erosione
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
      <CompitoMano titolo={servizio.nome} sottotitolo="I tuoi archi, in sola lettura">
        {archi.length === 0 ? (
          <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Nessun collegamento tracciato.
          </span>
        ) : (
          archi.map((a, i) => (
            <div key={i} className="text-[14px] py-1">
              {nomeAttore(a.da)} → {nomeAttore(a.a)}
            </div>
          ))
        )}
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
      sottotitolo={da ? `Da ${nomeAttore(da)} — tocca l'arrivo` : 'Tocca due attori: che cosa collega questo servizio?'}
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
      <div className="grid grid-cols-2 gap-2 mb-4">
        {stato.attori.map((a) => (
          <button
            key={a.id}
            className="px-3 text-left"
            style={{
              minHeight: 48,
              border: `1px solid ${da === a.id ? 'var(--wda-bright)' : 'var(--line-strong)'}`,
              background: da === a.id ? 'var(--wda-wash)' : 'var(--bg-raised)',
              color: a.fisso ? 'var(--wda-bright)' : 'var(--ink)',
            }}
            onClick={() => tap(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <span className="etichetta">i tuoi archi</span>
        {archi.length === 0 && (
          <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Nessuno. Un servizio può non collegare nulla.
          </span>
        )}
        {archi.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rialzato px-3 py-2">
            <span className="text-[13px]">
              {nomeAttore(a.da)} → {nomeAttore(a.a)}
            </span>
            <button className="bottone text-[12px]" onClick={() => salva((a) => a.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </CompitoMano>
  );
}
