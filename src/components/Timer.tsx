'use client';

/**
 * §3.4 — sempre visibile su Tavolo e Mano, sincronizzato dal server.
 * Il client non conta da solo: riceve avviatoA e durataS e calcola, usando
 * l'orologio del server corretto dallo scarto misurato al polling.
 */

import { useEffect, useRef, useState } from 'react';
import { secondiRimanenti } from '@/lib/calc';
import type { Sessione } from '@/lib/types';

export const SOGLIA_TENSIONE_S = 20;

function formatta(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** Suono singolo alla scadenza: niente file audio, un oscillatore basta. */
function suonaScadenza() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* audio non disponibile: il timer resta comunque visibile */
  }
}

export function Timer({
  sessione,
  ora,
  grande = false,
}: {
  sessione: Sessione | null;
  ora: () => number;
  grande?: boolean;
}) {
  const [rimanenti, setRimanenti] = useState<number | null>(null);
  const suonatoRef = useRef<string | null>(null);

  useEffect(() => {
    const tick = () => setRimanenti(secondiRimanenti(sessione?.timer ?? null, ora()));
    tick();
    const i = setInterval(tick, 250);
    return () => clearInterval(i);
  }, [sessione, ora]);

  useEffect(() => {
    if (rimanenti === 0 && sessione && suonatoRef.current !== sessione.id) {
      suonatoRef.current = sessione.id;
      suonaScadenza();
    }
    if (rimanenti !== null && rimanenti > 0 && sessione && suonatoRef.current === sessione.id) {
      suonatoRef.current = null;
    }
  }, [rimanenti, sessione]);

  const inTensione = rimanenti !== null && rimanenti <= SOGLIA_TENSIONE_S && rimanenti > 0;
  const scaduto = rimanenti === 0;
  const colore = scaduto ? 'var(--erosion)' : inTensione ? 'var(--tension)' : 'var(--ink)';

  return (
    // Grande, l'etichetta non può stare sulla stessa linea di base di un numero
    // da 200px: sale sopra, incolonnata al centro con le cifre.
    <div
      className={grande ? 'flex flex-col items-center gap-2' : 'flex items-baseline gap-2'}
      aria-live="off"
    >
      <span className="etichetta">timer</span>
      <time
        className="mono leading-none"
        style={{
          color: colore,
          fontSize: grande ? 'clamp(64px, 18vw, 200px)' : 22,
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        {rimanenti === null ? '--:--' : formatta(rimanenti)}
      </time>
    </div>
  );
}
