import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { and, eq } from 'drizzle-orm';
import { branches, departments, employees, memberships, tenants, tgLinks, users, withPlatform, withTenant } from '@adone/db';
import { canUsePanel, type MemberRole } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';

/**
 * Mini App sessiyasi — panel sessiyasidan ALOHIDA (xodim panelga kirmaydi). initData tekshirilgach beriladi:
 * { tg: Telegram user id, tenantId, employeeId }. Har so'rovda bog'lanish (tg_links) va xodim holati qayta tekshiriladi —
 * xodim o'chirilsa yoki Telegram boshqa xodimga bog'lansa eski cookie darhol ishlamaydi.
 * Telegram Web (iframe) uchun SameSite=None; Secure (prod, https).
 */
export const TG_COOKIE = 'adone_tg';
const TTL = 12 * 3600;

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET sozlanmagan');
  return new TextEncoder().encode(`${s}:miniapp`);
};

/**
 * Xodim: { tg, t, e }; rahbar (panel foydalanuvchisi, tg_links kind=member): { tg, t, m }. Bo'lim boshlig'i bo'lgan xodimning
 * rahbar tomoni tokenda emas — `currentTgMember` xodim bog'lanishidan har so'rovda hisoblaydi (xodim va rahbar rejimlari).
 */
