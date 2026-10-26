import 'server-only';
/** Vazifalar — panel ko'rinishlari (o'qish). Yozish — server/tasks.ts. Menejer faqat o'z bo'limi + o'zi bergan / o'z ishlari. */
import { aliasedTable, and, asc, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { departments, employees, media, taskBatches, taskEvents, taskReports, taskTemplates, tasks, users, withTenant, type Tx } from '@adone/db';
import { isOpenTask, isOverdue, kanbanColumn, localDate, onTime, type TaskPriority, type TaskProof, type TaskSource, type TaskStatus } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope } from './scope';
import { actorRole, loadTask } from './tasks';
import { pendingDeadlineFor } from './deadline';

export type TaskView = 'berilgan' | 'ozi' | 'mening';
export type TaskTab = 'all' | 'new' | 'progress' | 'review' | 'overdue' | 'done' | 'cancelled';

export interface TaskListRow {
  id: string;
  batchId: string;
  title: string;
  source: TaskSource;
  priority: TaskPriority;
  proofs: TaskProof[];
  checklist: number;
  status: TaskStatus;
  dueAt: Date | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  rating: number | null;
  spentMinutes: number | null;
  recurring: boolean;
  assigneeEmployeeId: string | null;
  assigneeName: string;
  departmentId: string | null;
  departmentName: string | null;
  overdue: boolean;
}

export interface TaskFilter {
  view: TaskView;
  tab: TaskTab;
  assignee?: string;
  department?: string;
  priority?: TaskPriority;
  due?: 'bugun' | 'ertaga' | 'hafta' | 'otgan';
  q?: string;
}

const assigneeUser = aliasedTable(users, 'assignee_user');

/** Foydalanuvchining xodim yozuvlari (rahbar o'zi ham xodim bo'lsa — «Mening ishlarim»). */
async function ownEmployeeIds(tx: Tx, userId: string) {
  return (await tx.select({ id: employees.id }).from(employees).where(eq(employees.userId, userId))).map((e) => e.id);
}

async function scopedRows(tx: Tx, user: TenantUser, view: TaskView) {
  const scope = await departmentScope(tx, user);
  const mine = await ownEmployeeIds(tx, user.id);
  const mineCond = or(eq(tasks.assigneeUserId, user.id), mine.length ? inArray(tasks.assigneeEmployeeId, mine) : sql`false`);
  const visible = scope === null
    ? sql`true`
    : or(mineCond, eq(taskBatches.createdByUserId, user.id), scope.length ? inArray(employees.departmentId, scope) : sql`false`);
  const viewCond = view === 'mening' ? mineCond : view === 'ozi' ? inArray(taskBatches.source, ['self_plan', 'self_done']) : eq(taskBatches.source, 'assigned');
  // Yopilganlar — oxirgi 30 kun (doska og'irlashmasin)
  const recent = or(inArray(tasks.status, ['new', 'accepted', 'in_progress', 'submitted', 'revision']), gte(tasks.updatedAt, sql`now() - interval '30 days'`));
  return tx
    .select({ t: tasks, b: taskBatches, empName: employees.fullName, userName: assigneeUser.name, departmentId: employees.departmentId, departmentName: departments.name })
    .from(tasks)
    .innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
    .leftJoin(employees, eq(employees.id, tasks.assigneeEmployeeId))
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(assigneeUser, eq(assigneeUser.id, tasks.assigneeUserId))
    .where(and(visible, viewCond, recent))
    .orderBy(asc(tasks.dueAt), desc(tasks.createdAt))
    .limit(1000);
}

function toRow(r: Awaited<ReturnType<typeof scopedRows>>[number], now: Date): TaskListRow {
  return {
    id: r.t.id, batchId: r.b.id, title: r.b.title, source: r.b.source, priority: r.b.priority, proofs: r.b.proofs as TaskProof[], checklist: r.b.checklist.length,
    status: r.t.status, dueAt: r.t.dueAt, submittedAt: r.t.submittedAt, approvedAt: r.t.approvedAt, createdAt: r.t.createdAt, rating: r.t.rating,
    spentMinutes: r.t.spentMinutes, recurring: !!r.b.templateId, assigneeEmployeeId: r.t.assigneeEmployeeId,
    assigneeName: r.empName ?? r.userName ?? '—', departmentId: r.departmentId, departmentName: r.departmentName,
    overdue: isOverdue({ status: r.t.status, dueAt: r.t.dueAt }, now),
  };
}

