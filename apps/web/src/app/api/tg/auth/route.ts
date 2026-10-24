import { NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/tg/init-data';
import { signTgSession, TG_COOKIE, tgCookieOptions } from '@/lib/tg/session';
import { employeeLinks } from '@/server/bot/links';
import { allow } from '@/server/rate-limit';

/**
 * Mini App kirishi: POST { initData, tenantId? } → imzo tekshiriladi (bot tokeni bilan), Telegram user → xodim bog'lanishi
 * (tg_links). Bir nechta ishxona bo'lsa — ro'yxat qaytadi, client tanlaydi. Tenant FAQAT bog'lanishdan, so'rovdan emas (§1.1).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { initData?: string; tenantId?: string };
  const v = verifyInitData(String(body.initData ?? ''), process.env.PLATFORM_BOT_TOKEN ?? '');
  if (!v) return NextResponse.json({ error: 'Telegram imzosi yaroqsiz. Ilovani bot orqali qayta oching.' }, { status: 401 });
  if (!(await allow(`tg-auth:${v.user.id}`, 30, 600))) return NextResponse.json({ error: 'Juda ko‘p urinish' }, { status: 429 });
  const links = await employeeLinks(v.user.id);
  if (links.length === 0) return NextResponse.json({ error: 'Siz hali ro‘yxatdan o‘tmagansiz. Rahbaringizdan taklif havolasini so‘rang.' }, { status: 403 });
  const link = body.tenantId ? links.find((l) => l.tenantId === body.tenantId) : links.length === 1 ? links[0] : null;
  if (!link) return NextResponse.json({ pick: links.map((l) => ({ tenantId: l.tenantId, name: l.tenantName })) });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TG_COOKIE, await signTgSession({ tg: v.user.id, tenantId: link.tenantId, employeeId: link.employeeId }), tgCookieOptions());
  return res;
}
