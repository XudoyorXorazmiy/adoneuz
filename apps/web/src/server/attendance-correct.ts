import 'server-only';
/**
 * Davomat tuzatishi — yangi `correction` hodisasi (eski yozuv o'chmaydi, CLAUDE.md §1.2) + audit + kun qayta hisoblanadi.
 * Panel action'i (lib/actions/attendance.ts) va rahbar Mini App'i (shubhali hodisa qarori) shu yerdan.
 *   set             — «Keldi / Ketdi» vaqtini belgilash: eski birinchi kirish / oxirgi chiqish bekor, yangisi qo'shiladi (retimePlan)
 *   add_in / add_out — vaqt (ish kuni sanasi + HH:MM; tungi smenada ertasi kun belgisi)
 *   void / approve  — mavjud hodisa (rad etish / shubhalini tasdiqlash)
 */
import { and, eq } from 'drizzle-orm';
import { attendanceEvents, auditLog, dayEvents, employees, rebuildDay, type Tx } from '@adone/db';
import { retimePlan, type CorrectionMeta } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope } from './scope';

export async function applyCorrections(
  tx: Tx, user: TenantUser,
  input: { employeeId: string; workDate: string; metas: CorrectionMeta[] | null; want?: { in?: Date; out?: Date } | null; reason: string },
): Promise<string | null> {
  const [e] = await tx.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
  if (!e) return 'Xodim topilmadi';
  const scope = await departmentScope(tx, user);
  if (scope && (!e.departmentId || !scope.includes(e.departmentId))) return "Faqat o'z bo'limingiz xodimlari";
  const list = input.metas ?? retimePlan(await dayEvents(tx, e.id, input.workDate), input.want!).map((m) => ({ ...m, reason: input.reason }));
  if (list.length === 0) return "O'zgarish yo'q — vaqtlar bir xil";
  for (const meta of list) {
    if (input.metas && (meta.action === 'void' || meta.action === 'approve')) {
      const [t] = await tx.select({ id: attendanceEvents.id }).from(attendanceEvents)
        .where(and(eq(attendanceEvents.id, meta.target), eq(attendanceEvents.employeeId, e.id), eq(attendanceEvents.workDate, input.workDate))).limit(1);
      if (!t) return 'Hodisa topilmadi';
    }
    const [ev] = await tx.insert(attendanceEvents).values({
      tenantId: user.tenantId, employeeId: e.id, workDate: input.workDate, kind: 'correction', source: 'admin', meta, createdByUserId: user.id,
    }).returning({ id: attendanceEvents.id });
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: `attendance.${meta.action}`, entity: 'attendance_event', entityId: ev!.id, meta: { employeeId: e.id, workDate: input.workDate, ...meta } });
  }
  await rebuildDay(tx, { tenantId: user.tenantId, employeeId: e.id, workDate: input.workDate, tz: user.tenantTimezone });
  return null;
}

/** Shubhali hodisa bo'yicha bir bosishli qaror (bosh sahifa, rahbar Mini App'i): tasdiqlash yoki rad etish, sabab avtomatik. */
export async function resolveSuspicious(tx: Tx, user: TenantUser, input: { employeeId: string; workDate: string; target: string; approve: boolean }): Promise<string | null> {
  const reason = input.approve ? 'Rahbar tasdiqladi' : 'Rahbar rad etdi';
  return applyCorrections(tx, user, { employeeId: input.employeeId, workDate: input.workDate, metas: [{ action: input.approve ? 'approve' : 'void', target: input.target, reason }], reason });
}
