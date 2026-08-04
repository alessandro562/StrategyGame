'use client';

/**
 * M1 — Unbundling del servizio. Il modulo centrale: tutto il resto dipende dal
 * suo output.
 *
 * Passo 1 scomposizione (plenaria) · passo 2 destinazione (risposta in cieco)
 * passo 3 confronto · passo 4 il residuo umano · passo 5 lock nei tre bucket.
 *
 * Nomi, obiettivo e glosse dei termini vengono tutti da lib/glossario: qui non
 * si riscrive nessuna etichetta a mano. Gli enum (AI, UMANO, MORTA, NUCLEO…)
 * restano il modello dati e non compaiono mai a schermo.
 *
 * Scala tipografica del modulo, tre gradini: .etichetta (11px, mono) per le
 * intestazioni di colonna e le unità, 13px per le righe dense — dentro una
 * riga tutte le celle hanno lo stesso corpo — e 15px per il contenuto
 * primario. 17px solo per la domanda del passo 4 e per il fatturato in testa.
 * Il residuo resta l'unico numero grande della schermata.
 */

import { useState, type ReactNode } from 'react';
import { esitiServizio, type EsitoAttivita } from '@/lib/calc';
import { BUCKET_GLOSSA, DESTINAZIONI_GLOSSA, TERMINI } from '@/lib/glossario';
import { SCOMPOSIZIONI_SUGGERITE } from '@/lib/seed';
import type { Bucket, Destinazione, Servizio, Sessione } from '@/lib/types';
import { BottoneTocco, COLORE_DESTINAZIONE, CompitoMano, Premessa, StatoCommitMano, Vuoto } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { DivergenceList } from '@/components/DivergenceList';
import { LockButton } from '@/components/LockButton';
import { RevealStage, useRevealPartito } from '@/components/RevealStage';
import { TestataModulo } from '@/components/TestataModulo';
import { useBozzaCommit } from '@/net/useBozza';
import { useStore } from '@/net/useStore';

const DESTINAZIONI: Destinazione[] = ['AI', 'UMANO', 'MORTA'];

const RISPOSTE: { chiave: 'MENO' | 'UGUALE_O_PIU' | 'NIENTE'; testo: string; bucket: Bucket }[] = [
  { chiave: 'MENO', testo: 'Meno del vecchio prezzo', bucket: 'PORTA' },
  { chiave: 'UGUALE_O_PIU', testo: 'Uguale o più', bucket: 'NUCLEO' },
  { chiave: 'NIENTE', testo: 'Niente', bucket: 'CHIUSO' },
];

/** Il nome del bucket con il termine standard che aiuta a riconoscerlo. */
function etichettaBucket(b: Bucket | null): string {
  if (!b) return '—';
  return `${BUCKET_GLOSSA[b].etichetta} (${BUCKET_GLOSSA[b].standard})`;
}

/** Conteggi dei voti scritti con i nomi delle destinazioni, non con gli enum. */
function dettaglioVoti(conteggi: Record<Destinazione, number>): string {
  return DESTINAZIONI.filter((d) => conteggi[d] > 0)
    .map((d) => `${conteggi[d]} ${DESTINAZIONI_GLOSSA[d].etichetta}`)
    .join(' / ');
}

/** Come sopra, ma a schermo: le cifre in mono, i nomi nel carattere di interfaccia. */
function DettaglioVoti({ conteggi }: { conteggi: Record<Destinazione, number> }) {
  const voci = DESTINAZIONI.filter((d) => conteggi[d] > 0);
  return (
    <>
      {voci.map((d, i) => (
        <span key={d}>
          {i > 0 ? ' / ' : ''}
          <span className="mono">{conteggi[d]}</span> {DESTINAZIONI_GLOSSA[d].etichetta}
        </span>
      ))}
    </>
  );
}

/** Una riga asciutta che dice cosa si fa adesso, sopra il compito. */
function Istruzione({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
      {children}
    </p>
  );
}

