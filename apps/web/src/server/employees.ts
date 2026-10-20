import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { branches, departments, employees, invites, schedules, withTenant, type Tx } from '@adone/db';
import type { EmployeeStatus } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope, inScope } from './scope';

export const BOT_USERNAME = process.env.PLATFORM_BOT_USERNAME || 'adoneuz_bot';
export const INVITE_DAYS = 14;

export function inviteLink(code: string) {
  return `https://t.me/${BOT_USERNAME}?start=inv_${code}`;
}

/** 10 belgili kod (Crockford base32 — chalkash belgilarsiz). */
export function newInviteCode(): string {
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % 32]).join('');
}

export async function createInvite(tx: Tx, tenantId: string, employeeId: string): Promise<string> {
  const code = newInviteCode();
  await tx.insert(invites).values({ code, tenantId, kind: 'employee', refId: employeeId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) });
  return code;
}

export interface EmployeeFilter {
  status?: EmployeeStatus | 'all';
  departmentId?: string;
  q?: string;
}

export async function listEmployees(user: TenantUser, f: EmployeeFilter) {
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const base = and(
      inScope(employees.departmentId, scope),
      f.departmentId ? eq(employees.departmentId, f.departmentId) : undefined,
      f.q ? or(ilike(employees.fullName, `%${f.q}%`), ilike(employees.phone, `%${f.q.replace(/\D/g, '') || f.q}%`), ilike(employees.position, `%${f.q}%`)) : undefined,
    );
    const counts = await tx.select({ status: employees.status, n: sql<number>`count(*)::int` }).from(employees).where(base).groupBy(employees.status);
    const status = f.status && f.status !== 'all' ? f.status : undefined;
    const rows = await tx
      .select({
        id: employees.id, fullName: employees.fullName, phone: employees.phone, position: employees.position, status: employees.status,
        departmentId: employees.departmentId, branchId: employees.branchId, scheduleId: employees.scheduleId,
        payType: employees.payType, payRate: employees.payRate, telegramUserId: employees.telegramUserId, telegramUsername: employees.telegramUsername,
        departmentName: departments.name, branchName: branches.name, scheduleName: schedules.name,
        invite: sql<string | null>`(select i.code from invites i where i.ref_id = ${employees.id} and i.used_at is null and i.expires_at > now() order by i.created_at desc limit 1)`,
      })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(branches, eq(branches.id, employees.branchId))
      .leftJoin(schedules, eq(schedules.id, employees.scheduleId))
      .where(and(base, status ? eq(employees.status, status) : sql`${employees.status} <> 'disabled'`))
      .orderBy(sql`case ${employees.status} when 'pending' then 0 when 'invited' then 1 when 'active' then 2 else 3 end`, asc(employees.fullName));
    return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<EmployeeStatus, number>>, scope };
  });
}

/** Forma tanlovlari: bo'lim, filial, jadval. */
export async function employeeOptions(tenantId: string) {
  return withTenant(tenantId, async (tx) => ({
    departments: await tx.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name)),
    branches: await tx.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name)),
    schedules: await tx.select({ id: schedules.id, name: schedules.name }).from(schedules).where(eq(schedules.isActive, true)).orderBy(asc(schedules.name)),
  }));
}

