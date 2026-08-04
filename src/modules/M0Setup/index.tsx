'use client';

/**
 * M0 — Setup. Tetto rigido: 15 minuti.
 * Ogni campo ha un default sensato, nessun campo blocca l'avanzamento.
 *
 * Scala tipografica del modulo, tre gradini e basta: .etichetta (11px, mono)
 * per etichette e unità di misura, 13px per le righe dense e i controlli,
 * 15px per il contenuto primario. Sulla Mano il corpo sale a 15px perché si
 * legge a mano tesa e non su un proiettore.
 */

import { Premessa } from '../comune';
import { QrCode } from '@/components/QrCode';
import { TestataModulo, TestataModuloMano } from '@/components/TestataModulo';
import { useStore } from '@/net/useStore';
import type { Profilo, Qualitativo } from '@/lib/types';

const PROFILI: Profilo[] = ['founder', 'operativo', 'board', 'non_operativo'];
const QUALITATIVI: Qualitativo[] = ['basso', 'medio', 'alto'];

/**
 * R, G e B sono le chiavi del modello dati, non un nome: da sole non dicono
 * niente a chi le legge la prima volta. Restano come sigla, ma davanti ci va
 * il nome per esteso, sotto cosa si sta contando, e accanto al campo l'unità
 * di misura — altrimenti «8» non si sa se sono clienti, mesi o persone.
 */
const VINCOLI: { chiave: 'R' | 'G' | 'B'; nome: string; descrizione: string; unita: string }[] = [
  {
    chiave: 'R',
    nome: 'Relazioni di fiducia',
    descrizione:
      'Quanti clienti o partner riusciamo a seguire davvero nello stesso periodo, prima che la relazione si degradi.',
    unita: 'relazioni in parallelo',
  },
  {
    chiave: 'G',
    nome: 'Decisioni con la nostra firma',
    descrizione:
      'Quante volte al mese qualcuno del team può mettere la faccia su una scelta: approvare, garantire, esporsi.',
    unita: 'al mese',
  },
  {
    chiave: 'B',
    nome: 'Trattative aperte',
    descrizione:
      'Quante conversazioni di vendita vere possiamo tenere aperte insieme, dal primo contatto alla firma.',
    unita: 'in parallelo',
  },
];

