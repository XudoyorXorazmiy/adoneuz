import 'server-only';
/**
 * «Nazorat» (2026-10-31): admin bo'limni mezonlar bo'yicha tekshiradi — Mini App «Nazorat» tabi (egasi, admin). YAGONA yozish nuqtasi.
 *   - mezonlar — ishxona sozlamasi (`settings.inspection.criteria`, core inspection.ts), bo'limga tegishlilari ko'rsatiladi;
 *   - yozuv `inspections` (append-only, RLS 0018), ✗ da izoh + rasm (`media` attachment, javobgar xodimga bog'lanadi);
 *   - har ✗ → javobgar xodimga AVTOMATIK vazifa (mavjud oqim: `createTasks`, «<Bo'lim>: <mezon>», muddat 1 soat, isbot rasm,
 *     beruvchi — tekshirgan admin, Telegram xabari task_notify orqali); shu bo'lim+mezon bo'yicha ochiq vazifa bo'lsa — yangisi ochilmaydi;
 *   - javobgar = `departments.responsible_employee_id`, bo'sh bo'lsa — bo'lim boshlig'i xodim bo'lsa (employees.user_id = manager_user_id).
 * Ish haqi: javobgarning oydagi ✗ soni → `pay_rules.inspectionFailPenalty` (server/payroll.ts).
 */
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { auditLog, departments, employees, inspections, taskBatches, tasks, users, withTenant, type Tx } from '@adone/db';
import {
  buildItems, criteriaFor, inspectionStats, inspectionTaskTitle, localDate, rankInspections, statsBy,
  type InspectionCriterion, type InspectionItem, type InspectionLike, type InspectionStats, type TaskStatus,
} from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { insertMedia, type StoredMedia } from './media';
import { readSettings } from './settings';
import { createTasks } from './tasks';
import { inTenant } from './scope';

const OPEN: TaskStatus[] = ['new', 'accepted', 'in_progress', 'submitted', 'revision'];
/** ✗ bo'yicha vazifa muddati */
const FIX_HOURS = 1;

export interface DepartmentRow {
  id: string; name: string;
  responsible: { id: string; name: string; fallback: boolean } | null;
  criteria: InspectionCriterion[];
}

/** Bo'limlar + javobgar (yoki boshliq-xodim) + tegishli mezonlar. */
export async function inspectionDepartments(user: TenantUser, tx?: Tx): Promise<DepartmentRow[]> {
  return inTenant(user.tenantId, tx, async (tx) => {
    const settings = await readSettings(tx);
    const deps = await tx
      .select({ id: departments.id, name: departments.name, responsibleId: departments.responsibleEmployeeId, managerUserId: departments.managerUserId })
      .from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name));
    const ids = deps.map((d) => d.responsibleId).filter((x): x is string => !!x);
    const heads = deps.map((d) => d.managerUserId).filter((x): x is string => !!x);
    const emps = ids.length || heads.length
      ? await tx.select({ id: employees.id, name: employees.fullName, userId: employees.userId, status: employees.status }).from(employees)
        .where(or(ids.length ? inArray(employees.id, ids) : sql`false`, heads.length ? inArray(employees.userId, heads) : sql`false`))
      : [];
    return deps.map((d) => {
      const direct = d.responsibleId ? emps.find((e) => e.id === d.responsibleId && e.status === 'active') : null;
      const head = !direct && d.managerUserId ? emps.find((e) => e.userId === d.managerUserId && e.status === 'active') : null;
      const r = direct ?? head;
      return { id: d.id, name: d.name, responsible: r ? { id: r.id, name: r.name, fallback: !direct } : null, criteria: criteriaFor(settings.inspection.criteria, d.id) };
    });
  });
}

export interface SaveInput {
  departmentId: string;
  items: Array<{ criterion: string; ok: boolean; note?: string | null; photo?: StoredMedia | null }>;
}
export type SaveResult = { ok: true; id: string; fail: number; tasks: number; responsible: string | null; department: string } | { ok: false; error: string };

