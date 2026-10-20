import 'server-only';
import { and, eq } from 'drizzle-orm';
import { memberships, tenants, users, withAuth } from '@adone/db';
import { verifyPassword } from '@adone/db/password';
import { canUsePanel } from '@adone/core';
import type { SessionClaims } from './tokens';

type LoginResult = { ok: true; claims: SessionClaims } | { ok: false; error: string };

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const INVALID = "Telefon raqam yoki parol noto'g'ri";
// Mavjud bo'lmagan login uchun ham scrypt hisoblanadi — vaqt bo'yicha akkaunt borligi bilinmasin.
const DUMMY_HASH = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

async function checkPassword(u: typeof users.$inferSelect | undefined, password: string) {
  if (!u) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false as const, error: INVALID };
  }
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    return { ok: false as const, error: `Ko'p marta xato kiritildi. ${LOCK_MINUTES} daqiqadan keyin urinib ko'ring.` };
  }
  if (!u.isActive || !(await verifyPassword(password, u.passwordHash))) return { ok: false as const, error: INVALID, failed: true };
  return { ok: true as const };
}

async function registerFailure(tx: Parameters<Parameters<typeof withAuth>[0]>[0], u: typeof users.$inferSelect) {
  const failed = u.failedLogins + 1;
  await tx
    .update(users)
    .set({ failedLogins: failed >= LOCK_AFTER ? 0 : failed, lockedUntil: failed >= LOCK_AFTER ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
    .where(eq(users.id, u.id));
}

/** Ishxona paneli: telefon + parol → panelga kira oladigan birinchi faol a'zolik (xodim — faqat Telegram). */
export async function loginTenantUser(phone: string, password: string): Promise<LoginResult> {
  return withAuth(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.phone, phone)).limit(1);
    const chk = await checkPassword(u, password);
    if (!chk.ok) {
      if ('failed' in chk && u) await registerFailure(tx, u);
      return { ok: false, error: chk.error };
    }
    const rows = await tx
      .select({ tenantId: tenants.id, status: tenants.status, role: memberships.role })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(and(eq(memberships.userId, u!.id), eq(memberships.isActive, true)));
    const panel = rows.filter((r) => canUsePanel(r.role));
    if (rows.length && !panel.length) return { ok: false, error: 'Xodimlar Telegram bot orqali ishlaydi. Panel faqat rahbarlar uchun.' };
    const m = panel.find((r) => r.status === 'active' || r.status === 'trial') ?? panel[0];
    if (!m) return { ok: false, error: u!.isPlatformAdmin ? 'Super admin admin.adone.uz orqali kiradi' : "Bu raqamga ishxona biriktirilmagan" };
    if (m.status === 'blocked' || m.status === 'archived') return { ok: false, error: 'Ishxona hisobi bloklangan. Qo‘llab-quvvatlashga yozing.' };
    await tx.update(users).set({ lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(users.id, u!.id));
    return { ok: true, claims: { sub: u!.id, name: u!.name, tenantId: m.tenantId, role: m.role, platform: false, pwd: u!.passwordChangedAt.getTime() } };
  });
}

/** Super admin: faqat is_platform_admin. */
export async function loginPlatformAdmin(phone: string, password: string): Promise<LoginResult> {
  return withAuth(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.phone, phone)).limit(1);
    const chk = await checkPassword(u, password);
    if (!chk.ok) {
      if ('failed' in chk && u) await registerFailure(tx, u);
      return { ok: false, error: chk.error };
    }
    if (!u!.isPlatformAdmin) return { ok: false, error: 'Bu ishxona hisobi — app.adone.uz orqali kiring. admin.adone.uz faqat super admin uchun.' };
    await tx.update(users).set({ lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null }).where(eq(users.id, u!.id));
    return { ok: true, claims: { sub: u!.id, name: u!.name, tenantId: null, role: null, platform: true, pwd: u!.passwordChangedAt.getTime() } };
  });
}
