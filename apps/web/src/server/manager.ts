import 'server-only';
/**
 * Rahbar Mini App'i (egasi, admin, bo'lim boshlig'i — xodim yozuvi bo'lmaganlar): bugungi davomat, kutilayotgan qarorlar,
 * vazifalar nazorati va berish, hisobot. Hammasi panelning o'sha server funksiyalari orqali (`TenantUser` ko'rinishida) —
 * rol va bo'lim cheklovi bir xil.
 */
import { can, reportPeriod } from '@adone/core';
import { appOrigin } from '@/lib/host';
import { memberAsTenantUser, type TgMember } from '@/lib/tg/session';
import { listDay, summarize, today } from './attendance';
import { pendingEmployees } from './dashboard';
import { listLeaves } from './leave';
import { buildReport } from './reports';
import { assignOptions, listTasks, taskDetail, taskKpis, type TaskTab, type TaskView } from './task-queries';

export async function managerToday(m: TgMember) {
  const tu = memberAsTenantUser(m);
  const date = today(tu);
  const rows = await listDay(tu, { date });
  return { date, rows, counts: summarize(rows) };
}

export async function managerDecisions(m: TgMember) {
  const tu = memberAsTenantUser(m);
  const [employees, leaves, assigned, self] = await Promise.all([
    pendingEmployees(tu, 50),
    listLeaves(tu, 'pending'),
    listTasks(tu, { view: 'berilgan', tab: 'review' }),
    listTasks(tu, { view: 'ozi', tab: 'review' }),
  ]);
  const tasks = [...assigned.rows, ...self.rows].sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
  return { employees, leaves: leaves.rows, tasks, total: employees.length + leaves.rows.length + tasks.length };
}

/** Pastki menyu uchun: panel manzili, kutilayotgan qarorlar soni, «Hisobot» tabi (faqat `reports` — egasi, admin). */
export function managerShell(m: TgMember, pending: number) {
  return { panelUrl: appOrigin(), pending, reports: can(m.role, 'reports') };
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

// ---------- Hisobot ----------

/** Davr bo'yicha yig'ma (panel /hisobotlar bilan bir xil hisob). Faqat `reports` huquqi bo'lsa. */
export async function managerReport(m: TgMember, preset: string | undefined) {
  if (!can(m.role, 'reports')) return null;
  const tu = memberAsTenantUser(m);
  const t = today(tu);
  const period = reportPeriod(preset, t);
  return { today: t, period, report: await buildReport(tu, { period }) };
}
