'use client';

/**
 * Schermata d'ingresso.
 *
 * È la prima cosa che vedono, in piedi, su un telefono, mentre qualcuno parla.
 * Quindi: un campo per volta nell'ordine in cui si pensa, tastiere giuste
 * (`inputMode`, `autoComplete`), nessuna regola di password da indovinare, e
 * l'errore scritto in italiano sotto il campo che lo ha causato.
 *
 * Registrazione e accesso stanno nella stessa schermata perché al primo giro
 * nessuno sa quale dei due gli serve.
 */

import { useState } from 'react';
import { Logo } from './Logo';

type Modo = 'registra' | 'entra';

export function Entra({
  onEntrato,
  nomiSuggeriti = [],
  compatto = false,
}: {
  onEntrato: () => void;
  nomiSuggeriti?: string[];
  compatto?: boolean;
}) {
  const [modo, setModo] = useState<Modo>('registra');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const invia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ azione: modo, nome, email, password }),
      });
      const dati = (await res.json()) as { errore?: string };
      if (!res.ok) {
        setErrore(dati.errore ?? 'Non è andata: riprova');
        return;
      }
      onEntrato();
    } catch {
      setErrore('Nessuna connessione. Controlla la rete e riprova.');
    } finally {
      setInCorso(false);
    }
  };

  const pronto = modo === 'entra' ? email && password : nome && email && password;

  return (
    <div
      className={compatto ? 'flex-1 flex flex-col justify-center' : 'min-h-[100dvh] flex items-center justify-center p-5'}
      style={{ background: 'var(--bg-deep)' }}
    >
      <div className="w-full" style={{ maxWidth: 380 }}>
        <div className="mb-7">
          <Logo altezza={30} />
          <p className="m-0 mt-3 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
            Strategy room — ritiro 5/6 agosto
          </p>
        </div>

        {/* Due modi, un solo posto: al primo giro non sai quale ti serve. */}
        <div className="flex gap-1 mb-5" role="tablist">
          {(['registra', 'entra'] as Modo[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={modo === m}
              className="flex-1 text-[15px]"
              style={{
                minHeight: 46,
                border: `1px solid ${modo === m ? 'var(--wda-bright)' : 'var(--line-strong)'}`,
                background: modo === m ? 'var(--wda-wash)' : 'transparent',
                color: modo === m ? 'var(--wda-bright)' : 'var(--ink-dim)',
              }}
              onClick={() => {
                setModo(m);
                setErrore(null);
              }}
            >
              {m === 'registra' ? 'Prima volta' : 'Ho già un accesso'}
            </button>
          ))}
        </div>

        <form onSubmit={invia} className="flex flex-col gap-4">
          {modo === 'registra' && (
            <Campo etichetta="Come ti chiami">
              <input
                className="w-full text-[17px]"
                style={{ minHeight: 50 }}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                autoCapitalize="words"
                placeholder="Il tuo nome"
                required
              />
              {nomiSuggeriti.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {nomiSuggeriti.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="bottone text-[13px]"
                      style={{ minHeight: 38 }}
                      aria-pressed={nome === n}
                      onClick={() => setNome(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </Campo>
          )}

          <Campo etichetta="Email">
            <input
              className="w-full text-[17px]"
              style={{ minHeight: 50 }}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@wda.it"
              required
            />
          </Campo>

          <Campo
            etichetta="Password"
            aiuto={modo === 'registra' ? 'Almeno 4 caratteri. Serve solo a ritrovarti, scegline una facile.' : undefined}
          >
            <input
              className="w-full text-[17px]"
              style={{ minHeight: 50 }}
              type="password"
              autoComplete={modo === 'registra' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Campo>

          {errore && (
            <div
              className="px-3 py-2 text-[14px]"
              role="alert"
              style={{ border: '1px solid var(--erosion)', color: 'var(--erosion)' }}
            >
              {errore}
            </div>
          )}

          <button
            type="submit"
            className="bottone bottone-primario text-[16px]"
            style={{ minHeight: 52 }}
            disabled={!pronto || inCorso}
          >
            {inCorso ? 'Un attimo…' : modo === 'registra' ? 'Entra nella stanza' : 'Entra'}
          </button>
        </form>

        <p className="m-0 mt-5 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          L’accesso serve a sapere di chi è ogni posizione. Durante il commit cieco nessuno vede le risposte degli
          altri, nemmeno chi proietta.
        </p>
      </div>
    </div>
  );
}

function Campo({
  etichetta,
  aiuto,
  children,
}: {
  etichetta: string;
  aiuto?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px]" style={{ color: 'var(--ink)' }}>
        {etichetta}
      </span>
      {children}
      {aiuto && (
        <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
          {aiuto}
        </span>
      )}
    </label>
  );
}
