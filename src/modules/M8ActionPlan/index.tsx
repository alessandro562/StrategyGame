'use client';

/**
 * M8 — L'action plan. È l'output dichiarato del ritiro e non può mancare:
 * senza questo modulo il tool produce diagnosi che nessuno esegue.
 *
 * Il modulo si alimenta da solo: ogni lock propone la sua azione precompilata,
 * che il team accetta, modifica o scarta.
 */

import { QUOTA_MASSIMA_OWNER, controlliM8 } from '@/lib/calc';
import { proposteAzioni } from '@/lib/handlers';
import type { Azione, Orizzonte, Sessione } from '@/lib/types';
import { CompitoMano, Istruzione, Vuoto } from '../comune';
import { TestataModulo } from '@/components/TestataModulo';
import { useStore } from '@/net/useStore';

const SCADENZA_90 = '2026-10-31';
const SCADENZA_GEN = '2027-01-31';

/**
 * Le colonne della tabella stanno in un'unica costante: intestazione e righe
 * sono griglie separate, e se i due tracciati divergono le colonne non si
 * allineano più.
 */
const COLONNE = 'grid grid-cols-[1fr_140px_140px_130px_92px] gap-2 items-center';

export function M8Tavolo({ sessione }: { sessione: Sessione }) {
  const { stato, invia, presenti, nome } = useStore();
  if (!stato) return null;

  const controlli = controlliM8(stato.azioni, stato.lock);
  const proposte = proposteAzioni(stato);

  return (
    <div className="flex flex-col gap-4">
      <TestataModulo
        modulo="M8"
        destra={
          <div className="text-right shrink-0" style={{ maxWidth: '16rem' }}>
            <div className="etichetta">azioni nel piano</div>
            <div className="mono text-[28px] leading-none mt-1">{stato.azioni.length}</div>
            <div className="text-[13px] mt-1" style={{ color: 'var(--ink-dim)' }}>
              Righe del piano, comprese quelle ancora senza owner o senza data.
            </div>
          </div>
        }
      />

      {proposte.length > 0 && (
        <div className="pannello p-4">
          <div className="flex flex-col gap-1 mb-3">
            <div className="etichetta">proposte dalle decisioni chiuse</div>
            <Istruzione>
              Ogni decisione chiusa nei moduli precedenti propone la propria azione. Accetta per portarla nel piano,
              poi correggi testo, owner e data nella tabella qui sotto.
            </Istruzione>
          </div>
          <div className="flex flex-col gap-2">
            {proposte.map((p) => (
              <div key={p.lockId} className="flex items-center gap-3">
                <span className="mono text-[13px] w-8 shrink-0" style={{ color: 'var(--locked)' }}>
                  {p.modulo}
                </span>
                <span className="text-[13px] flex-1 min-w-0">{p.testo}</span>
                <button
                  className="bottone text-[13px] shrink-0"
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
        <Istruzione>
          Un’azione per riga, con un solo owner: mai «tutti», mai «il team». L’orizzonte è novanta giorni oppure
          gennaio 2027, e imposta la scadenza. La colonna origine dice da quale decisione nasce l’azione.
        </Istruzione>
        <div className={`${COLONNE} pb-2`} style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="etichetta">azione — verbo all&apos;infinito</span>
          <span className="etichetta">owner</span>
          <span className="etichetta">scadenza</span>
          <span className="etichetta">orizzonte</span>
          <span className="etichetta">origine</span>
        </div>
        {stato.azioni.map((a) => (
          <RigaAzione key={a.id} azione={a} />
        ))}
        {stato.azioni.length === 0 && (
          <span className="text-[13px] py-1" style={{ color: 'var(--ink-dim)' }}>
            Nessuna azione nel piano.
          </span>
        )}
        <button
          className="bottone text-[13px] self-start mt-2"
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
          <div className="flex flex-col gap-1 mb-3">
            <div className="etichetta">distribuzione per owner</div>
            <Istruzione>
              Quante azioni ha in carico ogni persona e che quota del piano rappresentano. La barra cambia colore
              oltre il <span className="mono">{QUOTA_MASSIMA_OWNER * 100}%</span>: da lì in su il piano dipende da una
              persona sola.
            </Istruzione>
          </div>
          {controlli.perOwner.length === 0 && (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuna azione assegnata.
            </span>
          )}
          <div className="flex flex-col gap-2">
            {controlli.perOwner.map((o) => (
              <div
                key={o.ownerId}
                className="grid grid-cols-[7rem_1fr_2rem_3rem] gap-3 items-center"
              >
                <span className="text-[13px] truncate">{nome(o.ownerId)}</span>
                <div
                  className="h-2"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${o.quota * 100}%`,
                      background: o.sovraccarico ? 'var(--tension)' : 'var(--wda)',
                    }}
                  />
                </div>
                <span
                  className="mono text-[13px] text-right"
                  style={{ color: o.sovraccarico ? 'var(--tension)' : 'var(--ink-dim)' }}
                >
                  {o.conteggio}
                </span>
                <span
                  className="mono text-[13px] text-right"
                  style={{ color: o.sovraccarico ? 'var(--tension)' : 'var(--ink-dim)' }}
                >
                  {Math.round(o.quota * 100)}%
                </span>
              </div>
            ))}
          </div>
          {controlli.perOwner.some((o) => o.sovraccarico) && (
            <p className="m-0 mt-3 text-[13px]" style={{ color: 'var(--tension)' }}>
              Una persona ha più del <span className="mono">{QUOTA_MASSIMA_OWNER * 100}%</span>{' '}
              delle azioni.
            </p>
          )}
        </div>

        <div className="pannello p-4 flex flex-col">
          <div className="flex flex-col gap-1 mb-3">
            <div className="etichetta">controlli di chiusura</div>
            <Istruzione>
              Il piano si chiude quando contiene almeno un’azione e le prime due righe sono a zero. La terza non
              blocca la chiusura: segnala le decisioni che nessuno ha ancora tradotto in un’azione.
            </Istruzione>
          </div>
          <div className="flex flex-col gap-2">
            <Controllo
              ok={controlli.senzaOwner.length === 0}
              conteggio={controlli.senzaOwner.length}
              testo="Azioni senza owner"
            />
            <Controllo
              ok={controlli.senzaScadenza.length === 0}
              conteggio={controlli.senzaScadenza.length}
              testo="Azioni senza data"
            />
            <Controllo
              ok={controlli.lockSenzaAzione.length === 0}
              conteggio={controlli.lockSenzaAzione.length}
              testo="Decisioni chiuse senza un’azione"
              avviso
            />
          </div>
          <button
            className="bottone bottone-primario text-[13px] mt-4 self-start"
            disabled={!controlli.chiudibile || sessione.stato === 'LOCKED'}
            onClick={() =>
              invia('lock.create', {
                sessioneId: sessione.id,
                contenuto: { azioni: stato.azioni.length, perOwner: controlli.perOwner },
                dissensi: [],
              })
            }
          >
            {sessione.stato === 'LOCKED' ? 'Piano chiuso' : 'Chiudi il piano'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Controllo({
  ok,
  conteggio,
  testo,
  avviso,
}: {
  ok: boolean;
  conteggio: number;
  testo: string;
  avviso?: boolean;
}) {
  const colore = ok ? 'var(--live)' : avviso ? 'var(--tension)' : 'var(--erosion)';
  const coloreTesto = ok ? 'var(--ink-dim)' : colore;
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-2 h-2 shrink-0" style={{ background: colore }} />
      <span className="text-[13px] flex-1 min-w-0" style={{ color: coloreTesto }}>
        {testo}
      </span>
      <span className="mono text-[13px] w-8 text-right" style={{ color: coloreTesto }}>
        {conteggio}
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
    <div className={COLONNE}>
      <input
        className="text-[13px]"
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
      <div className="flex items-center gap-2">
        <span
          className="mono text-[13px] w-7"
          style={{ color: 'var(--locked)' }}
          title={l ? `${l.modulo} — ${l.titolo}` : 'nessuna decisione di origine'}
        >
          {l?.modulo ?? '—'}
        </span>
        <button
          className="bottone text-[13px]"
          aria-label="Elimina azione"
          onClick={() => invia('entity.delete', { tipo: 'azione', id: azione.id })}
        >
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
    <CompitoMano
      titolo="Le tue azioni"
      sottotitolo={
        io
          ? `${nome(io.id)} — le azioni del piano di cui sei owner, con la data entro cui vanno chiuse.`
          : 'Le azioni del piano di cui sei owner, con la data entro cui vanno chiuse.'
      }
    >
      {mie.length === 0 ? (
        <Vuoto>Nessuna azione a tuo nome. Le assegnazioni si fanno sul tavolo.</Vuoto>
      ) : (
        <div className="flex flex-col gap-2">
          {mie.map((a) => (
            <div key={a.id} className="rialzato p-3 flex flex-col gap-1">
              <span className="text-[15px]">{a.testo}</span>
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                <span className="mono">{a.scadenza}</span> ·{' '}
                {a.orizzonte === '90_GIORNI' ? (
                  <>
                    <span className="mono">90</span> giorni
                  </>
                ) : (
                  <>
                    gennaio <span className="mono">2027</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </CompitoMano>
  );
}
