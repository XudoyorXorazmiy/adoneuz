/**
 * Qaysi yuza (surface) — faqat hostdan. Sof, bog'liqliksiz: edge proxy ham ishlatadi.
 *
 *   adone.uz (+www)    landing (/sayt)
 *   app.adone.uz       ishxona paneli + Mini App /tg (tenant SESSIYADAN, hostdan emas)
 *   admin.adone.uz     super admin (/platforma, faqat is_platform_admin)
 *   boshqa host        landing (masalan Coolify sslip test manzili)
 *
 * Dev: ROOT_DOMAIN=localhost:3140 → app.localhost:3140, admin.localhost:3140.
 */
export const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'adone.uz';
export const APP_HOST = 'app';
export const PLATFORM_HOST = 'admin';

export type Surface = { kind: 'marketing' } | { kind: 'app' } | { kind: 'platform' };

const clean = (h: string) => h.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
const port = (root: string) => (/:\d+$/.exec(root)?.[0] ?? '');

export function surfaceFor(hostHeader: string | null | undefined, root = ROOT_DOMAIN): Surface {
  if (!hostHeader) return { kind: 'marketing' };
  const host = clean(hostHeader);
  const base = clean(root);
  if (host === `${APP_HOST}.${base}`) return { kind: 'app' };
  if (host === `${PLATFORM_HOST}.${base}`) return { kind: 'platform' };
  return { kind: 'marketing' };
}

function origin(label: string | null, root: string): string {
  const base = clean(root);
  const proto = base.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${label ? `${label}.` : ''}${base}${port(root)}`;
}
export const appOrigin = (root = ROOT_DOMAIN) => origin(APP_HOST, root);
export const platformOrigin = (root = ROOT_DOMAIN) => origin(PLATFORM_HOST, root);
export const marketingOrigin = (root = ROOT_DOMAIN) => origin(null, root);
/** Telegram webhook va Mini App uchun ommaviy manzil: prod'da https://app.adone.uz, dev'da PUBLIC_URL (tunnel). */
export const publicApiOrigin = () => process.env.PUBLIC_URL?.replace(/\/$/, '') || appOrigin();
