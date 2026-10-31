import 'server-only';
/**
 * Rahbar Mini App'i (egasi, admin, bo'lim boshlig'i — xodim yozuvi bo'lmaganlar): bugungi davomat, kutilayotgan qarorlar,
 * vazifalar nazorati va berish, xodim kartasi, hisobot, ish haqi. Hammasi panelning o'sha server funksiyalari orqali
 * (`TenantUser` ko'rinishida) — rol va bo'lim cheklovi bir xil.
 */
import { sql } from 'drizzle-orm';
import { withTenant } from '@adone/db';
import { addDays, can, reportPeriod } from '@adone/core';
import { appOrigin } from '@/lib/host';
import { memberAsTenantUser, type TgMember } from '@/lib/tg/session';
import { listDay, summarize, today, type DayRow } from './attendance';
import { pendingEmployees } from './dashboard';
import { listDeadlineRequests } from './deadline';
import { employeeOptions } from './employees';
import { listLeaves } from './leave';
import { payrollView } from './payroll';
import { employeeProfile } from './profile';
import { buildReport } from './reports';
import { departmentScope } from './scope';
import { assignOptions, employeeJournal, listTasks, taskDetail, taskKpis, type TaskTab, type TaskView } from './task-queries';

export async function managerToday(m: TgMember) {
  const tu = memberAsTenantUser(m);
  const date = today(tu);
  const rows = await listDay(tu, { date });
  return { date, rows, counts: summarize(rows) };
}

export interface SuspiciousItem { date: string; employee: Pick<DayRow, 'id' | 'fullName' | 'position' | 'departmentName' | 'branchName' | 'branchRadiusM'>; event: DayRow['events'][number] }

/** Hal qilinmagan shubhali keldi-ketdi (bugun va kecha): tuzatish (approve/void) qilinmagan hodisalar. */
export async function managerSuspicious(m: TgMember): Promise<SuspiciousItem[]> {
  const tu = memberAsTenantUser(m);
  const t = today(tu);
  const out: SuspiciousItem[] = [];
  for (const date of [addDays(t, -1), t]) {
    for (const r of await listDay(tu, { date })) {
      const resolved = new Set(r.events.filter((e) => e.kind === 'correction').map((e) => (e.meta as { target?: string } | null)?.target).filter(Boolean));
      for (const e of r.events) {
        if (e.checkStatus !== 'suspicious' || resolved.has(e.id)) continue;
        out.push({ date, employee: { id: r.id, fullName: r.fullName, position: r.position, departmentName: r.departmentName, branchName: r.branchName, branchRadiusM: r.branchRadiusM }, event: e });
      }
    }
  }
  return out.sort((a, b) => b.event.at.getTime() - a.event.at.getTime());
}

export async function managerDecisions(m: TgMember) {
  const tu = memberAsTenantUser(m);
  const [employees, leaves, assigned, self, suspicious, deadlines] = await Promise.all([
    pendingEmployees(tu, 50),
    listLeaves(tu, 'pending'),
    listTasks(tu, { view: 'berilgan', tab: 'review' }),
    listTasks(tu, { view: 'ozi', tab: 'review' }),
    managerSuspicious(m),
    listDeadlineRequests(tu, 'pending'),
  ]);
  const tasks = [...assigned.rows, ...self.rows].sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
  return {
    employees, leaves: leaves.rows, tasks, suspicious, deadlines,
    total: employees.length + leaves.rows.length + tasks.length + suspicious.length + deadlines.length,
  };
}

/**
 * Menyu belgisi uchun YENGIL son (2-bosqich 2.1): oldin har rahbar sahifasi to'liq `managerDecisions` ni (ikki kunlik davomat,
 * vazifalar ro'yxatlari — ~6 tranzaksiya) faqat shu son uchun chaqirardi. Endi bitta tranzaksiya, 5 ta COUNT — o'sha qoidalar:
 * yangi xodim, ruxsat so'rovi, tekshiruvdagi hisobot, muddat so'rovi, hal qilinmagan shubhali keldi-ketdi (bugun/kecha).
 * Menejer — o'z bo'limi (+ o'zi bergan/o'ziga berilgan vazifa).
 */
