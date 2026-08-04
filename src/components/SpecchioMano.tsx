'use client';

/**
 * Cosa vede il telefono quando non tocca a lui rispondere.
 *
 * Prima: un cartello con scritto «aspetta». Che è il modo più rapido per far
 * smettere di partecipare sei persone — chi ha in mano uno schermo vuoto
 * guarda il telefono, non la stanza.
 *
 * Adesso il telefono fa due cose che servono davvero: mostra il materiale di
 * cui si sta parlando, così si può seguire senza sporgersi verso il muro, e
 * lascia buttare giù un'idea mentre la si ha, invece di aspettare il proprio
 * turno di parola.
 *
 * I contributi non sono voti e non entrano in nessun calcolo: sono appunti
 * condivisi, e compaiono sul Tavolo appena scritti.
 */

import { useState } from 'react';
import { BUCKET_GLOSSA, MODULI } from '@/lib/glossario';
import { useStore } from '@/net/useStore';
import type { Sessione } from '@/lib/types';

export function SpecchioMano({ sessione }: { sessione: Sessione }) {
  const { stato, invia, servizio } = useStore();
  const [idea, setIdea] = useState('');
  if (!stato) return null;

  const m = MODULI[sessione.modulo];
  const inEsame = servizio(sessione.soggettoId);

  const contributi = stato.note
    .filter((n) => n.sessioneId === sessione.id && !n.privata)
    .sort((a, b) => b.ts - a.ts);

  const manda = () => {
    const testo = idea.trim();
    if (!testo) return;
    invia('discussion.note', { sessioneId: sessione.id, testo });
    setIdea('');
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div>
        <h2 className="m-0 text-[17px] font-normal">{m.nome}</h2>
        <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          {m.obiettivo}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
        {inEsame ? <ServizioInEsame servizioId={inEsame.id} /> : <CatalogoServizi />}

        {/* Il brainstorming: si scrive quando viene in mente, non quando tocca. */}
        <div className="flex flex-col gap-2">
          <span className="etichetta">butta giù un’idea</span>
          <textarea
            className="w-full text-[15px]"
            rows={2}
            placeholder="Quello che diresti a voce, se non ci fosse la coda"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <button
            className="bottone bottone-primario self-start"
            style={{ minHeight: 44 }}
            disabled={!idea.trim()}
            onClick={manda}
          >
            Manda al tavolo
          </button>
        </div>

        {contributi.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="etichetta">idee sul tavolo</span>
            {contributi.map((n) => (
              <div key={n.id} className="rialzato p-3">
                <div className="text-[14px]">{n.testo}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Il servizio di cui si sta parlando, con le sue attività. */
function ServizioInEsame({ servizioId }: { servizioId: string }) {
  const { servizio } = useStore();
  const s = servizio(servizioId);
  if (!s) return null;

  return (
    <div className="pannello p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px]" style={{ fontWeight: 500 }}>
          {s.nome}
        </span>
        {s.fatturato12m > 0 && (
          <span className="mono text-[13px] shrink-0" style={{ color: 'var(--ink-dim)' }}>
            {s.fatturato12m.toLocaleString('it-IT')} €
          </span>
        )}
      </div>

      {s.descrizione && (
        <p className="m-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          {s.descrizione}
        </p>
      )}

      {s.attivita.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="etichetta">le attività che lo compongono</span>
          {s.attivita.map((a) => (
            <div key={a.id} className="flex items-baseline justify-between gap-3 py-1">
              <span className="text-[14px]">{a.nome}</span>
              <span className="mono text-[13px] shrink-0" style={{ color: 'var(--ink-dim)' }}>
                {a.quotaPrezzoPct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tutti i servizi, con lo stato raggiunto finora. */
function CatalogoServizi() {
  const { stato } = useStore();
  if (!stato || stato.servizi.length === 0) return null;

  return (
    <div className="pannello p-4 flex flex-col gap-3">
      <span className="etichetta">i servizi di WDA</span>
      {stato.servizi.map((s) => {
        const b = s.bucket ? BUCKET_GLOSSA[s.bucket] : null;
        return (
          <div key={s.id} className="flex items-baseline justify-between gap-3 py-1">
            <span className="text-[14px] min-w-0">{s.nome}</span>
            {b ? (
              <span
                className="text-[12px] shrink-0 px-2 py-1"
                style={{
                  borderRadius: 'var(--radius-pill)',
                  background: s.bucket === 'CHIUSO' ? 'var(--erosion-wash)' : 'var(--live-wash)',
                  color: s.bucket === 'CHIUSO' ? 'var(--erosion)' : 'var(--live)',
                }}
              >
                {b.etichetta}
              </span>
            ) : (
              <span className="text-[12px] shrink-0" style={{ color: 'var(--ink-faint)' }}>
                da vedere
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
