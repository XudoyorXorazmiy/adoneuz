import 'server-only';
/** Ishxona sozlamalari (Sozlamalar sahifasi) — o'qish, bo'lim bo'yicha saqlash (audit bilan), «Oxirgi o'zgarish». */
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { auditLog, branches, employees, payrollPeriods, plans, subscriptions, tenants, users, withTenant, type Tx } from '@adone/db';
import { tenantSettings, type TenantSettings } from '@adone/core';

export async function readSettings(tx: Tx): Promise<TenantSettings> {
  const [t] = await tx.select({ s: tenants.settings }).from(tenants).limit(1);
  return tenantSettings(t?.s);
}

export async function getSettings(tenantId: string): Promise<TenantSettings> {
  return withTenant(tenantId, readSettings);
}

/** Sozlama bo'limlari — audit `settings.<bo'lim>`, kartochkadagi «Oxirgi o'zgarish» shu bo'yicha. */
export type SettingsSection = 'attendance' | 'face' | 'tasks' | 'reminders' | 'notifications' | 'tenant' | 'payroll';

/**
 * Bo'lim o'zgarishi: `patch` normallashtirilgan to'liq sozlamaga qo'shiladi, keyin yana normallashtiriladi
 * (yaroqsiz qiymat standartga qaytadi). Noma'lum kalitlar (kelajakdagi) saqlanib qoladi.
 */
export async function saveSettings(tx: Tx, actor: { tenantId: string; userId: string }, section: SettingsSection, patch: Partial<TenantSettings>) {
  const [t] = await tx.select({ s: tenants.settings }).from(tenants).limit(1);
  const raw = (t?.s ?? {}) as Record<string, unknown>;
  const before = tenantSettings(raw);
  const next = tenantSettings({ ...before, ...patch });
  await tx.update(tenants).set({ settings: { ...raw, ...next } }).where(eq(tenants.id, actor.tenantId));
  const keys = Object.keys(patch) as Array<keyof TenantSettings>;
  await tx.insert(auditLog).values({
    tenantId: actor.tenantId, userId: actor.userId, action: `settings.${section}`, entity: 'tenant', entityId: actor.tenantId,
    meta: { before: Object.fromEntries(keys.map((k) => [k, before[k]])), after: Object.fromEntries(keys.map((k) => [k, next[k]])) },
  });
  return next;
}

/** Har audit amali bo'yicha oxirgi o'zgarish: kim, qachon. */
export async function lastChanges(tenantId: string, actions: string[]): Promise<Record<string, { name: string; at: Date }>> {
  if (!actions.length) return {};
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({ action: auditLog.action, at: auditLog.createdAt, name: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(eq(auditLog.tenantId, tenantId), inArray(auditLog.action, actions)))
      .orderBy(desc(auditLog.createdAt))
      .limit(200);
    const out: Record<string, { name: string; at: Date }> = {};
    for (const r of rows) if (!out[r.action]) out[r.action] = { name: r.name ?? 'tizim', at: r.at };
    return out;
  });
}

/** Ishxona → «Mintaqa va til» uchun ruxsat etilgan vaqt mintaqalari. */
export const TIMEZONES: Array<{ id: string; label: string }> = [
  { id: 'Asia/Tashkent', label: 'Asia/Tashkent (UTC+5)' },
  { id: 'Asia/Samarkand', label: 'Asia/Samarkand (UTC+5)' },
  { id: 'Asia/Almaty', label: 'Asia/Almaty (UTC+5)' },
  { id: 'Asia/Bishkek', label: 'Asia/Bishkek (UTC+6)' },
  { id: 'Asia/Dushanbe', label: 'Asia/Dushanbe (UTC+5)' },
  { id: 'Europe/Moscow', label: 'Europe/Moscow (UTC+3)' },
  { id: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { id: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
];

export async function updateTenantProfile(actor: { tenantId: string; userId: string }, input: { name: string; timezone: string }): Promise<string | null> {
  if (input.name.length < 2 || input.name.length > 80) return 'Ishxona nomini kiriting';
  if (!TIMEZONES.some((t) => t.id === input.timezone)) return 'Vaqt mintaqasini tanlang';
  await withTenant(actor.tenantId, async (tx) => {
    const [before] = await tx.select({ name: tenants.name, timezone: tenants.timezone }).from(tenants).limit(1);
    await tx.update(tenants).set({ name: input.name, timezone: input.timezone }).where(eq(tenants.id, actor.tenantId));
    await tx.insert(auditLog).values({ tenantId: actor.tenantId, userId: actor.userId, action: 'settings.tenant', entity: 'tenant', entityId: actor.tenantId, meta: { before, after: input } });
  });
  return null;
}

/**
 * «Ishxonani yopish» (faqat egasi): holat `archived` — hech kim kira olmaydi, bot ishlamaydi, ma'lumot o'chirilmaydi
 * (butunlay o'chirish — platforma orqali, egasining yozma so'rovi bilan).
 */
export async function archiveTenant(actor: { tenantId: string; userId: string }): Promise<void> {
  await withTenant(actor.tenantId, async (tx) => {
    await tx.update(tenants).set({ status: 'archived' }).where(eq(tenants.id, actor.tenantId));
    await tx.insert(auditLog).values({ tenantId: actor.tenantId, userId: actor.userId, action: 'tenant.archive', entity: 'tenant', entityId: actor.tenantId });
  });
}

/** Tarif: joriy obuna, ishlatilishi, tariflar ro'yxati. */
export async function billingInfo(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [sub] = await tx
      .select({ status: subscriptions.status, periodEnd: subscriptions.currentPeriodEnd, code: plans.code, name: plans.name, maxEmployees: plans.maxEmployees, maxBranches: plans.maxBranches, face: plans.faceControl })
      .from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).limit(1);
    const [[emp], [br]] = await Promise.all([
      tx.select({ n: count() }).from(employees).where(eq(employees.status, 'active')),
      tx.select({ n: count() }).from(branches).where(eq(branches.isActive, true)),
    ]);
    const all = await tx.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sort));
    return { sub: sub ?? null, employees: Number(emp!.n), branches: Number(br!.n), plans: all };
  });
}

export async function lastClosedPeriod(tenantId: string): Promise<{ month: string; closedAt: Date | null } | null> {
  const [r] = await withTenant(tenantId, (tx) =>
    tx.select({ month: payrollPeriods.month, closedAt: payrollPeriods.closedAt }).from(payrollPeriods).where(eq(payrollPeriods.status, 'closed')).orderBy(desc(payrollPeriods.month)).limit(1),
  );
  return r ?? null;
}
