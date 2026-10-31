import 'server-only';
/**
 * «Nazorat» (2026-10-31): admin bo'limni mezonlar bo'yicha tekshiradi — Mini App «Nazorat» tabi (egasi, admin). YAGONA yozish nuqtasi.
 *   - mezonlar — ishxona sozlamasi (`settings.inspection.criteria`, core inspection.ts), bo'limga tegishlilari ko'rsatiladi;
 *   - yozuv `inspections` (append-only, RLS 0018), ✗ da izoh + rasm (`media` attachment, javobgar xodimga bog'lanadi);
 *   - har ✗ → javobgar xodimga AVTOMATIK vazifa (mavjud oqim: `createTasks`, «<Bo'lim>: <mezon>», muddat 1 soat, isbot rasm,
 *     beruvchi — tekshirgan admin, Telegram xabari task_notify orqali); shu bo'lim+mezon bo'yicha ochiq vazifa bo'lsa — yangisi ochilmaydi;
 *   - javobgar = `departments.responsible_employee_id`, bo'sh bo'lsa — bo'lim boshlig'i xodim bo'lsa (employees.user_id = manager_user_id).
 * Xodim tekshiruvi (shu kun, egasi talabi): admin alohida xodimni `settings.inspection.employeeCriteria` bo'yicha tekshiradi —
 *   `inspections.employee_id`, bo'lim — xodimniki (snapshot), javobgar — xodimning o'zi, ✗ → «Nazorat: <mezon>» vazifa xodimga.
 * Javobgar biriktirish tekshiruv ekranidan ham (`setResponsible`) — panel bo'lim formasi bilan bir xil qoida (faol xodim).
 * Ish haqi: javobgarning oydagi ✗ soni → `pay_rules.inspectionFailPenalty` (server/payroll.ts) — xodim tekshiruvi ✗ ham shu yerga.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
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

export interface EmployeeRow {
  id: string; name: string; position: string | null;
  departmentId: string | null; departmentName: string | null;
  criteria: InspectionCriterion[];
}

/** Faol xodimlar (bo'lim bo'yicha tartibda) + har biriga tegishli xodim mezonlari. Tekshiruv ekrani va javobgar tanlash uchun. */
export async function inspectionEmployees(user: TenantUser, tx?: Tx): Promise<EmployeeRow[]> {
  return inTenant(user.tenantId, tx, async (tx) => {
    const settings = await readSettings(tx);
    const rows = await tx
      .select({ id: employees.id, name: employees.fullName, position: employees.position, departmentId: employees.departmentId, departmentName: departments.name })
      .from(employees).leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(eq(employees.status, 'active')).orderBy(asc(departments.name), asc(employees.fullName));
    return rows.map((e) => ({ ...e, criteria: criteriaFor(settings.inspection.employeeCriteria, e.departmentId) }));
  });
}

/** Bo'limga «Nazorat» javobgarini biriktirish (tekshiruv ekranidan). Qoida panel bilan bir xil: faol xodim, bo'sh — olib tashlash. */
export async function setResponsible(user: TenantUser, departmentId: string, employeeId: string | null): Promise<string | null> {
  return withTenant(user.tenantId, async (tx) => {
    if (employeeId) {
      const [e] = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.status, 'active'))).limit(1);
      if (!e) return 'Xodim topilmadi yoki faol emas';
    }
    const [r] = await tx.update(departments).set({ responsibleEmployeeId: employeeId }).where(and(eq(departments.id, departmentId), eq(departments.isActive, true))).returning({ id: departments.id });
    if (!r) return "Bo'lim topilmadi";
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'department.update', entity: 'department', entityId: departmentId, meta: { responsibleEmployeeId: employeeId, from: 'miniapp' } });
    return null;
  });
}

export type SaveInput = {
  departmentId?: string;
  /** Berilsa — xodim tekshiruvi (departmentId e'tiborga olinmaydi) */
  employeeId?: string;
  items: Array<{ criterion: string; ok: boolean; note?: string | null; photo?: StoredMedia | null }>;
};
export type SaveResult = { ok: true; id: string; fail: number; tasks: number; responsible: string | null; subject: string } | { ok: false; error: string };