export async function signTgSession(c: { tg: number; tenantId: string; employeeId: string } | { tg: number; tenantId: string; userId: string }) {
  const payload = 'employeeId' in c ? { tg: c.tg, t: c.tenantId, e: c.employeeId } : { tg: c.tg, t: c.tenantId, m: c.userId };
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${TTL}s`).sign(key());
}

export const tgCookieOptions = () => {
  const secure = !(process.env.ROOT_DOMAIN ?? '').includes('localhost');
  return { httpOnly: true, secure, sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax', path: '/', maxAge: TTL };
};

export interface TgUser {
  tg: number;
  tenantId: string;
  tenantName: string;
  tz: string;
  employeeId: string;
  name: string;
  phone: string | null;
  position: string | null;
  departmentId: string | null;
  departmentName: string | null;
  branchId: string | null;
  branchName: string | null;
  status: string;
}

export const currentTgUser = cache(async (): Promise<TgUser | null> => {
  const token = (await cookies()).get(TG_COOKIE)?.value;
  if (!token) return null;
  let p: { tg?: unknown; t?: unknown; e?: unknown };
  try {
    p = (await jwtVerify(token, key())).payload as typeof p;
  } catch {
    return null;
  }
  if (typeof p.tg !== 'number' || typeof p.t !== 'string' || typeof p.e !== 'string') return null;
  const tg = p.tg, tenantId = p.t, employeeId = p.e;
  const [link] = await withPlatform((tx) =>
    tx.select({ status: tenants.status }).from(tgLinks).innerJoin(tenants, eq(tenants.id, tgLinks.tenantId))
      .where(and(eq(tgLinks.telegramUserId, tg), eq(tgLinks.tenantId, tenantId), eq(tgLinks.kind, 'employee'), eq(tgLinks.refId, employeeId))).limit(1),
  );
  if (!link || link.status === 'blocked' || link.status === 'archived') return null;
  return withTenant(tenantId, async (tx) => {
    const [r] = await tx
      .select({ e: employees, tenantName: tenants.name, tz: tenants.timezone, departmentName: departments.name, branchName: branches.name })
      .from(employees).innerJoin(tenants, eq(tenants.id, employees.tenantId))
      .leftJoin(departments, eq(departments.id, employees.departmentId)).leftJoin(branches, eq(branches.id, employees.branchId))
      .where(eq(employees.id, employeeId)).limit(1);
    if (!r || r.e.status === 'disabled' || r.e.telegramUserId !== tg) return null;
    return {
      tg, tenantId, tenantName: r.tenantName, tz: r.tz, employeeId, name: r.e.fullName, phone: r.e.phone, position: r.e.position,
      departmentId: r.e.departmentId, departmentName: r.departmentName, branchId: r.e.branchId, branchName: r.branchName, status: r.e.status,
    };
  });
});

/**
 * Rahbar Mini App sessiyasi (egasi, admin, bo'lim boshlig'i — xodim yozuvi bo'lmaganlar). Bog'lanish `tg_links kind=member`
 * (botda kontakt bilan tasdiqlangan), a'zolik faol va panelga kira oladigan rol. Panel server funksiyalari uchun `TenantUser` ko'rinishi.
 */
export interface TgMember {
  tg: number;
  tenantId: string;
  tenantName: string;
  tz: string;
  userId: string;
  name: string;
  phone: string;
  role: MemberRole;
}

export const currentTgMember = cache(async (): Promise<TgMember | null> => {
  const token = (await cookies()).get(TG_COOKIE)?.value;
  if (!token) return null;
  let p: { tg?: unknown; t?: unknown; m?: unknown; e?: unknown };
  try {
    p = (await jwtVerify(token, key())).payload as typeof p;
  } catch {
    return null;
  }
  if (typeof p.tg !== 'number' || typeof p.t !== 'string') return null;
  const tg = p.tg, tenantId = p.t;
  // Rahbarning o'z Telegram'i (m, kind=member) yoki xodim sessiyasi (e) — xodimga bog'langan faol rahbar hisobi (bo'lim boshlig'i).
  // Ikkinchisi har so'rovda hisoblanadi: boshliq tayinlansa/olinsa Mini App'ni qayta ochish shart emas.
  const viaEmployee = typeof p.m === 'string' ? null : typeof p.e === 'string' ? p.e : null;
  if (typeof p.m !== 'string' && !viaEmployee) return null;
  const [link] = await withPlatform((tx) =>
    tx.select({ status: tenants.status }).from(tgLinks).innerJoin(tenants, eq(tenants.id, tgLinks.tenantId))
      .where(and(eq(tgLinks.telegramUserId, tg), eq(tgLinks.tenantId, tenantId),
        viaEmployee ? and(eq(tgLinks.kind, 'employee'), eq(tgLinks.refId, viaEmployee)) : and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, p.m as string)))).limit(1),
  );
  if (!link || link.status === 'blocked' || link.status === 'archived') return null;
  return withTenant(tenantId, async (tx) => {
    let userId = p.m as string;
    if (viaEmployee) {
      const [e] = await tx.select({ userId: employees.userId, status: employees.status, tg: employees.telegramUserId }).from(employees).where(eq(employees.id, viaEmployee)).limit(1);
      if (!e?.userId || e.status !== 'active' || e.tg !== tg) return null;
      userId = e.userId;
    }
    const [r] = await tx
      .select({ name: users.name, phone: users.phone, active: users.isActive, role: memberships.role, mActive: memberships.isActive, tenantName: tenants.name, tz: tenants.timezone })
      .from(memberships).innerJoin(users, eq(users.id, memberships.userId)).innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId))).limit(1);
    if (!r || !r.active || !r.mActive || !canUsePanel(r.role)) return null;
    return { tg, tenantId, tenantName: r.tenantName, tz: r.tz, userId, name: r.name, phone: r.phone, role: r.role };
  });
});

/** Ikki rejimli sessiya (bo'lim boshlig'i xodim): qaysi ko'rinish ochiq. Standart — xodim (har kuni «Keldim»). */
export const TG_MODE_COOKIE = 'adone_tg_mode';

/**
 * Mini App ko'rinishi: `manager` — rahbar ekranlari (Bugun, Vazifalar nazorati, vazifa sahifasi rahbar sifatida).
 * Faqat rahbar — doim rahbar; faqat xodim — doim xodim; ikkalasi — `TG_MODE_COOKIE` bo'yicha.
 */
export const tgView = cache(async () => {
  const [u, m] = await Promise.all([currentTgUser(), currentTgMember()]);
  const mode = (await cookies()).get(TG_MODE_COOKIE)?.value;
  return { u, m, dual: !!u && !!m, manager: !!m && (!u || mode === 'rahbar') };
});

/** Panel server funksiyalari (`listDay`, `listLeaves`, `listTasks`…) uchun — o'sha foydalanuvchi, o'sha rol va bo'lim cheklovi. */
export function memberAsTenantUser(m: TgMember): TenantUser {
  return {
    id: m.userId, name: m.name, phone: m.phone, isPlatformAdmin: false, tenantId: m.tenantId, tenantName: m.tenantName,
    tenantStatus: 'active', tenantTimezone: m.tz, role: m.role, mustChangePassword: false,
  };
}

export async function assertTgMember(): Promise<TgMember> {
  const m = await currentTgMember();
  if (!m) throw new Error('Mini App sessiyasi tugagan — ilovani qaytadan oching');
  return m;
}

/** Server action'lar uchun: sessiya bo'lmasa xato (client «qayta oching» deydi). */
export async function assertTgUser(): Promise<TgUser> {
  const u = await currentTgUser();
  if (!u) throw new Error('Mini App sessiyasi tugagan — ilovani qaytadan oching');
  return u;
}
