/**
 * POST /api/action
 * Corpo: { actionId, pid, type, payload }
 *
 * 200 { version }   il client forza subito il giro di polling successivo
 * 403 azione riservata al facilitatore
 * 409 conflitto di stato (es. commit dopo il reveal)
 *
 * actionId è un UUID del client: viene registrato con TTL di un'ora e i
 * doppioni sono scartati. È ciò che rende sicuro rigiocare la coda offline.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Action, ActionEnvelope } from '@/lib/actions';
import { ErroreGuardia, verificaAzione, verificaPid, verificaStanza } from '@/lib/guards';
import { applica } from '@/lib/handlers';
import {
  ConflittoDiScrittura,
  azzera,
  caricaCommit,
  caricaCommits,
  caricaStato,
  muta,
  registraAzione,
  ripristina,
  scriviCommit,
  scriviStatoGrezzo,
  snapshot,
  versioneCorrente,
} from '@/lib/store';
import type { Commit, CommitPayload, Store } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let busta: ActionEnvelope;
  try {
    busta = (await req.json()) as ActionEnvelope;
  } catch {
    return NextResponse.json({ errore: 'corpo non valido' }, { status: 400 });
  }

  const { actionId, pid, type, payload } = busta;
  if (!actionId || !type) {
    return NextResponse.json({ errore: 'actionId e type sono obbligatori' }, { status: 400 });
  }

  try {
    const { state } = await caricaStato();
    verificaStanza(state, req.nextUrl.searchParams.get('r'));

    // participant.join è l'unica azione che può arrivare da un pid non ancora
    // noto: è il momento in cui il pid entra nel tavolo.
    const pidValido = type === 'participant.join' ? (pid ?? '') : verificaPid(state, pid);
    if (!pidValido) return NextResponse.json({ errore: 'pid mancante' }, { status: 401 });

    const azione = { type, payload } as Action;
    verificaAzione(state, pidValido, azione);

    // Idempotenza: il doppione non viene applicato, ma la risposta resta 200
    // perché per il client l'effetto desiderato c'è già.
    const nuova = await registraAzione(actionId);
    if (!nuova) {
      return NextResponse.json({ version: await versioneCorrente(), duplicato: true });
    }

    const version = await esegui(azione, pidValido);
    return NextResponse.json({ version });
  } catch (e) {
    if (e instanceof ErroreGuardia) {
      return NextResponse.json({ errore: e.message }, { status: e.stato });
    }
    if (e instanceof ConflittoDiScrittura) {
      return NextResponse.json({ errore: e.message }, { status: 409 });
    }
    return NextResponse.json({ errore: (e as Error).message }, { status: 500 });
  }
}

async function esegui(azione: Action, pid: string): Promise<number> {
  switch (azione.type) {
    /* I commit vivono su chiavi separate: sei persone che scrivono insieme non
       si toccano mai, e nessuna scrittura può perdersi (§2.4). */
    case 'commit.set': {
      const precedente = await caricaCommit(azione.payload.sessioneId, pid);
      const commit: Commit = {
        sessioneId: azione.payload.sessioneId,
        partecipanteId: pid,
        payload: azione.payload.payload as CommitPayload,
        confermato: precedente?.confermato ?? false,
        aggiornatoA: Date.now(),
      };
      return scriviCommit(commit);
    }

    case 'commit.confirm': {
      const precedente = await caricaCommit(azione.payload.sessioneId, pid);
      if (!precedente) throw new ErroreGuardia(409, 'nessun commit da confermare');
      return scriviCommit({ ...precedente, confermato: true, aggiornatoA: Date.now() });
    }

    /* Modalità panico: agisce sulle chiavi, fuori dal lock ottimistico. */
    case 'panic.restore':
      return ripristina(azione.payload.chiave);

    case 'panic.reset':
      return azzera();

    case 'panic.write': {
      const s = azione.payload.stato as Store;
      validaStato(s);
      return scriviStatoGrezzo(s);
    }

    default: {
      const commits = await caricaCommits();
      const versione = await muta((s) => {
        applica({ state: s, pid, commits, ora: Date.now() }, azione);
      });

      // Ogni lock produce uno snapshot: in un ritiro di due giorni con un tool
      // costruito in fretta, poter tornare indietro è ciò che separa un
      // intoppo da un disastro (§9).
      if (azione.type === 'lock.create') await snapshot();

      return versione;
    }
  }
}

/** Validazione minima ma reale prima di scrivere uno stato modificato a mano. */
function validaStato(s: unknown): asserts s is Store {
  if (!s || typeof s !== 'object') throw new ErroreGuardia(400, 'stato non valido');
  const richiesti = [
    'workshop',
    'partecipanti',
    'sessioni',
    'servizi',
    'attori',
    'flussi',
    'competitor',
    'soglie',
    'invarianti',
    'azioni',
    'lock',
  ];
  for (const k of richiesti) {
    if (!(k in (s as Record<string, unknown>))) {
      throw new ErroreGuardia(400, `stato non valido: manca "${k}"`);
    }
  }
  const arrays = richiesti.filter((k) => k !== 'workshop');
  for (const k of arrays) {
    if (!Array.isArray((s as Record<string, unknown>)[k])) {
      throw new ErroreGuardia(400, `stato non valido: "${k}" deve essere una lista`);
    }
  }
}
