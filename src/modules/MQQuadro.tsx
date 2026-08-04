'use client';

/**
 * MQ — il quadro d'insieme. È il primo esercizio del ritiro e l'unico che non
 * ha un vincitore: nessun voto, nessun commit cieco, nessun calcolo.
 *
 * Sei righe (servizi, prodotti, mercato, clienti, partner, revenue model) per
 * tre colonne (cosa facciamo, cosa fanno i competitor, dove vogliamo andare).
 * Chiunque scrive in qualsiasi casella dal proprio telefono, e la casella si
 * riempie sullo schermo grande mentre lo fa.
 *
 * Due scelte che reggono tutto il resto:
 *
 *  1. le prime due colonne partono già piene di quello che WDA fa davvero. Una
 *     tabella vuota è un invito a non compilarla; davanti a diciotto voci già
 *     scritte si comincia a contestarle, che è esattamente ciò che serve;
 *  2. la colonna Futuro parte vuota ed è marcata come tale. È l'unica domanda
 *     della schermata, e si vede da tre metri che è quella.
 *
 * Dentro il Futuro le voci si dispongono sui tre orizzonti del Future Canvas:
 * senza, «assumere un commerciale» e «cambiare mestiere» finiscono sulla
 * stessa riga e la colonna smette di dire qualcosa.
 */

import { useMemo, useState } from 'react';
import {
  COLONNE_QUADRO,
  MODULI,
  ORIZZONTI_QUADRO,
  RIGHE_QUADRO,
} from '@/lib/glossario';
import { useStore } from '@/net/useStore';
import { TestataModulo } from '@/components/TestataModulo';
import type {
  ColonnaQuadro,
  OrizzonteQuadro,
  RigaQuadro,
  Sessione,
  VoceQuadro,
} from '@/lib/types';

/** Le voci precaricate non hanno un autore vero: nessuna firma sotto. */
const SEME = 'seed';

/* ------------------------------------------------------------------ */
/* Tavolo                                                              */
/* ------------------------------------------------------------------ */

export function MQTavolo({ sessione }: { sessione: Sessione }) {
  const { stato } = useStore();
  if (!stato) return null;

  const quadro = stato.quadro ?? [];
  const futuro = quadro.filter((v) => v.colonna === 'FUTURO');
  const scritteDaNoi = quadro.filter((v) => v.autoreId !== SEME).length;

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <TestataModulo
        modulo="MQ"
        destra={
          <div className="flex items-start gap-6 shrink-0">
            <Contatore etichetta="voci nel futuro" valore={futuro.length} acceso={futuro.length > 0} />
            <Contatore etichetta="aggiunte oggi" valore={scritteDaNoi} />
          </div>
        }
      />

      {/* La tabella prende tutta l'altezza rimasta e scorre al proprio interno
          se serve. In sala non deve servire: sei righe devono stare dentro uno
          schermo, o metà del quadro è dietro una barra di scorrimento che solo
          chi ha il portatile può muovere. È il motivo per cui le voci sono
          pastiglie a capo automatico e non righe impilate. */}
      <div className="flex-1 min-h-0 overflow-y-auto barra-scorrimento">
        <Tabella />
      </div>
    </div>
  );
}

function Contatore({
  etichetta,
  valore,
  acceso,
}: {
  etichetta: string;
  valore: number;
  acceso?: boolean;
}) {
  return (
    <div className="flex flex-col items-end">
      <span
        className="mono leading-none"
        style={{ fontSize: 28, color: acceso ? 'var(--live)' : 'var(--ink)' }}
      >
        {valore}
      </span>
      <span className="etichetta mt-1">{etichetta}</span>
    </div>
  );
}

/**
 * La griglia. `grid` e non `<table>`: le celle devono poter crescere in
 * altezza insieme riga per riga, e una tabella con celle a scorrimento
 * indipendente è una cosa che nessun browser fa volentieri.
 */
