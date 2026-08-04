'use client';

/**
 * Il marchio WDA. I file in public/brand sono quelli caricati nel repository.
 *
 * Col fondo chiaro la variante di riferimento è la blu: la bianca sparisce
 * sul bianco. La bianca resta disponibile per le poche superfici piene
 * d'accento (un riempimento --wda sotto il marchio), e va chiesta a mano.
 */

/* eslint-disable @next/next/no-img-element */

export function Logo({ altezza = 20, variante = 'blu' }: { altezza?: number; variante?: 'bianco' | 'blu' }) {
  return (
    <img
      src={variante === 'bianco' ? '/brand/wda-logo-white.png' : '/brand/wda-logo-blue.png'}
      alt="WDA"
      height={altezza}
      // alignSelf: dentro un contenitore flex-col lo stretch di default allarga
      // l'immagine a tutta la larghezza schiacciandola: qui si tiene la
      // proporzione originale a prescindere dal contenitore in cui finisce.
      style={{ height: altezza, width: 'auto', display: 'block', alignSelf: 'flex-start', flexShrink: 0 }}
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
      style={{ height: altezza, width: 'auto', display: 'block', alignSelf: 'flex-start', flexShrink: 0 }}
    />
  );
}
