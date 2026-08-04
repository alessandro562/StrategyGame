'use client';

/**
 * M1 — Lo smontaggio. Il modulo centrale: tutto il resto dipende dal suo output.
 *
 * Passo 1 scomposizione (plenaria) · passo 2 destinazione (commit cieco)
 * passo 3 reveal · passo 4 il residuo · passo 5 lock nei tre bucket.
 */

import { useState } from 'react';
import { esitiServizio, type EsitoAttivita } from '@/lib/calc';
import { SCOMPOSIZIONI_SUGGERITE } from '@/lib/seed';
import type { Bucket, Destinazione, Servizio, Sessione } from '@/lib/types';
import { BottoneTocco, COLORE_DESTINAZIONE, CompitoMano, Intestazione, Premessa, StatoCommitMano, Vuoto } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { DivergenceList } from '@/components/DivergenceList';
import { LockButton } from '@/components/LockButton';
import { RevealStage, useRevealPartito } from '@/components/RevealStage';
import { useBozzaCommit } from '@/net/useBozza';
import { useStore } from '@/net/useStore';

const DESTINAZIONI: Destinazione[] = ['AI', 'UMANO', 'MORTA'];

const RISPOSTE: { chiave: 'MENO' | 'UGUALE_O_PIU' | 'NIENTE'; testo: string; bucket: Bucket; significato: string }[] = [
  {
    chiave: 'MENO',
    testo: 'Meno del vecchio prezzo',
    bucket: 'PORTA',
    significato: 'In commoditizzazione. Si tiene solo se apre relazioni — e si regala',
  },
  {
    chiave: 'UGUALE_O_PIU',
    testo: 'Uguale o più',
    bucket: 'NUCLEO',
    significato: 'Facevate pagare la parte sbagliata. Stesso prezzo, un decimo del lavoro',
  },
  { chiave: 'NIENTE', testo: 'Niente', bucket: 'CHIUSO', significato: 'Il servizio muore' },
];

/* ------------------------------------------------------------------ */
/* Tavolo                                                              */
/* ------------------------------------------------------------------ */

