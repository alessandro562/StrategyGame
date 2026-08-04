'use client';

/**
 * M7 — Gli invarianti. Il tool non decide il brand.
 * Due liste: ciò che regge in entrambi gli scenari e si può cominciare a
 * costruire da subito, e ciò che resta appeso all'esito della trattativa.
 */

import { useState } from 'react';
import type { Scenario, Sessione } from '@/lib/types';
import { BottoneTocco, CompitoMano, Intestazione, StatoCommitMano } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { RevealStage, useRevealPartito } from '@/components/RevealStage';
import { useBozzaCommit } from '@/net/useBozza';
import { useStore } from '@/net/useStore';

const SCENARI: { chiave: Scenario; breve: string; lungo: string }[] = [
  { chiave: 'ENTRAMBI', breve: 'entrambi', lungo: 'Regge in entrambi gli scenari' },
  { chiave: 'AUTONOMO', breve: 'solo autonomo', lungo: 'Solo con brand autonomo' },
  { chiave: 'SUB_BRAND', breve: 'solo sub-brand', lungo: 'Solo come sub-brand con partner industriale' },
];

/** Larghezze delle colonne del tabellone: intestazioni e conteggi restano incolonnati. */
const COL_VOTI = 'w-32 text-right shrink-0 whitespace-nowrap';
const COL_ESITO = 'w-28 text-right shrink-0 whitespace-nowrap';

const abilitatoDa = (scenario: Scenario) => (scenario === 'AUTONOMO' ? 'brand autonomo' : 'sub-brand');

