import type { Config } from 'tailwindcss';

/**
 * I colori non sono definiti qui ma in src/styles/tokens.css come custom
 * properties. Tailwind si limita a esporli: cambiare un token cambia tutto,
 * e il tema resta ispezionabile dal browser senza ricompilare.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        deep: 'var(--bg-deep)',
        panel: 'var(--bg-panel)',
        raised: 'var(--bg-raised)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        'ink-dim': 'var(--ink-dim)',
        'ink-faint': 'var(--ink-faint)',
        wda: 'var(--wda)',
        'wda-bright': 'var(--wda-bright)',
        'wda-deep': 'var(--wda-deep)',
        live: 'var(--live)',
        tension: 'var(--tension)',
        erosion: 'var(--erosion)',
        locked: 'var(--locked)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        none: '0',
      },
      fontFamily: {
        sans: ['var(--font-ui)'],
        mono: ['var(--font-mono)'],
      },
      spacing: {
        grid: 'var(--grid)',
      },
    },
  },
  plugins: [],
};

export default config;
