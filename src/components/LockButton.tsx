'use client';

/**
 * §3.3 — il lock registra la decisione e i dissensi.
 * Il dissenso non viene cancellato dal lock: resta nel verbale.
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
    return (
      <button
        className="bottone bottone-primario"
        disabled={disabilitato}
        onClick={() => setAperto(true)}
        style={{ borderColor: 'var(--locked)', color: 'var(--locked)' }}
      >
        Blocca la decisione
      </button>
    );
  }

  const conNota = Object.entries(dissensi).filter(([, n]) => n.trim().length > 0);

  return (
    <div className="pannello p-4 flex flex-col gap-3" style={{ borderColor: 'var(--locked)' }}>
      <div className="etichetta" style={{ color: 'var(--locked)' }}>
        blocco della decisione
      </div>

      <div>
        <div className="etichetta mb-2">chi voleva altro, e cosa</div>
        <div className="flex flex-col gap-1">
          {partecipanti.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <span className="text-[13px] w-24 shrink-0" style={{ color: 'var(--ink-dim)' }}>
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
                className="bottone text-[12px]"
                aria-pressed={aValle.includes(l.id)}
                onClick={() =>
                  setAValle(aValle.includes(l.id) ? aValle.filter((x) => x !== l.id) : [...aValle, l.id])
                }
              >
                {l.modulo} — {l.titolo}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="bottone bottone-primario"
          style={{ borderColor: 'var(--locked)', color: 'var(--locked)' }}
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
          Blocca — {conNota.length} {conNota.length === 1 ? 'dissenso' : 'dissensi'}
        </button>
        <button className="bottone" onClick={() => setAperto(false)}>
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
      <span className="mono text-[13px]" style={{ color: 'var(--tension)' }}>
        {riaperti.map((l) => `${l.modulo} riaperto`).join(' · ')} — {aValle.length}{' '}
        {aValle.length === 1 ? 'decisione a valle da riconvalidare' : 'decisioni a valle da riconvalidare'}
      </span>
      {aValle.map((l) => (
        <button key={l.id} className="bottone text-[12px]" onClick={() => onRiconferma(l.id)}>
          Riconferma {l.modulo} — {l.titolo}
        </button>
      ))}
      {riaperti.map((l) => (
        <button key={l.id} className="bottone text-[12px]" onClick={() => onRiconferma(l.id)}>
          Ri-blocca {l.modulo}
        </button>
      ))}
    </div>
  );
}
