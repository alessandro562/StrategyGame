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
        <div className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">affermazioni sulla proposition</span>
          {stato.invarianti.map((i) => (
            <div key={i.id} className="flex items-center gap-2">
              <input
                className="flex-1 text-[14px]"
                defaultValue={i.testo}
                onBlur={(e) => invia('entity.upsert', { tipo: 'invariante', dati: { id: i.id, testo: e.target.value } })}
              />
              <button className="bottone text-[12px]" onClick={() => invia('entity.delete', { tipo: 'invariante', id: i.id })}>
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="flex-1 text-[14px]"
              placeholder="Nuova affermazione"
              value={nuovo}
              onChange={(e) => setNuovo(e.target.value)}
            />
            <button
              className="bottone text-[12px]"
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
          <RevealStage
            elementi={stato.invarianti}
            seme={sessione.id}
            partito={partito || sessione.stato !== 'REVEAL'}
            chiave={(i) => i.id}
            className="pannello p-4 flex flex-col gap-2"
            render={(inv) => {
              const voti = inv.voti ?? [];
              return (
                <div className="flex items-center gap-3">
                  <span className="text-[14px] flex-1">{inv.testo}</span>
                  {SCENARI.map((s) => {
                    const n = voti.filter((v) => v.scenario === s.chiave).length;
                    return (
                      <span
                        key={s.chiave}
                        className="mono text-[12px] w-24 text-right"
                        style={{ color: n > 0 ? 'var(--ink)' : 'var(--ink-faint)' }}
                      >
                        {n} {s.breve}
                      </span>
                    );
                  })}
                  <span
                    className="mono text-[12px] w-28"
                    style={{ color: inv.scenario === 'ENTRAMBI' ? 'var(--live)' : 'var(--tension)' }}
                  >
                    {inv.scenario === 'ENTRAMBI' ? 'invariante' : 'condizionato'}
                  </span>
                </div>
              );
            }}
          />

          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="pannello p-4" style={{ borderColor: 'var(--live)' }}>
              <div className="etichetta mb-2" style={{ color: 'var(--live)' }}>
                invarianti — si può cominciare da subito
              </div>
              {invarianti.length === 0 && <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>Nessuno.</span>}
              <ul className="m-0 pl-4">
                {invarianti.map((i) => (
                  <li key={i.id} className="text-[14px]">
                    {i.testo}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pannello p-4" style={{ borderColor: 'var(--tension)' }}>
              <div className="etichetta mb-2" style={{ color: 'var(--tension)' }}>
                condizionati — in sospeso fino all&apos;esito della trattativa
              </div>
              {condizionati.length === 0 && <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>Nessuno.</span>}
              <ul className="m-0 pl-4">
                {condizionati.map((i) => (
                  <li key={i.id} className="text-[14px]">
                    {i.testo}{' '}
                    <span className="mono text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                      — abilitato da: {i.scenario === 'AUTONOMO' ? 'brand autonomo' : 'sub-brand'}
                    </span>
                  </li>
                ))}
              </ul>
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

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo="I tuoi voti" sottotitolo="In sola lettura">
        {stato.invarianti.map((i) => (
          <div key={i.id} className="py-2" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="text-[14px]">{i.testo}</div>
            <div className="mono text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              {voti[i.id] ?? '—'}
            </div>
          </div>
        ))}
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
            {mio?.confermato ? 'Confermato' : complete ? 'Conferma' : `Mancano ${stato.invarianti.filter((i) => !voti[i.id]).length}`}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {stato.invarianti.map((i) => (
          <div key={i.id}>
            <div className="text-[14px] mb-1">{i.testo}</div>
            <div className="flex gap-1">
              {SCENARI.map((s) => (
                <BottoneTocco
                  key={s.chiave}
                  attivo={voti[i.id] === s.chiave}
                  onClick={() => {
                    const nuovi = aggiornaVoti((v) => ({ ...v, [i.id]: s.chiave }));
                    invia('commit.set', { sessioneId: sessione.id, payload: { tipo: 'M7', voti: nuovi } });
                  }}
                >
                  <span className="text-[12px]">{s.breve}</span>
                </BottoneTocco>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompitoMano>
  );
}
