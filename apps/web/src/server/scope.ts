import 'server-only';
import { eq, inArray, sql } from 'drizzle-orm';
import { departments, memberships, type Tx } from '@adone/db';
import type { TenantUser } from '@/lib/auth/session';

/**
 * Menejer faqat o'z bo'limlarini ko'radi (CLAUDE.md §4): boshlig'i bo'lgan bo'limlar + a'zolikdagi department_ids.
 * null — cheklov yo'q (egasi, admin). Bo'sh massiv — hech narsa ko'rmaydi.
 */
export async function departmentScope(tx: Tx, user: TenantUser): Promise<string[] | null> {
  if (user.role !== 'manager') return null;
  const [m] = await tx.select({ ids: memberships.departmentIds }).from(memberships).where(eq(memberships.userId, user.id)).limit(1);
  const own = await tx.select({ id: departments.id }).from(departments).where(eq(departments.managerUserId, user.id));
  return [...new Set([...(m?.ids ?? []), ...own.map((d) => d.id)])];
}

/** employees.department_id bo'yicha filtr (null — filtr yo'q). */
export function inScope(column: Parameters<typeof inArray>[0], scope: string[] | null) {
  if (scope === null) return sql`true`;
  if (scope.length === 0) return sql`false`;
  return inArray(column, scope);
}

