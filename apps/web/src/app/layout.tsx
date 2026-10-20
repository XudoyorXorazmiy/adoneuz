import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin', 'cyrillic'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: { default: 'adone — davomat va vazifalar', template: '%s · adone' },
  description: "Xodimlar davomati (lokatsiya, selfi, yuz tekshiruvi) va vazifalar nazorati — Telegram orqali.",
  metadataBase: new URL(`https://${process.env.ROOT_DOMAIN?.includes('localhost') ? 'adone.uz' : (process.env.ROOT_DOMAIN ?? 'adone.uz')}`),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F766E' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uz" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
