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
        <div className="grid grid-cols-3 gap-2">
          {mazzo.length === 0 && <Vuoto>Mazzo esaurito.</Vuoto>}
          {mazzo.map((c) => (
            <button
              key={c.id}
              className="bottone p-4 text-left"
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
              <div className="text-[15px]">{c.nome}</div>
              <div className="text-[12px] mt-1" style={{ color: 'var(--ink-faint)' }}>
                {c.descrizione}
              </div>
              {rispondente && (
                <div className="etichetta mt-2">risponde {rispondente.nome}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const voti = commits.filter((c) => c.payload.tipo === 'M5');
  const convincenti = voti.filter((c) => c.payload.tipo === 'M5' && c.payload.convincente).length;
  const contrari = voti.length - convincenti;
  const rivelato = sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP';
  const aperta = voti.length > 0 && contrari > voti.length / 2;

  return (
    <div className="flex flex-col gap-4">
      <Intestazione
        modulo="M5"
        titolo={carta.nome}
        sottotitolo={sessione.rispondenteId ? `Risponde ${nome(sessione.rispondenteId)}` : undefined}
      />

      <div className="pannello p-5">
        <p className="m-0 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
          {carta.descrizione}
        </p>
        <ul className="mt-3 mb-0 pl-4">
          {carta.puntiForza.map((p) => (
            <li key={p} className="text-[14px]">
              {p}
            </li>
          ))}
        </ul>
      </div>

      {sessione.stato === 'SETUP' && (
        <div className="pannello p-4 flex items-center gap-3 flex-wrap">
          <span className="etichetta">chi risponde</span>
          {presenti.map((p) => (
            <button
              key={p.id}
              className="bottone text-[12px]"
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
          <p className="m-0 text-[20px] text-center">Perché un cliente sceglie noi e non loro?</p>
          <Timer sessione={sessione} ora={ora} grande />
          {sessione.stato === 'COMMIT' && (
            <span className="etichetta">
              voto in corso — {statoCommit?.committed ?? 0} su {statoCommit?.total ?? presenti.length}
            </span>
          )}
        </div>
      )}

      {rivelato && (
        <div className="pannello p-6 flex flex-col items-center gap-3" style={{ opacity: partito ? 1 : 0, transition: 'opacity 200ms' }}>
          <div className="flex items-end gap-8">
            <div className="text-center">
              <div className="etichetta">convincente</div>
              <div className="mono text-[56px] leading-none" style={{ color: 'var(--live)' }}>
                {convincenti}
              </div>
            </div>
            <div className="text-center">
              <div className="etichetta">non convincente</div>
              <div className="mono text-[56px] leading-none" style={{ color: 'var(--erosion)' }}>
                {contrari}
              </div>
            </div>
          </div>
          <span className="mono text-[15px]" style={{ color: aperta ? 'var(--erosion)' : 'var(--live)' }}>
            {aperta ? 'Vulnerabilità aperta' : voti.length === 0 ? 'Nessun voto' : 'Risposta tenuta'}
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
          <span className="mono text-[15px]" style={{ color: mio.payload.convincente ? 'var(--live)' : 'var(--erosion)' }}>
            hai votato: {mio.payload.convincente ? 'convincente' : 'non convincente'}
          </span>
        )}
      </CompitoMano>
    );
  }

  if (sonoIoARispondere) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-center text-[15px]" style={{ color: 'var(--ink-dim)' }}>
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
      <span className="etichetta">{carta?.nome}</span>
      <button
        className="flex-1"
        style={{
          border: `1px solid ${scelto === true ? 'var(--live)' : 'var(--line-strong)'}`,
          background: scelto === true ? 'var(--live)' : 'var(--bg-raised)',
          color: scelto === true ? '#0b0e12' : 'var(--ink)',
          fontSize: 22,
        }}
        onClick={() => vota(true)}
      >
        Convincente
      </button>
      <button
        className="flex-1"
        style={{
          border: `1px solid ${scelto === false ? 'var(--erosion)' : 'var(--line-strong)'}`,
          background: scelto === false ? 'var(--erosion)' : 'var(--bg-raised)',
          color: scelto === false ? '#0b0e12' : 'var(--ink)',
          fontSize: 22,
        }}
        onClick={() => vota(false)}
      >
        Non convincente
      </button>
    </div>
  );
}
