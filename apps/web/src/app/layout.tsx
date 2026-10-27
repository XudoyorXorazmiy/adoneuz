import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });
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
