import 'server-only';
/** Ishxona tuzilmasi: filiallar, bo'limlar, jadvallar. Hammasi withTenant ichida (RLS). */
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { branches, departments, employees, memberships, schedules, users, withTenant } from '@adone/db';

export async function listBranches(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: branches.id, name: branches.name, address: branches.address, lat: branches.lat, lng: branches.lng, radiusM: branches.radiusM, isActive: branches.isActive,
        employees: sql<number>`(select count(*)::int from employees e where e.branch_id = ${branches.id} and e.status <> 'disabled')`,
      })
      .from(branches)
      .orderBy(asc(branches.createdAt)),
  );
}

export async function listDepartments(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx
      .select({
        id: departments.id, name: departments.name, managerUserId: departments.managerUserId, managerName: users.name,
        employees: sql<number>`(select count(*)::int from employees e where e.department_id = ${departments.id} and e.status <> 'disabled')`,
      })
      .from(departments)
      .leftJoin(users, eq(users.id, departments.managerUserId))
      .where(eq(departments.isActive, true))
      .orderBy(asc(departments.name)),
  );
}

export async function listSchedules(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.select().from(schedules).where(eq(schedules.isActive, true)).orderBy(asc(schedules.createdAt));
    const counts = await tx.select({ id: employees.scheduleId, n: count() }).from(employees).where(sql`${employees.status} <> 'disabled'`).groupBy(employees.scheduleId);
    const by = new Map(counts.map((c) => [c.id, Number(c.n)]));
    return rows.map((r) => ({ ...r, employees: by.get(r.id) ?? 0 }));
  });
}

/** Bo'lim boshlig'i tanlovi uchun: panelga kira oladigan a'zolar. */
export async function listPanelMembers(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx
      .select({ id: users.id, name: users.name, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.isActive, true), sql`${memberships.role} <> 'employee'`))
      .orderBy(asc(users.name)),
  );
}
