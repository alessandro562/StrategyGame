'use client';

/**
 * M7 — No-regret moves. Il tool non decide il brand.
 * Due liste: ciò che regge in entrambi gli scenari e si può cominciare a
 * costruire da subito, e ciò che resta appeso all'esito della trattativa.
 *
 * A schermo «invariante» è diventato «no-regret move», che è il termine con
 * cui la stessa distinzione circola in strategia. Il nome nel codice e nel
 * modello dati resta invariante — cambia solo ciò che si legge.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { SCENARI_GLOSSA } from '@/lib/glossario';
import type { Scenario, Sessione } from '@/lib/types';
import { BottoneTocco, CompitoMano, Premessa, StatoCommitMano } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { RevealStage, useRevealPartito } from '@/components/RevealStage';
import { TestataModulo } from '@/components/TestataModulo';
import { useBozzaCommit } from '@/net/useBozza';
import { useStore } from '@/net/useStore';

/** Una riga asciutta che dice cosa si fa adesso, senza incoraggiamenti. */
function Istruzione({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
      {children}
    </p>
  );
}

/** L'ordine in cui i tre scenari compaiono ovunque. Le etichette dal glossario. */
const SCENARI: Scenario[] = ['ENTRAMBI', 'AUTONOMO', 'SUB_BRAND'];

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
      <TestataModulo modulo="M7" />

      <Premessa>
        I due scenari sono un brand autonomo e un sub-brand dentro l’accordo con il partner industriale. Il tool non
        decide quale dei due: separa ciò che si può cominciare in ogni caso da ciò che dipende dall’esito della
        trattativa.
      </Premessa>

      {/* Le tre risposte stanno a schermo per tutto il round: sono anche le tre
          colonne del tabellone, e lì non c'è spazio per la glossa. */}
      <div className="pannello p-4 grid grid-cols-3 gap-4">
        {SCENARI.map((s) => (
          <div key={s} className="flex flex-col gap-1">
            <span className="etichetta">{SCENARI_GLOSSA[s].etichetta.toLowerCase()}</span>
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              {SCENARI_GLOSSA[s].aiuto}
            </span>
          </div>
        ))}
      </div>

      {sessione.stato === 'SETUP' && (
        <div className="pannello p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="etichetta">affermazioni sulla proposition</span>
            <Istruzione>
              Scrivi le affermazioni su cui il gruppo voterà. Una frase per riga, al presente, come se fosse già
              pubblicata: «Vendiamo accesso e giudizio, non produzione di documenti».
            </Istruzione>
          </div>

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

      {sessione.stato === 'COMMIT' && (
        <>
          <Istruzione>
            Ognuno vota dal telefono, per ogni affermazione, se regge in entrambi gli scenari o solo in uno. Le
            risposte restano coperte finché il round non passa al confronto.
          </Istruzione>
          <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
        </>
      )}

      {rivelato && (
        <>
          {/* Un tabellone: affermazione a sinistra, conteggi incolonnati a destra. */}
          <div className="pannello">
            <div className="px-4 pt-4 pb-3 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--line)' }}>
              <Istruzione>
                Ogni colonna conta quante persone hanno scelto quello scenario. L’esito è lo scenario più votato: in
                caso di parità l’affermazione resta condizionata.
              </Istruzione>
              <div className="flex items-baseline gap-3">
                <span className="etichetta flex-1 min-w-0">affermazione</span>
                {SCENARI.map((s) => (
                  <span key={s} className={`etichetta ${COL_VOTI}`}>
                    {SCENARI_GLOSSA[s].etichetta.toLowerCase()}
                  </span>
                ))}
                <span className={`etichetta ${COL_ESITO}`}>esito</span>
              </div>
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
                      const n = voti.filter((v) => v.scenario === s).length;
                      return (
                        <span
                          key={s}
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
                      {inv.scenario === 'ENTRAMBI' ? 'no-regret' : 'condizionata'}
                    </span>
                  </div>
                );
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="pannello p-4 flex flex-col gap-3" style={{ borderColor: 'var(--live)' }}>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="etichetta" style={{ color: 'var(--live)' }}>
                    no-regret moves
                  </span>
                  <span className="mono text-[13px] shrink-0" style={{ color: 'var(--live)' }}>
                    {invarianti.length}
                  </span>
                </div>
                <Istruzione>
                  Reggono in tutti e due gli scenari: si possono cominciare adesso, senza aspettare la trattativa.
                </Istruzione>
              </div>
              {invarianti.length === 0 ? (
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  Nessuna.
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
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="etichetta" style={{ color: 'var(--tension)' }}>
                    condizionate
                  </span>
                  <span className="mono text-[13px] shrink-0" style={{ color: 'var(--tension)' }}>
                    {condizionati.length}
                  </span>
                </div>
                <Istruzione>
                  Reggono in un solo scenario: restano in attesa dell’esito della trattativa sul brand.
                </Istruzione>
              </div>
              {condizionati.length === 0 ? (
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  Nessuna.
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
                          <span className="etichetta">abilitata da</span>
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
      <CompitoMano
        titolo="I tuoi voti"
        sottotitolo="Sola lettura. Per ogni affermazione, lo scenario in cui hai detto che regge."
      >
        <div className="flex flex-col">
          {stato.invarianti.map((i, idx) => {
            const scelto = voti[i.id];
            return (
              <div
                key={i.id}
                className="flex flex-col gap-1 py-3"
                style={
                  idx < stato.invarianti.length - 1 ? { borderBottom: '1px solid var(--line)' } : undefined
                }
              >
                <span className="text-[15px]">{i.testo}</span>
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  {scelto ? SCENARI_GLOSSA[scelto].etichetta : '—'}
                </span>
                {scelto && (
                  <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                    {SCENARI_GLOSSA[scelto].aiuto}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CompitoMano>
    );
  }

  return (
    <CompitoMano
      titolo="Regge in entrambi gli scenari?"
      sottotitolo="I due scenari sono brand autonomo e sub-brand con il partner industriale. Scegli per ogni affermazione."
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
        {/* Le tre opzioni si spiegano una volta sola, in testa: sotto i bottoni
            resta la glossa di quella scelta, che è l'unica che serve rileggere. */}
        <div className="rialzato p-3 flex flex-col gap-2">
          <span className="etichetta">le tre risposte</span>
          {SCENARI.map((s) => (
            <div key={s} className="flex flex-col">
              <span className="text-[13px]">{SCENARI_GLOSSA[s].etichetta}</span>
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                {SCENARI_GLOSSA[s].aiuto}
              </span>
            </div>
          ))}
        </div>

        {stato.invarianti.map((i) => {
          const scelto = voti[i.id];
          return (
            <div key={i.id} className="flex flex-col gap-2">
              <span className="text-[15px]">{i.testo}</span>
              <div className="flex gap-2">
                {SCENARI.map((s) => (
                  <BottoneTocco
                    key={s}
                    attivo={scelto === s}
                    onClick={() => {
                      const nuovi = aggiornaVoti((v) => ({ ...v, [i.id]: s }));
                      invia('commit.set', { sessioneId: sessione.id, payload: { tipo: 'M7', voti: nuovi } });
                    }}
                  >
                    <span className="text-[13px]">{SCENARI_GLOSSA[s].etichetta}</span>
                  </BottoneTocco>
                ))}
              </div>
              {scelto && (
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  {SCENARI_GLOSSA[scelto].aiuto}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </CompitoMano>
  );
}
