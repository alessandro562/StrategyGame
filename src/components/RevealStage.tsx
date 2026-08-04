'use client';

/**
 * §3.2 — l'unico momento coreografato dell'intero prodotto.
 *
 * Tutti i commit compaiono insieme, con stagger di 80ms, in ordine casuale:
 * non alfabetico, non per ordine di conferma — l'ordine non deve suggerire
 * nulla. Durata totale sotto i 600ms. Rispetta prefers-reduced-motion.
 *
 * La partenza è agganciata a revealAt (orario del server), non alla ricezione:
 * è ciò che fa partire l'animazione insieme su sei dispositivi anche se le
 * risposte del polling arrivano scaglionate.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { mescolaConSeme } from '@/lib/calc';

export const STAGGER_MS = 80;
export const DURATA_MS = 260;

export function useRevealPartito(revealAt: number | null | undefined, ora: () => number): boolean {
  const [partito, setPartito] = useState(false);

  useEffect(() => {
    if (!revealAt) {
      setPartito(false);
      return;
    }
    const attesa = revealAt - ora();
    if (attesa <= 0) {
      setPartito(true);
      return;
    }
    setPartito(false);
    const t = setTimeout(() => setPartito(true), attesa);
    return () => clearTimeout(t);
  }, [revealAt, ora]);

  return partito;
}

export function RevealStage<T>({
  elementi,
  seme,
  partito,
  chiave,
  render,
  className = '',
}: {
  elementi: T[];
  seme: string;
  partito: boolean;
  chiave: (e: T, i: number) => string;
  render: (e: T, i: number) => React.ReactNode;
  className?: string;
}) {
  const ridotto = useReducedMotion();
  // Mescolato con seme di sessione: casuale ma identico su tutti gli schermi.
  const ordinati = mescolaConSeme(elementi, seme);

  return (
    <div className={className}>
      {ordinati.map((e, i) => (
        <motion.div
          key={chiave(e, i)}
          initial={ridotto ? false : { opacity: 0, y: 6 }}
          animate={partito ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{
            duration: ridotto ? 0 : DURATA_MS / 1000,
            delay: ridotto || !partito ? 0 : Math.min(i, 5) * (STAGGER_MS / 1000),
            ease: [0.2, 0, 0, 1],
          }}
        >
          {render(e, i)}
        </motion.div>
      ))}
    </div>
  );
}
