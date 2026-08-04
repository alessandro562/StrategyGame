'use client';

/**
 * M2 — Il ripricing.
 * Se l'artefatto è quasi gratis, il prezzo non può più stare sul tempo impiegato.
 */

import { pctErosione } from '@/lib/calc';
import { BASE_DOMANDA, type BasePrezzo, type Sessione } from '@/lib/types';
import { BottoneTocco, CompitoMano, Intestazione, Premessa, StatoCommitMano, Vuoto } from '../comune';
import { CommitBar } from '@/components/CommitBar';
import { LockButton } from '@/components/LockButton';
import { RevealStage, useRevealPartito } from '@/components/RevealStage';
import { useStore } from '@/net/useStore';

const BASI: BasePrezzo[] = ['ACCESSO', 'ESITO', 'PARTECIPAZIONE', 'VOLUME'];

export function M2Tavolo({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { stato, invia, presenti, nome, ora } = ctx;
  const partito = useRevealPartito(sessione.revealAt, ora);
  if (!stato) return null;

  const nucleo = stato.servizi.filter((s) => s.bucket === 'NUCLEO');
  const servizio = stato.servizi.find((s) => s.id === sessione.soggettoId);
  const commits = ctx.commitsDi(sessione.id);
  const statoCommit = stato.statiCommit.find((s) => s.sessioneId === sessione.id);
  const erosione = pctErosione(stato.servizi);

  const conteggi = BASI.map((b) => ({
    base: b,
    n: commits.filter((c) => c.payload.tipo === 'M2' && c.payload.primaria === b).length,
    secondarie: commits.filter((c) => c.payload.tipo === 'M2' && c.payload.secondaria === b).length,
  }));
  const massimo = Math.max(1, ...conteggi.map((c) => c.n));
  const vincente = conteggi.filter((c) => c.n === massimo && c.n > 0);

  return (
    <div className="flex flex-col gap-4">
      <Intestazione modulo="M2" titolo={servizio?.nome ?? 'Il ripricing'} sottotitolo="Su cosa poggia il prezzo" />

      <Premessa>Se l’artefatto è quasi gratis, il prezzo non può più stare sul tempo impiegato.</Premessa>

      {!servizio && (
        <div className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">servizi in nucleo</span>
          {nucleo.length === 0 ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessun servizio in NUCLEO: si passa da M1.
            </span>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {nucleo.map((s) => (
                <button
                  key={s.id}
                  className="bottone p-3 text-left text-[13px]"
                  onClick={() =>
                    invia('session.create', { modulo: 'M2', titolo: s.nome, soggettoId: s.id, durataS: 180 })
                  }
                >
                  {s.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {servizio && sessione.stato === 'COMMIT' && (
        <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
      )}

      {servizio && sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP' && (
        <>
          <div className="pannello p-4 flex flex-col gap-3">
            <span className="etichetta">commit per base</span>
            <RevealStage
              elementi={conteggi}
              seme={sessione.id}
              partito={partito || sessione.stato !== 'REVEAL'}
              chiave={(c) => c.base}
              className="flex flex-col gap-2"
              render={(c) => (
                <div className="flex items-center gap-3">
                  <span
                    className="mono text-[13px] w-32 shrink-0"
                    style={{ color: c.n === massimo && c.n > 0 ? 'var(--live)' : 'var(--ink)' }}
                  >
                    {c.base}
                  </span>
                  <div
                    className="w-40 h-3 shrink-0"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
                  >
                    <div
                      className="h-full"
                      style={{ width: `${(c.n / Math.max(presenti.length, 1)) * 100}%`, background: 'var(--live)' }}
                    />
                  </div>
                  <span className="mono text-[13px] w-8 text-right shrink-0">{c.n}</span>
                  <span
                    className="mono text-[13px] w-8 text-right shrink-0"
                    style={{ color: 'var(--ink-dim)' }}
                  >
                    {c.secondarie > 0 ? `+${c.secondarie}` : ''}
                  </span>
                  <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                    {BASE_DOMANDA[c.base]}
                  </span>
                </div>
              )}
            />
          </div>

          <div className="pannello p-4 flex flex-col gap-3">
            <span className="etichetta">base scelta</span>
            <div className="flex flex-wrap gap-2">
              {[...BASI, 'GIORNATA' as BasePrezzo].map((b) => {
                const attiva = servizio.basePrezzo?.primaria === b;
                return (
                  <button
                    key={b}
                    className="bottone mono text-[13px]"
                    aria-pressed={attiva}
                    onClick={() => invia('servizio.setBasePrezzo', { servizioId: servizio.id, primaria: b })}
                    style={
                      b !== 'GIORNATA'
                        ? undefined
                        : attiva
                          ? {
                              borderColor: 'var(--erosion)',
                              background: 'var(--erosion)',
                              color: 'var(--ink-inverso)',
                            }
                          : { borderColor: 'var(--erosion)', color: 'var(--erosion)' }
                    }
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            {servizio.basePrezzo?.primaria === 'PARTECIPAZIONE' && (
              <input
                className="text-[13px]"
                placeholder="Struttura ipotizzata: equity, revenue share, success fee…"
                defaultValue={servizio.basePrezzo.nota ?? ''}
                onBlur={(e) =>
                  invia('servizio.setBasePrezzo', {
                    servizioId: servizio.id,
                    primaria: 'PARTECIPAZIONE',
                    secondaria: servizio.basePrezzo?.secondaria,
                    nota: e.target.value,
                  })
                }
              />
            )}
            {!servizio.basePrezzo || servizio.basePrezzo.primaria === 'GIORNATA' ? (
              <span className="text-[13px]" style={{ color: 'var(--erosion)' }}>
                A giornata — erosione attesa
              </span>
            ) : null}
            {vincente.length > 1 && (
              <span className="text-[13px]" style={{ color: 'var(--tension)' }}>
                Pareggio fra {vincente.map((v) => v.base).join(' e ')} — la scelta resta al tavolo
              </span>
            )}

            {sessione.stato !== 'LOCKED' && (
              <LockButton
                disabilitato={!servizio.basePrezzo}
                contenuto={{ servizio: servizio.nome, base: servizio.basePrezzo }}
                lockAValle={stato.lock}
                partecipanti={presenti}
                nome={nome}
                onLock={(contenuto, dissensi, aValle) =>
                  invia('lock.create', { sessioneId: sessione.id, contenuto, dissensi, aValle })
                }
              />
            )}
          </div>
        </>
      )}

      <div className="pannello p-6 flex flex-col items-center gap-2">
        <div
          className="mono leading-none"
          style={{
            fontSize: 'clamp(48px, 8vw, 104px)',
            color: erosione > 0 ? 'var(--erosion)' : 'var(--ink-faint)',
            letterSpacing: '-0.03em',
          }}
        >
          {erosione.toFixed(0)}%
        </div>
        <span className="text-[13px] text-center" style={{ color: 'var(--ink-dim)' }}>
          del fatturato futuro poggia su una base in erosione
        </span>
      </div>
    </div>
  );
}

export function M2Mano({ sessione }: { sessione: Sessione }) {
  const ctx = useStore();
  const { invia } = ctx;
  const servizio = ctx.servizio(sessione.soggettoId);
  const mio = ctx.mioCommit(sessione.id);
  if (!servizio) return <Vuoto>Nessun servizio in ripricing.</Vuoto>;

  const p = mio?.payload.tipo === 'M2' ? mio.payload : null;

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo={servizio.nome} sottotitolo="Il tuo commit, in sola lettura">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="etichetta">base primaria</span>
            <span className="mono text-[15px]">{p?.primaria ?? '—'}</span>
          </div>
          {p?.secondaria && (
            <div className="flex flex-col gap-1">
              <span className="etichetta">base secondaria</span>
              <span className="mono text-[15px]">{p.secondaria}</span>
            </div>
          )}
          {p?.nota && (
            <div className="flex flex-col gap-1">
              <span className="etichetta">struttura ipotizzata</span>
              <p className="m-0 text-[15px]">{p.nota}</p>
            </div>
          )}
        </div>
      </CompitoMano>
    );
  }

  const imposta = (dati: Partial<{ primaria: BasePrezzo; secondaria?: BasePrezzo; nota: string }>) =>
    invia('commit.set', {
      sessioneId: sessione.id,
      payload: { tipo: 'M2', primaria: p?.primaria ?? 'ACCESSO', secondaria: p?.secondaria, nota: p?.nota, ...dati },
    });

  return (
    <CompitoMano
      titolo={servizio.nome}
      sottotitolo="Su cosa poggia il prezzo"
      azione={
        <div className="flex flex-col gap-2">
          <StatoCommitMano confermato={mio?.confermato ?? false} />
          <button
            className="bottone bottone-primario"
            style={{ minHeight: 52 }}
            disabled={!p || mio?.confermato}
            onClick={() => invia('commit.confirm', { sessioneId: sessione.id })}
          >
            {mio?.confermato ? 'Confermato' : 'Conferma'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <span className="etichetta">base primaria</span>
          {BASI.map((b) => (
            <div key={b} className="flex flex-col gap-1">
              <BottoneTocco attivo={p?.primaria === b} onClick={() => imposta({ primaria: b })}>
                <span className="mono">{b}</span>
              </BottoneTocco>
              <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                {BASE_DOMANDA[b]}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className="etichetta">base secondaria — opzionale</span>
          <div className="flex flex-wrap gap-2">
            {BASI.filter((b) => b !== p?.primaria).map((b) => (
              <button
                key={b}
                className="bottone mono text-[13px] px-3"
                style={{ minHeight: 48 }}
                aria-pressed={p?.secondaria === b}
                onClick={() => imposta({ secondaria: p?.secondaria === b ? undefined : b })}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {(p?.primaria === 'PARTECIPAZIONE' || p?.secondaria === 'PARTECIPAZIONE') && (
          <div className="flex flex-col gap-2">
            <span className="etichetta">struttura ipotizzata</span>
            <textarea
              className="w-full"
              rows={3}
              placeholder="equity, revenue share, success fee…"
              defaultValue={p?.nota ?? ''}
              onBlur={(e) => imposta({ nota: e.target.value })}
            />
          </div>
        )}
      </div>
    </CompitoMano>
  );
}
