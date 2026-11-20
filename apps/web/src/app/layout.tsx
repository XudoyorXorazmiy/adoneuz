import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Plus Jakarta Sans — lokal (2026-11-20): Google Fonts javobi tasodifiy buzilib (`/l/font?kit=…`) build yiqilardi (2026-11-19 deploy).
// Google'ning latin to'plami (variable, 200–800) — o'zbek lotini (ʻ U+02BB, ’ U+2019) shu ichida; kirill tizim shriftida.
const jakarta = localFont({ variable: '--font-jakarta', src: './fonts/plus-jakarta-sans-latin.woff2', weight: '200 800', display: 'swap' });
// Ikonkalar (Material Symbols Rounded): faqat ishlatilganlari, o'z serverimizdan — scripts/icons.mjs (dev/build oldidan)
const icons = localFont({ src: './fonts/material-symbols.woff2', variable: '--font-icons', weight: '300 600', display: 'block', preload: false, adjustFontFallback: false, fallback: [] });

export const metadata: Metadata = {
  title: { default: 'adone — davomat va vazifalar', template: '%s · adone' },
  description: "Xodimlar davomati (lokatsiya, selfi, yuz tekshiruvi) va vazifalar nazorati — Telegram orqali.",
  metadataBase: new URL(`https://${process.env.ROOT_DOMAIN?.includes('localhost') ? 'adone.uz' : (process.env.ROOT_DOMAIN ?? 'adone.uz')}`),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2443F5' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uz" className={`${jakarta.variable} ${icons.variable}`}>
      <body>{children}</body>
    </html>
  );
}
