'use client';

/**
 * M5 — Stress test competitivo.
 * Il timer è il meccanismo, non decorazione: distingue "abbiamo una risposta"
 * da "ce la costruiamo mentre parliamo". Per questo lo schermo dice sempre
 * quanti secondi si hanno, chi parla e chi vota: sono le tre cose che, senza
 * scriverle, si contrattano a voce mentre il tempo scorre.
 */

import type { ReactNode } from 'react';
import { MODULI, TERMINI } from '@/lib/glossario';
import type { Sessione } from '@/lib/types';
import { CompitoMano, Vuoto } from '../comune';
import { TestataModulo, TestataModuloMano } from '@/components/TestataModulo';
import { Timer } from '@/components/Timer';
import { useRevealPartito } from '@/components/RevealStage';
import { useStore } from '@/net/useStore';

export const DURATA_RISPOSTA_S = 90;

/** Una riga asciutta che dice cosa si fa adesso, senza incoraggiamenti. */
function Istruzione({ children, centrata }: { children: ReactNode; centrata?: boolean }) {
  return (
    <p
      className={`m-0 text-[13px] max-w-[42rem] ${centrata ? 'text-center' : ''}`}
      style={{ color: 'var(--ink-dim)' }}
    >
      {children}
    </p>
  );
}

