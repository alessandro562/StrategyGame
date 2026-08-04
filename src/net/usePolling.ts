'use client';

/**
 * Polling adattivo, cache locale, coda offline (§2.5, §2.6, §6.4).
 *
 * Nessuna libreria realtime: con sette client che interrogano ogni secondo si
 * parla di sette richieste al secondo, e in cambio sparisce tutta la classe di
 * problemi legata a connessioni cadute e stato desincronizzato.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action } from '@/lib/actions';
import type { Ruolo, StatoFiltrato } from '@/lib/types';

export type StatoRete = 'connesso' | 'offline' | 'errore';

/** §2.5 — cadenza per stato della sessione. */
export const CADENZE = {
  COMMIT: 1000,
  REVEAL: 400,
  DISCUSSIONE: 2000,
  LOCKED: 2000,
  SETUP: 2000,
  SFONDO: 5000,
} as const;

interface AzioneInCoda {
  actionId: string;
  type: Action['type'];
  payload: Record<string, unknown>;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `a-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function leggiLS<T>(chiave: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const g = window.localStorage.getItem(chiave);
    return g ? (JSON.parse(g) as T) : fallback;
  } catch {
    return fallback;
  }
}

function scriviLS(chiave: string, valore: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(chiave, JSON.stringify(valore));
  } catch {
    /* quota piena: si prosegue senza cache */
  }
}

export interface Polling {
  stato: StatoFiltrato | null;
  version: number;
  rete: StatoRete;
  inCoda: number;
  /** true quando i dati vengono dalla cache locale e non dal server */
  soloLettura: boolean;
  invia: (type: Action['type'], payload?: Record<string, unknown>) => void;
  /** Differenza fra orologio server e orologio locale, in ms. */
  scarto: number;
  ora: () => number;
  /** Sessione assente o scaduta: la vista deve mostrare la schermata d'ingresso. */
  nonAutenticato: boolean;
  /** Da chiamare dopo un accesso riuscito, per ripartire subito. */
  riprendi: () => void;
}

export function usePolling(ruolo: Ruolo, stanza: string): Polling {
  const chiaveCache = `wda:cache:${ruolo}`;
  const chiaveCoda = `wda:coda:${ruolo}`;

  const [stato, setStato] = useState<StatoFiltrato | null>(() => leggiLS<StatoFiltrato | null>(chiaveCache, null));
  const [version, setVersion] = useState(-1);
  const [rete, setRete] = useState<StatoRete>('connesso');
  const [inCoda, setInCoda] = useState(0);
  const [soloLettura, setSoloLettura] = useState(true);
  const [scarto, setScarto] = useState(0);
  const [nonAutenticato, setNonAutenticato] = useState(false);

  const statoRef = useRef<StatoFiltrato | null>(null);
  const versionRef = useRef(-1);
  const presenceRef = useRef('');
  const codaRef = useRef<AzioneInCoda[]>([]);
  const inVoloRef = useRef(false);
  const forzaRef = useRef(false);
  const nonAutenticatoRef = useRef(false);

  useEffect(() => {
    codaRef.current = leggiLS<AzioneInCoda[]>(chiaveCoda, []);
    setInCoda(codaRef.current.length);
  }, [chiaveCoda]);

  const salvaCoda = useCallback(() => {
    scriviLS(chiaveCoda, codaRef.current);
    setInCoda(codaRef.current.length);
  }, [chiaveCoda]);

  /** Rigioca la coda in ordine. L'idempotenza su actionId rende sicuro
   *  ritentare anche quando la richiesta era passata ma la risposta no. */
  const svuotaCoda = useCallback(async (): Promise<boolean> => {
    while (codaRef.current.length > 0) {
      const azione = codaRef.current[0];
      try {
        const res = await fetch(`/api/action?r=${encodeURIComponent(stanza)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(azione),
        });
        if (res.status >= 500 || res.status === 0) return false;
        if (!res.ok) {
          // 4xx: l'azione non sarà mai accettata, tenerla in coda blocca tutto.
          console.warn('azione rifiutata', azione.type, res.status, await res.text());
        }
        codaRef.current.shift();
        salvaCoda();
      } catch {
        return false;
      }
    }
    return true;
  }, [salvaCoda, stanza]);

  const invia = useCallback(
    (type: Action['type'], payload: Record<string, unknown> = {}) => {
      codaRef.current.push({ actionId: uuid(), type, payload });
      salvaCoda();
      forzaRef.current = true;
      void svuotaCoda().then((ok) => {
        if (ok) forzaRef.current = true;
      });
    },
    [salvaCoda, svuotaCoda],
  );

  const riprendi = useCallback(() => {
    setNonAutenticato(false);
    forzaRef.current = true;
  }, []);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cadenza = (): number => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return CADENZE.SFONDO;
      const s = statoRef.current;
      if (!s) return CADENZE.COMMIT;
      const stati = s.sessioni.map((x) => x.stato);
      if (stati.includes('REVEAL')) return CADENZE.REVEAL;
      if (stati.includes('COMMIT')) return CADENZE.COMMIT;
      return CADENZE.DISCUSSIONE;
    };

    const giro = async () => {
      if (!vivo || inVoloRef.current) return;
      inVoloRef.current = true;
      try {
        const codaVuota = await svuotaCoda();
        const q = new URLSearchParams({
          v: String(versionRef.current),
          pv: presenceRef.current,
          role: ruolo,
          r: stanza,
        });
        const res = await fetch(`/api/state?${q}`, { cache: 'no-store' });

        if (res.status === 204) {
          setRete(codaVuota ? 'connesso' : 'offline');
          setSoloLettura(false);
          return;
        }
        if (res.status === 401) {
          // Nessuna sessione: non è un errore di rete, è che devi entrare.
          setNonAutenticato(true);
          setRete('connesso');
          return;
        }
        if (res.status === 404) {
          setRete('errore');
          return;
        }
        if (!res.ok) {
          setRete('errore');
          return;
        }

        const dati = (await res.json()) as { version: number; presence: string; state: StatoFiltrato };
        versionRef.current = dati.version;
        presenceRef.current = dati.presence;
        statoRef.current = dati.state;
        setVersion(dati.version);
        setStato(dati.state);
        setScarto(dati.state.serverNow - Date.now());
        setSoloLettura(false);
        setNonAutenticato(false);
        setRete(codaVuota ? 'connesso' : 'offline');
        scriviLS(chiaveCache, dati.state);
      } catch {
        // Rete caduta: il client resta leggibile con l'ultimo stato in cache.
        setRete('offline');
      } finally {
        inVoloRef.current = false;
      }
    };

    const ciclo = async () => {
      await giro();
      if (!vivo) return;
      // Senza sessione non ha senso martellare: si aspetta l'accesso.
      const attesa = forzaRef.current ? 60 : nonAutenticatoRef.current ? 3000 : cadenza();
      forzaRef.current = false;
      timer = setTimeout(ciclo, attesa);
    };

    const suVisibilita = () => {
      if (document.visibilityState === 'visible') {
        forzaRef.current = true;
        if (timer) clearTimeout(timer);
        void ciclo();
      }
    };

    void ciclo();
    document.addEventListener('visibilitychange', suVisibilita);
    window.addEventListener('online', suVisibilita);

    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', suVisibilita);
      window.removeEventListener('online', suVisibilita);
    };
  }, [ruolo, stanza, chiaveCache, svuotaCoda]);

  useEffect(() => {
    nonAutenticatoRef.current = nonAutenticato;
  }, [nonAutenticato]);

  const ora = useCallback(() => Date.now() + scarto, [scarto]);

  return { stato, version, rete, inCoda, soloLettura, invia, scarto, ora, nonAutenticato, riprendi };
}

/** Chiude la sessione e ripulisce la cache locale di questa vista. */
export async function esci(ruolo: Ruolo): Promise<void> {
  try {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ azione: 'esci' }),
    });
  } finally {
    window.localStorage.removeItem(`wda:cache:${ruolo}`);
    window.localStorage.removeItem(`wda:coda:${ruolo}`);
    window.location.reload();
  }
}
