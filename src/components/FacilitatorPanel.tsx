'use client';

/**
 * §9 — vista facilitatore. Accessibile con un tasto dal Tavolo.
 *
 * La modalità panico non è un lusso: in un ritiro di due giorni con un tool
 * costruito in fretta, poter sistemare a mano uno stato corrotto è ciò che
 * separa un intoppo da un disastro.
 */

import { useEffect, useState } from 'react';
import type { Contesto } from '@/net/useStore';
import type { Modulo, StatoSessione } from '@/lib/types';

const MODULI: { modulo: Modulo; titolo: string; durataS?: number; anonimo?: boolean }[] = [
  { modulo: 'M0', titolo: 'Setup' },
  { modulo: 'M1', titolo: 'Lo smontaggio', durataS: 240 },
  { modulo: 'M2', titolo: 'Il ripricing', durataS: 180 },
  { modulo: 'M3', titolo: 'La mappa dei flussi', durataS: 240 },
  { modulo: 'M4', titolo: 'Il posizionamento', durataS: 180 },
  { modulo: 'M5', titolo: 'Le carte avversarie', durataS: 90 },
  { modulo: 'M6', titolo: 'La soglia di sostenibilità', durataS: 240, anonimo: true },
  { modulo: 'M7', titolo: 'Gli invarianti', durataS: 180 },
  { modulo: 'M8', titolo: "L'action plan" },
  { modulo: 'M9', titolo: 'Il verbale' },
];

const STATI: StatoSessione[] = ['SETUP', 'COMMIT', 'REVEAL', 'DISCUSSIONE', 'LOCKED'];

