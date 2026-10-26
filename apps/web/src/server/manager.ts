import 'server-only';
/**
 * Rahbar Mini App'i (egasi, admin, bo'lim boshlig'i — xodim yozuvi bo'lmaganlar): bugungi davomat va kutilayotgan qarorlar.
 * Hammasi panelning o'sha server funksiyalari orqali (`TenantUser` ko'rinishida) — rol va bo'lim cheklovi bir xil.
 */
import { memberAsTenantUser, type TgMember } from '@/lib/tg/session';
import { listDay, summarize, today } from './attendance';
import { pendingEmployees } from './dashboard';
import { listLeaves } from './leave';
import { listTasks } from './task-queries';

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
