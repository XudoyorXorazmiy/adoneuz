import 'server-only';
import { cache } from 'react';
import { and, count, eq } from 'drizzle-orm';
import { employees, plans, subscriptions, tasks, withTenant } from '@adone/db';

/** Yon menyu uchun: tarif, faol xodimlar, tasdiq kutayotganlar, tekshiruvdagi vazifalar. Bir so'rovda bir marta (cache). */
export const shellInfo = cache(async (tenantId: string) =>
  withTenant(tenantId, async (tx) => {
    const [plan] = await tx.select({ name: plans.name, max: plans.maxEmployees }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId)).limit(1);
    const [[active], [pending], [review]] = await Promise.all([
      tx.select({ n: count() }).from(employees).where(eq(employees.status, 'active')),
      tx.select({ n: count() }).from(employees).where(and(eq(employees.status, 'pending'))),
      tx.select({ n: count() }).from(tasks).where(eq(tasks.status, 'submitted')),
    ]);
    return { planName: plan?.name ?? '—', maxEmployees: plan?.max ?? 0, active: Number(active!.n), pending: Number(pending!.n), review: Number(review!.n) };
  }),
);
