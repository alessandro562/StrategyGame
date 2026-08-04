'use client';

/**
 * Hook sullo stato sincronizzato. Un provider per vista (Tavolo o Mano);
 * i moduli leggono da qui e non sanno nulla del trasporto.
 */

import { createContext, useContext, useMemo } from 'react';
import type { Polling } from './usePolling';
import type {
  Cappello,
  Commit,
  Modulo,
  Partecipante,
  Sessione,
  Servizio,
  StatoFiltrato,
} from '@/lib/types';

export interface Contesto extends Polling {
  /** Sessione su cui il tavolo sta lavorando adesso. */
  sessioneAttiva: Sessione | null;
  partecipanti: Partecipante[];
  presenti: Partecipante[];
  io: Partecipante | null;
  nome: (pid: string) => string;
  servizio: (id?: string) => Servizio | null;
  commitsDi: (sessioneId: string) => Commit[];
  mioCommit: (sessioneId: string) => Commit | null;
  mioCappello: Cappello | null;
  sessioniDi: (modulo: Modulo) => Sessione[];
}

export const CtxStore = createContext<Contesto | null>(null);

export function useStore(): Contesto {
  const c = useContext(CtxStore);
  if (!c) throw new Error('useStore fuori dal provider');
  return c;
}

/** Ultima sessione creata che non sia ancora archiviata: è quella in corso. */
export function sessioneCorrente(stato: StatoFiltrato | null): Sessione | null {
  if (!stato || stato.sessioni.length === 0) return null;
  return [...stato.sessioni].sort((a, b) => b.ordine - a.ordine)[0];
}

export function costruisciContesto(polling: Polling): Contesto {
  const s = polling.stato;
  const attiva = sessioneCorrente(s);
  const partecipanti = s?.partecipanti ?? [];

  return {
    ...polling,
    sessioneAttiva: attiva,
    partecipanti,
    presenti: partecipanti.filter((p) => p.presente),
    io: partecipanti.find((p) => p.id === s?.io) ?? null,
    nome: (pid: string) =>
      pid.startsWith('anon-')
        ? pid.replace('anon-', 'Anonimo ')
        : (partecipanti.find((p) => p.id === pid)?.nome ?? pid),
    servizio: (id?: string) => s?.servizi.find((x) => x.id === id) ?? null,
    commitsDi: (sessioneId: string) => (s?.commits ?? []).filter((c) => c.sessioneId === sessioneId),
    mioCommit: (sessioneId: string) =>
      (s?.commits ?? []).find((c) => c.sessioneId === sessioneId && c.partecipanteId === s?.io) ?? null,
    mioCappello: attiva && s?.io ? (attiva.cappelli[s.io] ?? null) : null,
    sessioniDi: (modulo: Modulo) =>
      (s?.sessioni ?? []).filter((x) => x.modulo === modulo).sort((a, b) => a.ordine - b.ordine),
  };
}

export function useContestoMemo(polling: Polling): Contesto {
  return useMemo(
    () => costruisciContesto(polling),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [polling.stato, polling.version, polling.rete, polling.inCoda, polling.soloLettura, polling.scarto],
  );
}
