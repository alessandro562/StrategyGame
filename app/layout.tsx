import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

/**
 * Geist e Geist Mono, non lo stack di sistema.
 *
 * La specifica vieta Inter e Roboto e chiede un grottesco svizzero con un mono
 * a cifre tabulari: Geist è esattamente quello, disegnato per interfacce dense
 * e strumentali. Il mono ha le cifre della stessa larghezza, che è la ragione
 * per cui i numeri non ballano mentre si aggiornano in tempo reale.
 *
 * Arriva dal pacchetto npm, che porta i file con sé, e non da next/font/google
 * che li scaricherebbe durante il build: a due giorni dal ritiro un build che
 * dipende dalla rete è un rischio che non vale la pena correre.
 */

export const metadata: Metadata = {
  title: 'WDA Strategy Room',
  description: 'Ritiro strategico WDA — 5/6 agosto 2026',
  icons: { icon: '/brand/wda-w-blue.png', apple: '/brand/wda-w-blue.png' },
};

export const viewport: Viewport = {
  // I metadati non leggono le custom properties: questo valore è la copia
  // letterale di --bg-deep e va tenuto allineato a mano se il token cambia.
  themeColor: '#ffffff',
  // Il tema è chiaro e basta. Senza dichiararlo, un telefono in modalità scura
  // ridipinge da sé i controlli nativi — campi, menù a tendina, barre di
  // scorrimento — e restano scuri dentro un'interfaccia bianca.
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
