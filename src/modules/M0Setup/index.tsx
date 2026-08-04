'use client';

/**
 * M0 — Setup. Tetto rigido: 15 minuti.
 * Ogni campo ha un default sensato, nessun campo blocca l'avanzamento.
 */

import { useState } from 'react';
import { Intestazione, Premessa } from '../comune';
import { QrCode } from '@/components/QrCode';
import { useStore } from '@/net/useStore';
import type { Profilo, Qualitativo } from '@/lib/types';

const PROFILI: Profilo[] = ['founder', 'operativo', 'board', 'non_operativo'];
const QUALITATIVI: Qualitativo[] = ['basso', 'medio', 'alto'];

const VINCOLI: { chiave: 'R' | 'G' | 'B'; nome: string; descrizione: string }[] = [
  { chiave: 'R', nome: 'Relazioni contemporanee', descrizione: 'Rapporti di fiducia reggibili in parallelo' },
  { chiave: 'G', nome: 'Gate decisionali umani', descrizione: 'Decisioni al mese in cui qualcuno mette la faccia' },
  { chiave: 'B', nome: 'Banda commerciale', descrizione: 'Conversazioni di vendita reale aperte in parallelo' },
];

export function M0Tavolo({ urlMano }: { urlMano: string }) {
  const { stato, invia, nome } = useStore();
  if (!stato) return null;
  const w = stato.workshop;
  const qualitativa = w.modalitaVincoli === 'qualitativa';

  return (
    <div className="flex flex-col gap-4">
      <Intestazione
        modulo="M0"
        titolo="Setup"
        sottotitolo="Tutto è modificabile durante il ritiro. Nessun campo blocca l'avanzamento."
      />

      <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-start">
        {/* Partecipanti ------------------------------------------- */}
        <section className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">partecipanti</span>
          {stato.partecipanti.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 shrink-0"
                style={{ background: p.socketConnesso ? 'var(--live)' : 'var(--line-strong)' }}
                title={p.socketConnesso ? 'connesso' : 'non connesso'}
              />
              <span className="text-[14px] w-24 shrink-0">{p.nome}</span>
              <select
                className="text-[12px] flex-1"
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
                className="bottone text-[12px]"
                aria-pressed={p.presente}
                onClick={() => invia('participant.setPresence', { partecipanteId: p.id, presente: !p.presente })}
              >
                {p.presente ? 'presente' : 'assente'}
              </button>
            </div>
          ))}
          <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--line)' }}>
            <span className="etichetta">facilitatore</span>
            <div className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
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
          {stato.servizi.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="text-[14px] flex-1">{s.nome}</span>
              <input
                className="mono text-[13px] w-28 text-right"
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
              <span className="etichetta">€</span>
            </div>
          ))}
          <button
            className="bottone text-[12px] self-start mt-1"
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
        <section className="pannello p-4 flex flex-col items-center gap-2">
          <span className="etichetta">accesso partecipanti</span>
          <QrCode url={urlMano} lato={140} />
        </section>
      </div>

      {/* Vincoli --------------------------------------------------- */}
      <section className="pannello p-4">
        <div className="flex items-baseline justify-between mb-3">
          <span className="etichetta">le tre risorse scarse</span>
          <div className="flex gap-1">
            <button
              className="bottone text-[12px]"
              aria-pressed={!qualitativa}
              onClick={() => invia('workshop.update', { modalitaVincoli: 'numerica', vincoli: { R: 8, G: 12, B: 5 } })}
            >
              numerica
            </button>
            <button
              className="bottone text-[12px]"
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
        </div>
        <div className="grid grid-cols-3 gap-4">
          {VINCOLI.map((v) => (
            <div key={v.chiave} className="rialzato p-3">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[15px]" style={{ color: 'var(--wda-bright)' }}>
                  {v.chiave}
                </span>
                <span className="text-[14px]">{v.nome}</span>
              </div>
              <p className="m-0 mt-1 mb-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                {v.descrizione}
              </p>
              {qualitativa ? (
                <div className="flex gap-1">
                  {QUALITATIVI.map((q) => (
                    <button
                      key={q}
                      className="bottone text-[12px] flex-1"
                      aria-pressed={w.vincoli[v.chiave] === q}
                      onClick={() => invia('workshop.update', { vincoli: { ...w.vincoli, [v.chiave]: q } })}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  className="mono text-[15px] w-24"
                  type="number"
                  min={0}
                  value={typeof w.vincoli[v.chiave] === 'number' ? (w.vincoli[v.chiave] as number) : 0}
                  onChange={(e) =>
                    invia('workshop.update', { vincoli: { ...w.vincoli, [v.chiave]: Number(e.target.value) || 0 } })
                  }
                />
              )}
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
          Le giornate-uomo non sono fra le risorse scarse: con la leva AI si misurerebbe la risorsa diventata
          abbondante.
        </p>
      </section>

      <Premessa>
        Il tool serve al lato core. Forge entra solo come vincolo di tempo in M6 e come cappello COSTRUTTORE.
      </Premessa>
    </div>
  );
}

export function M0Mano() {
  const { stato, invia, io } = useStore();
  const [scelto, setScelto] = useState<string | null>(null);
  if (!stato) return null;

  if (io) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="etichetta">sei collegato come</span>
        <div className="text-[24px]">{io.nome}</div>
        <button
          className="bottone text-[12px]"
          onClick={() => invia('participant.setPresence', { partecipanteId: io.id, presente: !io.presente })}
        >
          {io.presente ? 'Segnalati assente' : 'Segnalati presente'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-[17px] font-normal">Chi sei?</h2>
        <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          Scegli il tuo nome dalla lista.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {stato.partecipanti.map((p) => (
          <button
            key={p.id}
            className="text-left px-4"
            style={{
              minHeight: 52,
              border: `1px solid ${scelto === p.nome ? 'var(--wda-bright)' : 'var(--line-strong)'}`,
              background: scelto === p.nome ? 'var(--wda-wash)' : 'var(--bg-raised)',
            }}
            onClick={() => {
              setScelto(p.nome);
              invia('participant.join', { nome: p.nome });
            }}
          >
            {p.nome}
          </button>
        ))}
      </div>
    </div>
  );
}
