import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDate, isoWeekday, KANBAN_COLUMNS, KANBAN_LABELS, kanbanColumn, TASK_PRIORITIES, TASK_PRIORITY_LABELS, WEEKDAY_LONG, type KanbanColumn, type TaskPriority } from '@adone/core';
import { withTenant } from '@adone/db';
import { requireArea } from '@/lib/auth/guard';
import { today } from '@/server/attendance';
import { assignOptions, listTasks, selfPendingCount, taskKpis, type TaskFilter, type TaskListRow, type TaskTab, type TaskView } from '@/server/task-queries';
import { selfTasksNeedApproval } from '@/server/tasks';
import { addWorkAction, createTaskAction } from '@/lib/actions/tasks';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { AssignFields } from '@/components/tasks/assign-fields';
import { WorkFields } from '@/components/tasks/work-fields';
import { FilterPills, TaskSearch } from '@/components/tasks/task-filters';
import { dueText, minutesText, PRIORITY_DOT, StatusPill, TaskCard } from '@/components/tasks/task-card';

export const metadata: Metadata = { title: 'Vazifalar' };

const VIEWS: Array<[TaskView, string]> = [['berilgan', 'Berilgan'], ['ozi', "O'zi qo'shgan"], ['mening', 'Mening ishlarim']];
const TABS: Array<[TaskTab, string]> = [['all', 'Barchasi'], ['new', 'Yangi'], ['progress', 'Jarayonda'], ['review', 'Tekshiruvda'], ['overdue', "Muddati o'tgan"], ['done', 'Tasdiqlangan'], ['cancelled', 'Bekor']];
const COL_DOT: Record<KanbanColumn, string> = { new: 'bg-primary', progress: 'bg-navy', review: 'bg-warning', done: 'bg-success' };
const DUE: Array<[NonNullable<TaskFilter['due']>, string]> = [['bugun', 'Bugun'], ['ertaga', 'Ertaga'], ['hafta', 'Shu hafta'], ['otgan', "Muddati o'tgan"]];
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);

