'use client';

/**
 * §3.3 — il lock registra la decisione e i dissensi.
 * Il dissenso non viene cancellato dal lock: resta nel verbale.
 *
 * Due gradini di testo: 11 per le etichette, 13 per tutto il resto. Il pannello
 * è denso e vive dentro un'altra vista, quindi non si concede una terza misura.
 * Le sigle di modulo e i conteggi vanno in .mono, il resto nel carattere di
 * interfaccia.
 */

import { useState } from 'react';
import type { Lock, Partecipante } from '@/lib/types';

export function LockButton({
  disabilitato,
  contenuto,
  lockAValle,
  partecipanti,
  nome,
  onLock,
}: {
  disabilitato?: boolean;
  contenuto: unknown;
  lockAValle?: Lock[];
  partecipanti: Partecipante[];
  nome: (pid: string) => string;
  onLock: (contenuto: unknown, dissensi: { partecipanteId: string; nota: string }[], aValle: string[]) => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [dissensi, setDissensi] = useState<Record<string, string>>({});
  const [aValle, setAValle] = useState<string[]>([]);

  if (!aperto) {
    // Niente colore inline sopra .bottone-primario: al passaggio del mouse la
    // classe riempie il bottone di --wda, e un testo scuro imposto a mano
    // resterebbe blu su blu. Il testo sopra un riempimento pieno lo decide la
    // classe, che usa --ink-inverso.
    return (
      <button className="bottone bottone-primario" disabled={disabilitato} onClick={() => setAperto(true)}>
        Blocca la decisione
      </button>
    );
  }

  const conNota = Object.entries(dissensi).filter(([, n]) => n.trim().length > 0);

  return (
    <div className="pannello p-4 flex flex-col gap-4" style={{ borderColor: 'var(--locked)' }}>
      <div>
        <div className="etichetta" style={{ color: 'var(--locked)' }}>
          blocco della decisione
        </div>
        {/* Cosa comporta il lock non era scritto da nessuna parte, e vale per
            tutti i moduli: la decisione si registra, il dissenso non si perde. */}
        <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          La decisione viene registrata e il round si chiude. Chi non era d’accordo resta a verbale con la
          sua nota: bloccare non cancella il dissenso. Si può riaprire dal pannello del facilitatore.
        </p>
      </div>

      <div>
        <div className="etichetta mb-2">chi voleva altro, e cosa</div>
        <div className="flex flex-col gap-1">
          {partecipanti.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              {/* Colonna fissa: i nomi restano incolonnati e i campi partono
                  tutti dalla stessa ascissa, anche col nome lungo. */}
              <span className="text-[13px] w-24 shrink-0 truncate" style={{ color: 'var(--ink-dim)' }}>
                {nome(p.id)}
              </span>
              <input
                className="flex-1 text-[13px]"
                placeholder="—"
                value={dissensi[p.id] ?? ''}
                onChange={(e) => setDissensi({ ...dissensi, [p.id]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </div>

      {lockAValle && lockAValle.length > 0 && (
        <div>
          <div className="etichetta mb-2">decisioni che dipenderanno da questa</div>
          <div className="flex flex-wrap gap-2">
            {lockAValle.map((l) => (
              <button
                key={l.id}
                className="bottone text-[13px]"
                aria-pressed={aValle.includes(l.id)}
                onClick={() =>
                  setAValle(aValle.includes(l.id) ? aValle.filter((x) => x !== l.id) : [...aValle, l.id])
                }
              >
                <span className="mono">{l.modulo}</span> {l.titolo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="bottone bottone-primario text-[13px]"
          onClick={() => {
            onLock(
              contenuto,
              conNota.map(([partecipanteId, nota]) => ({ partecipanteId, nota: nota.trim() })),
              aValle,
            );
            setAperto(false);
            setDissensi({});
            setAValle([]);
          }}
        >
          Blocca — <span className="mono">{conNota.length}</span>{' '}
          {conNota.length === 1 ? 'dissenso' : 'dissensi'}
        </button>
        <button className="bottone text-[13px]" onClick={() => setAperto(false)}>
          Annulla
        </button>
      </div>
    </div>
  );
}

/** Banner persistente dopo una riapertura (§3.3). */
export function BannerRiapertura({
  riaperti,
  aValle,
  onRiconferma,
}: {
  riaperti: Lock[];
  aValle: Lock[];
  onRiconferma: (lockId: string) => void;
}) {
  if (riaperti.length === 0) return null;
  return (
    <div className="pannello px-4 py-2 flex items-center gap-4 flex-wrap" style={{ borderColor: 'var(--tension)' }}>
      {/* .mono solo su sigle e conteggi: la frase resta nel carattere di
          interfaccia, come nel resto del prodotto. */}
      <span className="text-[13px]" style={{ color: 'var(--tension)' }}>
        {riaperti.map((l, i) => (
          <span key={l.id}>
            {i > 0 && ' · '}
            <span className="mono">{l.modulo}</span> riaperto
          </span>
        ))}
        {' — '}
        <span className="mono">{aValle.length}</span>{' '}
        {aValle.length === 1 ? 'decisione a valle da riconvalidare' : 'decisioni a valle da riconvalidare'}
      </span>
      {aValle.map((l) => (
        <button key={l.id} className="bottone text-[13px]" onClick={() => onRiconferma(l.id)}>
          Riconferma <span className="mono">{l.modulo}</span> — {l.titolo}
        </button>
      ))}
      {riaperti.map((l) => (
        <button key={l.id} className="bottone text-[13px]" onClick={() => onRiconferma(l.id)}>
          Ri-blocca <span className="mono">{l.modulo}</span>
        </button>
      ))}
    </div>
  );
}
