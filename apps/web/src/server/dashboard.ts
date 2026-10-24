import 'server-only';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { attendanceDays, branches, employees, schedules, tgLinks, withTenant } from '@adone/db';
import { addDays } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope, inScope } from './scope';

/** Onboarding holati: filial, jadval, xodim bormi. */
export async function setupState(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [[b], [s], [e], [a]] = await Promise.all([
      tx.select({ n: count() }).from(branches).where(eq(branches.isActive, true)),
      tx.select({ n: count() }).from(schedules).where(eq(schedules.isActive, true)),
      tx.select({ n: count() }).from(employees),
      tx.select({ n: count() }).from(employees).where(eq(employees.status, 'active')),
    ]);
    return { branches: Number(b!.n), schedules: Number(s!.n), employees: Number(e!.n), active: Number(a!.n) };
  });
}

/** So'nggi 7 kun: holatlar bo'yicha soni (attendance_days). */
export async function lastWeek(user: TenantUser, today: string) {
  const from = addDays(today, -6);
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const rows = await tx
      .select({ d: attendanceDays.workDate, status: attendanceDays.status, n: sql<number>`count(*)::int` })
      .from(attendanceDays)
      .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(gte(attendanceDays.workDate, from), inScope(employees.departmentId, scope)))
      .groupBy(attendanceDays.workDate, attendanceDays.status);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(from, i);
      const by = (st: string) => rows.filter((r) => r.d === d && r.status === st).reduce((a, r) => a + r.n, 0);
      return { date: d, present: by('present'), late: by('late'), absent: by('absent') };
    });
  });
}

/** Rahbarning Telegram'i ulanganmi (tg_links, tenant konteksti). */
export async function memberLinked(tenantId: string, userId: string) {
  return withTenant(tenantId, async (tx) => {
    const [r] = await tx.select({ id: tgLinks.id }).from(tgLinks).where(and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, userId))).limit(1);
    return !!r;
  });
}
