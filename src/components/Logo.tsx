'use client';

/**
 * Il marchio WDA. I file in public/brand sono quelli caricati nel repository:
 * la variante bianca è l'unica leggibile sui fondi scuri della control room,
 * la blu resta per eventuali superfici chiare (stampe, export).
 */

/* eslint-disable @next/next/no-img-element */

export function Logo({ altezza = 20, variante = 'bianco' }: { altezza?: number; variante?: 'bianco' | 'blu' }) {
  return (
    <img
      src={variante === 'bianco' ? '/brand/wda-logo-white.png' : '/brand/wda-logo-blue.png'}
      alt="WDA"
      height={altezza}
      style={{ height: altezza, width: 'auto', display: 'block' }}
    />
  );
}

export function Monogramma({ altezza = 24, variante = 'blu' }: { altezza?: number; variante?: 'bianco' | 'blu' }) {
  return (
    <img
      src={variante === 'bianco' ? '/brand/wda-w-white.png' : '/brand/wda-w-blue.png'}
      alt=""
      aria-hidden
      height={altezza}
      style={{ height: altezza, width: 'auto', display: 'block' }}
    />
  );
}