export function M7Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const [nuovo, setNuovo] = useState('');
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';
  const invarianti = stato.invarianti.filter((i) => i.scenario === 'ENTRAMBI');
  const condizionati = stato.invarianti.filter((i) => i.scenario !== 'ENTRAMBI');

  return (
    <div className="flex flex-col gap-4">
      <Intestazione
        modulo="M7"
        titolo="Gli invarianti"
        sottotitolo="Brand autonomo contro sub-brand con partner industriale. Il tool non decide il brand."
      />

      {sessione.stato === 'SETUP' && (
        <div className="pannello p-4 flex flex-col gap-3">
          <span className="etichetta">affermazioni sulla proposition</span>

          {stato.invarianti.length > 0 && (
            <div className="flex flex-col gap-2">
              {stato.invarianti.map((i) => (
                <div key={i.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 text-[13px]"
                    defaultValue={i.testo}
                    onBlur={(e) =>
                      invia('entity.upsert', { tipo: 'invariante', dati: { id: i.id, testo: e.target.value } })
                    }
                  />
                  <button
                    className="bottone text-[13px] w-9 shrink-0"
                    aria-label="Elimina l’affermazione"
                    onClick={() => invia('entity.delete', { tipo: 'invariante', id: i.id })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="flex-1 text-[13px]"
              placeholder="Nuova affermazione"
              value={nuovo}
              onChange={(e) => setNuovo(e.target.value)}
            />
            <button
              className="bottone text-[13px] shrink-0"
              disabled={!nuovo.trim()}
              onClick={() => {
                invia('entity.upsert', {
                  tipo: 'invariante',
                  dati: { testo: nuovo.trim(), scenario: 'ENTRAMBI', votiTenere: [] },
                });
                setNuovo('');
              }}
            >
              Aggiungi
            </button>
          </div>
        </div>
      )}

      {sessione.stato === 'COMMIT' && <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />}

      {rivelato && (
        <>
          {/* Un tabellone: affermazione a sinistra, conteggi incolonnati a destra. */}
          <div className="pannello">
            <div
              className="flex items-baseline gap-3 px-4 pt-4 pb-2"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span className="etichetta flex-1 min-w-0">affermazione</span>
              {SCENARI.map((s) => (
                <span key={s.chiave} className={`etichetta ${COL_VOTI}`}>
                  {s.breve}
                </span>
              ))}
              <span className={`etichetta ${COL_ESITO}`}>esito</span>
            </div>

            <RevealStage
              elementi={stato.invarianti}
              seme={sessione.id}
              partito={partito || sessione.stato !== 'REVEAL'}
              chiave={(i) => i.id}
              className="px-4 py-3 flex flex-col gap-2"
              render={(inv) => {
                const voti = inv.voti ?? [];
                return (
                  <div className="flex items-baseline gap-3">
                    <span className="text-[13px] flex-1 min-w-0">{inv.testo}</span>
                    {SCENARI.map((s) => {
                      const n = voti.filter((v) => v.scenario === s.chiave).length;
                      return (
                        <span
                          key={s.chiave}
                          className={`mono text-[13px] ${COL_VOTI}`}
                          style={{ color: n > 0 ? 'var(--ink)' : 'var(--ink-faint)' }}
                        >
                          {n}
                        </span>
                      );
                    })}
                    <span
                      className={`etichetta ${COL_ESITO}`}
                      style={{ color: inv.scenario === 'ENTRAMBI' ? 'var(--live)' : 'var(--tension)' }}
                    >
                      {inv.scenario === 'ENTRAMBI' ? 'invariante' : 'condizionato'}
                    </span>
                  </div>
                );
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="pannello p-4 flex flex-col gap-3" style={{ borderColor: 'var(--live)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="etichetta" style={{ color: 'var(--live)' }}>
                  invarianti — si può cominciare da subito
                </span>
                <span className="mono text-[13px] shrink-0" style={{ color: 'var(--live)' }}>
                  {invarianti.length}
                </span>
              </div>
              {invarianti.length === 0 ? (
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  Nessuno.
                </span>
              ) : (
                // Marcatore esplicito: il preflight di Tailwind toglie i
                // pallini nativi. Stesso quadratino da 4px di M5 e M6.
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {invarianti.map((i) => (
                    <li key={i.id} className="flex items-start gap-3 text-[13px]">
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{ width: 4, height: 4, marginTop: 8, background: 'var(--ink-faint)' }}
                      />
                      <span>{i.testo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pannello p-4 flex flex-col gap-3" style={{ borderColor: 'var(--tension)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="etichetta" style={{ color: 'var(--tension)' }}>
                  condizionati — in sospeso fino all&apos;esito della trattativa
                </span>
                <span className="mono text-[13px] shrink-0" style={{ color: 'var(--tension)' }}>
                  {condizionati.length}
                </span>
              </div>
              {condizionati.length === 0 ? (
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  Nessuno.
                </span>
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {condizionati.map((i) => (
                    <li key={i.id} className="flex items-start gap-3 text-[13px]">
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{ width: 4, height: 4, marginTop: 8, background: 'var(--tension)' }}
                      />
                      <span className="min-w-0">
                        {i.testo}
                        <span className="flex items-baseline gap-2 mt-1">
                          <span className="etichetta">abilitato da</span>
                          <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                            {abilitatoDa(i.scenario)}
                          </span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {sessione.stato !== 'LOCKED' && (
            <LockButton
              contenuto={{
                invarianti: invarianti.map((i) => i.testo),
                condizionati: condizionati.map((i) => ({ testo: i.testo, scenario: i.scenario })),
              }}
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
  );
}

export function M7Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia } = ctx;
  const mio = ctx.mioCommit(sessione.id);
  const dalServer = (mio?.payload.tipo === 'M7' ? mio.payload.voti : {}) as Record<string, Scenario>;
  const [voti, aggiornaVoti] = useBozzaCommit(sessione.id, dalServer);

  if (!stato) return null;
  const complete = stato.invarianti.every((i) => voti[i.id]);
  const mancanti = stato.invarianti.filter((i) => !voti[i.id]).length;

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo="I tuoi voti" sottotitolo="In sola lettura">
        <div className="flex flex-col">
          {stato.invarianti.map((i, idx) => (
            <div
              key={i.id}
              className="flex flex-col gap-1 py-3"
              style={
                idx < stato.invarianti.length - 1 ? { borderBottom: '1px solid var(--line)' } : undefined
              }
            >
              <span className="text-[15px]">{i.testo}</span>
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                {SCENARI.find((s) => s.chiave === voti[i.id])?.breve ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </CompitoMano>
    );
  }

  return (
    <CompitoMano
      titolo="Regge in entrambi gli scenari?"
      sottotitolo="Brand autonomo contro sub-brand"
      azione={
        <div className="flex flex-col gap-2">
          <StatoCommitMano confermato={mio?.confermato ?? false} />
          <button
            className="bottone bottone-primario"
            style={{ minHeight: 52 }}
            disabled={!complete || mio?.confermato}
            onClick={() => invia('commit.confirm', { sessioneId: sessione.id })}
          >
            {mio?.confermato ? (
              'Confermato'
            ) : complete ? (
              'Conferma'
            ) : (
              <>
                Mancano <span className="mono">{mancanti}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {stato.invarianti.map((i) => (
          <div key={i.id} className="flex flex-col gap-2">
            <span className="text-[15px]">{i.testo}</span>
            <div className="flex gap-2">
              {SCENARI.map((s) => (
                <BottoneTocco
                  key={s.chiave}
                  attivo={voti[i.id] === s.chiave}
                  onClick={() => {
                    const nuovi = aggiornaVoti((v) => ({ ...v, [i.id]: s.chiave }));
                    invia('commit.set', { sessioneId: sessione.id, payload: { tipo: 'M7', voti: nuovi } });
                  }}
                >
                  <span className="text-[13px]">{s.breve}</span>
                </BottoneTocco>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompitoMano>
  );
}
