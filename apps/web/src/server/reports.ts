import 'server-only';
/**
 * Hisobotlar (panel → /hisobotlar, Excel). Faqat o'qish: davomat — `attendance_days` (yagona yig'ma), vazifalar — `tasks`.
 * Hisob — core `reports.ts` (sof funksiyalar). Ruxsat `reports` (egasi, admin); bo'lim cheklovi baribir qo'llanadi.
 */
import { and, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { attendanceDays, branches, departments, employees, media, taskBatches, taskReports, tasks, users, withTenant } from '@adone/db';
import { addDays, arrivalHistogram, attendanceStats, attentionReason, averageCame, dailySeries, localDate, periodDates, placeChange, rankBy, ratingScore, reportPeriod, taskStats, weekBuckets, zonedTime, type AttendanceStats, type ReportDay, type ReportPeriod, type ReportTask, type TaskSource, type TaskStats, type TaskStatus, isUuid } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope, inScope } from './scope';

export interface ReportFilter { period: ReportPeriod; branchId?: string; departmentId?: string }

export interface ReportEmp { id: string; name: string; position: string | null; departmentId: string | null; departmentName: string | null }

interface TaskRow extends ReportTask { title: string; assigneeUserId: string | null; approvedAt: Date | null }

const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

/** Davr ma'lumoti (joriy + solishtirish davri) — bitta tranzaksiyada. */
async function loadRaw(user: TenantUser, f: ReportFilter) {
  const tz = user.tenantTimezone;
  const { to, prevFrom } = f.period;
  const start = zonedTime(prevFrom, '00:00', tz);
  const end = zonedTime(addDays(to, 1), '00:00', tz);
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const emps = await tx
      .select({ id: employees.id, name: employees.fullName, position: employees.position, status: employees.status, departmentId: employees.departmentId, departmentName: departments.name })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(and(inArray(employees.status, ['active', 'disabled']), inScope(employees.departmentId, scope),
        f.branchId ? eq(employees.branchId, f.branchId) : undefined, f.departmentId ? eq(employees.departmentId, f.departmentId) : undefined))
      .orderBy(employees.fullName);
    if (emps.length === 0) return { emps, days: [], tasks: [] };
    const ids = emps.map((e) => e.id);
    const days = await tx.select().from(attendanceDays)
      .where(and(inArray(attendanceDays.employeeId, ids), gte(attendanceDays.workDate, prevFrom), lt(attendanceDays.workDate, addDays(to, 1))));
    const trows = await tx
      .select({ t: tasks, title: taskBatches.title, source: taskBatches.source })
      .from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      // Davr — vazifa yaratilgan sana (joriy + solishtirish davri)
      .where(and(inArray(tasks.assigneeEmployeeId, ids), gte(tasks.createdAt, start), lt(tasks.createdAt, end)))
      .orderBy(desc(sql`coalesce(${tasks.submittedAt}, ${tasks.createdAt})`))
      .limit(20_000);
    return {
      emps,
      days,
      tasks: trows.map(({ t, title, source }): TaskRow => ({
        id: t.id, employeeId: t.assigneeEmployeeId, assigneeUserId: t.assigneeUserId, source, status: t.status, title, createdAt: t.createdAt, dueAt: t.dueAt,
        submittedAt: t.submittedAt, approvedAt: t.approvedAt, rating: t.rating, revisionCount: t.revisionCount, spentMinutes: t.spentMinutes,
      })),
    };
  });
}

function toDay(d: typeof attendanceDays.$inferSelect): ReportDay {
  return {
    employeeId: d.employeeId, workDate: d.workDate, status: d.status,
    // Smenasi bor va boshlangan kun (bugun hali boshlanmagan smena — `off`)
    planned: !!d.shiftStart && d.status !== 'off' && d.status !== 'holiday',
    workedMinutes: d.workedMinutes, lateMinutes: d.lateMinutes, earlyLeaveMinutes: d.earlyLeaveMinutes, overtimeMinutes: d.overtimeMinutes,
    arrival: d.firstIn && d.shiftStart ? Math.round((d.firstIn.getTime() - d.shiftStart.getTime()) / 60_000) : null,
  };
}

