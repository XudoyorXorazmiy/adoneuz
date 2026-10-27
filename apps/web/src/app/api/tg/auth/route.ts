import { NextResponse } from 'next/server';
import { verifyInitData } from '@/lib/tg/init-data';
import { signTgSession, TG_COOKIE, tgCookieOptions } from '@/lib/tg/session';
import { employeeLinks, memberLinks } from '@/server/bot/links';
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
  const res = NextResponse.json({ ok: true });
  if (links.length > 0) {
    const link = body.tenantId ? links.find((l) => l.tenantId === body.tenantId) : links.length === 1 ? links[0] : null;
    if (!link) return NextResponse.json({ pick: links.map((l) => ({ tenantId: l.tenantId, name: l.tenantName })) });
    // Bo'lim boshlig'i bo'lsa rahbar rejimi ham ochiladi — sessiyadan har so'rovda hisoblanadi (lib/tg/session.ts)
    res.cookies.set(TG_COOKIE, await signTgSession({ tg: v.user.id, tenantId: link.tenantId, employeeId: link.employeeId }), tgCookieOptions());
    return res;
  }
  // Xodim emas, lekin rahbar (egasi/admin/bo'lim boshlig'i, botda kontakt bilan bog'langan) — rahbar ko'rinishi
  const members = await memberLinks(v.user.id);
  if (members.length === 0) {
    return NextResponse.json({ error: 'Siz hali ro‘yxatdan o‘tmagansiz. Xodim bo‘lsangiz — rahbaringizdan taklif havolasini so‘rang; rahbar bo‘lsangiz — panelda Sozlamalar → Profilim → Telegram orqali ulaning.' }, { status: 403 });
  }
  const m = body.tenantId ? members.find((l) => l.tenantId === body.tenantId) : members.length === 1 ? members[0] : null;
  if (!m) return NextResponse.json({ pick: members.map((l) => ({ tenantId: l.tenantId, name: l.tenantName })) });
  res.cookies.set(TG_COOKIE, await signTgSession({ tg: v.user.id, tenantId: m.tenantId, userId: m.userId }), tgCookieOptions());
  return res;
}