export function matchTab(r: TaskListRow, tab: TaskTab): boolean {
  if (tab === 'all') return r.status !== 'cancelled';
  if (tab === 'overdue') return r.overdue;
  if (tab === 'cancelled') return r.status === 'cancelled';
  const col = kanbanColumn(r.status);
  return tab === 'review' ? col === 'review' : tab === 'done' ? col === 'done' : col === tab;
}

export async function listTasks(user: TenantUser, f: TaskFilter) {
  const tz = user.tenantTimezone;
  const now = new Date();
  const today = localDate(now, tz);
  return withTenant(user.tenantId, async (tx) => {
    const all = (await scopedRows(tx, user, f.view)).map((r) => toRow(r, now));
    const q = f.q?.toLowerCase();
    const filtered = all.filter((r) => {
      if (f.assignee && r.assigneeEmployeeId !== f.assignee) return false;
      if (f.department && r.departmentId !== f.department) return false;
      if (f.priority && r.priority !== f.priority) return false;
      if (q && !r.title.toLowerCase().includes(q) && !r.assigneeName.toLowerCase().includes(q)) return false;
      if (f.due) {
        if (!r.dueAt) return false;
        const d = localDate(r.dueAt, tz);
        if (f.due === 'bugun' && d !== today) return false;
        if (f.due === 'ertaga' && d !== new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) return false;
        if (f.due === 'hafta' && (d < today || d > new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10))) return false;
        if (f.due === 'otgan' && !r.overdue) return false;
      }
      return true;
    });
    const counts = Object.fromEntries((['all', 'new', 'progress', 'review', 'overdue', 'done', 'cancelled'] as TaskTab[]).map((k) => [k, filtered.filter((r) => matchTab(r, k)).length])) as Record<TaskTab, number>;
    // Bir topshiriq N nusxa: kartada «3 ijrochi · 1/3 tasdiqlandi»
    const batches = new Map<string, { total: number; approved: number; names: string[]; statuses: TaskStatus[] }>();
    for (const r of all) {
      const s = batches.get(r.batchId) ?? { total: 0, approved: 0, names: [], statuses: [] };
      s.total++;
      if (r.status === 'approved') s.approved++;
      s.names.push(r.assigneeName);
      s.statuses.push(r.status);
      batches.set(r.batchId, s);
    }
    return { rows: filtered.filter((r) => matchTab(r, f.tab)), counts, batches };
  });
}

/** KPI (dizayn): faol, tekshiruvda, muddati o'tgan, o'z vaqtida % (oxirgi 30 kun). Tanlangan ko'rinish bo'yicha. */
export async function taskKpis(user: TenantUser, view: TaskView) {
  const now = new Date();
  return withTenant(user.tenantId, async (tx) => {
    const rows = (await scopedRows(tx, user, view)).map((r) => toRow(r, now));
    const submitted = rows.filter((r) => r.submittedAt && now.getTime() - r.submittedAt.getTime() < 30 * 86_400_000 && r.status !== 'cancelled');
    const timely = submitted.filter((r) => onTime(r)).length;
    return {
      active: rows.filter((r) => isOpenTask(r.status)).length,
      review: rows.filter((r) => r.status === 'submitted').length,
      overdue: rows.filter((r) => r.overdue).length,
      onTimePct: submitted.length ? Math.round((timely / submitted.length) * 100) : null,
      selfCount: view === 'ozi' ? rows.length : null,
    };
  });
}

/** «O'zi qo'shgan» tab yonidagi son (tekshiruv kutayotganlari). */
export async function selfPendingCount(user: TenantUser) {
  const rows = await withTenant(user.tenantId, (tx) => scopedRows(tx, user, 'ozi'));
  return rows.filter((r) => r.t.status === 'submitted').length;
}

