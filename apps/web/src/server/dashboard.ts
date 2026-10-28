import 'server-only';
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { attendanceDays, branches, employees, schedules, tgLinks, type Tx } from '@adone/db';
import { addDays, isoWeekday } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope, inScope, inTenant } from './scope';

/** Onboarding holati: filial, jadval, xodim bormi. */
export async function setupState(tenantId: string, tx0?: Tx) {
  return inTenant(tenantId, tx0, async (tx) => {
    // Bitta tranzaksiyada ketma-ket (parallel so'rov bitta ulanishda — pg ogohlantiradi, foydasi yo'q)
    const [b] = await tx.select({ n: count() }).from(branches).where(eq(branches.isActive, true));
    const [s] = await tx.select({ n: count() }).from(schedules).where(eq(schedules.isActive, true));
    const [e] = await tx.select({ n: count() }).from(employees);
    const [a] = await tx.select({ n: count() }).from(employees).where(eq(employees.status, 'active'));
    return { branches: Number(b!.n), schedules: Number(s!.n), employees: Number(e!.n), active: Number(a!.n) };
  });
}

export interface DayAgg { date: string; present: number; late: number; absent: number; worked: number; workedDays: number }

/** Sana oralig'i bo'yicha kunlik yig'ma (attendance_days; menejer — o'z bo'limlari). */
export async function dailyAgg(user: TenantUser, from: string, to: string, tx0?: Tx): Promise<Map<string, DayAgg>> {
  return inTenant(user.tenantId, tx0, async (tx) => {
    const scope = await departmentScope(tx, user);
    const rows = await tx
      .select({
        d: attendanceDays.workDate,
        present: sql<number>`count(*) filter (where ${attendanceDays.status} = 'present')::int`,
        late: sql<number>`count(*) filter (where ${attendanceDays.status} = 'late')::int`,
        absent: sql<number>`count(*) filter (where ${attendanceDays.status} = 'absent')::int`,
        worked: sql<number>`coalesce(sum(${attendanceDays.workedMinutes}) filter (where ${attendanceDays.workedMinutes} > 0), 0)::int`,
        workedDays: sql<number>`count(*) filter (where ${attendanceDays.workedMinutes} > 0)::int`,
      })
      .from(attendanceDays)
      .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(gte(attendanceDays.workDate, from), lte(attendanceDays.workDate, to), inScope(employees.departmentId, scope)))
      .groupBy(attendanceDays.workDate);
    return new Map(rows.map((r) => [r.d, { date: r.d, present: r.present, late: r.late, absent: r.absent, worked: r.worked, workedDays: r.workedDays }]));
  });
}

/** Haftaning dushanbasi. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** O'zgarish foizi (oldingi qiymatga nisbatan); oldingi 0 bo'lsa null. */
export function deltaPct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/** Rahbarning Telegram'i ulanganmi (tg_links, tenant konteksti). */
export async function memberLinked(tenantId: string, userId: string, tx0?: Tx) {
  return inTenant(tenantId, tx0, async (tx) => {
    const [r] = await tx.select({ id: tgLinks.id }).from(tgLinks).where(and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, userId))).limit(1);
    return !!r;
  });
}

/** Tasdiq kutayotgan xodimlar (botda ro'yxatdan o'tgan). */
export async function pendingEmployees(user: TenantUser, limit = 6, tx0?: Tx) {
  return inTenant(user.tenantId, tx0, async (tx) => {
    const scope = await departmentScope(tx, user);
    return tx
      .select({ id: employees.id, fullName: employees.fullName, position: employees.position, phone: employees.phone, updatedAt: employees.updatedAt, branchName: branches.name })
      .from(employees)
      .leftJoin(branches, eq(branches.id, employees.branchId))
      .where(and(eq(employees.status, 'pending'), inScope(employees.departmentId, scope)))
      .limit(limit);
  });
}
