/**
 * Da dove il server sa chi sta parlando.
 *
 * Unico punto in cui si ricava l'identità di una richiesta: dal cookie firmato,
 * mai da un parametro nell'URL. Se un giorno tornasse un `pid` in query string,
 * questo file resta il posto da cui passa comunque tutto.
 */

import type { NextRequest } from 'next/server';
import { COOKIE_SESSIONE, leggiSessione } from './auth';
import { ErroreGuardia } from './guards';
import { segretoAuth } from './store';

export async function pidDallaSessione(req: NextRequest): Promise<string | null> {
  return leggiSessione(req.cookies.get(COOKIE_SESSIONE)?.value, await segretoAuth());
}

export async function pidRichiesto(req: NextRequest): Promise<string> {
  const pid = await pidDallaSessione(req);
  if (!pid) throw new ErroreGuardia(401, 'non autenticato');
  return pid;
}
