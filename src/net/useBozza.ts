'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bozza locale del proprio commit.
 *
 * Il polling ha sempre un giro di ritardo. Senza una copia locale, due tocchi
 * ravvicinati leggono entrambi lo stesso stato vecchio e il secondo cancella il
 * primo: chi compila cinque righe con il pollice in dieci secondi si ritrova
 * con una sola scelta registrata. Non è un caso limite, è il modo normale di
 * usare la Mano.
 *
 * La bozza diventa autorevole al primo tocco e resta tale finché non cambia la
 * chiave (nuova sessione). Prima del primo tocco segue il server, così un
 * dispositivo che si ricollega ritrova quello che aveva già mandato.
 */
export function useBozzaCommit<T>(chiave: string, dalServer: T): [T, (agg: (b: T) => T) => T] {
  const [bozza, setBozza] = useState<T>(dalServer);
  const bozzaRef = useRef<T>(dalServer);
  const chiaveRef = useRef(chiave);
  const toccato = useRef(false);

  const serializzato = JSON.stringify(dalServer ?? null);

  useEffect(() => {
    const cambioChiave = chiaveRef.current !== chiave;
    if (cambioChiave) {
      chiaveRef.current = chiave;
      toccato.current = false;
    }
    if (cambioChiave || !toccato.current) {
      if (JSON.stringify(bozzaRef.current ?? null) !== serializzato) {
        bozzaRef.current = dalServer;
        setBozza(dalServer);
      }
    }
    // dalServer cambia identità a ogni polling: si confronta il contenuto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave, serializzato]);

  const aggiorna = useCallback((fn: (b: T) => T): T => {
    toccato.current = true;
    const nuova = fn(bozzaRef.current);
    bozzaRef.current = nuova;
    setBozza(nuova);
    return nuova;
  }, []);

  return [bozza, aggiorna];
}
