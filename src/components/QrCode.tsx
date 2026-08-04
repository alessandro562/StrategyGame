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
    void QRCode.toDataURL(url, {
      width: lato * 2,
      margin: 1,
      // Il QR si legge col modulo scuro su fondo chiaro: invertirlo rompe molti
      // lettori di fotocamera, che non tutti gestiscono il negativo.
      color: { dark: '#14181dff', light: '#ffffffff' },
      errorCorrectionLevel: 'M',
    }).then((d) => {
      if (vivo) setDataUrl(d);
    });
    return () => {
      vivo = false;
    };
  }, [url, lato]);

  return (
    <div className="flex flex-col items-center gap-2">
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={`QR verso ${url}`} width={lato} height={lato} style={{ display: 'block' }} />
      ) : (
        <div style={{ width: lato, height: lato, background: 'var(--bg-raised)' }} />
      )}
      <span className="mono text-[11px] break-all text-center" style={{ color: 'var(--ink-faint)', maxWidth: lato + 40 }}>
        {url.replace(/^https?:\/\//, '')}
      </span>
    </div>
  );
}
