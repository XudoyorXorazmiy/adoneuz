import 'server-only';
/** Profilim: o'z hisobi — ism, parol, Telegram, kirishlar. Faqat joriy foydalanuvchi o'zi uchun. */
import { and, desc, eq } from 'drizzle-orm';
import { auditLog, tgLinks, users, withTenant } from '@adone/db';
import { hashPassword, verifyPassword } from '@adone/db/password';
import { describeDevice, passwordProblem } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';

export interface MyAccount {
  name: string;
  phone: string;
  telegramSince: Date | null;
  logins: Array<{ label: string; icon: string; ip: string | null; at: Date }>;
}

export async function myAccount(user: TenantUser): Promise<MyAccount> {
  return withTenant(user.tenantId, async (tx) => {
    const [link] = await tx.select({ at: tgLinks.createdAt }).from(tgLinks).where(and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, user.id))).orderBy(desc(tgLinks.createdAt)).limit(1);
    const rows = await tx
      .select({ meta: auditLog.meta, at: auditLog.createdAt })
      .from(auditLog)
      .where(and(eq(auditLog.action, 'auth.login'), eq(auditLog.userId, user.id)))
      .orderBy(desc(auditLog.createdAt))
      .limit(4);
    return {
      name: user.name,
      phone: user.phone,
      telegramSince: link?.at ?? null,
      logins: rows.map((r) => ({ ...describeDevice(r.meta.ua as string | null), ip: (r.meta.ip as string | null) ?? null, at: r.at })),
    };
  });
}

async function audit(user: TenantUser, action: string) {
  await withTenant(user.tenantId, (tx) => tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action, entity: 'user', entityId: user.id }));
}

export async function updateMyName(user: TenantUser, name: string): Promise<string | null> {
  if (name.length < 2 || name.length > 80) return "Ismni to'liq kiriting";
  await withTenant(user.tenantId, (tx) => tx.update(users).set({ name }).where(eq(users.id, user.id)));
  await audit(user, 'account.name');
  return null;
}

/** Parol o'zgarsa `passwordChangedAt` suriladi — boshqa qurilmalardagi sessiyalar bekor bo'ladi; yangi vaqt qaytadi (joriy cookie qayta imzolanadi). */
export async function changeMyPassword(user: TenantUser, current: string, next: string): Promise<{ ok: true; changedAt: Date } | { ok: false; error: string }> {
  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem };
  return withTenant(user.tenantId, async (tx) => {
    const [u] = await tx.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!u || !(await verifyPassword(current, u.hash))) return { ok: false as const, error: "Joriy parol noto'g'ri" };
    if (current === next) return { ok: false as const, error: 'Yangi parol eskisidan farq qilsin' };
    const changedAt = new Date();
    await tx.update(users).set({ passwordHash: await hashPassword(next), passwordChangedAt: changedAt, mustChangePassword: false }).where(eq(users.id, user.id));
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'account.password', entity: 'user', entityId: user.id });
    return { ok: true as const, changedAt };
  });
}

/** Boshqa qurilmalardan chiqish — barcha sessiyalar bekor, joriysi yangi vaqt bilan qayta imzolanadi. */
export async function logoutOtherDevices(user: TenantUser): Promise<Date> {
  const changedAt = new Date();
  await withTenant(user.tenantId, async (tx) => {
    await tx.update(users).set({ passwordChangedAt: changedAt }).where(eq(users.id, user.id));
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'account.logout_all', entity: 'user', entityId: user.id });
  });
  return changedAt;
}

export async function unlinkMyTelegram(user: TenantUser): Promise<void> {
  await withTenant(user.tenantId, (tx) => tx.delete(tgLinks).where(and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, user.id))));
  await audit(user, 'account.telegram');
}
