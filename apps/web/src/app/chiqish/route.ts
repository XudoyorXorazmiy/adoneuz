import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

export async function POST(req: Request) {
  // Proxy ortida req.url ichki manzil (http://…:3000) — ommaviy host va protokol forward sarlavhalaridan
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') === 'https' ? 'https' : new URL(req.url).protocol.replace(':', '');
  const url = host ? new URL('/kirish', `${proto}://${host}`) : new URL('/kirish', req.url);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
