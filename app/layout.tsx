import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WDA Strategy Room',
  description: 'Ritiro strategico WDA — 5/6 agosto 2026',
  icons: { icon: '/brand/wda-w-blue.png', apple: '/brand/wda-w-blue.png' },
};

export const viewport: Viewport = {
  themeColor: '#0b0e12',
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
