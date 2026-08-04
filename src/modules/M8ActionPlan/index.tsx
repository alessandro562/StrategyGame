'use client';

/**
 * M8 — L'action plan. È l'output dichiarato del ritiro e non può mancare:
 * senza questo modulo il tool produce diagnosi che nessuno esegue.
 *
 * Il modulo si alimenta da solo: ogni lock propone la sua azione precompilata,
 * che il team accetta, modifica o scarta.
 */

import { useState } from 'react';
import { QUOTA_MASSIMA_OWNER, controlliM8 } from '@/lib/calc';
import { proposteAzioni } from '@/lib/handlers';
import type { Azione, Orizzonte, Sessione } from '@/lib/types';
import { CompitoMano, Intestazione, Vuoto } from '../comune';
import { useStore } from '@/net/useStore';

const SCADENZA_90 = '2026-10-31';
const SCADENZA_GEN = '2027-01-31';

export function M8Tavolo({ sessione }: { sessione: Sessione }) {
  const { stato, invia, presenti, nome } = useStore();
  if (!stato) return null;

  const controlli = controlliM8(stato.azioni, stato.lock);
  const proposte = proposteAzioni(stato);

  return (
    <div className="flex flex-col gap-4">
      <Intestazione
        modulo="M8"
        titolo="L'action plan"
        sottotitolo="Un solo owner per azione. Mai «tutti», mai «il team»."
        destra={
          <div className="text-right">
            <div className="etichetta">azioni</div>
            <div className="mono text-[28px] leading-none">{stato.azioni.length}</div>
          </div>
        }
      />

      {proposte.length > 0 && (
        <div className="pannello p-4">
          <div className="etichetta mb-2">proposte dalle decisioni bloccate</div>
          <div className="flex flex-col gap-2">
            {proposte.map((p) => (
              <div key={p.lockId} className="flex items-center gap-2">
                <span className="mono text-[12px] w-8" style={{ color: 'var(--locked)' }}>
                  {p.modulo}
                </span>
                <span className="text-[14px] flex-1">{p.testo}</span>
                <button
                  className="bottone text-[12px]"
                  onClick={() =>
                    invia('azione.upsert', {
                      testo: p.testo,
                      ownerId: presenti[0]?.id ?? '',
                      scadenza: SCADENZA_90,
                      orizzonte: '90_GIORNI',
                      lockOrigine: p.lockId,
                    })
                  }
                >
                  Accetta
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pannello p-4 flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_140px_140px_130px_auto] gap-2 items-center">
          <span className="etichetta">azione — verbo all&apos;infinito</span>
          <span className="etichetta">owner</span>
          <span className="etichetta">scadenza</span>
          <span className="etichetta">orizzonte</span>
          <span />
        </div>
        {stato.azioni.map((a) => (
          <RigaAzione key={a.id} azione={a} />
        ))}
        {stato.azioni.length === 0 && (
          <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Nessuna azione.
          </span>
        )}
        <button
          className="bottone text-[12px] self-start mt-1"
          onClick={() =>
            invia('azione.upsert', {
              testo: 'Nuova azione',
              ownerId: presenti[0]?.id ?? '',
              scadenza: SCADENZA_90,
              orizzonte: '90_GIORNI',
              lockOrigine: stato.lock[0]?.id ?? '',
            })
          }
          disabled={presenti.length === 0}
        >
          Aggiungi azione
        </button>
      </div>

      {/* Controlli obbligatori prima della chiusura */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <div className="pannello p-4">
          <div className="etichetta mb-3">distribuzione per owner</div>
          {controlli.perOwner.length === 0 && (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuna azione assegnata.
            </span>
          )}
          <div className="flex flex-col gap-2">
            {controlli.perOwner.map((o) => (
              <div key={o.ownerId} className="flex items-center gap-3">
                <span className="text-[13px] w-24 shrink-0">{nome(o.ownerId)}</span>
                <div className="flex-1 h-2" style={{ background: 'var(--bg-deep)', border: '1px solid var(--line)' }}>
                  <div
                    className="h-full"
                    style={{ width: `${o.quota * 100}%`, background: o.sovraccarico ? 'var(--tension)' : 'var(--wda)' }}
                  />
                </div>
                <span className="mono text-[12px] w-16 text-right" style={{ color: o.sovraccarico ? 'var(--tension)' : 'var(--ink-dim)' }}>
                  {o.conteggio} · {Math.round(o.quota * 100)}%
                </span>
              </div>
            ))}
          </div>
          {controlli.perOwner.some((o) => o.sovraccarico) && (
            <p className="m-0 mt-3 text-[12px]" style={{ color: 'var(--tension)' }}>
              Una persona ha più del {QUOTA_MASSIMA_OWNER * 100}% delle azioni.
            </p>
          )}
        </div>

        <div className="pannello p-4 flex flex-col gap-2">
          <div className="etichetta mb-1">controlli di chiusura</div>
          <Controllo ok={controlli.senzaOwner.length === 0} testo={`${controlli.senzaOwner.length} azioni senza owner`} />
          <Controllo ok={controlli.senzaScadenza.length === 0} testo={`${controlli.senzaScadenza.length} azioni senza data`} />
          <Controllo
            ok={controlli.lockSenzaAzione.length === 0}
            testo={`${controlli.lockSenzaAzione.length} decisioni senza esecuzione`}
            avviso
          />
          <button
            className="bottone bottone-primario mt-2 self-start"
            disabled={!controlli.chiudibile || sessione.stato === 'LOCKED'}
            onClick={() =>
              invia('lock.create', {
                sessioneId: sessione.id,
                contenuto: { azioni: stato.azioni.length, perOwner: controlli.perOwner },
                dissensi: [],
              })
            }
          >
            {sessione.stato === 'LOCKED' ? 'Chiuso' : 'Chiudi M8'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Controllo({ ok, testo, avviso }: { ok: boolean; testo: string; avviso?: boolean }) {
  const colore = ok ? 'var(--live)' : avviso ? 'var(--tension)' : 'var(--erosion)';
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-2 h-2" style={{ background: colore }} />
      <span className="text-[13px]" style={{ color: ok ? 'var(--ink-dim)' : colore }}>
        {testo}
      </span>
    </div>
  );
}

function RigaAzione({ azione }: { azione: Azione }) {
  const { invia, presenti, stato } = useStore();
  const l = stato?.lock.find((x) => x.id === azione.lockOrigine);

  const aggiorna = (over: Partial<Azione>) =>
    invia('azione.upsert', {
      id: azione.id,
      testo: azione.testo,
      ownerId: azione.ownerId,
      scadenza: azione.scadenza,
      orizzonte: azione.orizzonte,
      lockOrigine: azione.lockOrigine,
      stato: azione.stato,
      ...over,
    });

  return (
    <div className="grid grid-cols-[1fr_140px_140px_130px_auto] gap-2 items-center">
      <input
        className="text-[14px]"
        defaultValue={azione.testo}
        onBlur={(e) => e.target.value !== azione.testo && aggiorna({ testo: e.target.value })}
      />
      <select
        className="text-[13px]"
        value={azione.ownerId}
        onChange={(e) => aggiorna({ ownerId: e.target.value })}
        style={{ borderColor: azione.ownerId ? undefined : 'var(--erosion)' }}
      >
        <option value="">— nessuno —</option>
        {presenti.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <input
        className="mono text-[13px]"
        type="date"
        max="2027-01-31"
        value={azione.scadenza}
        onChange={(e) => aggiorna({ scadenza: e.target.value })}
        style={{ borderColor: azione.scadenza ? undefined : 'var(--erosion)' }}
      />
      <select
        className="text-[13px]"
        value={azione.orizzonte}
        onChange={(e) => {
          const o = e.target.value as Orizzonte;
          aggiorna({ orizzonte: o, scadenza: o === '90_GIORNI' ? SCADENZA_90 : SCADENZA_GEN });
        }}
      >
        <option value="90_GIORNI">90 giorni</option>
        <option value="A_GENNAIO_2027">gennaio 2027</option>
      </select>
      <div className="flex items-center gap-1">
        <span className="mono text-[11px]" style={{ color: 'var(--locked)' }} title={l ? `${l.modulo} — ${l.titolo}` : 'nessuna decisione di origine'}>
          {l?.modulo ?? '—'}
        </span>
        <button className="bottone text-[12px]" onClick={() => invia('entity.delete', { tipo: 'azione', id: azione.id })}>
          ×
        </button>
      </div>
    </div>
  );
}

export function M8Mano() {
  const { stato, io, nome } = useStore();
  if (!stato) return null;
  const mie = stato.azioni.filter((a) => a.ownerId === io?.id);

  return (
    <CompitoMano titolo="Le tue azioni" sottotitolo={io ? nome(io.id) : undefined}>
      {mie.length === 0 ? (
        <Vuoto>Nessuna azione a tuo nome.</Vuoto>
      ) : (
        <div className="flex flex-col gap-2">
          {mie.map((a) => (
            <div key={a.id} className="rialzato p-3">
              <div className="text-[15px]">{a.testo}</div>
              <div className="mono text-[12px] mt-1" style={{ color: 'var(--ink-dim)' }}>
                {a.scadenza} · {a.orizzonte === '90_GIORNI' ? '90 giorni' : 'gennaio 2027'}
              </div>
            </div>
          ))}
        </div>
      )}
    </CompitoMano>
  );
}
