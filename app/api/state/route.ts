/**
 * GET /api/state?v={versione}&pv={firmaPresenza}&pid={partecipanteId}&r={codiceStanza}
 *
 *   204  versione e presenza invariate, nessun corpo
 *   200  { version, presence, state }  — state esce SOLO da filterStateFor()
 *   401  pid mancante o sconosciuto
 *
 * Questa route non serializza mai lo Store direttamente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ErroreGuardia, filterStateFor, verificaPid, verificaStanza } from '@/lib/guards';
import { transizioniPigre } from '@/lib/handlers';
import {
  caricaCommits,
  caricaStato,
  firmaPresenza,
  muta,
  presenze,
  segnalaPresenza,
  segretoAnonimo,
} from '@/lib/store';
import type { Ruolo } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const pid = q.get('pid');
  const ruolo: Ruolo = q.get('role') === 'tavolo' ? 'tavolo' : 'mano';
  const vClient = Number(q.get('v') ?? '-1');
  const pvClient = q.get('pv') ?? '';

  try {
    let { version, state } = await caricaStato();
    verificaStanza(state, q.get('r'));
    const pidValido = verificaPid(state, pid);

    // La presenza si deduce dal polling: nessuna connessione persistente (§9).
    await segnalaPresenza(pidValido);

    let commits = await caricaCommits();

    // Scadenza del timer: si applica alla prima lettura utile.
    const ora = Date.now();
    if (
      state.sessioni.some(
        (s) => s.stato === 'COMMIT' && s.timer?.avviatoA && ora >= s.timer.avviatoA + s.timer.durataS * 1000,
      )
    ) {
      try {
        version = await muta((s) => {
          transizioniPigre(s, commits, Date.now());
        });
      } catch {
        // Se un altro client ha già applicato la transizione va bene così:
        // al giro dopo la vediamo comunque.
      }
      ({ state } = await caricaStato());
      commits = await caricaCommits();
    }

    const visti = await presenze();
    const pv = firmaPresenza(visti);

    if (version === vClient && pv === pvClient) {
      return new NextResponse(null, { status: 204 });
    }

    const filtrato = filterStateFor({
      state,
      commits,
      pid: pidValido,
      ruolo,
      visti,
      ora: Date.now(),
      segretoAnonimo: await segretoAnonimo(),
    });

    return NextResponse.json(
      { version, presence: pv, state: filtrato },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (e) {
    if (e instanceof ErroreGuardia) {
      return NextResponse.json({ errore: e.message }, { status: e.stato });
    }
    return NextResponse.json({ errore: (e as Error).message }, { status: 500 });
  }
}
