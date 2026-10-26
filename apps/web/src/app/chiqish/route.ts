import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

/** Proxy ortida req.url ichki manzil (http://…:3000) — ommaviy host va protokol forward sarlavhalaridan. */
function publicUrl(path: string, req: Request) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') === 'https' ? 'https' : new URL(req.url).protocol.replace(':', '');
  return host ? new URL(path, `${proto}://${host}`) : new URL(path, req.url);
}

export async function POST(req: Request) {
  const res = NextResponse.redirect(publicUrl('/kirish', req), 303);
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

/**
 * Manzil qo'lda ochilsa yoki eski havoladan kelinsa — 405 o'rniga ham chiqib, /kirish ga. Begona sayt <img>/<a> bilan
 * chiqarib yubormasin (CSRF): faqat o'z sahifamizdan (same-origin) yoki to'g'ridan-to'g'ri terilgan manzildan (none).
 */
export async function GET(req: Request) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return NextResponse.redirect(publicUrl('/', req), 303);
  return POST(req);
}