export interface EmpAttendance { emp: ReportEmp; stats: AttendanceStats }
export interface EmpTasks { emp: ReportEmp; stats: TaskStats; last: Array<{ id: string; title: string; at: Date; rating: number | null; status: TaskStatus }> }
export interface EmpRating {
  emp: ReportEmp; score: number; place: number; change: number | null;
  attendance: number | null; onTime: number | null; rating: number | null; reason: string | null;
}

/** Hamma tablar uchun yig'ma (sahifa va Excel bir xil hisob). */
export async function buildReport(user: TenantUser, f: ReportFilter) {
  const tz = user.tenantTimezone;
  const now = new Date();
  const { from, to, prevFrom, prevTo } = f.period;
  const raw = await loadRaw(user, f);
  const cur = raw.days.filter((d) => inRange(d.workDate, from, to)).map(toDay);
  const prev = raw.days.filter((d) => inRange(d.workDate, prevFrom, prevTo)).map(toDay);
  const createdOn = (t: TaskRow) => localDate(t.createdAt, tz);
  const curTasks = raw.tasks.filter((t) => inRange(createdOn(t), from, to));
  const prevTasks = raw.tasks.filter((t) => inRange(createdOn(t), prevFrom, prevTo));

  // Faol xodimlar + davrda yozuvi bor o'chirilganlar
  const touched = new Set([...cur.map((d) => d.employeeId), ...curTasks.map((t) => t.employeeId)]);
  const emps: ReportEmp[] = raw.emps.filter((e) => e.status === 'active' || touched.has(e.id))
    .map((e) => ({ id: e.id, name: e.name, position: e.position, departmentId: e.departmentId, departmentName: e.departmentName }));
  const group = <T extends { employeeId: string | null }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) if (x.employeeId) m.set(x.employeeId, [...(m.get(x.employeeId) ?? []), x]);
    return m;
  };
  const curByEmp = group(cur);
  const prevByEmp = group(prev);
  const curTasksByEmp = group(curTasks);
  const prevTasksByEmp = group(prevTasks);

  // ---- Davomat ----
  const attRows: EmpAttendance[] = emps.map((emp) => ({ emp, stats: attendanceStats(curByEmp.get(emp.id) ?? []) }));
  const deptMap = new Map<string, { name: string; days: ReportDay[] }>();
  for (const r of emps) {
    const key = r.departmentId ?? '-';
    const g = deptMap.get(key) ?? { name: r.departmentName ?? "Bo'limsiz", days: [] };
    g.days.push(...(curByEmp.get(r.id) ?? []));
    deptMap.set(key, g);
  }
  const attendance = {
    total: attendanceStats(cur),
    prev: attendanceStats(prev),
    absentEmployees: attRows.filter((r) => r.stats.absent > 0).length,
    // Ustun balandligi — faol xodimlar (+ davrda davomati bor o'chirilganlar)
    series: dailySeries(cur, periodDates(from, to), raw.emps.filter((e) => e.status === 'active' || curByEmp.has(e.id)).length),
    histogram: arrivalHistogram(cur),
    departments: [...deptMap.values()].map((g) => ({ name: g.name, pct: attendanceStats(g.days).pct })).filter((d) => d.pct != null)
      .sort((a, b) => a.name.localeCompare(b.name)) as Array<{ name: string; pct: number }>,
    rows: attRows,
  };
  const avgCame = averageCame(attendance.series);

  // ---- Vazifalar ----
  const taskRows: EmpTasks[] = emps.map((emp) => {
    const list = curTasksByEmp.get(emp.id) ?? [];
    return {
      emp, stats: taskStats(list, now),
      last: list.filter((t) => t.source === 'assigned').slice(0, 5).map((t) => ({ id: t.id, title: t.title, at: t.submittedAt ?? t.createdAt, rating: t.rating, status: t.status })),
    };
  });
  // Davr ≤ 10 kun — kunlar, aks holda haftalar
  const short = periodDates(from, to).length <= 10;
  const buckets = (short ? periodDates(from, to).map((d) => ({ from: d, to: d, label: d.slice(8), range: `${d.slice(8)}.${d.slice(5, 7)}` })) : weekBuckets(from, to))
    .map((b) => {
      const s = taskStats(curTasks.filter((t) => inRange(createdOn(t), b.from, b.to)), now);
      return { label: b.label, range: b.range, given: s.given, onTime: s.onTime, late: s.late, avgRating: s.avgRating };
    });
  const tasksData = {
    total: taskStats(curTasks, now),
    prev: taskStats(prevTasks, now),
    buckets, bucketKind: short ? ('day' as const) : ('week' as const),
    rows: taskRows,
  };

  // ---- Reyting ----
  const parts = (days: ReportDay[], list: TaskRow[]) => {
    const a = attendanceStats(days);
    const t = taskStats(list, now);
    return { a, t, p: { attendance: a.rate, onTime: t.onTimeRate, rating: t.avgRating } };
  };
  const scored = emps.map((emp) => ({ emp, ...parts(curByEmp.get(emp.id) ?? [], curTasksByEmp.get(emp.id) ?? []) }));
  const ranked = rankBy(scored, (x) => ratingScore(x.p), (x) => x.emp.name);
  const prevPlaces = new Map(rankBy(emps.map((emp) => ({ emp, ...parts(prevByEmp.get(emp.id) ?? [], prevTasksByEmp.get(emp.id) ?? []) })), (x) => ratingScore(x.p), (x) => x.emp.name)
    .map((r) => [r.item.emp.id, r.place]));
  const ratingRows: EmpRating[] = ranked.map((r) => {
    const { a, t, p } = r.item;
    return {
      emp: r.item.emp, score: r.score, place: r.place, change: placeChange(r.place, prevPlaces.get(r.item.emp.id)),
      attendance: a.pct, onTime: t.onTimePct, rating: t.avgRating,
      reason: attentionReason({ ...p, late: a.late, absent: a.absent, tasksLate: t.late, avgRating: t.avgRating })?.text ?? null,
    };
  });
  const deptRank = rankBy([...new Set(emps.map((e) => e.departmentId ?? '-'))].map((id) => {
    const mine = emps.filter((e) => (e.departmentId ?? '-') === id);
    const pr = parts(mine.flatMap((e) => curByEmp.get(e.id) ?? []), mine.flatMap((e) => curTasksByEmp.get(e.id) ?? []));
    return { name: mine[0]?.departmentName ?? "Bo'limsiz", p: pr.p };
  }), (x) => ratingScore(x.p), (x) => x.name).map((r) => ({ name: r.item.name, score: r.score, place: r.place }));
  // Pastdagi 3 ta (90 dan past) — sababi bilan
  const attention = ratingRows.length > 3 ? ratingRows.filter((r) => r.score < 90 && r.reason).slice(-3).reverse() : [];

  return {
    period: f.period, emps, avgCame,
    hasData: cur.length > 0 || curTasks.length > 0,
    attendance, tasks: tasksData,
    rating: { rows: ratingRows, departments: deptRank, attention, hasPrev: prevPlaces.size > 0 },
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

// ---------- Ish jurnali ----------

export interface JournalFilter extends ReportFilter { employeeId?: string; source?: 'berilgan' | 'ozi' }

export interface JournalEntry {
  id: string; at: Date; day: string; name: string; employeeId: string | null; title: string; source: TaskSource; status: TaskStatus;
  spentMinutes: number | null; photos: Array<{ id: string; video: boolean }>;
}

const JOURNAL_LIMIT = 300;

/** Kim nima qildi: davrda topshirilgan (yoki yaratilgan) barcha ishlar, yangisi birinchi. Rahbarning o'z ishlari ham (filtrsiz). */
export async function loadJournal(user: TenantUser, f: JournalFilter) {
  const tz = user.tenantTimezone;
  const start = zonedTime(f.period.from, '00:00', tz);
  const end = zonedTime(addDays(f.period.to, 1), '00:00', tz);
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const at = sql<Date>`coalesce(${tasks.submittedAt}, ${tasks.createdAt})`;
    const filtered = !!(f.branchId || f.departmentId || f.employeeId || scope !== null);
    const rows = await tx
      .select({ t: tasks, title: taskBatches.title, source: taskBatches.source, empName: employees.fullName, userName: users.name })
      .from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .leftJoin(employees, eq(employees.id, tasks.assigneeEmployeeId))
      .leftJoin(users, eq(users.id, tasks.assigneeUserId))
      .where(and(
        ne(tasks.status, 'cancelled'),
        sql`${at} >= ${start} and ${at} < ${end}`,
        filtered ? and(inScope(employees.departmentId, scope), f.branchId ? eq(employees.branchId, f.branchId) : undefined,
          f.departmentId ? eq(employees.departmentId, f.departmentId) : undefined, f.employeeId ? eq(tasks.assigneeEmployeeId, f.employeeId) : undefined)
          : undefined,
        f.source === 'berilgan' ? eq(taskBatches.source, 'assigned') : f.source === 'ozi' ? inArray(taskBatches.source, ['self_plan', 'self_done']) : undefined,
      ))
      .orderBy(desc(at))
      .limit(JOURNAL_LIMIT + 1);
    const list = rows.slice(0, JOURNAL_LIMIT);
    const reports = list.length
      ? await tx.select({ taskId: taskReports.taskId, mediaIds: taskReports.mediaIds, spent: taskReports.spentMinutes }).from(taskReports)
        .where(inArray(taskReports.taskId, list.map((r) => r.t.id))).orderBy(desc(taskReports.createdAt))
      : [];
    const mediaIds = [...new Set(reports.flatMap((r) => r.mediaIds))];
    const mimes = mediaIds.length ? await tx.select({ id: media.id, mime: media.mime }).from(media).where(inArray(media.id, mediaIds)) : [];
    const mime = new Map(mimes.map((m) => [m.id, m.mime]));
    const byTask = new Map<string, typeof reports>();
    for (const r of reports) byTask.set(r.taskId, [...(byTask.get(r.taskId) ?? []), r]);
    const entries = list.map(({ t, title, source, empName, userName }): JournalEntry => {
      const rep = byTask.get(t.id) ?? [];
      const when = t.submittedAt ?? t.createdAt;
      return {
        id: t.id, at: when, day: localDate(when, tz), name: empName ?? userName ?? '—', employeeId: t.assigneeEmployeeId, title, source, status: t.status,
        spentMinutes: t.spentMinutes ?? rep.find((r) => r.spent != null)?.spent ?? null,
        photos: rep.flatMap((r) => r.mediaIds).filter((id) => mime.has(id)).slice(0, 3).map((id) => ({ id, video: !mime.get(id)!.startsWith('image/') })),
      };
    });
    // Bir xil ismli ikki xodim qo'shilib ketmasin — kalit id (xodim yo'q bo'lsa — ism)
    const people = new Map<string, { name: string; minutes: number; count: number }>();
    for (const e of entries) {
      const key = e.employeeId ?? `n:${e.name}`;
      const p = people.get(key) ?? { name: e.name, minutes: 0, count: 0 };
      p.minutes += e.spentMinutes ?? 0;
      p.count++;
      people.set(key, p);
    }
    return {
      entries,
      truncated: rows.length > JOURNAL_LIMIT,
      minutes: entries.reduce((a, e) => a + (e.spentMinutes ?? 0), 0),
      top: [...people.values()].sort((a, b) => b.minutes - a.minutes || b.count - a.count).slice(0, 4),
    };
  });
}