export function M5Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const carta = stato.competitor.find((c) => c.id === sessione.soggettoId);
  const commits = ctx.commitsDi(sessione.id);
  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);

  if (!carta) {
    // Pesca: rotazione fra i presenti, così il turno non si contratta.
    const giaGiocate = new Set(
      stato.sessioni.filter((s) => s.modulo === 'M5').map((s) => s.soggettoId),
    );
    const mazzo = stato.competitor.filter((c) => !giaGiocate.has(c.id));
    const indice = stato.sessioni.filter((s) => s.modulo === 'M5').length;
    const rispondente = presenti[indice % Math.max(presenti.length, 1)];

    return (
      <div className="flex flex-col gap-4">
        <TestataModulo modulo="M5" />
        <Istruzione>
          Apri il round su un concorrente. Chi risponde è indicato sulla carta: avrà{' '}
          <span className="mono">{DURATA_RISPOSTA_S}</span> secondi per rispondere a voce, poi gli altri votano dal
          telefono se la risposta regge.
        </Istruzione>
        {mazzo.length === 0 ? (
          <Vuoto>Sono già passati tutti i concorrenti.</Vuoto>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {mazzo.map((c) => (
              <button
                key={c.id}
                className="bottone p-4 text-left flex flex-col gap-2"
                style={c.fisso ? { borderColor: 'var(--erosion)' } : undefined}
                onClick={() => {
                  invia('session.create', {
                    modulo: 'M5',
                    titolo: c.nome,
                    soggettoId: c.id,
                    durataS: DURATA_RISPOSTA_S,
                  });
                }}
              >
                <span className="text-[15px]">{c.nome}</span>
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  {c.descrizione}
                </span>
                {/* Il bordo rosso da solo non si spiega: la carta fissa va detta. */}
                {c.fisso && (
                  <span className="etichetta" style={{ color: 'var(--erosion)' }}>
                    carta obbligatoria
                  </span>
                )}
                {rispondente && (
                  <span className="flex items-baseline gap-2">
                    <span className="etichetta">risponde</span>
                    <span className="text-[13px]">{rispondente.nome}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const voti = commits.filter((c) => c.payload.tipo === 'M5');
  const convincenti = voti.filter((c) => c.payload.tipo === 'M5' && c.payload.convincente).length;
  const contrari = voti.length - convincenti;
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';
  const aperta = voti.length > 0 && contrari > voti.length / 2;
  const esito = aperta ? 'Vulnerabilità aperta' : voti.length === 0 ? 'Nessun voto' : 'Risposta tenuta';
  const coloreEsito = aperta ? 'var(--erosion)' : voti.length === 0 ? 'var(--ink-dim)' : 'var(--live)';

  return (
    <div className="flex flex-col gap-4">
      <TestataModulo
        modulo="M5"
        soggetto={carta.nome}
        destra={
          sessione.rispondenteId ? (
            <div className="text-right shrink-0">
              <div className="etichetta">risponde a voce</div>
              <div className="text-[17px] mt-1">{nome(sessione.rispondenteId)}</div>
              <div className="text-[13px] mt-1" style={{ color: 'var(--ink-dim)' }}>
                <span className="mono">{DURATA_RISPOSTA_S}</span> secondi
              </div>
            </div>
          ) : undefined
        }
      />

      <div className="pannello p-4 flex flex-col gap-4">
        <p className="m-0 text-[15px]">{carta.descrizione}</p>

        {carta.puntiForza.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="etichetta">punti di forza</span>
            <ul className="m-0 p-0 list-none flex flex-col gap-1">
              {carta.puntiForza.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{ width: 4, height: 4, marginTop: 9, background: 'var(--ink-faint)' }}
                  />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {sessione.stato === 'SETUP' && (
        <div className="pannello p-4 flex flex-col gap-3">
          <Istruzione>Indica chi risponde a voce, prima di far partire il tempo. Chi risponde poi non vota.</Istruzione>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="etichetta mr-1">chi risponde</span>
            {presenti.map((p) => (
              <button
                key={p.id}
                className="bottone text-[13px]"
                aria-pressed={sessione.rispondenteId === p.id}
                onClick={() => invia('session.setRispondente', { sessioneId: sessione.id, rispondenteId: p.id })}
              >
                {p.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Il timer diventa l'elemento visivo dominante dello schermo. */}
      {(sessione.stato === 'SETUP' || sessione.stato === 'COMMIT') && (
        <div className="pannello p-8 flex flex-col items-center gap-4">
          <p className="m-0 text-[22px] text-center">Perché un cliente sceglie noi e non loro?</p>
          <Istruzione centrata>
            {sessione.stato === 'SETUP' ? (
              <>
                Si risponde a voce, adesso, senza preparazione. Il tempo parte quando il facilitatore apre il round e
                dura <span className="mono">{DURATA_RISPOSTA_S}</span> secondi.
              </>
            ) : (
              <>
                Finita la risposta, ognuno vota dal telefono se regge. Chi ha risposto non vota.
              </>
            )}
          </Istruzione>
          <Timer sessione={sessione} ora={ora} grande />
          {sessione.stato === 'COMMIT' && (
            <div className="flex items-baseline gap-2">
              <span className="etichetta">hanno votato</span>
              <span className="mono text-[15px]">
                {statoCommit?.committed ?? 0} su {statoCommit?.total ?? presenti.length}
              </span>
            </div>
          )}
        </div>
      )}

      {rivelato && (
        <div
          className="pannello p-8 flex flex-col items-center gap-6"
          style={{ opacity: partito ? 1 : 0, transition: 'opacity 200ms' }}
        >
          <Istruzione centrata>
            Voti sulla risposta appena data a voce. Chi ha risposto non ha votato.
          </Istruzione>

          <div className="grid grid-cols-2 gap-12">
            <Conteggio etichetta="convincente" valore={convincenti} colore="var(--live)" />
            <Conteggio etichetta="non convincente" valore={contrari} colore="var(--erosion)" />
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[15px]" style={{ color: coloreEsito }}>
              {esito}
            </span>
            {/* L'esito non resta mai senza la regola che lo produce: la parola
                «vulnerabilità» arriva dal glossario, non da qui. */}
            <Istruzione centrata>
              {voti.length === 0
                ? 'Nessun voto registrato: la carta resta senza esito.'
                : aperta
                  ? `${TERMINI['vulnerabilità']} Resta in vista nei moduli successivi finché non si chiude.`
                  : 'Una carta si apre come vulnerabilità quando più della metà dei voti dice non convincente.'}
            </Istruzione>
          </div>

          {sessione.stato !== 'LOCKED' && (
            <button
              className="bottone"
              onClick={() => invia('session.setState', { sessioneId: sessione.id, stato: 'LOCKED' })}
            >
              Registra l’esito e chiudi la carta
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Conteggio({ etichetta, valore, colore }: { etichetta: string; valore: number; colore: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="etichetta">{etichetta}</span>
      <span className="mono text-[56px] leading-none" style={{ color: colore }}>
        {valore}
      </span>
    </div>
  );
}

export function M5Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia } = ctx;
  const mio = ctx.mioCommit(sessione.id);
  if (!stato) return null;

  const carta = stato.competitor.find((c) => c.id === sessione.soggettoId);
  const sonoIoARispondere = sessione.rispondenteId === stato.io;

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano
        titolo={carta?.nome ?? 'Concorrente'}
        sottotitolo={MODULI.M5.nome.toLowerCase()}
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
            {sessione.stato === 'SETUP' ? (
              sonoIoARispondere ? (
                <>
                  Tocca a te: rispondi a voce alla domanda sullo schermo grande. Hai{' '}
                  <span className="mono">{DURATA_RISPOSTA_S}</span> secondi, poi votano gli altri.
                </>
              ) : (
                <>
                  Ascolta la risposta. Quando il tempo finisce, qui compaiono i due bottoni per votare.
                </>
              )
            ) : (
              <>Il voto è chiuso. Il confronto si guarda sullo schermo grande.</>
            )}
          </p>
          {mio?.payload.tipo === 'M5' && (
            <span className="text-[15px]" style={{ color: 'var(--ink-dim)' }}>
              Hai votato:{' '}
              <span style={{ color: mio.payload.convincente ? 'var(--live)' : 'var(--erosion)' }}>
                {mio.payload.convincente ? 'convincente' : 'non convincente'}
              </span>
            </span>
          )}
        </div>
      </CompitoMano>
    );
  }

  if (sonoIoARispondere) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="m-0 text-center text-[15px]" style={{ color: 'var(--ink-dim)' }}>
          Hai risposto tu: non voti su te stesso. Stanno votando gli altri.
        </p>
      </div>
    );
  }

  // Due bottoni grandi, nient'altro a schermo.
  const vota = (convincente: boolean) => {
    invia('commit.set', { sessioneId: sessione.id, payload: { tipo: 'M5', convincente } });
    invia('commit.confirm', { sessioneId: sessione.id });
  };

  const scelto = mio?.payload.tipo === 'M5' ? mio.payload.convincente : null;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <TestataModuloMano modulo="M5" soggetto={carta?.nome} />
      <Istruzione>
        Vota la risposta appena data a voce. Nessuno la vede finché il round non passa al confronto.
      </Istruzione>
      <button
        className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-[22px]"
        style={{
          minHeight: 48,
          border: `1px solid ${scelto === true ? 'var(--live)' : 'var(--line-strong)'}`,
          background: scelto === true ? 'var(--live)' : 'var(--bg-raised)',
          color: scelto === true ? 'var(--ink-inverso)' : 'var(--ink)',
        }}
        aria-pressed={scelto === true}
        onClick={() => vota(true)}
      >
        Convincente
        <span
          className="text-[13px] text-center"
          style={{ color: scelto === true ? 'var(--ink-inverso)' : 'var(--ink-dim)' }}
        >
          Questa risposta la userei davanti a un cliente
        </span>
      </button>
      <button
        className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-[22px]"
        style={{
          minHeight: 48,
          border: `1px solid ${scelto === false ? 'var(--erosion)' : 'var(--line-strong)'}`,
          background: scelto === false ? 'var(--erosion)' : 'var(--bg-raised)',
          color: scelto === false ? 'var(--ink-inverso)' : 'var(--ink)',
        }}
        aria-pressed={scelto === false}
        onClick={() => vota(false)}
      >
        Non convincente
        <span
          className="text-[13px] text-center"
          style={{ color: scelto === false ? 'var(--ink-inverso)' : 'var(--ink-dim)' }}
        >
          Ce la stiamo costruendo adesso: resta una vulnerabilità aperta
        </span>
      </button>
    </div>
  );
}
