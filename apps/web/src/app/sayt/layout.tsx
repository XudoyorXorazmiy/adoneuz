import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import localFont from 'next/font/local';

const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin', 'latin-ext'], axes: ['opsz'], display: 'swap' });
// Inter Tight — lokal: Google ba'zan `/l/font?kit=…&skey=…` havolasini beradi, Turbopack uni o'qiy olmay build yiqiladi.
// Google'ning latin to'plami (variable, 400–600) — o'zbek lotini (ʻ U+02BB, ’ U+2019) shu ichida.
const interTight = localFont({ variable: '--font-inter-tight', src: './fonts/inter-tight-latin.woff2', weight: '400 600', display: 'swap' });
// Martian Mono ham lokal (2026-11-05): Google CSS'dagi havolani Turbopack o'qiy olmay build yiqildi (Inter Tight bilan bir xil sabab). Latin, variable 400–500.
const martian = localFont({ variable: '--font-martian', src: './fonts/martian-mono-latin.woff2', weight: '400 500', display: 'swap' });

export const metadata: Metadata = {
  title: { absolute: 'adone — xodimlar davomati va vazifalari Telegram orqali' },
  description: "Xodim Telegram'da «Keldim» bosadi — adone joylashuv, jonli selfi, yuz va telefonni tekshiradi. Davomat, vazifalar, oylik tabel va ish haqi bitta tizimda. 14 kun bepul.",
  openGraph: { title: 'adone — kim ishda, kim kechikdi', description: "Davomat va vazifalar Telegram orqali: GPS, jonli selfi, yuz va qurilma tekshiruvi.", locale: 'uz_UZ', type: 'website', siteName: 'adone' },
};

/** Landing (adone.uz) — o'z shriftlari (design/landing): Fraunces sarlavha, Inter Tight matn, Martian Mono yorliqlar. */
export default function LandingLayout({ children }: LayoutProps<'/sayt'>) {
  return <div className={`${fraunces.variable} ${interTight.variable} ${martian.variable}`}>{children}</div>;
}
