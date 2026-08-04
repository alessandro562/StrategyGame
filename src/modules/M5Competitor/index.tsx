'use client';

/**
 * M5 — Le carte avversarie.
 * Il timer è il meccanismo, non decorazione: distingue "abbiamo una risposta"
 * da "ce la costruiamo mentre parliamo".
 */

import type { Sessione } from '@/lib/types';
import { CompitoMano, Intestazione, Vuoto } from '../comune';
import { Timer } from '@/components/Timer';
import { useRevealPartito } from '@/components/RevealStage';
import { useStore } from '@/net/useStore';

export const DURATA_RISPOSTA_S = 90;

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
        <Intestazione modulo="M5" titolo="Le carte avversarie" sottotitolo="Il facilitatore pesca" />
        {mazzo.length === 0 ? (
          <Vuoto>Mazzo esaurito.</Vuoto>
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
      <Intestazione
        modulo="M5"
        titolo={carta.nome}
        sottotitolo={sessione.rispondenteId ? `Risponde ${nome(sessione.rispondenteId)}` : undefined}
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
        <div className="pannello p-4 flex items-center gap-2 flex-wrap">
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
      )}

      {/* Il timer diventa l'elemento visivo dominante dello schermo. */}
      {(sessione.stato === 'SETUP' || sessione.stato === 'COMMIT') && (
        <div className="pannello p-8 flex flex-col items-center gap-4">
          <p className="m-0 text-[22px] text-center">Perché un cliente sceglie noi e non loro?</p>
          <Timer sessione={sessione} ora={ora} grande />
          {sessione.stato === 'COMMIT' && (
            <div className="flex items-baseline gap-2">
              <span className="etichetta">voto in corso</span>
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
          <div className="grid grid-cols-2 gap-12">
            <Conteggio etichetta="convincente" valore={convincenti} colore="var(--live)" />
            <Conteggio etichetta="non convincente" valore={contrari} colore="var(--erosion)" />
          </div>

          <span className="text-[15px]" style={{ color: coloreEsito }}>
            {esito}
          </span>

          {sessione.stato !== 'LOCKED' && (
            <button
              className="bottone"
              onClick={() => invia('session.setState', { sessioneId: sessione.id, stato: 'LOCKED' })}
            >
              Chiudi la carta
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
      <CompitoMano titolo={carta?.nome ?? 'Carta avversaria'} sottotitolo={sonoIoARispondere ? 'Tocca a te rispondere' : 'In attesa del voto'}>
        {mio?.payload.tipo === 'M5' && (
          <span className="text-[15px]" style={{ color: 'var(--ink-dim)' }}>
            Hai votato:{' '}
            <span style={{ color: mio.payload.convincente ? 'var(--live)' : 'var(--erosion)' }}>
              {mio.payload.convincente ? 'convincente' : 'non convincente'}
            </span>
          </span>
        )}
      </CompitoMano>
    );
  }

  if (sonoIoARispondere) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="m-0 text-center text-[15px]" style={{ color: 'var(--ink-dim)' }}>
          Hai risposto tu: non voti su te stesso.
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
      <div className="flex flex-col gap-1">
        <span className="etichetta">carta avversaria</span>
        <span className="text-[17px]">{carta?.nome}</span>
      </div>
      <button
        className="flex-1 text-[22px]"
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
      </button>
      <button
        className="flex-1 text-[22px]"
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
      </button>
    </div>
  );
}