export function FacilitatorPanel({ ctx, chiudi }: { ctx: Contesto; chiudi: () => void }) {
  const { stato, sessioneAttiva, invia, partecipanti, nome } = ctx;
  const [panico, setPanico] = useState(false);

  if (!stato) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={chiudi}
    >
      <div
        className="pannello h-full overflow-y-auto barra-scorrimento p-5 flex flex-col gap-5"
        style={{ width: 420, maxWidth: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="etichetta">pannello facilitatore</span>
          <button className="bottone text-[12px]" onClick={chiudi}>
            Chiudi
          </button>
        </div>

        {/* Sessione ------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <span className="etichetta">apri un round</span>
          <div className="grid grid-cols-2 gap-1">
            {MODULI.map((m) => (
              <button
                key={m.modulo}
                className="bottone text-[12px] text-left"
                onClick={() =>
                  invia('session.create', {
                    modulo: m.modulo,
                    titolo: m.titolo,
                    durataS: m.durataS,
                    revealAnonimo: m.anonimo ?? false,
                  })
                }
              >
                <span className="mono" style={{ color: 'var(--wda-bright)' }}>
                  {m.modulo}
                </span>{' '}
                {m.titolo}
              </button>
            ))}
          </div>
        </section>

        {sessioneAttiva && (
          <>
            <section className="flex flex-col gap-2">
              <span className="etichetta">
                round in corso — {sessioneAttiva.modulo} {sessioneAttiva.titolo}
              </span>
              <div className="flex flex-wrap gap-1">
                {STATI.map((s) => (
                  <button
                    key={s}
                    className="bottone text-[12px]"
                    aria-pressed={sessioneAttiva.stato === s}
                    onClick={() => invia('session.setState', { sessioneId: sessioneAttiva.id, stato: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  className="bottone text-[12px]"
                  onClick={() => invia('session.startTimer', { sessioneId: sessioneAttiva.id, durataS: sessioneAttiva.timer?.durataS ?? 240 })}
                >
                  Avvia timer
                </button>
                <button className="bottone text-[12px]" onClick={() => invia('session.addTime', { sessioneId: sessioneAttiva.id, secondi: 30 })}>
                  +30s
                </button>
                <button className="bottone text-[12px]" onClick={() => invia('session.addTime', { sessioneId: sessioneAttiva.id, secondi: 120 })}>
                  +2min
                </button>
                <button className="bottone text-[12px]" onClick={() => invia('session.stopTimer', { sessioneId: sessioneAttiva.id })}>
                  Ferma
                </button>
                <button className="bottone text-[12px]" onClick={() => invia('session.dealHats', { sessioneId: sessioneAttiva.id })}>
                  Distribuisci cappelli
                </button>
                <button
                  className="bottone bottone-primario text-[12px]"
                  onClick={() => invia('session.reveal', { sessioneId: sessioneAttiva.id })}
                >
                  Reveal
                </button>
              </div>
              <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                <input
                  type="checkbox"
                  checked={sessioneAttiva.revealAnonimo}
                  onChange={(e) =>
                    invia('session.setAnonimo', { sessioneId: sessioneAttiva.id, revealAnonimo: e.target.checked })
                  }
                />
                reveal anonimo
              </label>
            </section>
          </>
        )}

        {/* Dispositivi ---------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <span className="etichetta">dispositivi</span>
          {partecipanti.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px]">
                <span
                  className="inline-block w-2 h-2"
                  style={{ background: p.socketConnesso ? 'var(--live)' : 'var(--erosion)' }}
                />
                {p.nome}
                <span className="etichetta">{p.socketConnesso ? 'connesso' : 'disconnesso'}</span>
              </span>
              <button
                className="bottone text-[12px]"
                aria-pressed={!p.presente}
                onClick={() => invia('participant.setPresence', { partecipanteId: p.id, presente: !p.presente })}
              >
                {p.presente ? 'Presente' : 'Assente'}
              </button>
            </div>
          ))}
        </section>

        {/* Lock ----------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <span className="etichetta">decisioni bloccate</span>
          {stato.lock.length === 0 && (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuna.
            </span>
          )}
          {stato.lock.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2">
              <span className="text-[13px]">
                <span className="mono" style={{ color: 'var(--locked)' }}>
                  {l.modulo}
                </span>{' '}
                {l.titolo}
                {l.dissensi.length > 0 && (
                  <span className="etichetta ml-2">{l.dissensi.length} dissensi</span>
                )}
              </span>
              <button
                className="bottone text-[12px]"
                onClick={() => invia(l.riapertoA ? 'lock.reconfirm' : 'lock.reopen', { lockId: l.id })}
              >
                {l.riapertoA ? 'Riconferma' : 'Riapri'}
              </button>
            </div>
          ))}
        </section>

        {/* Export --------------------------------------------------- */}
        <section className="flex flex-wrap gap-1">
          <a className="bottone text-[12px]" href="/api/export?scarica=1" target="_blank" rel="noreferrer">
            Scarica il verbale
          </a>
          <a className="bottone text-[12px]" href="/api/export" target="_blank" rel="noreferrer">
            Anteprima
          </a>
        </section>

        {/* Panico --------------------------------------------------- */}
        <section className="flex flex-col gap-2 pt-4" style={{ borderTop: '1px solid var(--line)' }}>
          <button
            className="bottone text-[12px] self-start"
            style={{ borderColor: 'var(--erosion)', color: 'var(--erosion)' }}
            onClick={() => setPanico(!panico)}
          >
            Modalità panico
          </button>
          {panico && <ModalitaPanico ctx={ctx} />}
        </section>
      </div>
    </div>
  );
}

function ModalitaPanico({ ctx }: { ctx: Contesto }) {
  const { invia, stato } = ctx;
  const [backup, setBackup] = useState<string[]>([]);
  const [anteprima, setAnteprima] = useState<Record<string, number> | null>(null);
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [json, setJson] = useState('');
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/export?formato=backup-list')
      .then((r) => r.json())
      .then((d: { backup: string[] }) => setBackup(d.backup ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="etichetta mb-1">ripristino da snapshot</div>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto barra-scorrimento">
          {backup.length === 0 && (
            <span className="text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuno snapshot: se ne crea uno a ogni lock.
            </span>
          )}
          {backup.map((b) => (
            <button
              key={b}
              className="bottone text-[12px] text-left mono"
              aria-pressed={selezionato === b}
              onClick={() => {
                setSelezionato(b);
                void fetch(`/api/export?formato=backup&chiave=${encodeURIComponent(b)}`)
                  .then((r) => r.json())
                  .then((d: { anteprima: Record<string, number> }) => setAnteprima(d.anteprima));
              }}
            >
              {new Date(Number(b.split(':')[1])).toLocaleString('it-IT')}
            </button>
          ))}
        </div>
        {selezionato && anteprima && (
          <div className="rialzato p-2 mt-2">
            <div className="etichetta mb-1">anteprima</div>
            <div className="mono text-[12px]" style={{ color: 'var(--ink-dim)' }}>
              {Object.entries(anteprima).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
            <button
              className="bottone text-[12px] mt-2"
              style={{ borderColor: 'var(--erosion)', color: 'var(--erosion)' }}
              onClick={() => invia('panic.restore', { chiave: selezionato })}
            >
              Conferma ripristino
            </button>
          </div>
        )}
      </div>

      <AzzeraStanza onAzzera={() => invia('panic.reset', {})} />

      <div>
        <div className="etichetta mb-1">editor dello stato</div>
        <div className="flex gap-1 mb-1">
          <button
            className="bottone text-[12px]"
            onClick={() => {
              setJson(JSON.stringify(stato ? spogliaFiltrato(stato as unknown as Record<string, unknown>) : {}, null, 2));
              setErrore(null);
            }}
          >
            Carica stato corrente
          </button>
          <a className="bottone text-[12px]" href="/api/export?formato=json" target="_blank" rel="noreferrer">
            Scarica come file
          </a>
        </div>
        <textarea
          className="mono text-[11px] w-full barra-scorrimento"
          rows={10}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder="{ }"
        />
        {errore && (
          <div className="text-[12px] mt-1" style={{ color: 'var(--erosion)' }}>
            {errore}
          </div>
        )}
        <button
          className="bottone text-[12px] mt-1"
          style={{ borderColor: 'var(--erosion)', color: 'var(--erosion)' }}
          onClick={() => {
            try {
              const parsato = JSON.parse(json);
              setErrore(null);
              invia('panic.write', { stato: parsato });
            } catch (e) {
              setErrore(`JSON non valido: ${(e as Error).message}`);
            }
          }}
        >
          Scrivi stato
        </button>
      </div>
    </div>
  );
}

/**
 * Serve dopo la prova generale in produzione: senza, il ritiro comincerebbe con
 * dentro le sessioni di prova. Uno snapshot viene preso prima di azzerare, così
 * anche un clic sbagliato si annulla dal ripristino qui sopra.
 */
function AzzeraStanza({ onAzzera }: { onAzzera: () => void }) {
  const [conferma, setConferma] = useState(false);
  return (
    <div>
      <div className="etichetta mb-1">azzera la stanza</div>
      {!conferma ? (
        <button className="bottone text-[12px]" onClick={() => setConferma(true)}>
          Riporta tutto al seed
        </button>
      ) : (
        <div className="rialzato p-2 flex flex-col gap-2">
          <span className="text-[12px]" style={{ color: 'var(--ink-dim)' }}>
            Cancella sessioni, commit, lock e azioni. Uno snapshot viene salvato prima, ed è ripristinabile.
          </span>
          <div className="flex gap-1">
            <button
              className="bottone text-[12px]"
              style={{ borderColor: 'var(--erosion)', color: 'var(--erosion)' }}
              onClick={() => {
                onAzzera();
                setConferma(false);
              }}
            >
              Conferma azzeramento
            </button>
            <button className="bottone text-[12px]" onClick={() => setConferma(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Toglie i campi aggiunti dal filtro: quelli non fanno parte dello Store. */
function spogliaFiltrato(s: Record<string, unknown>) {
  const copia = { ...s };
  for (const k of ['commits', 'statiCommit', 'serverNow', 'visti', 'io', 'sonoFacilitatore']) {
    delete copia[k];
  }
  return copia;
}
