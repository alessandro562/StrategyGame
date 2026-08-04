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

import { createContext, useContext, useMemo, useState } from 'react';
import {
  COLONNE_QUADRO,
  MODULI,
  ORIZZONTI_QUADRO,
  RIGHE_QUADRO,
} from '@/lib/glossario';
import { quadroIniziale } from '@/lib/seed';
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

/**
 * Vero mentre una carta è in mano.
 *
 * Serve perché le caselle del Futuro si comportano in due modi opposti. A
 * riposo ne compaiono solo quelle piene: tre zone vuote per riga, moltiplicate
 * per sei righe, sono diciotto righe di nulla che spingono metà mappa sotto il
 * bordo dello schermo. Mentre si trascina compaiono tutte e tre, perché senza
 * un bersaglio visibile non si può mirare a un orizzonte vuoto.
 */
const CtxTrascino = createContext<{ attivo: boolean; imposta: (v: boolean) => void }>({
  attivo: false,
  imposta: () => {},
});

/* ------------------------------------------------------------------ */
/* Tavolo                                                              */
/* ------------------------------------------------------------------ */

export function MQTavolo({ sessione }: { sessione: Sessione }) {
  const { stato } = useStore();
  const [trascino, setTrascino] = useState(false);
  if (!stato) return null;

  const quadro = stato.quadro ?? [];
  const futuro = quadro.filter((v) => v.colonna === 'FUTURO');
  const toccate = quantoSiEMossa(quadro);

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <TestataModulo
        modulo="MQ"
        senzaComeFunziona
        destra={
          <div className="flex items-start gap-6 shrink-0">
            <Contatore etichetta="carte nel futuro" valore={futuro.length} acceso={futuro.length > 0} />
            <Contatore etichetta="mosse e aggiunte" valore={toccate} acceso={toccate > 0} />
          </div>
        }
      />

      {/* Due righe di istruzione, e sono le uniche: senza, una griglia di carte
          si guarda invece di toccarla, e nessuno scopre da solo che si
          trascinano. Il «+» sulle carte competitor va detto per lo stesso
          motivo — un'analisi che nessuno apre non è un'analisi. */}
      <div className="flex items-center gap-5 flex-wrap text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        <span className="flex items-center gap-2">
          <Tasto>trascina</Tasto> una carta in qualsiasi casella per riclassificarla
        </span>
        <span className="flex items-center gap-2">
          <Tasto>+</Tasto> apre l’analisi dietro le carte competitor
        </span>
        <span className="flex items-center gap-2">
          <Tasto>telefono</Tasto> aggiunge carte nuove
        </span>
      </div>

      {/* La tabella prende tutta l'altezza rimasta e scorre al proprio interno
          se serve. In sala non deve servire: sei righe devono stare dentro uno
          schermo, o metà del quadro è dietro una barra di scorrimento che solo
          chi ha il portatile può muovere. È il motivo per cui le voci sono
          pastiglie a capo automatico e non righe impilate. */}
      {/* `dragend` sulla carta non scatta se il rilascio avviene fuori da una
          zona valida in certi browser: l'ascolto sta anche qui, sul
          contenitore, così le zone del futuro non restano aperte per sempre
          dopo un trascinamento abbandonato. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto barra-scorrimento"
        onDragEnd={() => setTrascino(false)}
        onDrop={() => setTrascino(false)}
      >
        <CtxTrascino.Provider value={{ attivo: trascino, imposta: setTrascino }}>
          <Tabella />
        </CtxTrascino.Provider>
      </div>
    </div>
  );
}

/**
 * Quante carte non sono più dove erano stamattina: quelle aggiunte oggi più
 * quelle precaricate che qualcuno ha spostato.
 *
 * Contava solo le aggiunte, e l'etichetta diceva «mosse e aggiunte»: si poteva
 * riclassificare mezza mappa e vedere ancora zero. Un numero che non si muove
 * quando ci si lavora sopra è peggio di nessun numero, perché insegna a non
 * guardarlo.
 */
function quantoSiEMossa(quadro: VoceQuadro[]): number {
  const partenza = new Map(quadroIniziale().map((v) => [v.id, v]));
  return quadro.filter((v) => {
    const era = partenza.get(v.id);
    if (!era) return true; // aggiunta oggi
    return era.riga !== v.riga || era.colonna !== v.colonna || era.orizzonte !== v.orizzonte;
  }).length;
}

function Tasto({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="etichetta px-2 py-0.5"
      style={{
        border: '1px solid var(--line-strong)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-panel)',
        color: 'var(--ink)',
      }}
    >
      {children}
    </span>
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
          riga={riga.chiave}
          colonna={c.chiave}
          bordo={bordo}
        />
      ))}
    </>
  );
}

