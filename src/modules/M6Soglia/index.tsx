'use client';

/**
 * M6 — La soglia di sostenibilità.
 *
 * L'80% non è un tetto da rispettare, è un pavimento da difendere.
 * Unico modulo con reveal anonimo per default: una soglia di rischio personale
 * è più onesta se non deve essere difesa. L'anonimato è garantito dal server
 * (guards.ts), non dall'interfaccia.
 */

import { useState } from 'react';
import { forbice, mescolaConSeme } from '@/lib/calc';
import type { Sessione } from '@/lib/types';
import { CompitoMano, Intestazione, Premessa, StatoCommitMano } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { useRevealPartito } from '@/components/RevealStage';
import { useStore } from '@/net/useStore';

/** Tacche dell'asse 0-100. */
const TACCHE = [0, 25, 50, 75, 100];

/** Geometria dell'asse, in pixel: una sola fonte per linea, tacche ed etichette. */
const ASSE = { altezza: 76, y: 36, tacca: 12, punto: 10, condivisa: 40 };

export function M6Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const [soglia, setSoglia] = useState<number | null>(null);
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';
  // Dopo il reveal i punti restano a schermo: l'opacità serve solo alla comparsa.
  const mostraPunti = partito || sessione.stato !== 'REVEAL';
  const f = forbice(stato.soglie);
  const condivisa = soglia ?? stato.workshop.sogliaCondivisaPct;
  const conTrigger = stato.soglie.filter((s) => s.trigger.trim());

  return (
    <div className="flex flex-col gap-4">
      <Intestazione modulo="M6" titolo="La soglia di sostenibilità" sottotitolo="Reveal anonimo" />

      <Premessa>
        L’80% non è un tetto da rispettare, è un pavimento da difendere. All’inizio può essere 90% o più. La domanda
        non è come dividere la torta, ma qual è il minimo di ricavi da servizi che tiene in vita il team mentre Forge
        matura.
      </Premessa>

      {sessione.stato === 'COMMIT' && <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />}

      {rivelato && (
        <>
          {/* La forbice è la cosa più grande a schermo dopo il reveal. */}
          <div className="pannello p-6 flex flex-col items-center gap-2">
            <span className="etichetta">forbice</span>
            <div
              className="mono leading-none"
              style={{ fontSize: 'clamp(72px, 13vw, 168px)', color: 'var(--tension)', letterSpacing: '-0.04em' }}
            >
              {f.ampiezza}
            </div>
            <div className="text-[15px]" style={{ color: 'var(--ink-dim)' }}>
              punti — da <span className="mono" style={{ color: 'var(--ink)' }}>{f.min ?? '—'}</span>% a{' '}
              <span className="mono" style={{ color: 'var(--ink)' }}>{f.max ?? '—'}</span>%
            </div>
          </div>

          {/* Le soglie come punti su un asse 0-100%, senza nomi. */}
          <div className="pannello p-5 flex flex-col gap-4">
            <span className="etichetta">soglie individuali</span>

            <div
              className="relative"
              style={{ height: ASSE.altezza, opacity: mostraPunti ? 1 : 0, transition: 'opacity 240ms' }}
            >
              <div
                className="absolute left-0 right-0"
                style={{ top: ASSE.y, height: 1, background: 'var(--line-strong)' }}
              />

              {TACCHE.map((t) => (
                <div key={t} className="absolute" style={{ left: `${t}%`, top: ASSE.y - ASSE.tacca / 2 }}>
                  <div style={{ width: 1, height: ASSE.tacca, background: 'var(--line-strong)' }} />
                  <span
                    className="mono text-[11px] absolute -translate-x-1/2"
                    style={{ top: ASSE.tacca + 4, color: 'var(--ink-faint)' }}
                  >
                    {t}
                  </span>
                </div>
              ))}

              {stato.soglie.map((s, i) => (
                <div
                  key={`${s.partecipanteId}-${i}`}
                  className="absolute"
                  style={{
                    left: `${s.sogliaPct}%`,
                    top: ASSE.y - ASSE.punto / 2,
                    transform: 'translateX(-50%)',
                    width: ASSE.punto,
                    height: ASSE.punto,
                    background: 'var(--live)',
                    // Il contorno del colore della pagina stacca i punti sovrapposti.
                    border: '1px solid var(--bg-deep)',
                  }}
                  title={`${s.sogliaPct}% — ${s.mesiAutonomia} mesi`}
                />
              ))}

              {condivisa !== null && (
                <div
                  className="absolute"
                  style={{ left: `${condivisa}%`, top: ASSE.y - ASSE.condivisa / 2 }}
                  title={`Soglia condivisa: ${condivisa}%`}
                >
                  <div style={{ width: 2, height: ASSE.condivisa, background: 'var(--locked)' }} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-5">
              <span className="etichetta flex items-center gap-2">
                <span className="shrink-0" style={{ width: 10, height: 10, background: 'var(--live)' }} />
                soglia individuale
              </span>
              <span className="etichetta flex items-center gap-2">
                <span className="shrink-0" style={{ width: 2, height: 12, background: 'var(--locked)' }} />
                soglia condivisa
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="pannello p-4 flex flex-col gap-3">
              <span className="etichetta">trigger di allarme — mescolati, non attribuiti</span>
              {conTrigger.length === 0 ? (
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  Nessun trigger scritto.
                </span>
              ) : (
                // Marcatore esplicito: il preflight di Tailwind azzera i
                // pallini nativi, quindi `pl-4` da solo dava righe rientrate e
                // basta. Stesso quadratino da 4px di M5.
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {mescolaConSeme(conTrigger, `trigger:${sessione.id}`).map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13px]">
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{ width: 4, height: 4, marginTop: 8, background: 'var(--ink-faint)' }}
                      />
                      <span>{s.trigger}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pannello p-4 flex flex-col gap-3">
              <span className="etichetta">soglia condivisa da negoziare</span>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={condivisa ?? 80}
                  onChange={(e) => setSoglia(Number(e.target.value))}
                  onMouseUp={() => soglia !== null && invia('workshop.update', { sogliaCondivisaPct: soglia })}
                  onTouchEnd={() => soglia !== null && invia('workshop.update', { sogliaCondivisaPct: soglia })}
                  className="flex-1"
                  style={{ height: 36 }}
                />
                <span
                  className="mono text-[28px] leading-none w-[92px] text-right shrink-0"
                  style={{ color: 'var(--locked)' }}
                >
                  {condivisa ?? 80}%
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <span className="etichetta">forbice originale registrata</span>
                <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-dim)' }}>
                  <span className="mono" style={{ color: 'var(--ink)' }}>
                    {stato.workshop.forbiceOriginale ?? f.ampiezza}
                  </span>{' '}
                  punti
                </span>
              </div>

              {sessione.stato !== 'LOCKED' && (
                <LockButton
                  contenuto={{
                    sogliaCondivisaPct: condivisa,
                    forbiceOriginale: stato.workshop.forbiceOriginale ?? f.ampiezza,
                    estremi: { min: f.min, max: f.max },
                  }}
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

          <Traiettoria />
        </>
      )}
    </div>
  );
}

/** Passo 5 — modificabile trascinando, non compilando campi. */
function Traiettoria() {
  const { stato, invia } = useStore();
  const [trascinato, setTrascinato] = useState<string | null>(null);
  if (!stato) return null;

  const altezza = 160;

  return (
    <div className="pannello p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="etichetta">traiettoria verso gennaio 2027 — quota servizi per trimestre</span>
        <span className="etichetta shrink-0">trascina le colonne</span>
      </div>

      <div
        className="flex items-end gap-3"
        style={{ height: altezza, touchAction: 'none' }}
        onPointerMove={(e) => {
          if (!trascinato) return;
          const r = e.currentTarget.getBoundingClientRect();
          const q = Math.round(Math.min(100, Math.max(0, (1 - (e.clientY - r.top) / r.height) * 100)));
          invia('entity.upsert', { tipo: 'trimestre', dati: { id: trascinato, quotaServiziPct: q } });
        }}
        onPointerUp={() => setTrascinato(null)}
        onPointerLeave={() => setTrascinato(null)}
      >
        {stato.traiettoria.map((t) => (
          <div
            key={t.id}
            className="flex-1 flex flex-col justify-end h-full"
            // La corsia resta visibile anche a quota zero: si vede dove si trascina.
            style={{ cursor: 'ns-resize', background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
          >
            <span className="mono text-[13px] text-center mb-1">{t.quotaServiziPct}%</span>
            <div
              style={{
                height: `${t.quotaServiziPct}%`,
                background: 'var(--wda)',
                borderTop: '1px solid var(--wda-deep)',
              }}
              onPointerDown={() => setTrascinato(t.id)}
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {stato.traiettoria.map((t) => (
          <div key={t.id} className="flex-1 flex flex-col items-center gap-1">
            <span className="etichetta">{t.etichetta}</span>
            <span className="mono text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              R{t.consumo.R} G{t.consumo.G} B{t.consumo.B}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function M6Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { invia } = ctx;
  const mio = ctx.mioCommit(sessione.id);
  const p = mio?.payload.tipo === 'M6' ? mio.payload : null;

  const [sogliaPct, setSogliaPct] = useState(p?.sogliaPct ?? 80);
  const [mesi, setMesi] = useState(p?.mesiAutonomia ?? 6);
  const [trigger, setTrigger] = useState(p?.trigger ?? '');

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo="La tua soglia" sottotitolo="In sola lettura — il reveal è anonimo">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="etichetta">soglia di sicurezza</span>
            <span className="mono text-[28px] leading-none">{p?.sogliaPct ?? '—'}%</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="etichetta">mesi di autonomia</span>
            <span className="mono text-[28px] leading-none">{p?.mesiAutonomia ?? '—'}</span>
          </div>
          {p?.trigger && (
            <div className="flex flex-col gap-1">
              <span className="etichetta">trigger di allarme</span>
              <p className="m-0 text-[15px]">{p.trigger}</p>
            </div>
          )}
        </div>
      </CompitoMano>
    );
  }

  const salva = (over: Partial<{ sogliaPct: number; mesiAutonomia: number; trigger: string }>) =>
    invia('commit.set', {
      sessioneId: sessione.id,
      payload: { tipo: 'M6', sogliaPct, mesiAutonomia: mesi, trigger, ...over },
    });

  return (
    <CompitoMano
      titolo="Qual è il minimo che ti fa stare tranquillo?"
      sottotitolo="Nessuno vedrà che è la tua"
      azione={
        <div className="flex flex-col gap-2">
          <StatoCommitMano confermato={mio?.confermato ?? false} />
          <button
            className="bottone bottone-primario"
            style={{ minHeight: 52 }}
            disabled={mio?.confermato}
            onClick={() => {
              salva({});
              invia('commit.confirm', { sessioneId: sessione.id });
            }}
          >
            {mio?.confermato ? 'Confermato' : 'Conferma'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="etichetta">soglia di sicurezza — quota ricavi da servizi</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={sogliaPct}
              onChange={(e) => setSogliaPct(Number(e.target.value))}
              onPointerUp={() => salva({ sogliaPct })}
              className="flex-1"
              style={{ height: 48 }}
            />
            <span className="mono text-[28px] leading-none w-[92px] text-right shrink-0">{sogliaPct}%</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="etichetta">mesi di autonomia</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={24}
              value={mesi}
              onChange={(e) => setMesi(Number(e.target.value))}
              onPointerUp={() => salva({ mesiAutonomia: mesi })}
              className="flex-1"
              style={{ height: 48 }}
            />
            <span className="mono text-[28px] leading-none w-[92px] text-right shrink-0">{mesi}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="etichetta">trigger di allarme</span>
          <textarea
            className="w-full text-[15px]"
            rows={4}
            placeholder="Cosa deve succedere perché tu dica che stiamo sbagliando"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            onBlur={() => salva({ trigger })}
          />
        </div>
      </div>
    </CompitoMano>
  );
}
