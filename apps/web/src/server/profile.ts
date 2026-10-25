import 'server-only';
/** Xodim profili (panel): asosiy ma'lumot, oylik tabel (attendance_days + bugun jonli), yuz namunalari. */
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { attendanceDays, branches, consents, dayEvents, departments, employees, faceTemplates, media, schedules, toRule, withTenant } from '@adone/db';
import { computeDay, localDate, monthDays, shiftFor, type DayResult, type DayStatus, type Shift } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope } from './scope';

export interface ProfileDay {
  date: string;
  shift: Shift | null;
  status: DayStatus | null;
  workedMinutes: number;
  lateMinutes: number;
  open: boolean;
  suspicious: boolean;
}

export async function employeeProfile(user: TenantUser, id: string, month: string) {
  const tz = user.tenantTimezone;
  const today = localDate(new Date(), tz);
  return withTenant(user.tenantId, async (tx) => {
    const [row] = await tx
      .select({ e: employees, s: schedules, departmentName: departments.name, branchName: branches.name })
      .from(employees)
      .leftJoin(schedules, eq(schedules.id, employees.scheduleId))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(branches, eq(branches.id, employees.branchId))
      .where(eq(employees.id, id))
      .limit(1);
    if (!row) return null;
    const scope = await departmentScope(tx, user);
    if (scope && (!row.e.departmentId || !scope.includes(row.e.departmentId))) return null;

    const dates = monthDays(month);
    const rule = row.s ? toRule(row.s) : null;
    const [stored, faces, [consent], templates] = await Promise.all([
      tx.select().from(attendanceDays).where(and(eq(attendanceDays.employeeId, id), gte(attendanceDays.workDate, dates[0]!), lte(attendanceDays.workDate, dates.at(-1)!))),
      tx.select({ id: media.id, createdAt: media.createdAt, mime: media.mime }).from(media).where(and(eq(media.employeeId, id), eq(media.kind, 'face_sample'))).orderBy(desc(media.createdAt)).limit(3),
      tx.select({ version: consents.version, acceptedAt: consents.acceptedAt }).from(consents).where(and(eq(consents.employeeId, id), eq(consents.kind, 'biometric'))).orderBy(desc(consents.acceptedAt)).limit(1),
      tx.select({ quality: faceTemplates.quality, createdAt: faceTemplates.createdAt }).from(faceTemplates).where(and(eq(faceTemplates.employeeId, id), eq(faceTemplates.isActive, true))).orderBy(desc(faceTemplates.createdAt)),
    ]);
    const byDate = new Map(stored.map((d) => [d.workDate, d]));
    // Bugun — jonli (ochiq kun «hozirgacha»); attendance_days 10 daqiqada bir yangilanadi
    let live: DayResult | null = null;
    if (dates.includes(today)) {
      const evs = await dayEvents(tx, id, today);
      if (evs.length) live = computeDay({ events: evs, shift: rule ? shiftFor(rule, today, tz) : null, now: new Date() });
    }
    const days: ProfileDay[] = dates.map((date) => {
      const shift = rule ? shiftFor(rule, date, tz) : null;
      if (date === today && live) return { date, shift, status: live.status, workedMinutes: live.workedMinutes, lateMinutes: live.lateMinutes, open: live.open, suspicious: live.suspicious };
      const d = byDate.get(date);
      if (d) return { date, shift, status: d.status, workedMinutes: d.workedMinutes, lateMinutes: d.lateMinutes, open: d.isOpen, suspicious: d.suspicious };
      return { date, shift, status: null, workedMinutes: 0, lateMinutes: 0, open: false, suspicious: false };
    });
    return { scope, e: row.e, schedule: row.s, departmentName: row.departmentName, branchName: row.branchName, days, today, faces, templates, consent: consent ?? null };
  });
}

/** Oylik ko'rsatkichlar (profil KPI). */
export function profileTotals(days: ProfileDay[], today: string) {
  const t = { planned: 0, plannedSoFar: 0, worked: 0, workedDays: 0, lateDays: 0, lateMinutes: 0, absent: 0, leave: 0 };
  for (const d of days) {
    if (d.shift) {
      t.planned++;
      if (d.date <= today) t.plannedSoFar++;
    }
    if (d.workedMinutes > 0 || d.status === 'present' || d.status === 'late') {
      t.workedDays++;
      t.worked += d.workedMinutes;
    }
    if (d.status === 'late') { t.lateDays++; t.lateMinutes += d.lateMinutes; }
    if (d.status === 'absent') t.absent++;
    if (d.status === 'leave') t.leave++;
  }
  return t;
}

