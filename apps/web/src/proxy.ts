/**
 * Kirish eshigi. Bitta deploy landing, ishxona paneli va super admin'ga xizmat qiladi; host ularni ajratadi (lib/host.ts).
 * Edge: faqat jose, baza yo'q. Bu darvoza, hakam emas — holat tekshiruvi (a'zolik faol, ishxona bloklanmagan,
 * parol o'zgarmagan) Node tomonida currentUser() da.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';
import { verifySession } from '@/lib/auth/tokens';
import { surfaceFor } from '@/lib/host';

const MARKETING = '/sayt';
const PLATFORM = '/platforma';
const INTERNAL = [MARKETING, PLATFORM];
// Har hostda o'z-o'zidan autentifikatsiya qiladigan yo'llar (Telegram webhook siri, CRON_SECRET, Mini App initData).
const PASS = ['/api'];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PASS.some((p) => under(pathname, p))) return NextResponse.next();

  // Server action redirect'dan keyin Next ichki fetch qiladi va Host yo'qolishi mumkin — asl host forward qilinadi.
  const originalHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const surface = surfaceFor(originalHost);
  const reqHeaders = new Headers(req.headers);
  if (originalHost) reqHeaders.set('x-forwarded-host', originalHost);
  const forward = { request: { headers: reqHeaders } };

  switch (surface.kind) {
    case 'marketing':
      if (under(pathname, PLATFORM) || under(pathname, '/tg')) return notFound(req);
      return rewriteTo(req, prefixed(pathname, MARKETING), forward);
    case 'platform': {
      if (under(pathname, MARKETING) || under(pathname, '/tg')) return notFound(req);
      if (pathname === '/chiqish') return NextResponse.next(forward); // umumiy chiqish route'i (app/chiqish)
      const target = prefixed(pathname, PLATFORM);
      if (target === `${PLATFORM}/kirish`) return rewriteTo(req, target, forward);
      const claims = await claimsFrom(req);
      if (claims?.platform) return rewriteTo(req, target, forward);
      return clear(redirectTo(req, '/kirish'));
    }
    case 'app': {
      if (INTERNAL.some((p) => under(pathname, p))) return notFound(req);
      if (pathname === '/kirish') return NextResponse.next(forward);
      // Chiqish sessiya eskirgan bo'lsa ham ishlaydi — aks holda /kirish?next=/chiqish bo'lib, kirgandan keyin 405
      if (pathname === '/chiqish') return NextResponse.next(forward);
      // Mini App: o'z sessiyasi (initData → adone_tg cookie), panel sessiyasi talab qilinmaydi
      if (under(pathname, '/tg')) return NextResponse.next(forward);
      const claims = await claimsFrom(req);
      if (claims?.tenantId && !claims.platform) return NextResponse.next(forward);
      const res = redirectTo(req, '/kirish');
      if (pathname !== '/') res.headers.set('Location', `${res.headers.get('Location')}?next=${encodeURIComponent(pathname)}`);
      return clear(res);
    }
  }
}

type Forward = { request: { headers: Headers } };

function prefixed(pathname: string, prefix: string): string {
  return pathname === '/' ? prefix : under(pathname, prefix) ? pathname : `${prefix}${pathname}`;
}
function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
async function claimsFrom(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}
function rewriteTo(req: NextRequest, path: string, forward?: Forward) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  return NextResponse.rewrite(url, forward);
}
function redirectTo(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  return NextResponse.redirect(url);
}
function notFound(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/topilmadi';
  return NextResponse.rewrite(url, { status: 404 });
}
function clear(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
