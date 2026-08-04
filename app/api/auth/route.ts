/**
 * POST /api/auth
 *   { azione: 'registra', nome, email, password }
 *   { azione: 'entra',    email, password }
 *   { azione: 'esci' }
 *
 * GET /api/auth  ->  { autenticato, io? }
 *
 * La sessione è un cookie httpOnly firmato dal server. Il client non lo legge
 * mai: sa chi è perché glielo dice /api/state.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_SESSIONE,
  DURATA_SESSIONE_S,
  EMAIL_MASTER,
  cifraPassword,
  emailValida,
  firmaSessione,
  leggiSessione,
  normalizzaEmail,
  validaRegistrazione,
  verificaPassword,
  type Utente,
} from '@/lib/auth';
import { caricaStato, leggiUtente, muta, salvaUtente, segretoAuth } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function nuovoIdUtente(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: NextRequest) {
  const pid = leggiSessione(req.cookies.get(COOKIE_SESSIONE)?.value, await segretoAuth());
  const { state } = await caricaStato();

  if (!pid) {
    // Solo i nomi dei posti ancora liberi, per far scegliere con un tocco
    // invece di far digitare. Nient'altro esce prima dell'accesso.
    const liberi = state.partecipanti.filter((p) => !p.id.startsWith('u-')).map((p) => p.nome);
    return NextResponse.json({ autenticato: false, nomi: liberi });
  }

  const p = state.partecipanti.find((x) => x.id === pid);
  return NextResponse.json({ autenticato: true, io: p ? { id: p.id, nome: p.nome } : { id: pid } });
}

export async function POST(req: NextRequest) {
  let corpo: { azione?: string; nome?: string; email?: string; password?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: 'corpo non valido' }, { status: 400 });
  }

  const azione = corpo.azione ?? 'entra';

  if (azione === 'esci') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESSIONE, '', { path: '/', maxAge: 0 });
    return res;
  }

  const email = normalizzaEmail(corpo.email ?? '');
  const password = corpo.password ?? '';

  if (azione === 'registra') {
    const nome = (corpo.nome ?? '').trim();
    const v = validaRegistrazione(nome, email, password);
    if (!v.ok) return NextResponse.json({ errore: v.errore }, { status: 400 });

    const esistente = await leggiUtente(email);
    if (esistente) {
      // Chi si registra due volte quasi sempre voleva rientrare: se la password
      // combacia lo si fa entrare invece di sbattergli in faccia un errore.
      if (verificaPassword(password, esistente.hash)) return await entra(esistente);
      return NextResponse.json({ errore: 'Email già registrata con un’altra password' }, { status: 409 });
    }

    const utente: Utente = {
      id: nuovoIdUtente(),
      nome,
      email,
      hash: cifraPassword(password),
      creatoA: Date.now(),
    };
    await salvaUtente(utente);
    await collegaAlTavolo(utente);
    return await entra(utente);
  }

  if (!emailValida(email) || !password) {
    return NextResponse.json({ errore: 'Email o password mancanti' }, { status: 400 });
  }

  const utente = await leggiUtente(email);
  // Stesso messaggio per utente inesistente e password sbagliata: non serve
  // dire a chi prova quale delle due ha indovinato.
  if (!utente || !verificaPassword(password, utente.hash)) {
    return NextResponse.json({ errore: 'Email o password non corretti' }, { status: 401 });
  }
  await collegaAlTavolo(utente);
  return await entra(utente);
}

async function entra(utente: Utente) {
  const token = firmaSessione(utente.id, await segretoAuth());
  const res = NextResponse.json({ ok: true, io: { id: utente.id, nome: utente.nome } });
  res.cookies.set(COOKIE_SESSIONE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURATA_SESSIONE_S,
  });
  return res;
}

/**
 * Collega l'account a un posto al tavolo.
 *
 * Se il nome corrisponde a qualcuno già in elenco — i sei del seed — l'account
 * prende quel posto invece di aggiungerne un settimo: altrimenti al primo round
 * il contatore direbbe "4 su 12" e i cappelli si distribuirebbero a fantasmi.
 * Il collegamento avviene una volta sola, alla prima entrata.
 */
async function collegaAlTavolo(utente: Utente): Promise<void> {
  const master = normalizzaEmail(utente.email) === normalizzaEmail(EMAIL_MASTER);

  await muta((s) => {
    const esistente = s.partecipanti.find((p) => p.id === utente.id);
    if (esistente) {
      if (master) esistente.master = true;
      return;
    }

    const perNome = s.partecipanti.find(
      (p) => p.nome.trim().toLowerCase() === utente.nome.trim().toLowerCase(),
    );
    if (perNome) {
      perNome.id = utente.id;
      if (master) perNome.master = true;
    } else {
      s.partecipanti.push({
        id: utente.id,
        nome: utente.nome,
        profilo: 'operativo',
        presente: true,
        socketConnesso: true,
        master: master || undefined,
      });
    }

    // Il primo che entra tiene il timone finché qualcuno non lo prende. Il
    // master non ne ha bisogno — eFacilitatore() gli dà i diritti comunque —
    // quindi non si intesta il ruolo, per non nascondere a chi è affidato in
    // quel momento sull'interfaccia.
    if (s.workshop.facilitatoreId === null && !master) s.workshop.facilitatoreId = utente.id;
  });
}