function Cella({
  voci,
  riga,
  colonna,
  bordo,
}: {
  voci: VoceQuadro[];
  riga: RigaQuadro;
  colonna: ColonnaQuadro;
  bordo?: string;
}) {
  const stile = { borderBottom: bordo, borderLeft: '1px solid var(--line)' };

  // Nel futuro la cella si divide nei tre orizzonti, e ognuno è una zona di
  // rilascio a sé: trascinare una carta su «entro l'anno» la classifica nel
  // gesto stesso di spostarla, senza un secondo passaggio.
  if (colonna === 'FUTURO') {
    return (
      <div className="p-1.5 flex flex-col gap-1" style={stile}>
        {ORIZZONTI_QUADRO.map((o) => (
          <ZonaRilascio
            key={o.chiave}
            riga={riga}
            colonna="FUTURO"
            orizzonte={o.chiave}
            etichetta={o.etichetta}
            voci={voci.filter((v) => v.orizzonte === o.chiave)}
            // Un orizzonte vuoto è un bersaglio solo mentre si trascina. A
            // riposo sparisce: tre righe di «—» per ognuna delle sei righe
            // sono la differenza fra una mappa che sta in uno schermo e una
            // che sta in due.
            soloSePienaOInTrascinamento
          />
        ))}
        {/* Chi ha scritto nel futuro senza dire quando. Non si perde, e resta
            una zona valida: si può anche togliere l'orizzonte a una carta. */}
        <ZonaRilascio
          riga={riga}
          colonna="FUTURO"
          etichetta="senza data"
          voci={voci.filter((v) => !v.orizzonte)}
          soloSePiena
        />
        {/* Quando la casella è del tutto vuota e nessuno sta trascinando resta
            solo questo: una riga, che dice cosa manca. */}
        {voci.length === 0 && <VuotoFuturo />}
      </div>
    );
  }

  return (
    <div className="p-1.5" style={stile}>
      <ZonaRilascio riga={riga} colonna={colonna} voci={voci} />
    </div>
  );
}

/**
 * Una casella su cui si può lasciare cadere una carta.
 *
 * `dragover` va sempre annullato, anche quando non si vuole evidenziare nulla:
 * senza `preventDefault` il browser rifiuta il rilascio e la carta torna
 * indietro con l'animazione dello «no», che si legge come un errore
 * dell'applicazione invece che come un divieto voluto.
 */
