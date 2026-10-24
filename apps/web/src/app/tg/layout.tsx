import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { currentTgUser } from '@/lib/tg/session';
import { TgAuth } from '@/components/tg/tg-auth';
import { TgReady } from '@/components/tg/tg-shell';

export const metadata: Metadata = { title: 'adone — Mini App', robots: { index: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover', themeColor: '#FFFFFF' };

/**
 * Telegram Mini App (xodim). Sessiya — initData'dan (lib/tg/session.ts), panel sessiyasi bilan aralashmaydi.
 * Sessiya bo'lmasa — avtorizatsiya ekrani (initData → /api/tg/auth).
 */
export default async function TgLayout({ children }: LayoutProps<'/tg'>) {
  const user = await currentTgUser();
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="afterInteractive" />
      <TgReady />
      {user ? children : <TgAuth />}
    </>
  );
}