export function M0Tavolo({ urlMano }: { urlMano: string }) {
  const { stato, invia, nome } = useStore();
  if (!stato) return null;
  const w = stato.workshop;
  const qualitativa = w.modalitaVincoli === 'qualitativa';

  return (
    <div className="flex flex-col gap-4">
      <TestataModulo modulo="M0" />

      <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        Si compila adesso, una volta sola: chi è in stanza, cosa vendiamo oggi, cosa è scarso. Tutto resta modificabile
        durante il ritiro e nessun campo blocca l’avanzamento.
      </p>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-start">
        {/* Partecipanti ------------------------------------------- */}
        <section className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">partecipanti</span>
          <p className="m-0 mb-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Segna chi è presente e con quale ruolo siede al tavolo.
          </p>
          {stato.partecipanti.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 shrink-0"
                style={{ background: p.socketConnesso ? 'var(--live)' : 'var(--line-strong)' }}
                title={p.socketConnesso ? 'connesso' : 'non connesso'}
              />
              <span className="text-[13px] flex-1 min-w-0 truncate">{p.nome}</span>
              <select
                className="text-[13px] w-36 shrink-0"
                aria-label={`profilo di ${p.nome}`}
                value={p.profilo}
                onChange={(e) =>
                  invia('entity.upsert', { tipo: 'partecipante', dati: { id: p.id, profilo: e.target.value } })
                }
              >
                {PROFILI.map((x) => (
                  <option key={x} value={x}>
                    {x.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <button
                className="bottone text-[13px] w-24 shrink-0"
                aria-pressed={p.presente}
                onClick={() => invia('participant.setPresence', { partecipanteId: p.id, presente: !p.presente })}
              >
                {p.presente ? 'presente' : 'assente'}
              </button>
            </div>
          ))}
          <div className="mt-2 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
            <span className="etichetta">facilitatore</span>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Apre i round, chiude il confronto e registra le decisioni.
            </p>
            <div className="text-[13px] mt-1">
              {/* Il Tavolo non è un partecipante: se il pid non è in lista, è lui. */}
              {stato.partecipanti.some((p) => p.id === w.facilitatoreId)
                ? nome(w.facilitatoreId!)
                : 'questo Tavolo'}
            </div>
          </div>
        </section>

        {/* Servizi ------------------------------------------------- */}
        <section className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">servizi — fatturato ultimi 12 mesi</span>
          <p className="m-0 mb-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Elenca i servizi venduti negli ultimi dodici mesi. Il fatturato pesa i risultati dei moduli successivi.
          </p>
          {stato.servizi.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="text-[13px] flex-1 min-w-0 truncate">{s.nome}</span>
              <input
                className="mono text-[13px] w-28 shrink-0 text-right"
                aria-label={`fatturato 12 mesi di ${s.nome}`}
                type="number"
                min={0}
                step={1000}
                value={s.fatturato12m}
                onChange={(e) =>
                  invia('entity.upsert', {
                    tipo: 'servizio',
                    dati: { id: s.id, fatturato12m: Number(e.target.value) || 0 },
                  })
                }
              />
              <span className="etichetta shrink-0">€</span>
            </div>
          ))}
          <button
            className="bottone text-[13px] self-start mt-2"
            onClick={() =>
              invia('entity.upsert', {
                tipo: 'servizio',
                dati: {
                  nome: 'Nuovo servizio',
                  descrizione: '',
                  fatturato12m: 0,
                  attivita: [],
                  destinazioni: [],
                  bucket: null,
                  valoreResiduo: null,
                  basePrezzo: null,
                },
              })
            }
          >
            Aggiungi servizio
          </button>
        </section>

        {/* Accesso ------------------------------------------------- */}
        <section className="pannello p-4 flex flex-col items-center gap-3">
          <span className="etichetta">accesso partecipanti</span>
          <QrCode url={urlMano} lato={140} />
          <p className="m-0 text-[13px] text-center max-w-[16rem]" style={{ color: 'var(--ink-dim)' }}>
            Ognuno inquadra il codice con il telefono. Dal telefono si risponde in privato, senza vedere le risposte
            degli altri.
          </p>
        </section>
      </div>

      {/* Vincoli --------------------------------------------------- */}
      <section className="pannello p-4">
        <div className="flex items-baseline justify-between gap-6">
          <span className="etichetta">le tre risorse scarse</span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1">
              <button
                className="bottone text-[13px]"
                aria-pressed={!qualitativa}
                onClick={() =>
                  invia('workshop.update', { modalitaVincoli: 'numerica', vincoli: { R: 8, G: 12, B: 5 } })
                }
              >
                numerica
              </button>
              <button
                className="bottone text-[13px]"
                aria-pressed={qualitativa}
                onClick={() =>
                  invia('workshop.update', {
                    modalitaVincoli: 'qualitativa',
                    vincoli: { R: 'medio', G: 'medio', B: 'basso' },
                  })
                }
              >
                qualitativa
              </button>
            </div>
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Numerica se la cifra la conoscete, qualitativa se conviene stimarla.
            </span>
          </div>
        </div>
        <p className="m-0 mt-2 mb-3 text-[15px]" style={{ color: 'var(--ink)' }}>
          Sono le tre cose che l’AI non moltiplica: restano quelle per quanto lavoro si aggiunga, e fissano quante
          iniziative il team regge davvero. Dai un valore a ciascuna: R, G e B tornano in M6, sulla soglia di ricavi, e
          in M8, quando il piano va diviso fra le persone.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {VINCOLI.map((v) => (
            <div key={v.chiave} className="rialzato p-3 flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[15px]" style={{ color: 'var(--wda-bright)' }}>
                  {v.chiave}
                </span>
                <span className="text-[15px]">{v.nome}</span>
              </div>
              <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                {v.descrizione}
              </p>
              {qualitativa ? (
                <div className="flex gap-1">
                  {QUALITATIVI.map((q) => (
                    <button
                      key={q}
                      className="bottone text-[13px] flex-1"
                      aria-pressed={w.vincoli[v.chiave] === q}
                      onClick={() => invia('workshop.update', { vincoli: { ...w.vincoli, [v.chiave]: q } })}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <input
                    className="mono text-[15px] w-20"
                    aria-label={`${v.nome}, ${v.unita}`}
                    type="number"
                    min={0}
                    value={typeof w.vincoli[v.chiave] === 'number' ? (w.vincoli[v.chiave] as number) : 0}
                    onChange={(e) =>
                      invia('workshop.update', { vincoli: { ...w.vincoli, [v.chiave]: Number(e.target.value) || 0 } })
                    }
                  />
                  <span className="etichetta">{v.unita}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          Le giornate-uomo non sono fra le risorse scarse: con la leva AI si misurerebbe la risorsa diventata
          abbondante.
        </p>
      </section>

      <Premessa>
        Il ritiro lavora sul lato core, cioè sui servizi che vendiamo oggi. Forge entra solo in due punti: come vincolo
        di tempo in M6, revenue floor e runway, e come cappello COSTRUTTORE in discussione.
      </Premessa>
    </div>
  );
}

export function M0Mano() {
  const { stato, invia, io } = useStore();
  if (!stato || !io) return null;

  const collegati = stato.partecipanti.filter((p) => p.socketConnesso).length;

  return (
    <div className="flex-1 flex flex-col gap-5">
      <div className="rialzato p-4" style={{ borderColor: 'var(--wda-bright)' }}>
        <span className="etichetta">sei entrato come</span>
        <div className="text-[26px] mt-1">{io.nome}</div>
      </div>

      <TestataModuloMano modulo="M0" />

      <p className="m-0 text-[15px]" style={{ color: 'var(--ink)' }}>
        Adesso non c’è niente da rispondere. Controlla che il tuo nome sia quello giusto e lascia aperta questa
        schermata: cambia da sola quando parte il primo round.
      </p>

      <div>
        <span className="etichetta">chi c’è in stanza</span>
        <div className="flex flex-col gap-1 mt-2">
          {stato.partecipanti.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-2">
              <span
                className="inline-block w-2 h-2 shrink-0"
                style={{ background: p.socketConnesso ? 'var(--live)' : 'var(--line-strong)' }}
              />
              <span
                className="text-[15px] flex-1 min-w-0 truncate"
                style={{ color: p.socketConnesso ? 'var(--ink)' : 'var(--ink-dim)' }}
              >
                {p.nome}
              </span>
              {p.id === io.id && <span className="etichetta shrink-0">tu</span>}
              {!p.presente && (
                <span className="etichetta shrink-0" style={{ color: 'var(--tension)' }}>
                  assente
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          <span className="mono">{collegati}</span> di <span className="mono">{stato.partecipanti.length}</span>{' '}
          collegati. Il round parte quando lo apre chi facilita.
        </p>
      </div>

      <button
        className="bottone self-start text-[15px]"
        style={{ minHeight: 48 }}
        onClick={() => invia('participant.setPresence', { partecipanteId: io.id, presente: !io.presente })}
      >
        {io.presente ? 'Segnalati assente' : 'Segnalati presente'}
      </button>
    </div>
  );
}