export default async function TasksPage({ searchParams }: PageProps<'/vazifalar'>) {
  const user = await requireArea('tasks');
  const sp = await searchParams;
  const view = (VIEWS.map((v) => v[0]) as string[]).includes(String(sp.kor)) ? (String(sp.kor) as TaskView) : 'berilgan';
  const tab = (TABS.map((v) => v[0]) as string[]).includes(String(sp.holat)) ? (String(sp.holat) as TaskTab) : 'all';
  const layout = sp.tur === 'royxat' ? 'list' : 'kanban';
  const f: TaskFilter = {
    view, tab, assignee: uuid(sp.ijrochi), department: uuid(sp.bolim),
    priority: (TASK_PRIORITIES as readonly string[]).includes(String(sp.muhim)) ? (String(sp.muhim) as TaskPriority) : undefined,
    due: DUE.some((d) => d[0] === sp.muddat) ? (sp.muddat as TaskFilter['due']) : undefined,
    q: typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : undefined,
  };
  const t = today(user);
  const tz = user.tenantTimezone;
  const [{ rows, counts, batches }, kpi, options, selfPending, needsApproval] = await Promise.all([
    listTasks(user, f), taskKpis(user, view), assignOptions(user), selfPendingCount(user),
    withTenant(user.tenantId, (tx) => selfTasksNeedApproval(tx)),
  ]);
  const params = { kor: view === 'berilgan' ? undefined : view, holat: tab === 'all' ? undefined : tab, tur: layout === 'list' ? 'royxat' : undefined, ijrochi: f.assignee, bolim: f.department, muhim: f.priority, muddat: f.due, q: f.q || undefined };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) p.set(k, v);
    return `/vazifalar${p.size ? `?${p}` : ''}`;
  };
  const deps = [...new Map(options.filter((o) => o.departmentId).map((o) => [o.departmentId!, o.department!])).entries()];
  const assignDrawer = (open = false) => (
    <FormDrawer trigger={<><Icon name="add" />Vazifa berish</>} triggerClass="btn-primary h-11 pr-[22px] pl-[18px] text-sm" title="Vazifa berish" subtitle="Xodim Telegram orqali xabar oladi"
      action={createTaskAction} submitLabel="Yuborish" defaultOpen={open}>
      <AssignFields options={options} from={user.name} today={t} preselect={f.assignee ? [f.assignee] : []} />
    </FormDrawer>
  );

  // Kanban: ustun → to'plam bo'yicha guruh (bir topshiriqning shu ustundagi nusxalari bitta kartada)
  const cols = new Map<KanbanColumn, TaskListRow[][]>(KANBAN_COLUMNS.map((c) => [c, []]));
  const seen = new Map<string, TaskListRow[]>();
  for (const r of rows) {
    const c = kanbanColumn(r.status);
    if (!c) continue;
    const key = `${c}:${r.batchId}`;
    const g = seen.get(key);
    if (g) g.push(r);
    else { const n = [r]; seen.set(key, n); cols.get(c)!.push(n); }
  }

  const kpis = [
    { label: 'Faol vazifalar', value: kpi.active, icon: 'assignment', tone: 'bg-primary-tint text-primary', link: href({ holat: undefined }) },
    { label: 'Tekshiruvda', value: kpi.review, icon: 'pending_actions', tone: 'bg-warning-tint text-warning', link: href({ holat: 'review' }) },
    { label: "Muddati o'tgan", value: kpi.overdue, icon: 'alarm', tone: 'bg-danger-tint text-danger', link: href({ holat: 'overdue' }) },
    { label: "O'z vaqtida", value: kpi.onTimePct == null ? '—' : `${kpi.onTimePct}%`, icon: 'verified', tone: 'bg-success-tint text-success', link: href({ holat: 'done' }) },
  ];

  return (
    <>
      <PageHeader title="Vazifalar" badge={`${kpi.active} faol`} subtitle={`Bugun ${formatDate(`${t}T12:00:00Z`)}, ${WEEKDAY_LONG[isoWeekday(t) - 1]}`} alert={kpi.review > 0}
        actions={
          <>
            <FormDrawer trigger={<><Icon name="add" />Ish qo&apos;shish</>} triggerClass="btn-secondary h-11 text-sm" title="Ish qo'shish" subtitle="O'zingiz qilgan yoki rejalashtirgan ish" action={addWorkAction}>
              <WorkFields today={t} needsApproval={user.role !== 'owner' && needsApproval} />
            </FormDrawer>
            {assignDrawer(sp.ber === '1')}
          </>
        } />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.link} className="card group flex items-center gap-4 p-5 transition hover:shadow-[var(--shadow-frame)]">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] ${k.tone}`}><Icon name={k.icon} size={22} fill /></span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium text-muted">{k.label}</span>
              <span className="tnum block text-[28px] leading-8 font-extrabold tracking-[-0.03em]">{k.value}</span>
            </span>
            <Icon name="arrow_outward" size={18} className="self-start text-placeholder group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-card p-1 shadow-[var(--shadow-card)]">
          {VIEWS.map(([k, l]) => (
            <Link key={k} href={href({ kor: k === 'berilgan' ? undefined : k, holat: undefined })}
              className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold ${view === k ? 'bg-navy text-white' : 'text-ink-2 hover:bg-subtle'}`}>
              {l}{k === 'ozi' && selfPending > 0 && <span className={`tnum rounded-full px-1.5 text-[11px] font-bold ${view === k ? 'bg-white/20' : 'bg-primary-tint text-primary'}`}>{selfPending}</span>}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-full p-1">
          {([['list', 'Ro‘yxat', 'view_list'], ['kanban', 'Kanban', 'view_kanban']] as const).map(([k, l, icon]) => (
            <Link key={k} href={href({ tur: k === 'list' ? 'royxat' : undefined })}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${layout === k ? 'bg-card text-ink shadow-[var(--shadow-card)]' : 'text-muted hover:text-ink'}`}>
              <Icon name={icon} size={18} className={layout === k ? 'text-primary' : ''} />{l}
            </Link>
          ))}
        </div>
      </div>

      <section className="card flex flex-col gap-4 p-5 max-sm:p-4">
        <div className="flex flex-wrap items-center gap-1 border-b border-line-soft pb-3">
          {TABS.filter(([k]) => k !== 'cancelled' || counts.cancelled > 0).map(([k, l]) => (
            <Link key={k} href={href({ holat: k === 'all' ? undefined : k })}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap ${tab === k ? 'bg-subtle font-bold text-ink' : 'font-medium text-muted hover:text-ink'}`}>
              {l}
              {(k === 'review' || k === 'overdue') && counts[k] > 0 && <span className={`tnum rounded-full px-1.5 text-[11px] font-bold ${k === 'overdue' ? 'bg-danger-tint text-danger' : 'bg-warning-tint text-warning'}`}>{counts[k]}</span>}
            </Link>
          ))}
          <TaskSearch params={params} />
        </div>
        <FilterPills params={params} pills={[
          { key: 'ijrochi', label: 'Ijrochi', options: options.map((o) => ({ value: o.id, label: o.name })) },
          { key: 'bolim', label: "Bo'lim", options: deps.map(([id, name]) => ({ value: id, label: name })) },
          { key: 'muhim', label: 'Muhimlik', options: TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] })) },
          { key: 'muddat', label: 'Muddat', options: DUE.map(([v, l]) => ({ value: v, label: l })) },
        ]} />

        {rows.length === 0 && (tab === 'all' || layout === 'list') ? (
          <EmptyState text={view === 'mening' ? "Sizga tegishli ish yo'q. «Ish qo'shish» bilan o'zingiz qilgan yoki rejalashtirgan ishni kiriting." : view === 'ozi' ? "Xodimlar o'zi qo'shgan ishlar shu yerda ko'rinadi (botda «➕ Ish qo'shish»)." : "Hali vazifa yo'q. Birinchi vazifani bering — xodim Telegram'da xabar oladi."}>
            {view === 'berilgan' && !f.q && assignDrawer()}
          </EmptyState>
        ) : layout === 'kanban' && tab !== 'cancelled' ? (
          <div className="overflow-x-auto">
            <div className="grid min-w-[980px] grid-cols-4 gap-4">
              {KANBAN_COLUMNS.map((c) => {
                const groups = cols.get(c)!;
                const n = groups.reduce((s, g) => s + g.length, 0);
                return (
                  <div key={c} className="flex min-h-[200px] flex-col gap-3 rounded-[20px] bg-page p-3">
                    <div className="flex items-center gap-2 px-1.5 pt-1">
                      <span className={`size-2 rounded-full ${COL_DOT[c]}`} />
                      <span className="text-sm font-bold">{KANBAN_LABELS[c]}</span>
                      <span className="tnum text-xs font-semibold text-muted">{n}</span>
                    </div>
                    {groups.map((g) => <TaskCard key={`${c}:${g[0]!.batchId}`} rows={g} batch={batches.get(g[0]!.batchId)} tz={tz} />)}
                    {groups.length === 0 && <div className="rounded-2xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-placeholder">Bo&apos;sh</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead className="text-left text-xs text-placeholder">
                <tr className="border-b border-line-soft"><th className="py-2.5 pr-3 font-medium">Vazifa</th><th className="px-3 font-medium">Ijrochi</th><th className="px-3 font-medium">Muddat</th><th className="px-3 font-medium">Muhimlik</th><th className="px-3 font-medium">Holat</th><th className="px-3 font-medium">Baho</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F4F5F7] hover:bg-page">
                    <td className="py-3 pr-3"><Link href={`/vazifalar/${r.id}`} className="font-bold hover:text-primary">{r.title}</Link>
                      <div className="text-xs text-muted">{r.source === 'assigned' ? (r.recurring ? 'Takroriy' : 'Berilgan') : r.source === 'self_done' ? "O'zi qo'shgan · bajarilgan" : "O'zi qo'shgan · reja"}{r.spentMinutes ? ` · ${minutesText(r.spentMinutes)}` : ''}</div></td>
                    <td className="px-3"><span className="flex items-center gap-2"><Avatar name={r.assigneeName} size={26} /><span><span className="block font-semibold">{r.assigneeName}</span><span className="block text-xs text-muted">{r.departmentName ?? ''}</span></span></span></td>
                    <td className={`tnum px-3 ${r.overdue ? 'font-bold text-danger' : ''}`}>{r.dueAt ? dueText(r.dueAt, tz) : '—'}</td>
                    <td className="px-3"><span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${PRIORITY_DOT[r.priority]}`} />{TASK_PRIORITY_LABELS[r.priority]}</span></td>
                    <td className="px-3"><StatusPill status={r.status} /></td>
                    <td className="px-3 text-warning">{r.rating ? '★'.repeat(r.rating) : <span className="text-placeholder">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState text="Bu filtr bo'yicha vazifa yo'q." />}
          </div>
        )}
      </section>
    </>
  );
}
