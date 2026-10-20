import 'server-only';
/** Davomat ko'rinishlari (panel). Hisob — core computeDay(); jurnal — attendance_events (append-only). */
import { and, asc, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import { attendanceDays, attendanceEvents, branches, departments, employees, media, schedules, toRule, withTenant } from '@adone/db';
import { computeDay, localDate, shiftFor, type DayResult, type DayStatus, type Shift } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope, inScope } from './scope';

export interface DayRow {
  id: string;
  fullName: string;
  position: string | null;
  departmentName: string | null;
  branchName: string | null;
  scheduleName: string | null;
  shift: Shift | null;
  result: DayResult;
  events: Array<{
    id: string; kind: string; at: Date; checkStatus: 'ok' | 'suspicious' | 'rejected'; distanceM: number | null; accuracyM: number | null;
    lat: number | null; lng: number | null; isLive: boolean | null; mediaId: string | null; reasons: string[]; source: string; meta: Record<string, unknown> | null;
  }>;
}

export interface DayFilter {
  date: string;
  branchId?: string;
  departmentId?: string;
}

/** Bir kunlik davomat — har faol xodim uchun hisob xotirada (ochiq kunlar «hozirgacha» bilan). */
export async function listDay(user: TenantUser, f: DayFilter): Promise<DayRow[]> {
  const tz = user.tenantTimezone;
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const emps = await tx
      .select({ e: employees, s: schedules, departmentName: departments.name, branchName: branches.name })
      .from(employees)
      .leftJoin(schedules, eq(schedules.id, employees.scheduleId))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(branches, eq(branches.id, employees.branchId))
      .where(and(eq(employees.status, 'active'), inScope(employees.departmentId, scope), f.branchId ? eq(employees.branchId, f.branchId) : undefined, f.departmentId ? eq(employees.departmentId, f.departmentId) : undefined))
      .orderBy(asc(employees.fullName));
    if (emps.length === 0) return [];
    const evs = await tx
      .select()
      .from(attendanceEvents)
      .where(and(eq(attendanceEvents.workDate, f.date), inArray(attendanceEvents.employeeId, emps.map((x) => x.e.id))))
      .orderBy(asc(attendanceEvents.serverAt));
    const byEmp = new Map<string, typeof evs>();
    for (const e of evs) byEmp.set(e.employeeId, [...(byEmp.get(e.employeeId) ?? []), e]);
    const now = new Date();
    return emps.map(({ e, s, departmentName, branchName }) => {
      const list = byEmp.get(e.id) ?? [];
      const shift = s ? shiftFor(toRule(s), f.date, tz) : null;
      const result = computeDay({ events: list.map((x) => ({ id: x.id, kind: x.kind, at: x.serverAt, checkStatus: x.checkStatus, meta: x.meta })), shift, now });
      return {
        id: e.id, fullName: e.fullName, position: e.position, departmentName, branchName, scheduleName: s?.name ?? null, shift, result,
        events: list.map((x) => ({
          id: x.id, kind: x.kind, at: x.serverAt, checkStatus: x.checkStatus, distanceM: x.distanceM, accuracyM: x.accuracyM, lat: x.lat, lng: x.lng,
          isLive: x.isLiveLocation, mediaId: x.mediaId, reasons: x.reasons, source: x.source, meta: x.meta ?? null,
        })),
      };
    });
  });
}

export function summarize(rows: DayRow[]) {
  const c = { all: rows.length, present: 0, late: 0, absent: 0, leave: 0, off: 0, holiday: 0, inside: 0, suspicious: 0 };
  for (const r of rows) {
    c[r.result.status as DayStatus]++;
    if (r.result.open) c.inside++;
    if (r.result.suspicious) c.suspicious++;
  }
  return c;
}

/** Oylik tabel: attendance_days dan (cron va har hodisa yangilaydi). */
export async function monthGrid(user: TenantUser, month: string, departmentId?: string) {
  const from = `${month}-01`;
  const to = `${month}-31`;
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const emps = await tx
      .select({ id: employees.id, fullName: employees.fullName, position: employees.position, departmentName: departments.name })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(and(ne(employees.status, 'invited'), ne(employees.status, 'pending'), inScope(employees.departmentId, scope), departmentId ? eq(employees.departmentId, departmentId) : undefined))
      .orderBy(asc(employees.fullName));
    const days = emps.length
      ? await tx.select().from(attendanceDays).where(and(gte(attendanceDays.workDate, from), lte(attendanceDays.workDate, to), inArray(attendanceDays.employeeId, emps.map((e) => e.id))))
      : [];
    const cells = new Map<string, (typeof days)[number]>();
    for (const d of days) cells.set(`${d.employeeId}:${d.workDate}`, d);
    return { emps, cells };
  });
}

export function monthTotals(empId: string, dates: string[], cells: Map<string, { status: DayStatus; workedMinutes: number; lateMinutes: number; overtimeMinutes: number }>) {
  const t = { worked: 0, presentDays: 0, lateDays: 0, lateMinutes: 0, absentDays: 0, leaveDays: 0, overtime: 0 };
  for (const d of dates) {
    const c = cells.get(`${empId}:${d}`);
    if (!c) continue;
    t.worked += c.workedMinutes;
    t.overtime += c.overtimeMinutes;
    if (c.status === 'present' || c.status === 'late') t.presentDays++;
    if (c.status === 'late') { t.lateDays++; t.lateMinutes += c.lateMinutes; }
    if (c.status === 'absent') t.absentDays++;
    if (c.status === 'leave') t.leaveDays++;
  }
  return t;
}

/** Media fayli: faqat shu ishxona (RLS). */
export async function mediaFor(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const [m] = await tx.select().from(media).where(eq(media.id, id)).limit(1);
    return m ?? null;
  });
}

export function today(user: TenantUser) {
  return localDate(new Date(), user.tenantTimezone);
}