function Tabella() {
  const { stato } = useStore();
  const quadro = stato?.quadro ?? [];

  const perCella = useMemo(() => {
    const m = new Map<string, VoceQuadro[]>();
    for (const v of quadro) {
      const k = `${v.riga}|${v.colonna}`;
      const l = m.get(k);
      if (l) l.push(v);
      else m.set(k, [v]);
    }
    return m;
  }, [quadro]);

  return (
    <div
      className="pannello overflow-hidden grid"
      // La prima colonna porta l'etichetta di riga e sta stretta; le tre
      // colonne di contenuto si dividono il resto in parti uguali, così il
      // Futuro non sembra la colonna di scarto solo perché è l'ultima.
      style={{ gridTemplateColumns: 'minmax(140px, 200px) repeat(3, minmax(0, 1fr))' }}
    >
      <div style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--line)' }} />
      {COLONNE_QUADRO.map((c) => (
        <IntestazioneColonna key={c.chiave} colonna={c.chiave} etichetta={c.etichetta} aiuto={c.aiuto} />
      ))}

      {RIGHE_QUADRO.map((r, i) => (
        <Riga key={r.chiave} riga={r} perCella={perCella} ultima={i === RIGHE_QUADRO.length - 1} />
      ))}
    </div>
  );
}

function IntestazioneColonna({
  colonna,
  etichetta,
  aiuto,
}: {
  colonna: ColonnaQuadro;
  etichetta: string;
  aiuto: string;
}) {
  const daRiempire = colonna === 'FUTURO';
  return (
    <div
      className="px-3 py-2 flex flex-col gap-0.5 sticky top-0 z-10"
      style={{
        borderBottom: '1px solid var(--line)',
        borderLeft: '1px solid var(--line)',
        // Il Futuro è marcato in testata, non nelle celle: tinteggiare sei
        // caselle vuote le fa sembrare disabilitate invece che da riempire.
        background: daRiempire ? 'var(--wda-wash)' : 'var(--bg-raised)',
      }}
    >
      <span
        className="text-[17px] leading-tight"
        style={{ fontWeight: 500, color: daRiempire ? 'var(--wda-bright)' : 'var(--ink)' }}
      >
        {etichetta}
      </span>
      <span className="text-[13px] leading-tight" style={{ color: 'var(--ink-dim)' }}>
        {aiuto}
      </span>
    </div>
  );
}

function Riga({
  riga,
  perCella,
  ultima,
}: {
  riga: (typeof RIGHE_QUADRO)[number];
  perCella: Map<string, VoceQuadro[]>;
  ultima: boolean;
}) {
  const bordo = ultima ? undefined : '1px solid var(--line)';
  return (
    <>
      <div
        className="px-3 py-2 flex flex-col gap-0.5"
        style={{ borderBottom: bordo, background: 'var(--bg-raised)' }}
      >
        <span className="text-[15px] leading-tight" style={{ fontWeight: 500 }}>
          {riga.etichetta}
        </span>
        <span className="text-[13px] leading-tight" style={{ color: 'var(--ink-faint)' }}>
          {riga.aiuto}
        </span>
      </div>

      {COLONNE_QUADRO.map((c) => (
        <Cella
          key={c.chiave}
          voci={perCella.get(`${riga.chiave}|${c.chiave}`) ?? []}
          colonna={c.chiave}
          bordo={bordo}
        />
      ))}
    </>
  );
}