export function M1Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const [chiPropone, setChiPropone] = useState<string | null>(null);
  const [ordinaPerResiduo, setOrdinaPerResiduo] = useState(false);
  const partito = useRevealPartito(sessione.revealAt, ora);

  if (!stato) return null;
  const servizio = stato.servizi.find((s) => s.id === sessione.soggettoId);
  if (!servizio) {
    return <SceltaServizio sessione={sessione} />;
  }

  const commits = ctx.commitsDi(sessione.id);
  const esiti = esitiServizio(servizio, commits);
  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const sommaQuote = servizio.attivita.reduce((s, a) => s + a.quotaPrezzoPct, 0);

  return (
    <div className="flex flex-col gap-4">
      <Intestazione
        modulo="M1"
        titolo={servizio.nome}
        sottotitolo="Lo smontaggio"
        destra={
          <div className="text-right">
            <div className="etichetta">fatturato 12m</div>
            <div className="mono text-[17px]">{servizio.fatturato12m.toLocaleString('it-IT')} €</div>
          </div>
        }
      />

      {sessione.stato === 'SETUP' && (
        <Scomposizione servizio={servizio} sommaQuote={sommaQuote} />
      )}

      {sessione.stato === 'COMMIT' && (
        <>
          <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
          <BarraAttivita esiti={esiti} cieca />
        </>
      )}

      {(sessione.stato === 'REVEAL' || sessione.stato === 'DISCUSSIONE' || sessione.stato === 'LOCKED') && (
        <>
          <RevealStage
            elementi={esiti.esiti}
            seme={sessione.id}
            partito={partito || sessione.stato !== 'REVEAL'}
            chiave={(e) => e.attivitaId}
            className="pannello p-4 flex flex-col gap-2"
            render={(e) => <RigaEsito esito={e} />}
          />

          <BarraAttivita esiti={esiti} />

          <div className="grid grid-cols-[1fr_320px] gap-4 items-start">
            <div className="pannello p-6 flex flex-col items-center justify-center">
              <span className="etichetta">residuo umano</span>
              <div
                className="mono leading-none"
                style={{ fontSize: 'clamp(56px, 9vw, 120px)', color: 'var(--live)', letterSpacing: '-0.03em' }}
              >
                {esiti.residuoPct.toFixed(0)}%
              </div>
              {esiti.quoteInPareggio > 0 && (
                <span className="etichetta mt-2" style={{ color: 'var(--tension)' }}>
                  {esiti.quoteInPareggio}% delle quote in pareggio, fuori dal residuo
                </span>
              )}
              {sommaQuote !== 100 && (
                <span className="etichetta mt-1">quote sommate: {sommaQuote}% — residuo normalizzato</span>
              )}
            </div>

            <DivergenceList
              voci={esiti.esiti
                .filter((e) => e.divergente)
                .map((e) => ({
                  etichetta: e.nome,
                  dettaglio: DESTINAZIONI.filter((d) => e.conteggi[d] > 0)
                    .map((d) => `${e.conteggi[d]} ${d}`)
                    .join(' / '),
                  intensita:
                    e.votanti > 0 ? 1 - Math.max(...DESTINAZIONI.map((d) => e.conteggi[d])) / e.votanti : 0,
                }))}
            />
          </div>

          {sessione.stato !== 'LOCKED' && (
            <div className="pannello p-4 flex flex-col gap-3">
              <p className="m-0 text-[17px]">Il residuo, venduto da solo, quanto vale?</p>
              <div className="grid grid-cols-3 gap-2">
                {RISPOSTE.map((r) => {
                  const attiva = servizio.valoreResiduo === r.chiave;
                  return (
                    <button
                      key={r.chiave}
                      className="bottone text-left p-3"
                      aria-pressed={attiva}
                      onClick={() => {
                        if (r.bucket === 'CHIUSO' && !chiPropone) return;
                        invia('servizio.setBucket', {
                          servizioId: servizio.id,
                          bucket: r.bucket,
                          valoreResiduo: r.chiave,
                          richiestoDa: r.bucket === 'CHIUSO' ? chiPropone : undefined,
                        });
                      }}
                      disabled={r.bucket === 'CHIUSO' && !chiPropone}
                    >
                      <div className="text-[14px]">{r.testo}</div>
                      <div className="mono text-[12px] mt-1" style={{ color: coloreBucket(r.bucket) }}>
                        {r.bucket}
                      </div>
                      <div className="text-[12px] mt-1" style={{ color: 'var(--ink-faint)' }}>
                        {r.significato}
                      </div>
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-dim)' }}>
                <span className="etichetta">chiusura richiesta da</span>
                <select value={chiPropone ?? ''} onChange={(e) => setChiPropone(e.target.value || null)}>
                  <option value="">nessuno</option>
                  {presenti.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <span>Un servizio non si chiude per inerzia.</span>
              </label>

              <LockButton
                disabilitato={!servizio.bucket}
                contenuto={{
                  servizio: servizio.nome,
                  bucket: servizio.bucket,
                  residuoPct: Number(esiti.residuoPct.toFixed(1)),
                  esiti: esiti.esiti.map((e) => ({ attivita: e.nome, quota: e.quotaPct, esito: e.esito })),
                }}
                lockAValle={stato.lock}
                partecipanti={presenti}
                nome={nome}
                onLock={(contenuto, dissensi, aValle) =>
                  invia('lock.create', { sessioneId: sessione.id, contenuto, dissensi, aValle })
                }
              />
            </div>
          )}
        </>
      )}

      <Confronto ordinaPerResiduo={ordinaPerResiduo} onOrdina={() => setOrdinaPerResiduo(!ordinaPerResiduo)} />
    </div>
  );
}

function coloreBucket(b: Bucket | null): string {
  if (b === 'NUCLEO') return 'var(--live)';
  if (b === 'PORTA') return 'var(--tension)';
  if (b === 'CHIUSO') return 'var(--erosion)';
  return 'var(--ink-faint)';
}

function SceltaServizio({ sessione }: { sessione: Sessione }) {
  const { stato, invia } = useStore();
  if (!stato) return null;
  return (
    <div className="flex flex-col gap-4">
      <Intestazione modulo="M1" titolo="Lo smontaggio" sottotitolo="Quale servizio si smonta adesso?" />
      <div className="grid grid-cols-3 gap-2">
        {stato.servizi.map((s) => (
          <button
            key={s.id}
            className="bottone p-4 text-left"
            onClick={() =>
              invia('session.create', { modulo: 'M1', titolo: s.nome, soggettoId: s.id, durataS: 240 })
            }
          >
            <div className="text-[15px]">{s.nome}</div>
            <div className="mono text-[12px] mt-1" style={{ color: coloreBucket(s.bucket) }}>
              {s.bucket ?? 'non smontato'}
            </div>
          </button>
        ))}
      </div>
      <p className="m-0 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
        Round corrente: {sessione.modulo} — {sessione.titolo}
      </p>
    </div>
  );
}

function Scomposizione({ servizio, sommaQuote }: { servizio: Servizio; sommaQuote: number }) {
  const { invia } = useStore();
  const suggerimenti = SCOMPOSIZIONI_SUGGERITE[servizio.id];

  const aggiorna = (attivita: Servizio['attivita']) =>
    invia('entity.upsert', { tipo: 'servizio', dati: { id: servizio.id, attivita } });

  return (
    <div className="pannello p-4 flex flex-col gap-3">
      <Premessa>
        La quota è del <strong>prezzo</strong>, non dello sforzo. Sono cose diverse, ed è la differenza tra le due
        che stiamo cercando.
      </Premessa>

      <div className="flex flex-col gap-2">
        {servizio.attivita.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <span className="mono text-[12px] w-6" style={{ color: 'var(--ink-faint)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <input
              className="flex-1 text-[14px]"
              value={a.nome}
              onChange={(e) =>
                aggiorna(servizio.attivita.map((x) => (x.id === a.id ? { ...x, nome: e.target.value } : x)))
              }
            />
            <input
              className="mono text-[13px] w-16 text-right"
              type="number"
              min={0}
              max={100}
              value={a.quotaPrezzoPct}
              onChange={(e) =>
                aggiorna(
                  servizio.attivita.map((x) =>
                    x.id === a.id ? { ...x, quotaPrezzoPct: Number(e.target.value) || 0 } : x,
                  ),
                )
              }
            />
            <span className="etichetta">%</span>
            <button
              className="bottone text-[12px]"
              onClick={() => aggiorna(servizio.attivita.filter((x) => x.id !== a.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Vincolo visivo: la barra si riempie fino a 100% */}
      <div>
        <div className="flex h-2" style={{ background: 'var(--bg-deep)', border: '1px solid var(--line)' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, sommaQuote)}%`,
              background: sommaQuote === 100 ? 'var(--live)' : 'var(--tension)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="etichetta">somma delle quote</span>
          <span
            className="mono text-[13px]"
            style={{ color: sommaQuote === 100 ? 'var(--live)' : 'var(--tension)' }}
          >
            {sommaQuote}%{sommaQuote !== 100 && ` — mancano ${100 - sommaQuote}`}
          </span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          className="bottone text-[12px]"
          onClick={() =>
            aggiorna([
              ...servizio.attivita,
              { id: `${servizio.id}-a${Date.now().toString(36)}`, nome: 'Nuova attività', quotaPrezzoPct: 0 },
            ])
          }
        >
          Aggiungi attività
        </button>
        {suggerimenti && servizio.attivita.length === 0 && (
          <button
            className="bottone text-[12px]"
            onClick={() =>
              aggiorna(
                suggerimenti.map((nome, i) => ({
                  id: `${servizio.id}-a${i + 1}`,
                  nome,
                  quotaPrezzoPct: Math.floor(100 / suggerimenti.length) + (i === 0 ? 100 % suggerimenti.length : 0),
                })),
              )
            }
          >
            Usa la scomposizione suggerita
          </button>
        )}
      </div>
    </div>
  );
}

function RigaEsito({ esito }: { esito: EsitoAttivita }) {
  const totale = DESTINAZIONI.reduce((s, d) => s + esito.conteggi[d], 0);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[14px] flex-1">{esito.nome}</span>
      <span className="mono text-[12px] w-10 text-right" style={{ color: 'var(--ink-dim)' }}>
        {esito.quotaPct}%
      </span>
      <div className="flex w-40 h-3" style={{ border: '1px solid var(--line)' }}>
        {DESTINAZIONI.map((d) =>
          esito.conteggi[d] > 0 ? (
            <div
              key={d}
              className={d === 'MORTA' ? 'tratteggio' : ''}
              style={{
                width: `${(esito.conteggi[d] / Math.max(totale, 1)) * 100}%`,
                background: d === 'MORTA' ? undefined : COLORE_DESTINAZIONE[d],
              }}
              title={`${esito.conteggi[d]} ${d}`}
            />
          ) : null,
        )}
      </div>
      <span
        className="mono text-[12px] w-32"
        style={{ color: esito.esito ? COLORE_DESTINAZIONE[esito.esito] : 'var(--tension)' }}
      >
        {esito.esito ?? 'pareggio'}
      </span>
      {esito.divergente && (
        <span className="mono text-[11px]" style={{ color: 'var(--tension)' }}>
          {DESTINAZIONI.filter((d) => esito.conteggi[d] > 0)
            .map((d) => `${esito.conteggi[d]} ${d}`)
            .join(' / ')}
        </span>
      )}
    </div>
  );
}

/** La barra del servizio, larga e dominante, segmentata per attività. */
function BarraAttivita({ esiti, cieca = false }: { esiti: ReturnType<typeof esitiServizio>; cieca?: boolean }) {
  const totale = esiti.totaleQuote || 1;
  return (
    <div className="flex h-16" style={{ border: '1px solid var(--line-strong)' }}>
      {esiti.esiti.map((e) => {
        const larghezza = `${(e.quotaPct / totale) * 100}%`;
        if (cieca) {
          return (
            <div
              key={e.attivitaId}
              className="flex items-end p-1"
              style={{ width: larghezza, borderRight: '1px solid var(--line)', background: 'var(--bg-panel)' }}
            >
              <span className="mono text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                {e.quotaPct}%
              </span>
            </div>
          );
        }
        const divergente = e.esito === null && e.votanti > 0;
        return (
          <div
            key={e.attivitaId}
            className={divergente ? 'strisce flex items-end p-1' : e.esito === 'MORTA' ? 'tratteggio flex items-end p-1' : 'flex items-end p-1'}
            style={{
              width: larghezza,
              borderRight: '1px solid var(--bg-deep)',
              background: divergente || e.esito === 'MORTA' ? undefined : e.esito ? COLORE_DESTINAZIONE[e.esito] : 'var(--bg-raised)',
            }}
            title={`${e.nome} — ${e.esito ?? 'pareggio'}`}
          >
            <span
              className="mono text-[10px]"
              style={{ color: e.esito === 'UMANO' ? 'var(--ink-inverso)' : 'var(--ink)' }}
            >
              {e.quotaPct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Vista di confronto: tutti i servizi smontati, barre affiancate. */
function Confronto({ ordinaPerResiduo, onOrdina }: { ordinaPerResiduo: boolean; onOrdina: () => void }) {
  const { stato } = useStore();
  if (!stato) return null;

  const righe = stato.servizi
    .map((s) => {
      const ids = new Set(stato.sessioni.filter((x) => x.modulo === 'M1' && x.soggettoId === s.id).map((x) => x.id));
      const esiti = esitiServizio(
        s,
        stato.commits.filter((c) => ids.has(c.sessioneId)),
      );
      return { servizio: s, residuo: esiti.residuoPct, smontato: s.destinazioni.length > 0 };
    })
    .filter((r) => r.smontato);

  if (righe.length === 0) return null;
  const ordinate = ordinaPerResiduo ? [...righe].sort((a, b) => b.residuo - a.residuo) : righe;

  return (
    <div className="pannello p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="etichetta">servizi già smontati</span>
        <button className="bottone text-[12px]" aria-pressed={ordinaPerResiduo} onClick={onOrdina}>
          Ordina per residuo
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {ordinate.map((r) => (
          <div key={r.servizio.id} className="flex items-center gap-3">
            <span className="text-[13px] w-56 shrink-0">{r.servizio.nome}</span>
            <div className="flex-1 h-3" style={{ background: 'var(--bg-deep)', border: '1px solid var(--line)' }}>
              <div className="h-full" style={{ width: `${r.residuo}%`, background: 'var(--live)' }} />
            </div>
            <span className="mono text-[13px] w-12 text-right">{r.residuo.toFixed(0)}%</span>
            <span className="mono text-[11px] w-16" style={{ color: coloreBucket(r.servizio.bucket) }}>
              {r.servizio.bucket ?? '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mano                                                                */
/* ------------------------------------------------------------------ */

export function M1Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia } = ctx;
  const servizio = ctx.servizio(sessione.soggettoId);
  const mio = ctx.mioCommit(sessione.id);

  const dalServer = (mio?.payload.tipo === 'M1' ? mio.payload.destinazioni : {}) as Record<string, Destinazione>;
  const [scelte, aggiornaScelte] = useBozzaCommit(sessione.id, dalServer);

  if (!stato || !servizio) return <Vuoto>Nessun servizio in smontaggio.</Vuoto>;

  const complete = servizio.attivita.every((a) => scelte[a.id]);

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo={servizio.nome} sottotitolo="Il tuo commit, in sola lettura">
        <div className="flex flex-col gap-2">
          {servizio.attivita.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 rialzato">
              <span className="text-[14px]">{a.nome}</span>
              <span
                className="mono text-[12px]"
                style={{ color: scelte[a.id] ? COLORE_DESTINAZIONE[scelte[a.id]] : 'var(--ink-faint)' }}
              >
                {scelte[a.id] ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </CompitoMano>
    );
  }

  const imposta = (attivitaId: string, valore: Destinazione) => {
    const destinazioni = aggiornaScelte((s) => ({ ...s, [attivitaId]: valore }));
    invia('commit.set', { sessioneId: sessione.id, payload: { tipo: 'M1', destinazioni } });
  };

  return (
    <CompitoMano
      titolo={servizio.nome}
      sottotitolo="Dove va a finire ogni attività?"
      azione={
        <div className="flex flex-col gap-2">
          <StatoCommitMano confermato={mio?.confermato ?? false} />
          <button
            className="bottone bottone-primario"
            style={{ minHeight: 52 }}
            disabled={!complete || mio?.confermato}
            onClick={() => invia('commit.confirm', { sessioneId: sessione.id })}
          >
            {mio?.confermato ? 'Confermato' : complete ? 'Conferma' : `Mancano ${servizio.attivita.filter((a) => !scelte[a.id]).length}`}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {servizio.attivita.map((a) => (
          <div key={a.id}>
            <div className="text-[14px] mb-1">{a.nome}</div>
            <div className="flex gap-1">
              {DESTINAZIONI.map((d) => (
                <BottoneTocco
                  key={d}
                  attivo={scelte[a.id] === d}
                  colore={COLORE_DESTINAZIONE[d]}
                  onClick={() => imposta(a.id, d)}
                >
                  {d}
                </BottoneTocco>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompitoMano>
  );
}
