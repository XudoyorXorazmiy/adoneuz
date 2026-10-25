import type { Metadata } from 'next';
import { Fraunces, Inter_Tight, Martian_Mono } from 'next/font/google';

const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin', 'latin-ext'], axes: ['opsz'], display: 'swap' });
const interTight = Inter_Tight({ variable: '--font-inter-tight', subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], display: 'swap' });
const martian = Martian_Mono({ variable: '--font-martian', subsets: ['latin', 'latin-ext'], weight: ['400', '500'], display: 'swap' });

export const metadata: Metadata = {
  title: { absolute: 'adone — xodimlar davomati va vazifalari Telegram orqali' },
  description: "Xodim Telegram'da «Keldim» bosadi — adone joylashuv, jonli selfi, yuz va telefonni tekshiradi. Davomat, vazifalar, oylik tabel va ish haqi bitta tizimda. 14 kun bepul.",
  openGraph: { title: 'adone — kim ishda, kim kechikdi', description: "Davomat va vazifalar Telegram orqali: GPS, jonli selfi, yuz va qurilma tekshiruvi.", locale: 'uz_UZ', type: 'website', siteName: 'adone' },
};

/** Landing (adone.uz) — o'z shriftlari (design/landing): Fraunces sarlavha, Inter Tight matn, Martian Mono yorliqlar. */
export default function LandingLayout({ children }: LayoutProps<'/sayt'>) {
  return <div className={`${fraunces.variable} ${interTight.variable} ${martian.variable}`}>{children}</div>;
}
