import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { computeDay, shiftFor, workdayFor, type DayEvent, type ScheduleRule } from '@adone/core';
import type { Tx } from './client';
import { attendanceDays, attendanceEvents, employees, leaveRequests, schedules } from './schema/index';

/**
 * Kunlik yig'ma — FAQAT shu yerdan yoziladi (CLAUDE.md §1.2): jurnal → core computeDay() → attendance_days.
 * withTenant tranzaksiyasi ichida chaqiriladi (panel, bot, seed, cron bir xil kod).
 */

export function toRule(s: typeof schedules.$inferSelect): ScheduleRule {
  return {
    kind: s.kind,
    weekdays: s.weekdays,
    cycleOn: s.cycleOn,
    cycleOff: s.cycleOff,
    cycleStart: s.cycleStart,
    startTime: s.startTime,
    endTime: s.endTime,
    breakMinutes: s.breakMinutes,
    graceMinutes: s.graceMinutes,
  };
}

export async function employeeRule(tx: Tx, employeeId: string): Promise<ScheduleRule | null> {
  const [r] = await tx
    .select({ s: schedules })
    .from(employees)
    .innerJoin(schedules, eq(schedules.id, employees.scheduleId))
    .where(eq(employees.id, employeeId))
    .limit(1);
  return r ? toRule(r.s) : null;
}

/** Hodisa qaysi ish kuniga yoziladi (tungi smena — kechagi sana). */
export async function workdayOf(tx: Tx, employeeId: string, at: Date, tz: string) {
  return workdayFor(await employeeRule(tx, employeeId), at, tz);
}

export async function dayEvents(tx: Tx, employeeId: string, workDate: string): Promise<DayEvent[]> {
  const rows = await tx
    .select({ id: attendanceEvents.id, kind: attendanceEvents.kind, at: attendanceEvents.serverAt, checkStatus: attendanceEvents.checkStatus, meta: attendanceEvents.meta })
    .from(attendanceEvents)
    .where(and(eq(attendanceEvents.employeeId, employeeId), eq(attendanceEvents.workDate, workDate)))
    .orderBy(asc(attendanceEvents.serverAt));
  return rows;
}

/** Shu kuni tasdiqlangan ruxsat bormi (davomatda «Ruxsatda», kelmagan emas). */
export async function onLeave(tx: Tx, employeeId: string, date: string): Promise<boolean> {
  const r = await tx.select({ id: leaveRequests.id }).from(leaveRequests)
    .where(and(eq(leaveRequests.employeeId, employeeId), eq(leaveRequests.status, 'approved'), lte(leaveRequests.dateFrom, date), gte(leaveRequests.dateTo, date))).limit(1);
  return r.length > 0;
}

/** Bir kunda ruxsatdagi xodimlar (ro'yxat sahifalari uchun, bitta so'rov). */
export async function leavesOn(tx: Tx, date: string): Promise<Set<string>> {
  const r = await tx.select({ e: leaveRequests.employeeId }).from(leaveRequests)
    .where(and(eq(leaveRequests.status, 'approved'), lte(leaveRequests.dateFrom, date), gte(leaveRequests.dateTo, date)));
  return new Set(r.map((x) => x.e));
}

export async function rebuildDay(tx: Tx, input: { tenantId: string; employeeId: string; workDate: string; tz: string; now?: Date }) {
  const rule = await employeeRule(tx, input.employeeId);
  const shift = rule ? shiftFor(rule, input.workDate, input.tz) : null;
  const events = await dayEvents(tx, input.employeeId, input.workDate);
  const r = computeDay({ events, shift, now: input.now ?? new Date(), onLeave: await onLeave(tx, input.employeeId, input.workDate) });
  const values = {
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    workDate: input.workDate,
    shiftStart: shift?.start ?? null,
    shiftEnd: shift?.end ?? null,
    firstIn: r.firstIn,
    lastOut: r.lastOut,
    workedMinutes: r.workedMinutes,
    lateMinutes: r.lateMinutes,
    earlyLeaveMinutes: r.earlyLeaveMinutes,
    overtimeMinutes: r.overtimeMinutes,
    status: r.status,
    isOpen: r.open,
    suspicious: r.suspicious,
  };
  await tx
    .insert(attendanceDays)
    .values(values)
    .onConflictDoUpdate({ target: [attendanceDays.tenantId, attendanceDays.employeeId, attendanceDays.workDate], set: { ...values, updatedAt: new Date() } });
  return r;
}
