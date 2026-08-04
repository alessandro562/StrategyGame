'use client';

/**
 * §9 — vista facilitatore. Accessibile con un tasto dal Tavolo.
 *
 * La modalità panico non è un lusso: in un ritiro di due giorni con un tool
 * costruito in fretta, poter sistemare a mano uno stato corrotto è ciò che
 * separa un intoppo da un disastro.
 *
 * Pannello denso, quindi regole strette. Due gradini di testo — 11 per le
 * etichette di sezione, 13 per tutto ciò che si legge o si tocca; il 12 resta
 * solo all'editor JSON, che è codice. Le sezioni sono separate da un filetto
 * e hanno la stessa aria sopra e sotto. I bottoni di destra hanno larghezza
 * minima fissa, così le colonne restano incolonnate anche quando l'etichetta
 * cambia da "Presente" ad "Assente".
 */

import { useEffect, useState } from 'react';
import type { Contesto } from '@/net/useStore';
import { FASI, MODULI } from '@/lib/glossario';
import type { Modulo, StatoSessione } from '@/lib/types';

/**
 * Durate e anonimato per modulo. Il TITOLO non sta qui: viene dal glossario,
 * altrimenti la stessa cosa avrebbe due nomi e quello vecchio finirebbe
 * salvato dentro le sessioni — che è esattamente com'è successo, con «Lo
 * smontaggio» rimasto a schermo dopo la rinomina.
 */
const CONFIG_MODULI: { modulo: Modulo; durataS?: number; anonimo?: boolean }[] = [
  // Senza timer: il quadro si riempie finché serve, e un conto alla rovescia
  // sul primo esercizio della giornata mette fretta nel momento sbagliato.
  { modulo: 'MQ' },
  { modulo: 'M0' },
  { modulo: 'M1', durataS: 240 },
  { modulo: 'M2', durataS: 180 },
  { modulo: 'M3', durataS: 240 },
  { modulo: 'M4', durataS: 180 },
  { modulo: 'M5', durataS: 90 },
  { modulo: 'M6', durataS: 240, anonimo: true },
  { modulo: 'M7', durataS: 180 },
  { modulo: 'M8' },
  { modulo: 'M9' },
];

const STATI: StatoSessione[] = ['SETUP', 'COMMIT', 'REVEAL', 'DISCUSSIONE', 'LOCKED'];

/** Filetto e respiro uguali per ogni sezione: la densità si regge sul ritmo. */
const SEZIONE = 'flex flex-col gap-3 py-4';
const FILETTO = { borderTop: '1px solid var(--line)' };
/** Colonna dei comandi a destra: larghezza fissa, così i bordi si incolonnano. */
const COMANDO = { minWidth: 96 };