/** Vazifa sahifasi: nusxa, uning to'plamidagi boshqa nusxalar, tarix, hisobotlar, foydalanuvchining o'rni. */
export async function taskDetail(user: TenantUser, id: string) {
  return withTenant(user.tenantId, async (tx) => {
    const row = await loadTask(tx, id);
    if (!row) return null;
    const actor = { userId: user.id, role: user.role };
    const role = await actorRole(tx, actor, row);
    const scope = await departmentScope(tx, user);
    if (!role && scope !== null && row.batch.createdByUserId !== user.id) return null;
    const actorUser = aliasedTable(users, 'actor_user');
    const actorEmp = aliasedTable(employees, 'actor_emp');
    const [copies, events, reports, creator, template] = await Promise.all([
      tx.select({ id: tasks.id, status: tasks.status, rating: tasks.rating, submittedAt: tasks.submittedAt, empName: employees.fullName, userName: users.name })
        .from(tasks).leftJoin(employees, eq(employees.id, tasks.assigneeEmployeeId)).leftJoin(users, eq(users.id, tasks.assigneeUserId))
        .where(eq(tasks.batchId, row.batch.id)).orderBy(asc(employees.fullName)),
      tx.select({ e: taskEvents, userName: actorUser.name, empName: actorEmp.fullName })
        .from(taskEvents).leftJoin(actorUser, eq(actorUser.id, taskEvents.actorUserId)).leftJoin(actorEmp, eq(actorEmp.id, taskEvents.actorEmployeeId))
        .where(eq(taskEvents.taskId, id)).orderBy(asc(taskEvents.createdAt)),
      tx.select().from(taskReports).where(eq(taskReports.taskId, id)).orderBy(desc(taskReports.createdAt)),
      row.batch.createdByUserId ? tx.select({ name: users.name }).from(users).where(eq(users.id, row.batch.createdByUserId)).limit(1)
        : row.batch.createdByEmployeeId ? tx.select({ name: employees.fullName }).from(employees).where(eq(employees.id, row.batch.createdByEmployeeId)).limit(1) : Promise.resolve([]),
      row.batch.templateId ? tx.select().from(taskTemplates).where(eq(taskTemplates.id, row.batch.templateId)).limit(1) : Promise.resolve([]),
    ]);
    const mediaIds = reports.flatMap((r) => r.mediaIds);
    const files = mediaIds.length ? await tx.select({ id: media.id, mime: media.mime }).from(media).where(inArray(media.id, mediaIds)) : [];
    const [assignee] = row.task.assigneeEmployeeId
      ? await tx.select({ name: employees.fullName, position: employees.position, departmentName: departments.name, telegram: employees.telegramUsername })
        .from(employees).leftJoin(departments, eq(departments.id, employees.departmentId)).where(eq(employees.id, row.task.assigneeEmployeeId)).limit(1)
      : await tx.select({ name: users.name, position: sql<string | null>`null`, departmentName: sql<string | null>`null`, telegram: sql<string | null>`null` })
        .from(users).where(eq(users.id, row.task.assigneeUserId ?? '00000000-0000-0000-0000-000000000000')).limit(1);
    const deadline = await pendingDeadlineFor(tx, id);
    return {
      task: row.task, batch: row.batch, role, assignee: assignee ?? null, creator: creator[0]?.name ?? null, template: template[0] ?? null, deadline,
      copies: copies.map((c) => ({ ...c, name: c.empName ?? c.userName ?? '—' })),
      events: events.map((x) => ({ ...x.e, actor: x.userName ?? x.empName ?? 'Tizim' })),
      reports, mime: new Map(files.map((f) => [f.id, f.mime])),
    };
  });
}

