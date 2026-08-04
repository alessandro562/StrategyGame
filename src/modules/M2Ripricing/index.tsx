'use client';

/**
 * M2 — Modello di pricing.
 * Se l'artefatto è quasi gratis, il prezzo non può più stare sul tempo impiegato.
 *
 * Le cinque basi sono il punto in cui il termine standard serve di più: chi fa
 * consulenza riconosce «retainer» e «success fee» molto prima di «Accesso» e
 * «Esito». Il nome italiano resta il titolo, il termine standard gli sta
 * accanto, e la riga di spiegazione arriva dal glossario — mai riscritta qui.
 */

import { pctErosione } from '@/lib/calc';
import { BASI_GLOSSA, FASI, MODULI, TERMINI } from '@/lib/glossario';
import { BASE_DOMANDA, type BasePrezzo, type Sessione } from '@/lib/types';
import { BottoneTocco, CompitoMano, Premessa, StatoCommitMano, Vuoto } from '../comune';
import { TestataModulo } from '@/components/TestataModulo';
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
      <TestataModulo modulo="M2" soggetto={servizio?.nome} />

      <Premessa>
        Un servizio si può far pagare su cinque basi diverse. Quattro poggiano su qualcosa che l’AI non replica: la
        disponibilità, il risultato, il rischio condiviso, il presidio di un flusso. La quinta, «a giornata», poggia sul
        tempo impiegato, ed è quella in erosione.
      </Premessa>

      {!servizio && (
        <div className="pannello p-4 flex flex-col gap-2">
          <span className="etichetta">servizi nel nucleo (core)</span>
          {nucleo.length === 0 ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Nessun servizio nel nucleo: i bucket si assegnano in M1, unbundling del servizio.
            </span>
          ) : (
            <>
              <p className="m-0 mb-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Apri il round sul servizio da riprezzare. Si lavora su un servizio per volta.
              </p>
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
            </>
          )}
        </div>
      )}

      {servizio && sessione.stato === 'COMMIT' && (
        <CommitBar stato={statoCommit} presenti={presenti} nome={nome} />
      )}

      {servizio && sessione.stato !== 'COMMIT' && sessione.stato !== 'SETUP' && (
        <>
          <div className="pannello p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="etichetta">{FASI.COMMIT.nome}, base per base</span>
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Quante persone hanno indicato quella base come principale. Il numero grigio conta chi l’ha messa come
                seconda. A destra, la domanda a cui quella base risponde.
              </span>
            </div>
            <RevealStage
              elementi={conteggi}
              seme={sessione.id}
              partito={partito || sessione.stato !== 'REVEAL'}
              chiave={(c) => c.base}
              className="flex flex-col gap-2"
              render={(c) => (
                <div className="flex items-center gap-3">
                  {/* Due righe fisse invece di una che va a capo da sola:
                      «Partecipazione (equity o revenue share)» su una riga
                      sola non ci sta, e la colonna smetterebbe di incolonnare. */}
                  <span className="w-52 shrink-0 flex flex-col leading-tight">
                    <span
                      className="text-[15px]"
                      style={{ color: c.n === massimo && c.n > 0 ? 'var(--live)' : 'var(--ink)' }}
                    >
                      {BASI_GLOSSA[c.base].etichetta}
                    </span>
                    <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                      {BASI_GLOSSA[c.base].standard}
                    </span>
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
            <div className="flex flex-col gap-1">
              <span className="etichetta">base decisa al tavolo</span>
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Registra su quale base il tavolo fa poggiare il prezzo di questo servizio, poi blocca la decisione.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[...BASI, 'GIORNATA' as BasePrezzo].map((b) => {
                const attiva = servizio.basePrezzo?.primaria === b;
                return (
                  <button
                    key={b}
                    className="bottone text-[13px]"
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
                    {BASI_GLOSSA[b].etichetta}{' '}
                    {/* Il termine standard si smorza con l'opacità e non con un
                        token di colore: sul bottone attivo il fondo è pieno e
                        un grigio fisso non si leggerebbe più. */}
                    <span style={{ opacity: 0.7 }}>({BASI_GLOSSA[b].standard})</span>
                  </button>
                );
              })}
            </div>
            {!servizio.basePrezzo || servizio.basePrezzo.primaria === 'GIORNATA' ? (
              <span className="text-[13px]" style={{ color: 'var(--erosion)' }}>
                {servizio.basePrezzo
                  ? `A giornata (time & materials): ${BASI_GLOSSA.GIORNATA.aiuto}`
                  : 'Nessuna base scelta.'}{' '}
                Il fatturato di questo servizio resta dentro la percentuale in erosione, qui sotto.
              </span>
            ) : (
              <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                {BASI_GLOSSA[servizio.basePrezzo.primaria].aiuto}
              </span>
            )}
            {servizio.basePrezzo?.primaria === 'PARTECIPAZIONE' && (
              <div className="flex flex-col gap-1">
                <span className="etichetta">struttura ipotizzata</span>
                <input
                  className="text-[13px]"
                  aria-label="struttura ipotizzata della partecipazione"
                  placeholder="Quota di equity, percentuale sui ricavi, fee sul risultato…"
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
              </div>
            )}
            {vincente.length > 1 && (
              <span className="text-[13px]" style={{ color: 'var(--tension)' }}>
                Pareggio fra {vincente.map((v) => BASI_GLOSSA[v.base].etichetta).join(' e ')}: nessuna base prevale, la
                scelta resta al tavolo.
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
        <span className="etichetta">esposizione</span>
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
        <span className="text-[15px] text-center" style={{ color: 'var(--ink)' }}>
          {TERMINI.esposizione}
        </span>
        <span className="text-[13px] text-center max-w-[32rem]" style={{ color: 'var(--ink-dim)' }}>
          Conta i servizi ancora venduti a giornata (time &amp; materials) e quelli senza una base scelta, sul
          fatturato di tutti i servizi che non stiamo dismettendo.
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
  if (!servizio) return <Vuoto>Nessun servizio aperto in questo round.</Vuoto>;

  const p = mio?.payload.tipo === 'M2' ? mio.payload : null;

  if (sessione.stato !== 'COMMIT') {
    return (
      <CompitoMano titolo={servizio.nome} sottotitolo="La tua risposta in cieco, in sola lettura">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="etichetta">base principale</span>
            {p ? (
              <>
                <span className="text-[15px]">
                  {BASI_GLOSSA[p.primaria].etichetta} ({BASI_GLOSSA[p.primaria].standard})
                </span>
                <span className="text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  {BASI_GLOSSA[p.primaria].aiuto}
                </span>
              </>
            ) : (
              <span className="mono text-[15px]">—</span>
            )}
          </div>
          {p?.secondaria && (
            <div className="flex flex-col gap-1">
              <span className="etichetta">seconda base</span>
              <span className="text-[15px]">
                {BASI_GLOSSA[p.secondaria].etichetta} ({BASI_GLOSSA[p.secondaria].standard})
              </span>
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
      sottotitolo={MODULI.M2.obiettivo}
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
          <div className="flex flex-col gap-1">
            <span className="etichetta">base principale</span>
            <p className="m-0 text-[15px]">
              Scegli su cosa dovrebbe far pagare questo servizio. Nessuno vede la tua risposta finché il tavolo non
              apre il confronto.
            </p>
          </div>
          {BASI.map((b) => (
            <div key={b} className="flex flex-col gap-1">
              <BottoneTocco attivo={p?.primaria === b} onClick={() => imposta({ primaria: b })}>
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-[15px]">{BASI_GLOSSA[b].etichetta}</span>
                  {/* Opacità e non un token di colore: da attivo il fondo è
                      pieno e un grigio fisso sparirebbe. */}
                  <span className="text-[13px]" style={{ opacity: 0.7 }}>
                    {BASI_GLOSSA[b].standard}
                  </span>
                </span>
              </BottoneTocco>
              {/* Una riga sola sotto il bottone: la glossa del termine. La
                  domanda di controllo di BASE_DOMANDA dice la stessa cosa in
                  forma interrogativa, e sul telefono resterebbe un doppione:
                  vive sul Tavolo, dove serve a far discutere il gruppo. */}
              <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                {BASI_GLOSSA[b].aiuto}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="etichetta">seconda base — opzionale</span>
            <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
              Se il prezzo poggerebbe su due basi insieme, indica anche la seconda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {BASI.filter((b) => b !== p?.primaria).map((b) => (
              <button
                key={b}
                className="bottone text-[15px] px-3"
                style={{ minHeight: 48 }}
                aria-pressed={p?.secondaria === b}
                onClick={() => imposta({ secondaria: p?.secondaria === b ? undefined : b })}
              >
                {BASI_GLOSSA[b].etichetta}
              </button>
            ))}
          </div>
        </div>

        {(p?.primaria === 'PARTECIPAZIONE' || p?.secondaria === 'PARTECIPAZIONE') && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="etichetta">struttura ipotizzata</span>
              <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Scrivi come legheresti il nostro guadagno al loro: quota di equity, percentuale sui ricavi, fee sul
                risultato.
              </p>
            </div>
            <textarea
              className="w-full"
              rows={3}
              aria-label="struttura ipotizzata della partecipazione"
              placeholder="Per esempio: 3% di equity, oppure 10% sui ricavi generati"
              defaultValue={p?.nota ?? ''}
              onBlur={(e) => imposta({ nota: e.target.value })}
            />
          </div>
        )}
      </div>
    </CompitoMano>
  );
}