/**
 * Tekshiruvni saqlash + ✗ bo'yicha vazifalar. Faqat `inspections` ruxsati (egasi, admin).
 * Bo'lim: vazifa bo'lim javobgariga «<Bo'lim>: <mezon>»; xodim: vazifa xodimning o'ziga «Nazorat: <mezon>».
 */
export async function saveInspection(user: TenantUser, input: SaveInput): Promise<SaveResult> {
  return withTenant(user.tenantId, async (tx) => {
    let subject: { kind: 'department' | 'employee'; id: string; name: string; departmentId: string | null; criteria: InspectionCriterion[]; responsible: { id: string; name: string } | null };
    if (input.employeeId) {
      const emp = (await inspectionEmployees(user, tx)).find((e) => e.id === input.employeeId);
      if (!emp) return { ok: false, error: 'Xodim topilmadi yoki faol emas' };
      if (!emp.criteria.length) return { ok: false, error: 'Xodim uchun mezon belgilanmagan — Sozlamalar → Nazorat → Xodim mezonlari' };
      subject = { kind: 'employee', id: emp.id, name: emp.name, departmentId: emp.departmentId, criteria: emp.criteria, responsible: { id: emp.id, name: emp.name } };
    } else {
      const dep = (await inspectionDepartments(user, tx)).find((d) => d.id === input.departmentId);
      if (!dep) return { ok: false, error: "Bo'lim topilmadi" };
      if (!dep.criteria.length) return { ok: false, error: "Bu bo'lim uchun mezon belgilanmagan — Sozlamalar → Nazorat" };
      subject = { kind: 'department', id: dep.id, name: dep.name, departmentId: dep.id, criteria: dep.criteria, responsible: dep.responsible ? { id: dep.responsible.id, name: dep.responsible.name } : null };
    }
    // Rasmlar — bazaga (fayl allaqachon diskda, actions/miniapp.ts); javobgarga bog'lanadi (media route bo'lim chegarasi uchun)
    const withMedia: Array<{ criterion: string; ok: boolean; note: string | null; mediaId: string | null }> = [];
    for (const it of input.items) {
      let mediaId: string | null = null;
      if (!it.ok && it.photo) mediaId = await insertMedia(tx, { ...it.photo, employeeId: subject.responsible?.id ?? null });
      withMedia.push({ criterion: it.criterion, ok: it.ok, note: it.note ?? null, mediaId });
    }
    const items = buildItems(subject.criteria, withMedia);
    if (!items) return { ok: false, error: 'Hech bir mezon belgilanmadi' };
    const now = new Date();
    const workDate = localDate(now, user.tenantTimezone);
    const fails = items.filter((i) => !i.ok);
    const taskIds: string[] = [];
    const titlePrefix = subject.kind === 'department' ? subject.name : 'Nazorat';
    if (fails.length && subject.responsible) {
      // Shu mezon bo'yicha ochiq vazifa bormi (takror ochilmaydi)
      const titles = fails.map((f) => inspectionTaskTitle(titlePrefix, subject.criteria.find((c) => c.id === f.criterion)!.label));
      const open = await tx.select({ title: taskBatches.title }).from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
        .where(and(eq(tasks.assigneeEmployeeId, subject.responsible.id), inArray(tasks.status, OPEN), inArray(taskBatches.title, titles)));
      const openTitles = new Set(open.map((o) => o.title));
      for (const f of fails) {
        const label = subject.criteria.find((c) => c.id === f.criterion)!.label;
        const title = inspectionTaskTitle(titlePrefix, label);
        if (openTitles.has(title)) continue;
        const { taskIds: made } = await createTasks(tx, {
          tenantId: user.tenantId, source: 'assigned', title, description: f.note ? `Nazorat: ${f.note}` : "Nazorat tekshiruvida kamchilik topildi — to'g'irlab, rasm bilan hisobot bering.",
          priority: 'high', proofs: ['photo'], checklist: [], dueAt: new Date(now.getTime() + FIX_HOURS * 3600_000),
          assignees: [{ employeeId: subject.responsible.id }], createdBy: { userId: user.id },
        });
        taskIds.push(...made);
        openTitles.add(title);
      }
    }
    const [row] = await tx.insert(inspections).values({
      tenantId: user.tenantId, departmentId: subject.departmentId, employeeId: subject.kind === 'employee' ? subject.id : null,
      inspectorUserId: user.id, responsibleEmployeeId: subject.responsible?.id ?? null,
      at: now, workDate, items, okCount: items.length - fails.length, failCount: fails.length, taskIds,
    }).returning({ id: inspections.id });
    await tx.insert(auditLog).values({
      tenantId: user.tenantId, userId: user.id, action: 'inspection.create', entity: 'inspection', entityId: row!.id,
      meta: { [subject.kind]: subject.name, ok: items.length - fails.length, fail: fails.length, tasks: taskIds.length },
    });
    return { ok: true, id: row!.id, fail: fails.length, tasks: taskIds.length, responsible: subject.responsible?.name ?? null, subject: subject.name };
  });
}

