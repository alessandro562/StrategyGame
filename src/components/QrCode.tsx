'use client';

/**
 * §2.8 — il Tavolo mostra in permanenza un QR verso /mano, così chi perde la
 * connessione rientra in due secondi senza chiedere niente a nessuno.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ url, lato = 132 }: { url: string; lato?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // Il codice viene disegnato dentro un PNG, e un PNG non conosce le
    // variabili CSS: i due colori si leggono dai token a runtime invece di
    // essere scritti a mano qui, così restano uno solo posto anche se il tema
    // cambia ancora. Se i token non ci fossero, l'opzione si omette e la
    // libreria usa il suo nero su bianco, che si legge comunque.
    const radice = getComputedStyle(document.documentElement);
    const scuro = radice.getPropertyValue('--ink').trim();
    const chiaro = radice.getPropertyValue('--bg-deep').trim();

    const opzioni = { width: lato * 2, margin: 1, errorCorrectionLevel: 'M' as const };

    // Il QR si legge col modulo scuro su fondo chiaro: invertirlo rompe molti
    // lettori di fotocamera, che non tutti gestiscono il negativo.
    // Se un token smettesse di essere un colore che la libreria sa leggere,
    // toDataURL rifiuta: senza rete di sicurezza il QR resterebbe bianco per
    // sempre, e il QR è la via di rientro di chi cade dalla stanza. Al
    // fallimento si ridisegna col nero su bianco della libreria, che si legge.
    void QRCode.toDataURL(url, {
      ...opzioni,
      color: scuro && chiaro ? { dark: scuro, light: chiaro } : undefined,
    })
      .catch(() => QRCode.toDataURL(url, opzioni))
      .then((d) => {
        if (vivo) setDataUrl(d);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [url, lato]);

  return (
    <div className="flex flex-col items-center gap-2">
      {dataUrl ? (
        // Il filetto chiude il quadrato bianco del QR: senza, sopra un pannello
        // appena grigio il codice sembra una macchia senza bordi.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`QR verso ${url}`}
          width={lato}
          height={lato}
          style={{ display: 'block', border: '1px solid var(--line)' }}
        />
      ) : (
        <div
          style={{ width: lato, height: lato, background: 'var(--bg-raised)', border: '1px solid var(--line)' }}
        />
      )}
      <span
        className="mono text-[13px] break-all text-center"
        style={{ color: 'var(--ink-dim)', maxWidth: lato + 40 }}
      >
        {url.replace(/^https?:\/\//, '')}
      </span>
    </div>
  );
}
