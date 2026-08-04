import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