/** «Kimga» tanlovi: faol xodimlar (menejer — faqat o'z bo'limi) + bo'lim va filial nomlari. */
export async function assignOptions(user: TenantUser) {
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const rows = await tx.execute<{ id: string; name: string; department_id: string | null; department: string | null; branch_id: string | null; branch: string | null; linked: boolean }>(sql`
      select e.id, e.full_name as name, e.department_id, d.name as department, e.branch_id, b.name as branch, (e.telegram_user_id is not null) as linked
      from employees e left join departments d on d.id = e.department_id left join branches b on b.id = e.branch_id
      where e.status = 'active' order by e.full_name`);
    const list = rows.rows.filter((r) => scope === null || (r.department_id && scope.includes(r.department_id)));
    return list.map((r) => ({ id: r.id, name: r.name, departmentId: r.department_id, department: r.department, branchId: r.branch_id, branch: r.branch, linked: r.linked }));
  });
}


/** Xodim ish jurnali (profil → Vazifalar, §7a): oydagi barcha ishlari kun bo'yicha + o'z vaqtida %. */
export async function employeeJournal(user: TenantUser, employeeId: string, month: string) {
  const tz = user.tenantTimezone;
  return withTenant(user.tenantId, async (tx) => {
    const rows = await tx
      .select({ t: tasks, b: taskBatches })
      .from(tasks)
      .innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .where(and(eq(tasks.assigneeEmployeeId, employeeId), sql`to_char(coalesce(${tasks.submittedAt}, ${tasks.createdAt}) at time zone ${tz}, 'YYYY-MM') = ${month}`))
      .orderBy(desc(sql`coalesce(${tasks.submittedAt}, ${tasks.createdAt})`));
    const items = rows.map(({ t, b }) => ({
      id: t.id, title: b.title, source: b.source, status: t.status, spentMinutes: t.spentMinutes, rating: t.rating,
      at: t.submittedAt ?? t.createdAt, day: localDate(t.submittedAt ?? t.createdAt, tz), onTime: onTime({ dueAt: t.dueAt, submittedAt: t.submittedAt }),
    }));
    const submitted = items.filter((i) => i.onTime !== null && i.status !== 'cancelled');
    return {
      items,
      onTimePct: submitted.length ? Math.round((submitted.filter((i) => i.onTime).length / submitted.length) * 100) : null,
      onTimeOf: [submitted.filter((i) => i.onTime).length, submitted.length] as const,
      doneCount: items.filter((i) => i.status === 'approved').length,
      minutes: items.reduce((s, i) => s + (i.status !== 'cancelled' ? (i.spentMinutes ?? 0) : 0), 0),
    };
  });
}

/** Bosh sahifa «Vazifalar bajarilishi»: oy bo'yicha o'z vaqtida %, o'tgan oy bilan farq va bo'limlar kesimi (4 ta). */
export async function onTimeStats(user: TenantUser, month: string, prevMonth: string) {
  const tz = user.tenantTimezone;
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const { rows } = await tx.execute<{ m: string; dep: string | null; total: number; ok: number }>(sql`
      select to_char(t.submitted_at at time zone ${tz}, 'YYYY-MM') as m, d.name as dep, count(*)::int as total,
             count(*) filter (where t.due_at is null or t.submitted_at <= t.due_at)::int as ok
      from tasks t left join employees e on e.id = t.assignee_employee_id left join departments d on d.id = e.department_id
      where t.submitted_at is not null and t.status <> 'cancelled'
        and to_char(t.submitted_at at time zone ${tz}, 'YYYY-MM') in (${month}, ${prevMonth})
        and ${scope === null ? sql`true` : scope.length ? sql`e.department_id in (${sql.join(scope.map((s) => sql`${s}::uuid`), sql`, `)})` : sql`false`}
      group by 1, 2`);
    const sum = (m: string): [number, number] => rows.filter((r) => r.m === m).reduce<[number, number]>((a, r) => [a[0] + r.ok, a[1] + r.total], [0, 0]);
    const [ok, total] = sum(month);
    const [pok, ptotal] = sum(prevMonth);
    const pct = total ? Math.round((ok / total) * 100) : null;
    const prev = ptotal ? Math.round((pok / ptotal) * 100) : null;
    const deps = rows.filter((r) => r.m === month).sort((a, b) => b.total - a.total).slice(0, 4)
      .map((r) => ({ name: r.dep ?? 'Boshqa', pct: Math.round((r.ok / r.total) * 100), total: r.total }));
    return { pct, prev, deps, total };
  });
}
