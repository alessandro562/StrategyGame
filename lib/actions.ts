/**
 * Unione discriminata delle azioni (§6.2).
 * Ogni mutazione dello stato passa da qui, viene validata in guards.ts
 * e applicata da un handler in handlers.ts.
 */

import type {
  Bucket,
  ColonnaQuadro,
  CommitPayload,
  Destinazione,
  Modulo,
  Orizzonte,
  OrizzonteQuadro,
  Profilo,
  RigaQuadro,
  Scenario,
  StatoSessione,
} from './types';

export type TipoEntita =
  | 'servizio'
  | 'attore'
  | 'competitor'
  | 'invariante'
  | 'azione'
  | 'partecipante'
  | 'asse'
  | 'trimestre';

export type Action =
  // L'ingresso al tavolo avviene in /api/auth: qui restano solo le mutazioni.
  | { type: 'participant.setPresence'; payload: { partecipanteId: string; presente: boolean } }
  | { type: 'workshop.rivendicaFacilitatore'; payload: Record<string, never> }
  | { type: 'workshop.setFacilitatore'; payload: { partecipanteId: string } }
  | { type: 'workshop.update'; payload: Record<string, unknown> }
  | { type: 'session.create'; payload: { modulo: Modulo; titolo: string; soggettoId?: string; revealAnonimo?: boolean; durataS?: number } }
  | { type: 'session.setState'; payload: { sessioneId: string; stato: StatoSessione } }
  | { type: 'session.startTimer'; payload: { sessioneId: string; durataS: number } }
  | { type: 'session.addTime'; payload: { sessioneId: string; secondi: number } }
  | { type: 'session.stopTimer'; payload: { sessioneId: string } }
  | { type: 'session.dealHats'; payload: { sessioneId: string } }
  | { type: 'session.reveal'; payload: { sessioneId: string } }
  | { type: 'session.setAnonimo'; payload: { sessioneId: string; revealAnonimo: boolean } }
  | { type: 'session.setRispondente'; payload: { sessioneId: string; rispondenteId: string } }
  // Il quadro d'insieme è l'unica lavagna a scrittura libera: chiunque aggiunge
  // una voce in qualsiasi casella, e ciascuno cancella le proprie (il
  // facilitatore cancella tutto). Non passa da entity.upsert proprio perché
  // quello è riservato al facilitatore.
  | { type: 'quadro.aggiungi'; payload: { riga: RigaQuadro; colonna: ColonnaQuadro; testo: string; orizzonte?: OrizzonteQuadro } }
  | { type: 'quadro.modifica'; payload: { id: string; testo: string } }
  | { type: 'quadro.rimuovi'; payload: { id: string } }
  | { type: 'commit.set'; payload: { sessioneId: string; payload: CommitPayload } }
  | { type: 'commit.confirm'; payload: { sessioneId: string } }
  | { type: 'discussion.note'; payload: { sessioneId: string; testo: string; privata?: boolean } }
  | { type: 'lock.create'; payload: { sessioneId: string; contenuto: unknown; dissensi?: { partecipanteId: string; nota: string }[]; aValle?: string[] } }
  | { type: 'lock.reopen'; payload: { lockId: string } }
  | { type: 'lock.reconfirm'; payload: { lockId: string } }
  | { type: 'servizio.setBucket'; payload: { servizioId: string; bucket: Bucket; valoreResiduo: 'MENO' | 'UGUALE_O_PIU' | 'NIENTE'; richiestoDa?: string } }
  | { type: 'servizio.setDestinazione'; payload: { servizioId: string; attivitaId: string; partecipanteId: string; valore: Destinazione } }
  | { type: 'servizio.setBasePrezzo'; payload: { servizioId: string; primaria: string; secondaria?: string; nota?: string } }
  | { type: 'attore.move'; payload: { attoreId: string; x: number; y: number } }
  | { type: 'vulnerabilita.close'; payload: { vulnerabilitaId: string } }
  | { type: 'azione.upsert'; payload: { id?: string; testo: string; ownerId: string; scadenza: string; orizzonte: Orizzonte; lockOrigine: string; stato?: 'APERTA' | 'FATTA' } }
  | { type: 'invariante.setScenario'; payload: { invarianteId: string; scenario: Scenario } }
  | { type: 'entity.upsert'; payload: { tipo: TipoEntita; dati: Record<string, unknown> } }
  | { type: 'entity.delete'; payload: { tipo: TipoEntita; id: string } }
  | { type: 'panic.restore'; payload: { chiave: string } }
  | { type: 'panic.write'; payload: { stato: unknown } }
  | { type: 'panic.reset'; payload: Record<string, never> };

export interface ActionEnvelope {
  actionId: string;
  pid: string;
  type: Action['type'];
  payload: Record<string, unknown>;
}

/** Azioni riservate al facilitatore (§6.2, marcate [facilitatore]). */
export const AZIONI_FACILITATORE: ReadonlySet<Action['type']> = new Set<Action['type']>([
  'workshop.setFacilitatore',
  'workshop.update',
  'session.create',
  'session.setState',
  'session.startTimer',
  'session.addTime',
  'session.stopTimer',
  'session.dealHats',
  'session.reveal',
  'session.setAnonimo',
  'session.setRispondente',
  'lock.create',
  'lock.reopen',
  'lock.reconfirm',
  'servizio.setBucket',
  'servizio.setDestinazione',
  'servizio.setBasePrezzo',
  'vulnerabilita.close',
  'azione.upsert',
  'invariante.setScenario',
  'entity.upsert',
  'entity.delete',
  'panic.restore',
  'panic.write',
  'panic.reset',
]);