export interface InspectionRow extends InspectionLike {
  id: string; workDate: string; departmentName: string | null; inspectorName: string | null;
  /** Bo'lim tekshiruvida — javobgar; xodim tekshiruvida — xodimning o'zi */
  responsibleName: string | null; taskIds: string[];
  okCount: number; failCount: number;
}

/** Tekshiruv sarlavhasi: bo'lim nomi yoki xodim ismi. */
export function inspectionSubject(r: Pick<InspectionRow, 'employeeId' | 'departmentName' | 'responsibleName'>): string {
  return r.employeeId ? (r.responsibleName ?? 'Xodim') : (r.departmentName ?? "Bo'lim");
}

/** Davrdagi tekshiruvlar (ishxona sanasi bo'yicha), yangisi oldin. `kind` — faqat bo'lim yoki faqat xodim tekshiruvlari. */
export async function listInspections(user: TenantUser, q: { from: string; to: string; departmentId?: string; employeeId?: string; kind?: 'department' | 'employee'; limit?: number }, tx?: Tx): Promise<InspectionRow[]> {
  return inTenant(user.tenantId, tx, async (tx) => {
    const rows = await tx
      .select({
        id: inspections.id, departmentId: inspections.departmentId, employeeId: inspections.employeeId, responsibleEmployeeId: inspections.responsibleEmployeeId, at: inspections.at, workDate: inspections.workDate,
        items: inspections.items, okCount: inspections.okCount, failCount: inspections.failCount, taskIds: inspections.taskIds,
        departmentName: departments.name, inspectorName: users.name, responsibleName: employees.fullName,
      })
      .from(inspections)
      .leftJoin(departments, eq(departments.id, inspections.departmentId))
      .leftJoin(users, eq(users.id, inspections.inspectorUserId))
      .leftJoin(employees, eq(employees.id, inspections.responsibleEmployeeId))
      .where(and(
        gte(inspections.workDate, q.from), lte(inspections.workDate, q.to),
        q.departmentId ? eq(inspections.departmentId, q.departmentId) : undefined,
        q.employeeId ? eq(inspections.employeeId, q.employeeId) : undefined,
        q.kind === 'department' ? isNull(inspections.employeeId) : q.kind === 'employee' ? isNotNull(inspections.employeeId) : undefined,
      ))
      .orderBy(desc(inspections.at)).limit(q.limit ?? 500);
    return rows.map((r) => ({ ...r, items: r.items as InspectionItem[] }));
  });
}