function ZonaRilascio({
  riga,
  colonna,
  orizzonte,
  etichetta,
  voci,
  soloSePiena,
  soloSePienaOInTrascinamento,
}: {
  riga: RigaQuadro;
  colonna: ColonnaQuadro;
  orizzonte?: OrizzonteQuadro;
  etichetta?: string;
  voci: VoceQuadro[];
  soloSePiena?: boolean;
  soloSePienaOInTrascinamento?: boolean;
}) {
  const { invia } = useStore();
  const trascino = useContext(CtxTrascino);
  const [sopra, setSopra] = useState(false);

  if (voci.length === 0) {
    if (soloSePiena) return null;
    if (soloSePienaOInTrascinamento && !trascino.attivo) return null;
  }

  const lascia = (e: React.DragEvent) => {
    e.preventDefault();
    setSopra(false);
    trascino.imposta(false);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    invia('quadro.sposta', { id, riga, colonna, ...(orizzonte ? { orizzonte } : {}) });
  };

  const vuota = voci.length === 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!sopra) setSopra(true);
      }}
      onDragLeave={() => setSopra(false)}
      onDrop={lascia}
      className="flex gap-2 px-2 py-1.5 transition-colors"
      style={{
        borderRadius: 'var(--radius-sm)',
        minHeight: 40,
        // Il tratteggio compare solo mentre si trascina sopra: una griglia di
        // diciotto caselle tratteggiate a riposo sembra un modulo da compilare.
        background: sopra ? 'var(--wda-wash)' : 'transparent',
        outline: sopra ? '2px dashed var(--wda)' : '2px dashed transparent',
        outlineOffset: -2,
        alignItems: vuota ? 'center' : 'flex-start',
      }}
    >
      {etichetta && (
        <span className="etichetta shrink-0 pt-1" style={{ width: 72, color: 'var(--wda-bright)' }}>
          {etichetta}
        </span>
      )}
      {vuota ? (
        <span className="text-[13px]" style={{ color: sopra ? 'var(--wda-bright)' : 'var(--ink-faint)' }}>
          {sopra ? 'lascia qui' : '—'}
        </span>
      ) : (
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {voci.map((v) => (
            <Carta key={v.id} voce={v} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Il segnaposto della casella futura ancora intatta. Una riga, non tre. */
function VuotoFuturo() {
  const trascino = useContext(CtxTrascino);
  if (trascino.attivo) return null;
  return (
    <span className="text-[13px] px-2 py-1" style={{ color: 'var(--ink-faint)' }}>
      da riempire
    </span>
  );
}

/**
 * Una carta sulla mappa. Si trascina in qualsiasi casella, e se ha un retro
 * — le analisi dei competitor ce l'hanno — si apre con un clic.
 *
 * Pastiglia e non riquadro impilato: con cinque servizi in colonna le righe
 * impilate facevano una cella alta 250px, e con sei righe così metà della
 * mappa finiva sotto il bordo dello schermo proiettato.
 */
function Carta({ voce }: { voce: VoceQuadro }) {
  const { nome } = useStore();
  const trascino = useContext(CtxTrascino);
  const [aperta, setAperta] = useState(false);
  const [presa, setPresa] = useState(false);
  const nuova = voce.autoreId !== SEME;
  const haRetro = Boolean(voce.nota);

  return (
    <span className="relative inline-flex">
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', voce.id);
          e.dataTransfer.effectAllowed = 'move';
          setPresa(true);
          // Il retro aperto mentre si trascina resterebbe sospeso a mezz'aria
          // sopra una carta che non c'è più in quel punto.
          setAperta(false);
          trascino.imposta(true);
        }}
        onDragEnd={() => {
          setPresa(false);
          trascino.imposta(false);
        }}
        onClick={() => haRetro && setAperta((x) => !x)}
        role={haRetro ? 'button' : undefined}
        tabIndex={haRetro ? 0 : undefined}
        onKeyDown={(e) => {
          if (haRetro && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setAperta((x) => !x);
          }
        }}
        className="inline-flex items-baseline gap-2 px-2.5 py-1 text-[14px] leading-snug select-none"
        style={{
          borderRadius: 'var(--radius-sm)',
          background: aperta ? 'var(--wda-wash)' : nuova ? 'var(--live-wash)' : 'var(--bg-raised)',
          border: `1px solid ${aperta ? 'var(--wda)' : nuova ? 'var(--live)' : 'var(--line)'}`,
          color: 'var(--ink)',
          cursor: haRetro ? 'pointer' : 'grab',
          opacity: presa ? 0.4 : 1,
          boxShadow: presa ? 'none' : 'var(--ombra-1)',
        }}
      >
        {voce.testo}
        {haRetro && (
          <span className="text-[12px] shrink-0" style={{ color: 'var(--wda-bright)' }}>
            {aperta ? '−' : '+'}
          </span>
        )}
        {nuova && (
          <span className="text-[12px] shrink-0" style={{ color: 'var(--live)' }}>
            {nome(voce.autoreId)}
          </span>
        )}
      </span>

      {aperta && voce.nota && <Retro voce={voce} chiudi={() => setAperta(false)} />}
    </span>
  );
}

/** L'analisi dietro una carta competitor. Sovrapposta, non in linea: in linea
 *  spingerebbe giù le cinque righe sotto e farebbe saltare la mappa. */
function Retro({ voce, chiudi }: { voce: VoceQuadro; chiudi: () => void }) {
  return (
    <div
      className="pannello absolute z-30 p-4 flex flex-col gap-3"
      style={{
        top: 'calc(100% + 6px)',
        left: 0,
        width: 460,
        maxWidth: '46vw',
        boxShadow: 'var(--ombra-3)',
        borderColor: 'var(--wda)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[15px]" style={{ fontWeight: 500 }}>
          {voce.testo}
        </span>
        <button
          className="etichetta shrink-0 px-2 py-1"
          style={{ border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)' }}
          onClick={(e) => {
            e.stopPropagation();
            chiudi();
          }}
        >
          chiudi
        </button>
      </div>
      <p className="m-0 text-[14px]" style={{ color: 'var(--ink)' }}>
        {voce.nota}
      </p>
      {voce.url && (
        <span className="text-[12px] truncate" style={{ color: 'var(--ink-faint)' }}>
          {voce.url}
        </span>
      )}
    </div>
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
              <div key={v.id} className="rialzato p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
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
                {v.nota && <Nota testo={v.nota} url={v.url} />}
              </div>
            ))
          )}
        </div>

        {/* Il trascinamento non esiste su un telefono, ma il gesto sì: si
            sceglie la casella qui sopra e si manda dentro una carta con un
            tocco. Senza, riclassificare sarebbe una cosa che può fare solo chi
            ha il portatile, e la mappa la muoverebbe una persona sola. */}
        <SpostaQui riga={riga} colonna={colonna} orizzonte={orizzonte} />

        {mie > 0 && (
          <span className="etichetta">
            hai messo {mie} {mie === 1 ? 'carta' : 'carte'} sulla mappa
          </span>
        )}
      </div>
    </div>
  );
}

/** L'analisi dietro una carta, sul telefono: in linea e richiudibile. */
function Nota({ testo, url }: { testo: string; url?: string }) {
  const [aperta, setAperta] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        className="etichetta self-start px-2 py-1"
        style={{
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--radius-sm)',
          minHeight: 36,
          color: 'var(--wda-bright)',
        }}
        onClick={() => setAperta((x) => !x)}
      >
        {aperta ? 'chiudi analisi' : 'apri analisi'}
      </button>
      {aperta && (
        <>
          <p className="m-0 text-[13px]" style={{ color: 'var(--ink)' }}>
            {testo}
          </p>
          {url && (
            <span className="text-[12px] break-all" style={{ color: 'var(--ink-faint)' }}>
              {url}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Manda una carta esistente nella casella scelta con i selettori qui sopra.
 * Chiusa di default: aperta occuperebbe più spazio del modulo di scrittura,
 * che resta il gesto principale del telefono.
 */
function SpostaQui({
  riga,
  colonna,
  orizzonte,
}: {
  riga: RigaQuadro;
  colonna: ColonnaQuadro;
  orizzonte: OrizzonteQuadro;
}) {
  const { stato, invia } = useStore();
  const [aperto, setAperto] = useState(false);

  const quadro = stato?.quadro ?? [];
  // Le carte già nella casella di destinazione non si mostrano: spostarle dove
  // sono già è l'unico gesto che non fa niente, e in una lista lunga è anche
  // l'unico che si prova per sbaglio.
  const altrove = quadro.filter(
    (v) => !(v.riga === riga && v.colonna === colonna && (colonna !== 'FUTURO' || v.orizzonte === orizzonte)),
  );

  const dove = `${RIGHE_QUADRO.find((r) => r.chiave === riga)?.etichetta} · ${
    COLONNE_QUADRO.find((c) => c.chiave === colonna)?.etichetta
  }${colonna === 'FUTURO' ? ` · ${ORIZZONTI_QUADRO.find((o) => o.chiave === orizzonte)?.etichetta}` : ''}`;

  return (
    <div className="flex flex-col gap-2">
      <button
        className="bottone text-[14px] text-left"
        style={{ minHeight: 48 }}
        onClick={() => setAperto((x) => !x)}
      >
        {aperto ? 'Chiudi' : `Sposta una carta in «${dove}»`}
      </button>

      {aperto && (
        <div className="flex flex-col gap-2">
          {altrove.length === 0 ? (
            <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Non c’è nessun’altra carta sulla mappa.
            </span>
          ) : (
            altrove.map((v) => (
              <button
                key={v.id}
                className="bottone text-left flex flex-col items-start gap-1"
                style={{ minHeight: 48 }}
                onClick={() => {
                  invia('quadro.sposta', {
                    id: v.id,
                    riga,
                    colonna,
                    ...(colonna === 'FUTURO' ? { orizzonte } : {}),
                  });
                  setAperto(false);
                }}
              >
                <span className="text-[14px]">{v.testo}</span>
                <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                  adesso in {RIGHE_QUADRO.find((r) => r.chiave === v.riga)?.etichetta} ·{' '}
                  {COLONNE_QUADRO.find((c) => c.chiave === v.colonna)?.etichetta}
                </span>
              </button>
            ))
          )}
        </div>
      )}
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
