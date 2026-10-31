import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { addDays, computeDay, nextAction, openWorkday, shiftFor, toRuleLike, workdayFor, type DayEvent, type DayResult, type ScheduleRule, type Shift } from '@adone/core';
import type { Tx } from './client';
import { attendanceDays, attendanceEvents, employees, leaveRequests, schedules } from './schema/index';

/**
 * Kunlik yig'ma — FAQAT shu yerdan yoziladi (CLAUDE.md §1.2): jurnal → core computeDay() → attendance_days.
 * withTenant tranzaksiyasi ichida chaqiriladi (panel, bot, seed, cron bir xil kod).
 */

export function toRule(s: typeof schedules.$inferSelect): ScheduleRule {
  return toRuleLike(s);
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

/**
 * «Keldim/Ketdim/Tanaffus» uchun joriy holat: ish kuni (`workdayFor`) va uning hodisalari. Joriy kunda ochiq kirish bo'lmasa,
 * oldingi kun yopilmagan bo'lsa (yarim tundan keyin «Ketdim», 2026-10-31) — o'sha kun qaytadi: hodisa unga yoziladi, kun qayta
 * hisoblanadi. `open` — hozir ishda (keyingi amal «Ketdim»).
 */
export async function currentWorkday(tx: Tx, employeeId: string, at: Date, tz: string): Promise<{ date: string; shift: Shift | null; events: DayEvent[]; open: boolean }> {
  const rule = await employeeRule(tx, employeeId);
  const wd = workdayFor(rule, at, tz);
  const events = await dayEvents(tx, employeeId, wd.date);
  if (nextAction(events) === 'check_out') return { ...wd, events, open: true };
  const prevDate = addDays(wd.date, -1);
  const prevEvents = await dayEvents(tx, employeeId, prevDate);
  if (openWorkday(at, [{ date: prevDate, events: prevEvents }])) return { date: prevDate, shift: rule ? shiftFor(rule, prevDate, tz) : null, events: prevEvents, open: true };
  return { ...wd, events, open: false };
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
  const [r] = await rebuildDays(tx, { tenantId: input.tenantId, tz: input.tz, now: input.now, items: [{ employeeId: input.employeeId, workDate: input.workDate }] });
  return r!;
}

// ---------- To'plam (tick, kunlik ro'yxat): xodim × kun uchun 3 ta so'rov + bitta upsert, N+1 emas ----------

const key = (employeeId: string, date: string) => `${employeeId}|${date}`;

/** Xodimlarning jadval qoidalari (bitta so'rov). Jadvalsiz — null. */
export async function rulesFor(tx: Tx, employeeIds: string[]): Promise<Map<string, ScheduleRule | null>> {
  const out = new Map<string, ScheduleRule | null>(employeeIds.map((id) => [id, null]));
  if (!employeeIds.length) return out;
  const rows = await tx.select({ id: employees.id, s: schedules }).from(employees).innerJoin(schedules, eq(schedules.id, employees.scheduleId)).where(inArray(employees.id, employeeIds));
  for (const r of rows) out.set(r.id, toRule(r.s));
  return out;
}

/** Hodisalar xodim × kun bo'yicha (bitta so'rov), vaqt tartibida. Kalit — `${employeeId}|${date}`. */
export async function eventsFor(tx: Tx, employeeIds: string[], dates: string[]): Promise<Map<string, DayEvent[]>> {
  const out = new Map<string, DayEvent[]>();
  if (!employeeIds.length || !dates.length) return out;
  const rows = await tx
    .select({ employeeId: attendanceEvents.employeeId, workDate: attendanceEvents.workDate, id: attendanceEvents.id, kind: attendanceEvents.kind, at: attendanceEvents.serverAt, checkStatus: attendanceEvents.checkStatus, meta: attendanceEvents.meta })
    .from(attendanceEvents)
    .where(and(inArray(attendanceEvents.employeeId, employeeIds), inArray(attendanceEvents.workDate, dates)))
    .orderBy(asc(attendanceEvents.serverAt));
  for (const { employeeId, workDate, ...e } of rows) {
    const k = key(employeeId, workDate);
    const list = out.get(k) ?? [];
    list.push(e);
    out.set(k, list);
  }
  return out;
}

/** Tasdiqlangan ruxsat kunlari (bitta so'rov). Kalit — `${employeeId}|${date}`. */
export async function leavesFor(tx: Tx, employeeIds: string[], dates: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (!employeeIds.length || !dates.length) return out;
  const from = [...dates].sort()[0]!;
  const to = [...dates].sort().at(-1)!;
  const rows = await tx.select({ e: leaveRequests.employeeId, from: leaveRequests.dateFrom, to: leaveRequests.dateTo }).from(leaveRequests)
    .where(and(inArray(leaveRequests.employeeId, employeeIds), eq(leaveRequests.status, 'approved'), lte(leaveRequests.dateFrom, to), gte(leaveRequests.dateTo, from)));
  for (const r of rows) for (const d of dates) if (r.from <= d && d <= r.to) out.add(key(r.e, d));
  return out;
}

export interface DayInput { employeeId: string; workDate: string }

/**
 * Bir nechta xodim × kun yig'masini qayta qurish: 3 ta o'qish (qoidalar, hodisalar, ruxsatlar) + bitta upsert.
 * `preloaded` — chaqiruvchi allaqachon o'qigan bo'lsa (tick: o'qib, avto-yopish qo'shib, keyin quradi).
 */
export async function rebuildDays(tx: Tx, input: {
  tenantId: string; tz: string; now?: Date; items: DayInput[];
  preloaded?: { rules: Map<string, ScheduleRule | null>; events: Map<string, DayEvent[]>; leaves: Set<string> };
}): Promise<DayResult[]> {
  if (!input.items.length) return [];
  const ids = [...new Set(input.items.map((i) => i.employeeId))];
  const dates = [...new Set(input.items.map((i) => i.workDate))];
  const rules = input.preloaded?.rules ?? (await rulesFor(tx, ids));
  const events = input.preloaded?.events ?? (await eventsFor(tx, ids, dates));
  const leaves = input.preloaded?.leaves ?? (await leavesFor(tx, ids, dates));
  const now = input.now ?? new Date();
  const results: DayResult[] = [];
  const values = input.items.map((i) => {
    const rule = rules.get(i.employeeId) ?? null;
    const shift = rule ? shiftFor(rule, i.workDate, input.tz) : null;
    const r = computeDay({ events: events.get(key(i.employeeId, i.workDate)) ?? [], shift, now, onLeave: leaves.has(key(i.employeeId, i.workDate)) });
    results.push(r);
    return {
      tenantId: input.tenantId,
      employeeId: i.employeeId,
      workDate: i.workDate,
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
  });
  const ex = (c: string) => sql.raw(`excluded.${c}`);
  await tx
    .insert(attendanceDays)
    .values(values)
    .onConflictDoUpdate({
      target: [attendanceDays.tenantId, attendanceDays.employeeId, attendanceDays.workDate],
      set: {
        shiftStart: ex('shift_start'), shiftEnd: ex('shift_end'), firstIn: ex('first_in'), lastOut: ex('last_out'), workedMinutes: ex('worked_minutes'),
        lateMinutes: ex('late_minutes'), earlyLeaveMinutes: ex('early_leave_minutes'), overtimeMinutes: ex('overtime_minutes'), status: ex('status'),
        isOpen: ex('is_open'), suspicious: ex('suspicious'), updatedAt: new Date(),
      },
    });
  return results;
}