/** Le tre destinazioni con la loro glossa: si legge una volta, vale per tutte le righe. */
function LegendaDestinazioni({ variante }: { variante: 'tavolo' | 'mano' }) {
  const tavolo = variante === 'tavolo';
  return (
    <div
      className={tavolo ? 'grid grid-cols-3 gap-x-6 gap-y-2' : 'rialzato px-3 py-3 flex flex-col gap-2'}
      style={tavolo ? { borderTop: '1px solid var(--line)', paddingTop: 12 } : undefined}
    >
      {DESTINAZIONI.map((d) => (
        <div key={d} className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[13px]" style={{ color: COLORE_DESTINAZIONE[d] }}>
            {DESTINAZIONI_GLOSSA[d].etichetta}
          </span>
          <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            {DESTINAZIONI_GLOSSA[d].aiuto}
          </span>
        </div>
      ))}
    </div>
  );
}

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
      <TestataModulo
        modulo="M1"
        soggetto={servizio.nome}
        destra={
          <div className="text-right">
            <div className="etichetta">fatturato 12m</div>
            <div className="mono text-[17px] mt-1">{servizio.fatturato12m.toLocaleString('it-IT')} €</div>
          </div>
        }
      />

      {sessione.stato === 'SETUP' && (
        <Scomposizione servizio={servizio} sommaQuote={sommaQuote} />
      )}

      {sessione.stato === 'COMMIT' && (
        <>
          <Istruzione>
            Ognuno assegna sul proprio telefono ogni attività a chi la farà d’ora in poi. Nessuno vede le
            risposte degli altri finché il round non passa al confronto.
          </Istruzione>
          <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
          <BarraAttivita esiti={esiti} cieca />
        </>
      )}

      {(sessione.stato === 'REVEAL' || sessione.stato === 'DISCUSSIONE' || sessione.stato === 'LOCKED') && (
        <>
          <div className="pannello p-4 flex flex-col gap-3">
            <Istruzione>
              Una riga per attività: quanta parte del prezzo regge, come l’ha assegnata il gruppo e dove le
              risposte non coincidono.
            </Istruzione>
            <IntestazioneEsiti />
            <RevealStage
              elementi={esiti.esiti}
              seme={sessione.id}
              partito={partito || sessione.stato !== 'REVEAL'}
              chiave={(e) => e.attivitaId}
              className="flex flex-col gap-2"
              render={(e) => <RigaEsito esito={e} />}
            />
            <LegendaDestinazioni variante="tavolo" />
          </div>

          <BarraAttivita esiti={esiti} />

          <div className="grid grid-cols-[1fr_320px] gap-4 items-start">
            <div className="pannello p-4 flex flex-col items-center justify-center gap-2">
              <span className="etichetta">residuo umano</span>
              <div
                className="mono leading-none"
                style={{ fontSize: 'clamp(56px, 9vw, 120px)', color: 'var(--live)', letterSpacing: '-0.03em' }}
              >
                {esiti.residuoPct.toFixed(0)}%
              </div>
              {/* Il numero dominante della schermata non resta mai senza la sua
                  definizione: la glossa arriva dal glossario, non da qui. */}
              <p className="m-0 text-[13px] text-center max-w-[34rem]" style={{ color: 'var(--ink-dim)' }}>
                {TERMINI['residuo umano']}
              </p>
              {esiti.quoteInPareggio > 0 && (
                <p className="m-0 text-[13px] text-center" style={{ color: 'var(--tension)' }}>
                  <span className="mono">{esiti.quoteInPareggio}%</span> delle quote in pareggio, fuori dal residuo
                </p>
              )}
              {sommaQuote !== 100 && (
                <p className="m-0 text-[13px] text-center" style={{ color: 'var(--ink-dim)' }}>
                  Quote sommate: <span className="mono">{sommaQuote}%</span> — residuo normalizzato
                </p>
              )}
            </div>

            <DivergenceList
              voci={esiti.esiti
                .filter((e) => e.divergente)
                .map((e) => ({
                  etichetta: e.nome,
                  dettaglio: dettaglioVoti(e.conteggi),
                  intensita:
                    e.votanti > 0 ? 1 - Math.max(...DESTINAZIONI.map((d) => e.conteggi[d])) / e.votanti : 0,
                }))}
            />
          </div>

          {sessione.stato !== 'LOCKED' && (
            <div className="pannello p-4 flex flex-col gap-3">
              <p className="m-0 text-[17px]">Il residuo, venduto da solo, quanto vale?</p>
              <Istruzione>
                Scegliete una risposta insieme: decide in quale dei tre bucket finisce il servizio.
              </Istruzione>
              <div className="grid grid-cols-3 gap-2">
                {RISPOSTE.map((r) => {
                  const attiva = servizio.valoreResiduo === r.chiave;
                  const spento = r.bucket === 'CHIUSO' && !chiPropone;
                  const glossa = BUCKET_GLOSSA[r.bucket];
                  return (
                    <button
                      key={r.chiave}
                      className="bottone text-left p-3 flex flex-col gap-1"
                      aria-pressed={attiva}
                      onClick={() => {
                        if (spento) return;
                        invia('servizio.setBucket', {
                          servizioId: servizio.id,
                          bucket: r.bucket,
                          valoreResiduo: r.chiave,
                          richiestoDa: r.bucket === 'CHIUSO' ? chiPropone : undefined,
                        });
                      }}
                      disabled={spento}
                    >
                      <span className="text-[15px]">{r.testo}</span>
                      {/* Da spento le due righe sotto perdono il colore
                          semantico: hanno un colore inline, quindi la regola
                          `button:disabled` dei token non le raggiunge e senza
                          questo il bottone inerte resterebbe acceso come gli
                          altri due. */}
                      <span
                        className="text-[13px]"
                        style={{ color: spento ? 'var(--ink-faint)' : coloreBucket(r.bucket) }}
                      >
                        {glossa.etichetta}{' '}
                        <span style={{ color: spento ? 'var(--ink-faint)' : 'var(--ink-dim)' }}>
                          ({glossa.standard})
                        </span>
                      </span>
                      <span
                        className="text-[13px]"
                        style={{ color: spento ? 'var(--ink-faint)' : 'var(--ink-dim)' }}
                      >
                        {glossa.aiuto}
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                <span className="etichetta">chiusura richiesta da</span>
                <select
                  className="text-[13px]"
                  value={chiPropone ?? ''}
                  onChange={(e) => setChiPropone(e.target.value || null)}
                >
                  <option value="">nessuno</option>
                  {presenti.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <span>
                  Finché nessuno la richiede, «Niente» resta spento: un servizio non si chiude per inerzia.
                </span>
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
      <TestataModulo modulo="M1" />
      <Istruzione>Scegli il servizio da scomporre in questo round.</Istruzione>
      <div className="grid grid-cols-3 gap-2">
        {stato.servizi.map((s) => (
          <button
            key={s.id}
            className="bottone p-4 text-left flex flex-col gap-1"
            onClick={() =>
              invia('session.create', { modulo: 'M1', titolo: s.nome, soggettoId: s.id, durataS: 240 })
            }
          >
            <span className="text-[15px]">{s.nome}</span>
            <span className="text-[13px]" style={{ color: coloreBucket(s.bucket) }}>
              {s.bucket ? etichettaBucket(s.bucket) : 'non ancora scomposto'}
            </span>
          </button>
        ))}
      </div>
      <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
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

      <Istruzione>
        Elencate insieme le attività che compongono il servizio e assegnate a ognuna la quota di prezzo che
        regge. Le quote devono sommare a 100.
      </Istruzione>

      <div className="flex flex-col gap-2">
        {servizio.attivita.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <span className="mono text-[13px] w-6 shrink-0 text-right" style={{ color: 'var(--ink-faint)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <input
              className="flex-1 min-w-0 text-[13px]"
              aria-label={`nome dell'attività ${i + 1}`}
              value={a.nome}
              onChange={(e) =>
                aggiorna(servizio.attivita.map((x) => (x.id === a.id ? { ...x, nome: e.target.value } : x)))
              }
            />
            <input
              className="mono text-[13px] w-20 shrink-0 text-right"
              aria-label={`quota di prezzo di ${a.nome}`}
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
            <span className="etichetta shrink-0">%</span>
            <button
              className="bottone text-[13px] shrink-0"
              aria-label={`rimuovi ${a.nome}`}
              title="Rimuovi l'attività"
              onClick={() => aggiorna(servizio.attivita.filter((x) => x.id !== a.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Vincolo visivo: la barra si riempie fino a 100% */}
      <div>
        <div className="flex h-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, sommaQuote)}%`,
              background: sommaQuote === 100 ? 'var(--live)' : 'var(--tension)',
            }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-3 mt-2">
          <span className="etichetta">somma delle quote</span>
          <span className="flex items-baseline gap-2">
            <span
              className="mono text-[13px]"
              style={{ color: sommaQuote === 100 ? 'var(--live)' : 'var(--tension)' }}
            >
              {sommaQuote}%
            </span>
            {sommaQuote !== 100 && (
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                — {sommaQuote < 100 ? 'mancano' : 'eccedono'}{' '}
                <span className="mono">{Math.abs(100 - sommaQuote)}%</span>
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          className="bottone text-[13px]"
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
            className="bottone text-[13px]"
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

/**
 * Intestazione di colonna della tabella degli esiti. Le stesse larghezze di
 * RigaEsito: se una cambia, cambiano tutte e due.
 */
function IntestazioneEsiti() {
  return (
    <div className="flex items-center gap-3">
      <span className="etichetta flex-1 min-w-0">attività</span>
      <span className="etichetta w-12 shrink-0 text-right">quota</span>
      <span className="etichetta w-40 shrink-0">voti</span>
      <span className="etichetta w-28 shrink-0">destinazione</span>
      <span className="etichetta w-52 shrink-0">divergenza</span>
    </div>
  );
}

function RigaEsito({ esito }: { esito: EsitoAttivita }) {
  const totale = DESTINAZIONI.reduce((s, d) => s + esito.conteggi[d], 0);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] flex-1 min-w-0 truncate">{esito.nome}</span>
      <span className="mono text-[13px] w-12 shrink-0 text-right" style={{ color: 'var(--ink-dim)' }}>
        {esito.quotaPct}%
      </span>
      <div
        className="flex w-40 h-3 shrink-0"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
      >
        {DESTINAZIONI.map((d) =>
          esito.conteggi[d] > 0 ? (
            <div
              key={d}
              className={d === 'MORTA' ? 'tratteggio' : ''}
              style={{
                width: `${(esito.conteggi[d] / Math.max(totale, 1)) * 100}%`,
                background: d === 'MORTA' ? undefined : COLORE_DESTINAZIONE[d],
              }}
              title={`${esito.conteggi[d]} ${DESTINAZIONI_GLOSSA[d].etichetta}`}
            />
          ) : null,
        )}
      </div>
      <span
        className="text-[13px] w-28 shrink-0"
        style={{ color: esito.esito ? COLORE_DESTINAZIONE[esito.esito] : 'var(--tension)' }}
      >
        {esito.esito ? DESTINAZIONI_GLOSSA[esito.esito].etichetta : 'pareggio'}
      </span>
      {/* Colonna sempre presente, anche vuota: le righe restano incolonnate. */}
      <span className="text-[13px] w-52 shrink-0 whitespace-nowrap" style={{ color: 'var(--tension)' }}>
        {esito.divergente ? <DettaglioVoti conteggi={esito.conteggi} /> : ''}
      </span>
    </div>
  );
}

/** La barra del servizio, larga e dominante, segmentata per attività. */
function BarraAttivita({ esiti, cieca = false }: { esiti: ReturnType<typeof esitiServizio>; cieca?: boolean }) {
  const totale = esiti.totaleQuote || 1;
  return (
    <div className="flex h-16" style={{ border: '1px solid var(--line)' }}>
      {esiti.esiti.map((e) => {
        const larghezza = `${(e.quotaPct / totale) * 100}%`;
        if (cieca) {
          return (
            <div
              key={e.attivitaId}
              className="flex items-end p-1"
              style={{ width: larghezza, borderRight: '1px solid var(--line)', background: 'var(--bg-raised)' }}
            >
              <span className="mono text-[11px]" style={{ color: 'var(--ink-dim)' }}>
                {e.quotaPct}%
              </span>
            </div>
          );
        }
        const divergente = e.esito === null && e.votanti > 0;
        const morta = e.esito === 'MORTA';
        // Solo AI e UMANO sono riempimenti pieni: MORTA è tratteggiata e la
        // divergenza è a strisce, e sopra un motivo il testo resta scuro.
        const riempimento = e.esito === 'AI' || e.esito === 'UMANO' ? COLORE_DESTINAZIONE[e.esito] : undefined;
        return (
          <div
            key={e.attivitaId}
            className={`flex items-end p-1 ${divergente ? 'strisce' : morta ? 'tratteggio' : ''}`}
            style={{
              width: larghezza,
              borderRight: '1px solid var(--bg-deep)',
              background: riempimento ?? (divergente || morta ? undefined : 'var(--bg-raised)'),
            }}
            title={`${e.nome} — ${e.esito ? DESTINAZIONI_GLOSSA[e.esito].etichetta : 'pareggio'}`}
          >
            <span
              className="mono text-[11px]"
              style={{ color: riempimento ? 'var(--ink-inverso)' : 'var(--ink)' }}
            >
              {e.quotaPct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Vista di confronto: tutti i servizi già scomposti, barre affiancate. */
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
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="etichetta">servizi già scomposti</span>
        <button className="bottone text-[13px]" aria-pressed={ordinaPerResiduo} onClick={onOrdina}>
          Ordina per residuo umano
        </button>
      </div>
      <p className="m-0 mb-3 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        {TERMINI['residuo umano']}
      </p>
      <div className="flex flex-col gap-2">
        {ordinate.map((r) => (
          <div key={r.servizio.id} className="flex items-center gap-3">
            <span className="text-[13px] w-56 shrink-0 truncate">{r.servizio.nome}</span>
            <div
              className="flex-1 h-3"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
            >
              <div className="h-full" style={{ width: `${r.residuo}%`, background: 'var(--live)' }} />
            </div>
            <span className="mono text-[13px] w-12 shrink-0 text-right">{r.residuo.toFixed(0)}%</span>
            <span className="text-[13px] w-36 shrink-0 truncate" style={{ color: coloreBucket(r.servizio.bucket) }}>
              {etichettaBucket(r.servizio.bucket)}
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

  if (!stato || !servizio) return <Vuoto>Nessun servizio in scomposizione.</Vuoto>;

  const complete = servizio.attivita.every((a) => scelte[a.id]);
  const mancanti = servizio.attivita.filter((a) => !scelte[a.id]).length;

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo={servizio.nome} sottotitolo="Le tue risposte, in sola lettura">
        <div className="flex flex-col gap-2">
          {servizio.attivita.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-3 rialzato">
              <span className="text-[15px] flex-1 min-w-0">{a.nome}</span>
              <span
                className="text-[13px] shrink-0"
                style={{ color: scelte[a.id] ? COLORE_DESTINAZIONE[scelte[a.id]] : 'var(--ink-faint)' }}
              >
                {scelte[a.id] ? DESTINAZIONI_GLOSSA[scelte[a.id]].etichetta : '—'}
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
      sottotitolo="Assegna ogni attività a chi la farà d’ora in poi"
      azione={
        <div className="flex flex-col gap-2">
          <StatoCommitMano confermato={mio?.confermato ?? false} />
          <button
            className="bottone bottone-primario text-[15px]"
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
                {mancanti === 1 ? 'Manca' : 'Mancano'} <span className="mono">{mancanti}</span> da assegnare
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* La legenda sta in cima una volta sola: ripetere le tre glosse sotto
            ogni attività allungherebbe la lista senza aggiungere nulla. */}
        <LegendaDestinazioni variante="mano" />

        {servizio.attivita.map((a) => (
          <div key={a.id}>
            <div className="text-[15px] mb-2">{a.nome}</div>
            <div className="flex gap-2">
              {DESTINAZIONI.map((d) => (
                <BottoneTocco
                  key={d}
                  attivo={scelte[a.id] === d}
                  colore={COLORE_DESTINAZIONE[d]}
                  onClick={() => imposta(a.id, d)}
                >
                  <span className="text-[15px]">{DESTINAZIONI_GLOSSA[d].etichetta}</span>
                </BottoneTocco>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CompitoMano>
  );
}