export async function managerPendingCount(m: TgMember): Promise<number> {
  const tu = memberAsTenantUser(m);
  const t = today(tu);
  return withTenant(m.tenantId, async (tx) => {
    const scope = await departmentScope(tx, tu);
    const dep = (col: ReturnType<typeof sql>) => (scope === null ? sql`true` : scope.length ? sql`${col} in (${sql.join(scope.map((s) => sql`${s}::uuid`), sql`, `)})` : sql`false`);
    const { rows } = await tx.execute<{ n: number }>(sql`
      select
        (select count(*) from employees e where e.status = 'pending' and ${dep(sql`e.department_id`)})
      + (select count(*) from leave_requests l join employees e on e.id = l.employee_id where l.status = 'pending' and ${dep(sql`e.department_id`)})
      + (select count(*) from tasks t join task_batches b on b.id = t.batch_id left join employees e on e.id = t.assignee_employee_id
           where t.status = 'submitted' and (${dep(sql`e.department_id`)} or b.created_by_user_id = ${m.userId}::uuid)
             and t.assignee_user_id is distinct from ${m.userId}::uuid and e.user_id is distinct from ${m.userId}::uuid)
      + (select count(*) from deadline_requests r join tasks t on t.id = r.task_id join task_batches b on b.id = t.batch_id join employees e on e.id = r.employee_id
           where r.status = 'pending' and (${dep(sql`e.department_id`)} or b.created_by_user_id = ${m.userId}::uuid))
      + (select count(*) from attendance_events a join employees e on e.id = a.employee_id
           where a.check_status = 'suspicious' and a.work_date >= ${addDays(t, -1)}::date and e.status = 'active' and ${dep(sql`e.department_id`)}
             and not exists (select 1 from attendance_events c where c.employee_id = a.employee_id and c.work_date = a.work_date and c.kind = 'correction' and c.meta->>'target' = a.id::text))
      as n`);
    return Number(rows[0]?.n ?? 0);
  });
}

/** Pastki menyu uchun: panel manzili, kutilayotgan qarorlar soni, «Hisobot» tabi (faqat `reports` — egasi, admin). */
export function managerShell(m: TgMember, pending: number) {
  return { panelUrl: appOrigin(), pending, reports: can(m.role, 'reports'), inspections: can(m.role, 'inspections') };
}

// ---------- Vazifalar ----------

export const MANAGER_TASK_TABS: ReadonlyArray<{ id: TaskTab; label: string }> = [
  { id: 'all', label: 'Hammasi' }, { id: 'new', label: 'Yangi' }, { id: 'progress', label: 'Jarayonda' }, { id: 'review', label: 'Tekshiruvda' },
  { id: 'overdue', label: "Muddati o'tgan" }, { id: 'done', label: 'Bajarilgan' },
];

export async function managerTasks(m: TgMember, view: TaskView, tab: TaskTab) {
  return listTasks(memberAsTenantUser(m), { view, tab });
}

export async function managerTaskKpis(m: TgMember) {
  return taskKpis(memberAsTenantUser(m), 'berilgan');
}

export async function managerTaskDetail(m: TgMember, id: string) {
  return taskDetail(memberAsTenantUser(m), id);
}

export async function managerAssignOptions(m: TgMember) {
  return assignOptions(memberAsTenantUser(m));
}

// ---------- Xodim ----------

/** Xodim kartasi: profil (oy tabeli, bugun jonli), ish jurnali, bugungi qator (isbotlar). Menejer — faqat o'z bo'limi (employeeProfile null). */
export async function managerEmployee(m: TgMember, id: string, month: string) {
  const tu = memberAsTenantUser(m);
  const [p, journal, rows] = await Promise.all([employeeProfile(tu, id, month), employeeJournal(tu, id, month), listDay(tu, { date: today(tu) })]);
  if (!p) return null;
  return { p, journal, todayRow: rows.find((r) => r.id === id) ?? null };
}

/** «Xodim qo'shish» formasi tanlovlari — menejerga faqat o'z bo'limlari. */
export async function managerFormOptions(m: TgMember) {
  const tu = memberAsTenantUser(m);
  const [o, scope] = await Promise.all([employeeOptions(m.tenantId), withTenant(m.tenantId, (tx) => departmentScope(tx, tu))]);
  return { ...o, departments: scope ? o.departments.filter((d) => scope.includes(d.id)) : o.departments };
}

// ---------- Hisobot, ish haqi ----------

/** Davr bo'yicha yig'ma (panel /hisobotlar bilan bir xil hisob). Faqat `reports` huquqi bo'lsa. */
export async function managerReport(m: TgMember, preset: string | undefined) {
  if (!can(m.role, 'reports')) return null;
  const tu = memberAsTenantUser(m);
  const t = today(tu);
  const period = reportPeriod(preset, t);
  return { today: t, period, report: await buildReport(tu, { period }) };
}

/** Oylik vedomost (qoralama avtomatik qayta hisoblanadi, yopilgan oy o'zgarmaydi). Faqat `payroll` (egasi, admin). */
export async function managerPayroll(m: TgMember, month: string) {
  if (!can(m.role, 'payroll')) return null;
  return payrollView(m.tenantId, month);
}
