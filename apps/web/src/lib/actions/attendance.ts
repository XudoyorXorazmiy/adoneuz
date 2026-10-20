'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { attendanceEvents, auditLog, employees, rebuildDay, withTenant } from '@adone/db';
import { isValidDate, isValidTime, zonedTime, addDays, type CorrectionMeta } from '@adone/core';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { departmentScope } from '@/server/scope';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/**
 * Davomat tuzatishi — yangi `correction` hodisasi (eski yozuv o'chmaydi, CLAUDE.md §1.2) + audit + kun qayta hisoblanadi.
 *   add_in / add_out — vaqt (ish kuni sanasi + HH:MM; tungi smenada ertasi kun belgisi)
 *   void / approve  — mavjud hodisa (rad etish / shubhalini tasdiqlash)
 */
export async function correctAttendanceAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('attendance');
  const employeeId = z.uuid().safeParse(str(f, 'employeeId'));
  const workDate = str(f, 'workDate');
  if (!employeeId.success || !isValidDate(workDate)) return { error: "Ma'lumot noto'g'ri" };
  const action = z.enum(['add_in', 'add_out', 'void', 'approve']).safeParse(str(f, 'action'));
  if (!action.success) return { error: 'Amalni tanlang' };
  const reason = str(f, 'reason');
  if (reason.length < 3) return { error: 'Sababni yozing — jurnalga tushadi' };
  let meta: CorrectionMeta;
  if (action.data === 'add_in' || action.data === 'add_out') {
    const time = str(f, 'time');
    if (!isValidTime(time)) return { error: "Vaqtni 09:00 ko'rinishida kiriting" };
    const date = f.get('nextDay') === '1' ? addDays(workDate, 1) : workDate;
    meta = { action: action.data, at: zonedTime(date, time, user.tenantTimezone).toISOString(), reason };
  } else {
    const target = z.uuid().safeParse(str(f, 'target'));
    if (!target.success) return { error: 'Hodisani tanlang' };
    meta = { action: action.data, target: target.data, reason };
  }
  const err = await withTenant(user.tenantId, async (tx) => {
    const [e] = await tx.select().from(employees).where(eq(employees.id, employeeId.data)).limit(1);
    if (!e) return 'Xodim topilmadi';
    const scope = await departmentScope(tx, user);
    if (scope && (!e.departmentId || !scope.includes(e.departmentId))) return "Faqat o'z bo'limingiz xodimlari";
    if (meta.action === 'void' || meta.action === 'approve') {
      const target = meta.target;
      const [t] = await tx.select({ id: attendanceEvents.id }).from(attendanceEvents).where(and(eq(attendanceEvents.id, target), eq(attendanceEvents.employeeId, e.id), eq(attendanceEvents.workDate, workDate))).limit(1);
      if (!t) return 'Hodisa topilmadi';
    }
    const [ev] = await tx.insert(attendanceEvents).values({
      tenantId: user.tenantId, employeeId: e.id, workDate, kind: 'correction', source: 'admin', meta, createdByUserId: user.id,
    }).returning({ id: attendanceEvents.id });
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: `attendance.${meta.action}`, entity: 'attendance_event', entityId: ev!.id, meta: { employeeId: e.id, workDate, ...meta } });
    await rebuildDay(tx, { tenantId: user.tenantId, employeeId: e.id, workDate, tz: user.tenantTimezone });
    return null;
  });
  if (err) return { error: err };
  revalidatePath('/davomat');
  revalidatePath('/');
  return { ok: 'Tuzatildi' };
}

/** Bosh sahifadagi shubhali hodisa: tasdiqlash yoki rad etish (bir bosish, sabab avtomatik). */
export async function resolveSuspiciousAction(f: FormData): Promise<void> {
  const fd = new FormData();
  for (const k of ['employeeId', 'workDate', 'target']) fd.set(k, String(f.get(k) ?? ''));
  const approve = f.get('decision') === 'approve';
  fd.set('action', approve ? 'approve' : 'void');
  fd.set('reason', approve ? 'Rahbar tasdiqladi' : 'Rahbar rad etdi');
  const r = await correctAttendanceAction(undefined, fd);
  if (r?.error) throw new Error(r.error);
}