function Cella({
  voci,
  colonna,
  bordo,
}: {
  voci: VoceQuadro[];
  colonna: ColonnaQuadro;
  bordo?: string;
}) {
  const stile = { borderBottom: bordo, borderLeft: '1px solid var(--line)' };

  if (voci.length === 0) {
    return (
      <div className="px-3 py-2 flex items-start" style={stile}>
        <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          {colonna === 'FUTURO' ? 'da scrivere — dai telefoni' : '—'}
        </span>
      </div>
    );
  }

  // Nel futuro le voci si raggruppano per orizzonte, nelle altre colonne no:
  // «cosa facciamo» non ha orizzonti, ha solo il presente.
  if (colonna === 'FUTURO') {
    const senzaQuando = voci.filter((v) => !v.orizzonte);
    return (
      <div className="px-3 py-2 flex flex-col gap-2" style={stile}>
        {ORIZZONTI_QUADRO.map((o) => {
          const dellOrizzonte = voci.filter((v) => v.orizzonte === o.chiave);
          if (dellOrizzonte.length === 0) return null;
          return (
            <div key={o.chiave} className="flex items-baseline gap-2">
              {/* L'orizzonte sta a sinistra delle sue voci invece che sopra:
                  un'etichetta su riga propria per ognuno dei tre costa tre
                  righe di altezza per cella, che moltiplicate per sei righe
                  sono lo schermo intero. */}
              <span
                className="etichetta shrink-0 pt-1"
                style={{ width: 76, color: 'var(--wda-bright)' }}
              >
                {o.etichetta}
              </span>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {dellOrizzonte.map((v) => (
                  <Post key={v.id} voce={v} />
                ))}
              </div>
            </div>
          );
        })}
        {/* Chi ha scritto nel futuro senza scegliere quando. Non si perde. */}
        {senzaQuando.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {senzaQuando.map((v) => (
              <Post key={v.id} voce={v} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 flex flex-wrap gap-1.5 content-start" style={stile}>
      {voci.map((v) => (
        <Post key={v.id} voce={v} />
      ))}
    </div>
  );
}

/**
 * Una voce sul tavolo. Pastiglia a capo automatico, non riga di lista: cinque
 * servizi impilati facevano una cella alta 250px, e con sei righe così il
 * quadro finiva per metà sotto il bordo dello schermo. In verde e firmate
 * quelle scritte in sala, perché la cosa che vale la pena vedere da tre metri
 * è cosa si è aggiunto adesso rispetto a com'era stamattina.
 */
function Post({ voce }: { voce: VoceQuadro }) {
  const { nome } = useStore();
  const nuova = voce.autoreId !== SEME;

  return (
    <span
      className="inline-flex items-baseline gap-2 px-2.5 py-1 text-[14px] leading-snug"
      style={{
        borderRadius: 'var(--radius-sm)',
        background: nuova ? 'var(--live-wash)' : 'var(--bg-raised)',
        border: `1px solid ${nuova ? 'var(--live)' : 'var(--line)'}`,
        color: 'var(--ink)',
      }}
    >
      {voce.testo}
      {nuova && (
        <span className="text-[12px] shrink-0" style={{ color: 'var(--live)' }}>
          {nome(voce.autoreId)}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Mano                                                                */
/* ------------------------------------------------------------------ */

/**
 * Sul telefono il quadro non si mostra tutto: sei per tre celle su uno schermo
 * da cinque pollici sono diciotto caselle illeggibili. Si sceglie una casella,
 * si legge cosa c'è già, si aggiunge.
 */
export function MQMano({ sessione }: { sessione: Sessione }) {
  const { stato, invia, nome, io } = useStore();
  const [riga, setRiga] = useState<RigaQuadro>('SERVIZI');
  const [colonna, setColonna] = useState<ColonnaQuadro>('FUTURO');
  const [orizzonte, setOrizzonte] = useState<OrizzonteQuadro>('VICINO');
  const [testo, setTesto] = useState('');

  if (!stato) return null;

  const quadro = stato.quadro ?? [];
  const nellaCella = quadro.filter((v) => v.riga === riga && v.colonna === colonna);
  const mie = quadro.filter((v) => v.autoreId === io?.id).length;
  const futuro = quadro.filter((v) => v.colonna === 'FUTURO').length;

  const aggiungi = () => {
    const t = testo.trim();
    if (!t) return;
    invia('quadro.aggiungi', {
      riga,
      colonna,
      testo: t,
      ...(colonna === 'FUTURO' ? { orizzonte } : {}),
    });
    setTesto('');
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Il sottotitolo che stava qui («scrivi dove vuoi, non è un voto») era
          la stessa frase della fascia di fase, tre centimetri più su. Al suo
          posto va un dato che la fascia non ha: quanto è pieno il quadro, e
          quanto ne manca alla colonna che conta. */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-normal">{MODULI.MQ.nome}</h2>
        <span className="text-[13px] shrink-0" style={{ color: 'var(--ink-dim)' }}>
          <span className="mono" style={{ color: futuro > 0 ? 'var(--live)' : 'var(--ink)' }}>
            {futuro}
          </span>{' '}
          nel futuro
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto barra-scorrimento flex flex-col gap-5">
        <Passo numero={1} titolo="Di cosa parli">
          <div className="grid grid-cols-2 gap-2">
            {RIGHE_QUADRO.map((r) => (
              <Chip key={r.chiave} attivo={riga === r.chiave} onClick={() => setRiga(r.chiave)}>
                {r.etichetta}
              </Chip>
            ))}
          </div>
          <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            {RIGHE_QUADRO.find((r) => r.chiave === riga)?.aiuto}
          </span>
        </Passo>

        {/* Tre bottoni a tutta larghezza impilati costavano 150px di altezza e
            spingevano «cosa c'è già» fuori dallo schermo — cioè nascondevano
            proprio la cosa che serve leggere prima di scrivere. In riga da tre
            costano 48. */}
        <Passo numero={2} titolo="In che colonna">
          <div className="grid grid-cols-3 gap-2">
            {COLONNE_QUADRO.map((c) => (
              <Chip
                key={c.chiave}
                attivo={colonna === c.chiave}
                centrato
                onClick={() => setColonna(c.chiave)}
              >
                {c.etichetta}
              </Chip>
            ))}
          </div>
          <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            {COLONNE_QUADRO.find((c) => c.chiave === colonna)?.aiuto}
          </span>
        </Passo>

        {colonna === 'FUTURO' && (
          <Passo numero={3} titolo="Quando">
            <div className="grid grid-cols-3 gap-2">
              {ORIZZONTI_QUADRO.map((o) => (
                <Chip
                  key={o.chiave}
                  attivo={orizzonte === o.chiave}
                  centrato
                  onClick={() => setOrizzonte(o.chiave)}
                >
                  <span className="flex flex-col items-center leading-tight">
                    <span>{o.etichetta}</span>
                    <span className="text-[11px]" style={{ opacity: 0.75 }}>
                      {o.quando}
                    </span>
                  </span>
                </Chip>
              ))}
            </div>
            <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              {ORIZZONTI_QUADRO.find((o) => o.chiave === orizzonte)?.aiuto}
            </span>
          </Passo>
        )}

        <Passo numero={colonna === 'FUTURO' ? 4 : 3} titolo="Scrivila">
          <textarea
            className="w-full text-[15px]"
            rows={3}
            placeholder="Una riga, come la diresti a voce"
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
          />
          <button
            className="bottone bottone-primario"
            style={{ minHeight: 48 }}
            disabled={!testo.trim()}
            onClick={aggiungi}
          >
            Aggiungi al quadro
          </button>
        </Passo>

        <div className="flex flex-col gap-2">
          <span className="etichetta">
            cosa c’è già in «{RIGHE_QUADRO.find((r) => r.chiave === riga)?.etichetta} ·{' '}
            {COLONNE_QUADRO.find((c) => c.chiave === colonna)?.etichetta}»
          </span>
          {nellaCella.length === 0 ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Questa casella è vuota. Sei il primo.
            </span>
          ) : (
            nellaCella.map((v) => (
              <div key={v.id} className="rialzato p-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1">
                  <span className="text-[14px]">{v.testo}</span>
                  {v.autoreId !== SEME && (
                    <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                      {nome(v.autoreId)}
                    </span>
                  )}
                </div>
                {/* Si cancella solo quello che si è scritto. Togliere l'idea di
                    un altro mentre la sta ancora spiegando è il modo più veloce
                    per far smettere tutti di scrivere. */}
                {v.autoreId === io?.id && (
                  <button
                    className="bottone text-[13px] shrink-0"
                    style={{ minHeight: 44, padding: '6px 12px' }}
                    onClick={() => invia('quadro.rimuovi', { id: v.id })}
                  >
                    Togli
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {mie > 0 && (
          <span className="etichetta">
            hai messo {mie} {mie === 1 ? 'voce' : 'voci'} nel quadro
          </span>
        )}
      </div>
    </div>
  );
}

function Passo({
  numero,
  titolo,
  children,
}: {
  numero: number;
  titolo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="mono flex items-center justify-center shrink-0"
          style={{
            width: 20,
            height: 20,
            fontSize: 12,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--wda)',
            color: 'var(--ink-inverso)',
          }}
        >
          {numero}
        </span>
        <span className="text-[15px]" style={{ fontWeight: 500 }}>
          {titolo}
        </span>
      </div>
      {children}
    </div>
  );
}

function Chip({
  attivo,
  centrato,
  onClick,
  children,
}: {
  attivo: boolean;
  centrato?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`flex items-center px-2 leading-snug text-[14px] ${
        centrato ? 'justify-center text-center' : 'text-left px-3'
      }`}
      style={{
        minHeight: 48,
        width: '100%',
        border: `1px solid ${attivo ? 'var(--wda)' : 'var(--line-strong)'}`,
        background: attivo ? 'var(--wda)' : 'var(--bg-panel)',
        color: attivo ? 'var(--ink-inverso)' : 'var(--ink)',
        fontWeight: attivo ? 500 : 400,
        borderRadius: 'var(--radius-sm)',
      }}
      aria-pressed={attivo}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