export function FacilitatorPanel({ ctx, chiudi }: { ctx: Contesto; chiudi: () => void }) {
  const { stato, sessioneAttiva, invia, partecipanti, nome } = ctx;
  const [panico, setPanico] = useState(false);

  if (!stato) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      // Il velo nero pieno veniva dal tema scuro. Su fondo chiaro si ricava
      // dall'inchiostro, così resta dentro i token e pesa la metà.
      style={{ background: 'color-mix(in srgb, var(--ink) 40%, transparent)' }}
      onClick={chiudi}
    >
      <div
        className="pannello h-full overflow-y-auto barra-scorrimento px-5 flex flex-col"
        style={{ width: 420, maxWidth: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 py-4">
          <span className="etichetta">pannello facilitatore</span>
          <button className="bottone text-[13px] shrink-0" onClick={chiudi}>
            Chiudi
          </button>
        </div>

        {/* Sessione ------------------------------------------------- */}
        <section className={SEZIONE} style={FILETTO}>
          <span className="etichetta">apri un round</span>
          <div className="grid grid-cols-2 gap-1">
            {CONFIG_MODULI.map((m) => (
              <button
                key={m.modulo}
                className="bottone text-[13px] text-left flex items-baseline gap-2"
                onClick={() =>
                  invia('session.create', {
                    modulo: m.modulo,
                    titolo: MODULI[m.modulo].nome,
                    durataS: m.durataS,
                    revealAnonimo: m.anonimo ?? false,
                  })
                }
              >
                {/* Sigla in colonna: i titoli partono tutti dalla stessa ascissa. */}
                <span className="mono shrink-0" style={{ color: 'var(--wda-bright)' }}>
                  {m.modulo}
                </span>
                <span className="truncate min-w-0">{MODULI[m.modulo].nome}</span>
              </button>
            ))}
          </div>
        </section>

        {sessioneAttiva && (
          <section className={SEZIONE} style={FILETTO}>
            {/* .etichetta sulla sola etichetta: modulo e titolo sono contenuto. */}
            <div className="flex items-baseline justify-between gap-3">
              <span className="etichetta shrink-0">round in corso</span>
              <span className="text-[13px] text-right truncate min-w-0">
                <span className="mono" style={{ color: 'var(--wda-bright)' }}>
                  {sessioneAttiva.modulo}
                </span>{' '}
                {sessioneAttiva.titolo}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {STATI.map((s) => (
                <button
                  key={s}
                  className="bottone mono text-[13px]"
                  aria-pressed={sessioneAttiva.stato === s}
                  onClick={() => invia('session.setState', { sessioneId: sessioneAttiva.id, stato: s })}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              <button
                className="bottone text-[13px]"
                onClick={() => invia('session.startTimer', { sessioneId: sessioneAttiva.id, durataS: sessioneAttiva.timer?.durataS ?? 240 })}
              >
                Avvia timer
              </button>
              <button className="bottone mono text-[13px]" onClick={() => invia('session.addTime', { sessioneId: sessioneAttiva.id, secondi: 30 })}>
                +30s
              </button>
              <button className="bottone mono text-[13px]" onClick={() => invia('session.addTime', { sessioneId: sessioneAttiva.id, secondi: 120 })}>
                +2min
              </button>
              <button className="bottone text-[13px]" onClick={() => invia('session.stopTimer', { sessioneId: sessioneAttiva.id })}>
                Ferma
              </button>
              <button className="bottone text-[13px]" onClick={() => invia('session.dealHats', { sessioneId: sessioneAttiva.id })}>
                Distribuisci cappelli
              </button>
              <button
                className="bottone bottone-primario text-[13px]"
                onClick={() => invia('session.reveal', { sessioneId: sessioneAttiva.id })}
              >
                Apri il {FASI.REVEAL.nome.toLowerCase()}
              </button>
            </div>

            <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              <input
                type="checkbox"
                // Senza accentColor la spunta esce nel blu di sistema, che è
                // l'unico colore della schermata a non venire dai token.
                style={{ accentColor: 'var(--wda)', width: 16, height: 16 }}
                checked={sessioneAttiva.revealAnonimo}
                onChange={(e) =>
                  invia('session.setAnonimo', { sessioneId: sessioneAttiva.id, revealAnonimo: e.target.checked })
                }
              />
              Risposte anonime al {FASI.REVEAL.nome.toLowerCase()}
            </label>
          </section>
        )}

        {/* Dispositivi ---------------------------------------------- */}
        <section className={SEZIONE} style={FILETTO}>
          <span className="etichetta">dispositivi</span>
          {partecipanti.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0 text-[13px]">
                <span
                  className="inline-block w-2 h-2 shrink-0"
                  style={{ background: p.socketConnesso ? 'var(--live)' : 'var(--erosion)' }}
                />
                <span className="truncate">{p.nome}</span>
                <span
                  className="etichetta shrink-0"
                  style={p.socketConnesso ? undefined : { color: 'var(--erosion)' }}
                >
                  {p.socketConnesso ? 'connesso' : 'disconnesso'}
                </span>
              </span>
              <button
                className="bottone text-[13px] shrink-0"
                style={COMANDO}
                aria-pressed={!p.presente}
                onClick={() => invia('participant.setPresence', { partecipanteId: p.id, presente: !p.presente })}
              >
                {p.presente ? 'Presente' : 'Assente'}
              </button>
            </div>
          ))}
        </section>

        {/* Lock ----------------------------------------------------- */}
        <section className={SEZIONE} style={FILETTO}>
          <span className="etichetta">decisioni bloccate</span>
          {stato.lock.length === 0 && (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuna.
            </span>
          )}
          {stato.lock.map((l) => (
            <div key={l.id} className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] min-w-0">
                <span className="mono" style={{ color: 'var(--locked)' }}>
                  {l.modulo}
                </span>{' '}
                {l.titolo}
                {l.dissensi.length > 0 && (
                  <span className="etichetta ml-2">
                    <span className="mono">{l.dissensi.length}</span>{' '}
                    {l.dissensi.length === 1 ? 'dissenso' : 'dissensi'}
                  </span>
                )}
              </span>
              <button
                className="bottone text-[13px] shrink-0"
                style={COMANDO}
                onClick={() => invia(l.riapertoA ? 'lock.reconfirm' : 'lock.reopen', { lockId: l.id })}
              >
                {l.riapertoA ? 'Riconferma' : 'Riapri'}
              </button>
            </div>
          ))}
        </section>

        {/* Export --------------------------------------------------- */}
        <section className={SEZIONE} style={FILETTO}>
          <span className="etichetta">verbale</span>
          <div className="flex flex-wrap gap-1">
            <a
              className="bottone text-[13px] inline-flex items-center"
              href="/api/export?scarica=1"
              target="_blank"
              rel="noreferrer"
            >
              Scarica il verbale
            </a>
            <a
              className="bottone text-[13px] inline-flex items-center"
              href="/api/export"
              target="_blank"
              rel="noreferrer"
            >
              Anteprima
            </a>
          </div>
        </section>

        {/* Panico --------------------------------------------------- */}
        <section className={SEZIONE} style={FILETTO}>
          <button
            className="bottone text-[13px] self-start"
            // aria-expanded e non aria-pressed: .bottone[aria-pressed] tinge di
            // blu, e qui il colore deve restare quello del rischio.
            aria-expanded={panico}
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="etichetta">ripristino da snapshot</div>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto barra-scorrimento">
          {backup.length === 0 && (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessuno snapshot: se ne crea uno a ogni lock.
            </span>
          )}
          {backup.map((b) => (
            <button
              key={b}
              className="bottone mono text-[13px] text-left"
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
          <div className="rialzato p-3 flex flex-col gap-2">
            <div className="etichetta">anteprima</div>
            {/* Voce a sinistra, numero a destra: incolonnati si confrontano. */}
            <div className="flex flex-col gap-1">
              {Object.entries(anteprima).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <span className="etichetta">{k}</span>
                  <span className="mono text-[13px]">{v}</span>
                </div>
              ))}
            </div>
            <button
              className="bottone text-[13px] self-start"
              style={{ borderColor: 'var(--erosion)', color: 'var(--erosion)' }}
              onClick={() => invia('panic.restore', { chiave: selezionato })}
            >
              Conferma ripristino
            </button>
          </div>
        )}
      </div>

      <AzzeraStanza onAzzera={() => invia('panic.reset', {})} />

      <div className="flex flex-col gap-2">
        <div className="etichetta">editor dello stato</div>
        <div className="flex flex-wrap gap-1">
          <button
            className="bottone text-[13px]"
            onClick={() => {
              setJson(JSON.stringify(stato ? spogliaFiltrato(stato as unknown as Record<string, unknown>) : {}, null, 2));
              setErrore(null);
            }}
          >
            Carica stato corrente
          </button>
          <a
            className="bottone text-[13px] inline-flex items-center"
            href="/api/export?formato=json"
            target="_blank"
            rel="noreferrer"
          >
            Scarica come file
          </a>
        </div>
        <textarea
          className="mono text-[12px] w-full barra-scorrimento"
          rows={10}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder="{ }"
        />
        {errore && (
          <div className="text-[13px]" style={{ color: 'var(--erosion)' }}>
            {errore}
          </div>
        )}
        <button
          className="bottone text-[13px] self-start"
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
    <div className="flex flex-col gap-2">
      <div className="etichetta">azzera la stanza</div>
      {!conferma ? (
        <button className="bottone text-[13px] self-start" onClick={() => setConferma(true)}>
          Riporta tutto al seed
        </button>
      ) : (
        <div className="rialzato p-3 flex flex-col gap-2">
          <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
            Cancella sessioni, commit, lock e azioni. Uno snapshot viene salvato prima, ed è ripristinabile.
          </span>
          <div className="flex gap-1">
            <button
              className="bottone text-[13px]"
              style={{ borderColor: 'var(--erosion)', color: 'var(--erosion)' }}
              onClick={() => {
                onAzzera();
                setConferma(false);
              }}
            >
              Conferma azzeramento
            </button>
            <button className="bottone text-[13px]" onClick={() => setConferma(false)}>
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
