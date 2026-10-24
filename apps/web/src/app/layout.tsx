import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: { default: 'adone — davomat va vazifalar', template: '%s · adone' },
  description: "Xodimlar davomati (lokatsiya, selfi, yuz tekshiruvi) va vazifalar nazorati — Telegram orqali.",
  metadataBase: new URL(`https://${process.env.ROOT_DOMAIN?.includes('localhost') ? 'adone.uz' : (process.env.ROOT_DOMAIN ?? 'adone.uz')}`),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2443F5' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uz" className={jakarta.variable}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0&display=block" />
      </head>
      <body>{children}</body>
    </html>
  );
}