/** Tekshiruvni saqlash + ✗ bo'yicha vazifalar. Faqat `inspections` ruxsati (egasi, admin). */
export async function saveInspection(user: TenantUser, input: SaveInput): Promise<SaveResult> {
  return withTenant(user.tenantId, async (tx) => {
    const [dep] = (await inspectionDepartments(user, tx)).filter((d) => d.id === input.departmentId);
    if (!dep) return { ok: false, error: "Bo'lim topilmadi" };
    if (!dep.criteria.length) return { ok: false, error: "Bu bo'lim uchun mezon belgilanmagan — Sozlamalar → Nazorat" };
    // Rasmlar — bazaga (fayl allaqachon diskda, actions/miniapp.ts); javobgarga bog'lanadi (media route bo'lim chegarasi uchun)
    const withMedia: Array<{ criterion: string; ok: boolean; note: string | null; mediaId: string | null }> = [];
    for (const it of input.items) {
      let mediaId: string | null = null;
      if (!it.ok && it.photo) mediaId = await insertMedia(tx, { ...it.photo, employeeId: dep.responsible?.id ?? null });
      withMedia.push({ criterion: it.criterion, ok: it.ok, note: it.note ?? null, mediaId });
    }
    const items = buildItems(dep.criteria, withMedia);
    if (!items) return { ok: false, error: 'Hech bir mezon belgilanmadi' };
    const now = new Date();
    const workDate = localDate(now, user.tenantTimezone);
    const fails = items.filter((i) => !i.ok);
    const taskIds: string[] = [];
    if (fails.length && dep.responsible) {
      // Shu bo'lim + mezon bo'yicha ochiq vazifa bormi (takror ochilmaydi)
      const titles = fails.map((f) => inspectionTaskTitle(dep.name, dep.criteria.find((c) => c.id === f.criterion)!.label));
      const open = await tx.select({ title: taskBatches.title }).from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
        .where(and(eq(tasks.assigneeEmployeeId, dep.responsible.id), inArray(tasks.status, OPEN), inArray(taskBatches.title, titles)));
      const openTitles = new Set(open.map((o) => o.title));
      for (const f of fails) {
        const label = dep.criteria.find((c) => c.id === f.criterion)!.label;
        const title = inspectionTaskTitle(dep.name, label);
        if (openTitles.has(title)) continue;
        const { taskIds: made } = await createTasks(tx, {
          tenantId: user.tenantId, source: 'assigned', title, description: f.note ? `Nazorat: ${f.note}` : "Nazorat tekshiruvida kamchilik topildi — to'g'irlab, rasm bilan hisobot bering.",
          priority: 'high', proofs: ['photo'], checklist: [], dueAt: new Date(now.getTime() + FIX_HOURS * 3600_000),
          assignees: [{ employeeId: dep.responsible.id }], createdBy: { userId: user.id },
        });
        taskIds.push(...made);
        openTitles.add(title);
      }
    }
    const [row] = await tx.insert(inspections).values({
      tenantId: user.tenantId, departmentId: dep.id, inspectorUserId: user.id, responsibleEmployeeId: dep.responsible?.id ?? null,
      at: now, workDate, items, okCount: items.length - fails.length, failCount: fails.length, taskIds,
    }).returning({ id: inspections.id });
    await tx.insert(auditLog).values({
      tenantId: user.tenantId, userId: user.id, action: 'inspection.create', entity: 'inspection', entityId: row!.id,
      meta: { department: dep.name, ok: items.length - fails.length, fail: fails.length, tasks: taskIds.length },
    });
    return { ok: true, id: row!.id, fail: fails.length, tasks: taskIds.length, responsible: dep.responsible?.name ?? null, department: dep.name };
  });
}

export interface InspectionRow extends InspectionLike {
  id: string; workDate: string; departmentName: string; inspectorName: string | null; responsibleName: string | null; taskIds: string[];
  okCount: number; failCount: number;
}

