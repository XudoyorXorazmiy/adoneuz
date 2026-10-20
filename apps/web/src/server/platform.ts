import 'server-only';
/** Super admin: ishxonalar ro'yxati, yaratish, holat. Faqat withPlatform (platforma jadvallari). */
import { randomInt } from 'node:crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { auditLog, memberships, plans, subscriptions, tenants, users, withPlatform, type Tx } from '@adone/db';
import { hashPassword } from '@adone/db/password';
import { slugify, type TenantStatus } from '@adone/core';

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: Date;
  ownerName: string | null;
  ownerPhone: string | null;
  planName: string | null;
  periodEnd: Date | null;
  members: number;
}

export async function listTenants(): Promise<TenantRow[]> {
  return withPlatform(async (tx) => {
    const rows = await tx
      .select({
        id: tenants.id, name: tenants.name, slug: tenants.slug, status: tenants.status, createdAt: tenants.createdAt,
        planName: plans.name, periodEnd: subscriptions.currentPeriodEnd,
        members: sql<number>`(select count(*)::int from memberships m where m.tenant_id = ${tenants.id} and m.is_active)`,
        ownerName: sql<string | null>`(select u.name from memberships m join users u on u.id = m.user_id where m.tenant_id = ${tenants.id} and m.role = 'owner' order by m.created_at limit 1)`,
        ownerPhone: sql<string | null>`(select u.phone from memberships m join users u on u.id = m.user_id where m.tenant_id = ${tenants.id} and m.role = 'owner' order by m.created_at limit 1)`,
      })
      .from(tenants)
      .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .orderBy(desc(tenants.createdAt));
    return rows;
  });
}

export async function listPlans() {
  return withPlatform((tx) => tx.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sort)));
}

export async function platformStats() {
  return withPlatform(async (tx) => {
    const [r] = await tx.execute<{ tenants: number; active: number; trial: number; members: number }>(sql`
      select count(*)::int as tenants,
             count(*) filter (where status = 'active')::int as active,
             count(*) filter (where status = 'trial')::int as trial,
             (select count(*)::int from memberships where is_active) as members
      from tenants`).then((x) => x.rows);
    return r!;
  });
}

async function uniqueSlug(tx: Tx, name: string): Promise<string> {
  const base = slugify(name).slice(0, 40);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (!hit) return slug;
  }
  return `${base}-${randomInt(1000, 9999)}`;
}

export interface CreateTenantInput {
  name: string;
  ownerName: string;
  ownerPhone: string;
  /** Telefon yangi bo'lsa majburiy; mavjud user bo'lsa paroli o'zgarmaydi. */
  password: string | null;
  planCode: string;
  trialDays: number;
}

export type CreateTenantResult = { ok: true; tenantId: string; existingUser: boolean } | { ok: false; error: string };

/** Ishxona + egasi + obuna — bitta tranzaksiyada. Telefon allaqachon ro'yxatda bo'lsa o'sha user egasi bo'ladi. */
export async function createTenant(input: CreateTenantInput, actorId: string): Promise<CreateTenantResult> {
  return withPlatform(async (tx) => {
    const [plan] = await tx.select().from(plans).where(and(eq(plans.code, input.planCode), eq(plans.isActive, true))).limit(1);
    if (!plan) return { ok: false, error: 'Tarif topilmadi' };
    const [existing] = await tx.select().from(users).where(eq(users.phone, input.ownerPhone)).limit(1);
    if (existing?.isPlatformAdmin) return { ok: false, error: 'Bu raqam super admin hisobi — boshqa raqam kiriting' };
    if (!existing && !input.password) return { ok: false, error: 'Yangi egasi uchun parol kiriting' };

    const slug = await uniqueSlug(tx, input.name);
    const [tenant] = await tx.insert(tenants).values({ name: input.name, slug, status: 'trial' }).returning({ id: tenants.id });
    const userId =
      existing?.id ??
      (await tx
        .insert(users)
        .values({ phone: input.ownerPhone, name: input.ownerName, passwordHash: await hashPassword(input.password!) })
        .returning({ id: users.id }))[0]!.id;
    await tx.insert(memberships).values({ userId, tenantId: tenant!.id, role: 'owner' });
    await tx.insert(subscriptions).values({
      tenantId: tenant!.id,
      planId: plan.id,
      status: 'trial',
      currentPeriodEnd: new Date(Date.now() + input.trialDays * 86_400_000),
    });
    await tx.insert(auditLog).values({ tenantId: tenant!.id, userId: actorId, action: 'tenant.create', entity: 'tenant', entityId: tenant!.id, meta: { plan: plan.code, existingUser: !!existing } });
    return { ok: true, tenantId: tenant!.id, existingUser: !!existing };
  });
}

export async function setTenantStatus(tenantId: string, status: TenantStatus, actorId: string): Promise<void> {
  await withPlatform(async (tx) => {
    await tx.update(tenants).set({ status }).where(eq(tenants.id, tenantId));
    await tx.insert(auditLog).values({ tenantId, userId: actorId, action: 'tenant.status', entity: 'tenant', entityId: tenantId, meta: { status } });
  });
}

export async function recentJobs(limit = 50) {
  return withPlatform((tx) =>
    tx.execute<{ id: string; type: string; status: string; attempts: number; last_error: string | null; run_at: Date; tenant: string | null }>(sql`
      select j.id, j.type, j.status, j.attempts, j.last_error, j.run_at, t.name as tenant
      from jobs j left join tenants t on t.id = j.tenant_id
      order by j.created_at desc limit ${limit}`).then((r) => r.rows),
  );
}
