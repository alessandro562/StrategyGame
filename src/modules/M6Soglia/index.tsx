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

export function M6Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const [soglia, setSoglia] = useState<number | null>(null);
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';
  const f = forbice(stato.soglie);
  const condivisa = soglia ?? stato.workshop.sogliaCondivisaPct;

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
          <div className="pannello p-6 flex flex-col items-center">
            <span className="etichetta">forbice</span>
            <div
              className="mono leading-none"
              style={{ fontSize: 'clamp(72px, 13vw, 168px)', color: 'var(--tension)', letterSpacing: '-0.04em' }}
            >
              {f.ampiezza}
            </div>
            <span className="mono text-[15px] mt-1" style={{ color: 'var(--ink-dim)' }}>
              punti — da {f.min ?? '—'}% a {f.max ?? '—'}%
            </span>
          </div>

          {/* Le soglie come punti su un asse 0-100%, senza nomi. */}
          <div className="pannello p-5">
            <div className="etichetta mb-4">soglie individuali</div>
            <div className="relative h-16" style={{ opacity: partito ? 1 : 0, transition: 'opacity 240ms' }}>
              <div className="absolute left-0 right-0 top-8 h-px" style={{ background: 'var(--line-strong)' }} />
              {[0, 25, 50, 75, 100].map((t) => (
                <div key={t} className="absolute top-6" style={{ left: `${t}%` }}>
                  <div className="w-px h-4" style={{ background: 'var(--line-strong)' }} />
                  <span className="mono text-[10px] absolute -translate-x-1/2 top-5" style={{ color: 'var(--ink-faint)' }}>
                    {t}
                  </span>
                </div>
              ))}
              {stato.soglie.map((s, i) => (
                <div
                  key={`${s.partecipanteId}-${i}`}
                  className="absolute"
                  style={{ left: `${s.sogliaPct}%`, top: 24, transform: 'translateX(-50%)' }}
                  title={`${s.sogliaPct}% — ${s.mesiAutonomia} mesi`}
                >
                  <div className="w-3 h-3" style={{ background: 'var(--live)', border: '1px solid var(--bg-deep)' }} />
                </div>
              ))}
              {condivisa !== null && (
                <div className="absolute" style={{ left: `${condivisa}%`, top: 8 }}>
                  <div className="w-px h-14" style={{ background: 'var(--locked)' }} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="pannello p-4">
              <div className="etichetta mb-2">trigger di allarme — mescolati, non attribuiti</div>
              <ul className="m-0 pl-4 flex flex-col gap-1">
                {mescolaConSeme(
                  stato.soglie.filter((s) => s.trigger.trim()),
                  `trigger:${sessione.id}`,
                ).map((s, i) => (
                  <li key={i} className="text-[14px]">
                    {s.trigger}
                  </li>
                ))}
                {stato.soglie.every((s) => !s.trigger.trim()) && (
                  <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                    Nessun trigger scritto.
                  </span>
                )}
              </ul>
            </div>

            <div className="pannello p-4 flex flex-col gap-3">
              <div className="etichetta">soglia condivisa da negoziare</div>
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
                />
                <span className="mono text-[28px]" style={{ color: 'var(--locked)' }}>
                  {condivisa ?? 80}%
                </span>
              </div>
              <span className="etichetta">
                forbice originale registrata: {stato.workshop.forbiceOriginale ?? f.ampiezza} punti
              </span>
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
    <div className="pannello p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="etichetta">traiettoria verso gennaio 2027 — quota servizi per trimestre</span>
        <span className="etichetta">trascina le colonne</span>
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
          <div key={t.id} className="flex-1 flex flex-col justify-end h-full" style={{ cursor: 'ns-resize' }}>
            <span className="mono text-[13px] text-center mb-1">{t.quotaServiziPct}%</span>
            <div
              style={{ height: `${t.quotaServiziPct}%`, background: 'var(--wda)', border: '1px solid var(--wda-bright)' }}
              onPointerDown={() => setTrascinato(t.id)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {stato.traiettoria.map((t) => (
          <div key={t.id} className="flex-1 text-center">
            <div className="etichetta">{t.etichetta}</div>
            <div className="mono text-[11px]" style={{ color: 'var(--ink-faint)' }}>
              R{t.consumo.R} G{t.consumo.G} B{t.consumo.B}
            </div>
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
        <div className="mono text-[32px]">{p?.sogliaPct ?? '—'}%</div>
        <div className="text-[14px] mt-2">{p?.mesiAutonomia ?? '—'} mesi di autonomia</div>
        {p?.trigger && <p className="text-[14px] mt-2">{p.trigger}</p>}
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
        <div>
          <span className="etichetta">soglia di sicurezza — quota ricavi da servizi</span>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range"
              min={0}
              max={100}
              value={sogliaPct}
              onChange={(e) => setSogliaPct(Number(e.target.value))}
              onPointerUp={() => salva({ sogliaPct })}
              className="flex-1"
              style={{ height: 40 }}
            />
            <span className="mono text-[28px]">{sogliaPct}%</span>
          </div>
        </div>

        <div>
          <span className="etichetta">mesi di autonomia</span>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="range"
              min={0}
              max={24}
              value={mesi}
              onChange={(e) => setMesi(Number(e.target.value))}
              onPointerUp={() => salva({ mesiAutonomia: mesi })}
              className="flex-1"
              style={{ height: 40 }}
            />
            <span className="mono text-[28px]">{mesi}</span>
          </div>
        </div>

        <div>
          <span className="etichetta">trigger di allarme</span>
          <textarea
            className="w-full text-[15px] mt-2"
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