/** Filtrlar: filiallar, bo'limlar va jurnal uchun xodimlar ro'yxati. */
export async function reportOptions(user: TenantUser) {
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    // Bitta tranzaksiya mijozi — so'rovlar ketma-ket
    const bs = await tx.select({ id: branches.id, name: branches.name }).from(branches).orderBy(branches.name);
    const ds = await tx.select({ id: departments.id, name: departments.name }).from(departments).where(inScope(departments.id, scope)).orderBy(departments.name);
    const es = await tx.select({ id: employees.id, name: employees.fullName }).from(employees)
      .where(and(inArray(employees.status, ['active', 'disabled']), inScope(employees.departmentId, scope))).orderBy(employees.fullName);
    return { branches: bs, departments: ds, employees: es };
  });
}

// ---------- URL parametrlari (sahifa va Excel bir xil) ----------

const uuid = (v: unknown) => (isUuid(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** `davr`, `dan`, `gacha`, `filial`, `bolim`, `solishtir=0`. */
export function parseReportParams(sp: Record<string, string | string[] | undefined>, today: string) {
  return {
    period: reportPeriod(str(sp.davr), today, { from: str(sp.dan), to: str(sp.gacha) }),
    branchId: uuid(sp.filial),
    departmentId: uuid(sp.bolim),
    compare: sp.solishtir !== '0',
  };
}