/** Davrdagi tekshiruvlar (ishxona sanasi bo'yicha), yangisi oldin. */
export async function listInspections(user: TenantUser, q: { from: string; to: string; departmentId?: string; limit?: number }, tx?: Tx): Promise<InspectionRow[]> {
  return inTenant(user.tenantId, tx, async (tx) => {
    const rows = await tx
      .select({
        id: inspections.id, departmentId: inspections.departmentId, responsibleEmployeeId: inspections.responsibleEmployeeId, at: inspections.at, workDate: inspections.workDate,
        items: inspections.items, okCount: inspections.okCount, failCount: inspections.failCount, taskIds: inspections.taskIds,
        departmentName: departments.name, inspectorName: users.name, responsibleName: employees.fullName,
      })
      .from(inspections)
      .innerJoin(departments, eq(departments.id, inspections.departmentId))
      .leftJoin(users, eq(users.id, inspections.inspectorUserId))
      .leftJoin(employees, eq(employees.id, inspections.responsibleEmployeeId))
      .where(and(gte(inspections.workDate, q.from), lte(inspections.workDate, q.to), q.departmentId ? eq(inspections.departmentId, q.departmentId) : undefined))
      .orderBy(desc(inspections.at)).limit(q.limit ?? 500);
    return rows.map((r) => ({ ...r, items: r.items as InspectionItem[] }));
  });
}

export interface Overview {
  rows: InspectionRow[];
  stats: InspectionStats;
  departments: Array<{ id: string; name: string; responsible: string | null; stats: InspectionStats; last: InspectionRow | null; openTasks: number }>;
  responsible: Array<{ id: string; name: string; stats: InspectionStats }>;
  days: Array<{ date: string; byDepartment: Map<string, InspectionStats>; stats: InspectionStats }>;
  openTasks: number;
}

/** Hisobot: bo'limlar (reyting), javobgarlar, kun × bo'lim jadvali, ochiq ✗ vazifalar. */
export async function inspectionOverview(user: TenantUser, q: { from: string; to: string; departmentId?: string }): Promise<Overview> {
  return withTenant(user.tenantId, async (tx) => {
    const [deps, rows] = await Promise.all([inspectionDepartments(user, tx), listInspections(user, q, tx)]);
    const allTaskIds = rows.flatMap((r) => r.taskIds);
    const open = allTaskIds.length ? await tx.select({ id: tasks.id, dep: departments.id }).from(tasks)
      .innerJoin(employees, eq(employees.id, tasks.assigneeEmployeeId)).leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(and(inArray(tasks.id, allTaskIds), inArray(tasks.status, OPEN))) : [];
    const openByDep = new Map<string, number>();
    for (const r of rows) for (const t of r.taskIds) if (open.some((o) => o.id === t)) openByDep.set(r.departmentId, (openByDep.get(r.departmentId) ?? 0) + 1);
    const byDep = statsBy(rows, (r) => r.departmentId);
    const byResp = statsBy(rows, (r) => r.responsibleEmployeeId);
    const respNames = new Map(rows.filter((r) => r.responsibleEmployeeId && r.responsibleName).map((r) => [r.responsibleEmployeeId!, r.responsibleName!]));
    const dates = [...new Set(rows.map((r) => r.workDate))].sort().reverse();
    return {
      rows,
      stats: inspectionStats(rows),
      departments: rankInspections(deps.filter((d) => !q.departmentId || d.id === q.departmentId).map((d) => ({
        id: d.id, name: d.name, responsible: d.responsible?.name ?? null, stats: byDep.get(d.id) ?? inspectionStats([]),
        last: rows.find((r) => r.departmentId === d.id) ?? null, openTasks: openByDep.get(d.id) ?? 0,
      }))),
      responsible: rankInspections([...byResp].map(([id, stats]) => ({ id, name: respNames.get(id) ?? '—', stats }))),
      days: dates.map((date) => { const dayRows = rows.filter((r) => r.workDate === date); return { date, byDepartment: statsBy(dayRows, (r) => r.departmentId), stats: inspectionStats(dayRows) }; }),
      openTasks: open.length,
    };
  });
}

/** Ish haqi: davrda javobgar sifatida olingan ✗ soni (xodim → son). */
export async function inspectionFailsFor(tx: Tx, employeeIds: string[], from: string, to: string): Promise<Map<string, number>> {
  if (!employeeIds.length) return new Map();
  const rows = await tx.select({ emp: inspections.responsibleEmployeeId, n: sql<number>`sum(${inspections.failCount})::int` }).from(inspections)
    .where(and(inArray(inspections.responsibleEmployeeId, employeeIds), gte(inspections.workDate, from), lte(inspections.workDate, to)))
    .groupBy(inspections.responsibleEmployeeId);
  return new Map(rows.filter((r) => r.emp).map((r) => [r.emp!, r.n]));
}

