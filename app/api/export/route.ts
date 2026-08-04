/**
 * GET /api/export
 *
 * Il verbale in markdown, disponibile sempre — anche a ritiro in corso e con
 * moduli incompleti. Se cade tutto, il documento c'è comunque.
 *
 * Non restituisce stato: costruisce un testo. Nessun commit individuale finisce
 * nel verbale, solo le entità già materializzate al reveal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { caricaCommits, caricaStato, elencaBackup, leggiBackup } from '@/lib/store';
import { generaVerbale } from '@/lib/verbale';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;

  // Modalità panico: scarica stato come file, per riparare offline (§9).
  if (q.get('formato') === 'json') {
    const { version, state } = await caricaStato();
    const commits = await caricaCommits();
    return new NextResponse(JSON.stringify({ version, state, commits }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="wda-stato-${Date.now()}.json"`,
        'cache-control': 'no-store',
      },
    });
  }

  if (q.get('formato') === 'backup-list') {
    return NextResponse.json({ backup: await elencaBackup() });
  }

  if (q.get('formato') === 'backup') {
    const chiave = q.get('chiave') ?? '';
    const b = await leggiBackup(chiave);
    if (!b) return NextResponse.json({ errore: 'snapshot inesistente' }, { status: 404 });
    return NextResponse.json({ anteprima: riassunto(b.state), chiave });
  }

  const { state } = await caricaStato();
  const commits = await caricaCommits();
  const markdown = generaVerbale(state, commits);

  const scarica = q.get('scarica') === '1';
  return new NextResponse(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
      ...(scarica
        ? { 'content-disposition': `attachment; filename="verbale-wda-${new Date().toISOString().slice(0, 10)}.md"` }
        : {}),
    },
  });
}

function riassunto(state: {
  partecipanti: unknown[];
  sessioni: unknown[];
  lock: unknown[];
  azioni: unknown[];
  servizi: unknown[];
}) {
  return {
    partecipanti: state.partecipanti.length,
    sessioni: state.sessioni.length,
    lock: state.lock.length,
    azioni: state.azioni.length,
    servizi: state.servizi.length,
  };
}