export interface Overview {
  /** Hammasi (bo'lim + xodim), yangisi oldin */
  rows: InspectionRow[];
  /** Faqat bo'lim tekshiruvlari bo'yicha */
  stats: InspectionStats;
  departments: Array<{ id: string; name: string; responsible: string | null; stats: InspectionStats; last: InspectionRow | null; openTasks: number }>;
  /** Bo'lim tekshiruvlari javobgarlari (xodim tekshiruvlari kirmaydi) */
  responsible: Array<{ id: string; name: string; stats: InspectionStats }>;
  days: Array<{ date: string; byDepartment: Map<string, InspectionStats>; stats: InspectionStats }>;
  /** Xodim tekshiruvlari: faol xodimlar, reyting (tekshirilganlar oldin) */
  employees: Array<{ id: string; name: string; departmentId: string | null; departmentName: string | null; stats: InspectionStats; last: InspectionRow | null; openTasks: number }>;
  employeeStats: InspectionStats;
  openTasks: number;
}

/** Hisobot: bo'limlar (reyting), javobgarlar, kun × bo'lim jadvali, xodimlar reytingi, ochiq ✗ vazifalar. */
export async function inspectionOverview(user: TenantUser, q: { from: string; to: string; departmentId?: string }): Promise<Overview> {
  return withTenant(user.tenantId, async (tx) => {
    const [deps, emps, rows] = await Promise.all([inspectionDepartments(user, tx), inspectionEmployees(user, tx), listInspections(user, q, tx)]);
    const depRows = rows.filter((r) => !r.employeeId);
    const empRows = rows.filter((r) => r.employeeId);
    const allTaskIds = rows.flatMap((r) => r.taskIds);
    const open = allTaskIds.length ? await tx.select({ id: tasks.id }).from(tasks).where(and(inArray(tasks.id, allTaskIds), inArray(tasks.status, OPEN))) : [];
    const openIds = new Set(open.map((o) => o.id));
    const openByDep = new Map<string, number>();
    const openByEmp = new Map<string, number>();
    for (const r of rows) for (const t of r.taskIds) if (openIds.has(t)) {
      if (r.employeeId) openByEmp.set(r.employeeId, (openByEmp.get(r.employeeId) ?? 0) + 1);
      else if (r.departmentId) openByDep.set(r.departmentId, (openByDep.get(r.departmentId) ?? 0) + 1);
    }
    const byDep = statsBy(depRows, (r) => r.departmentId);
    const byResp = statsBy(depRows, (r) => r.responsibleEmployeeId);
    const byEmp = statsBy(empRows, (r) => r.employeeId);
    const respNames = new Map(depRows.filter((r) => r.responsibleEmployeeId && r.responsibleName).map((r) => [r.responsibleEmployeeId!, r.responsibleName!]));
    const dates = [...new Set(depRows.map((r) => r.workDate))].sort().reverse();
    return {
      rows,
      stats: inspectionStats(depRows),
      departments: rankInspections(deps.filter((d) => !q.departmentId || d.id === q.departmentId).map((d) => ({
        id: d.id, name: d.name, responsible: d.responsible?.name ?? null, stats: byDep.get(d.id) ?? inspectionStats([]),
        last: depRows.find((r) => r.departmentId === d.id) ?? null, openTasks: openByDep.get(d.id) ?? 0,
      }))),
      responsible: rankInspections([...byResp].map(([id, stats]) => ({ id, name: respNames.get(id) ?? '—', stats }))),
      days: dates.map((date) => { const dayRows = depRows.filter((r) => r.workDate === date); return { date, byDepartment: statsBy(dayRows, (r) => r.departmentId), stats: inspectionStats(dayRows) }; }),
      employees: rankInspections(emps.filter((e) => !q.departmentId || e.departmentId === q.departmentId).map((e) => ({
        id: e.id, name: e.name, departmentId: e.departmentId, departmentName: e.departmentName, stats: byEmp.get(e.id) ?? inspectionStats([]),
        last: empRows.find((r) => r.employeeId === e.id) ?? null, openTasks: openByEmp.get(e.id) ?? 0,
      }))),
      employeeStats: inspectionStats(empRows),
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

