import Link from 'next/link';
import { can, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@adone/core';
import type { TgMember } from '@/lib/tg/session';
import { MANAGER_TASK_TABS, managerDecisions, managerShell, managerTasks } from '@/server/manager';
import type { TaskListRow, TaskTab, TaskView } from '@/server/task-queries';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { dueText, PRIORITY_DOT, STATUS_PILL } from '@/components/tasks/task-card';
import { TgPage } from './tg-shell';

type SP = Record<string, string | string[] | undefined>;

/** Rahbar Mini App'i — «Vazifalar»: berilgan / o'zi qo'shgan ishlar, holat tablari (soni bilan), har qator → vazifa sahifasi. */
export async function ManagerTasks({ m, sp }: { m: TgMember; sp: SP }) {
  const view: TaskView = sp.kor === 'ozi' ? 'ozi' : sp.kor === 'mening' ? 'mening' : 'berilgan';
  const tab: TaskTab = MANAGER_TASK_TABS.some((t) => t.id === sp.tab) ? (sp.tab as TaskTab) : 'all';
  const [{ rows, counts, batches }, d] = await Promise.all([managerTasks(m, view, tab), managerDecisions(m)]);
  const url = (patch: { kor?: TaskView; tab?: TaskTab }) => {
    const p = new URLSearchParams();
    const k = patch.kor ?? view;
    const t = patch.tab ?? tab;
    if (k !== 'berilgan') p.set('kor', k);
    if (t !== 'all') p.set('tab', t);
    const s = p.toString();
    return `/tg/vazifalar${s ? `?${s}` : ''}`;
  };
  return (
    <TgPage manager={managerShell(m, d.total)}>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Vazifalar</h1>
          {can(m.role, 'tasks') && <Link href="/tg/vazifa-berish" className="flex h-9 items-center gap-1 rounded-full bg-primary px-3.5 text-[13px] font-bold text-white"><Icon name="add" size={18} />Vazifa berish</Link>}
        </div>
        {sp.yuborildi && <p className="m-0 flex items-center gap-2 rounded-2xl bg-success-tint p-3.5 text-sm font-semibold text-success"><Icon name="check_circle" fill />{view === 'mening' ? 'Hisobot yuborildi — vazifa bergan rahbar tekshiradi.' : 'Vazifa yuborildi — xodim Telegram\u2019da xabar oldi.'}</p>}

        <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
          {([['berilgan', 'Berilgan'], ['ozi', "O'zi qo'shgan"], ['mening', 'Menga']] as const).map(([k, l]) => (
            <Link key={k} href={url({ kor: k, tab: 'all' })} className={`flex-1 rounded-full py-2 text-center ${view === k ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>{l}</Link>
          ))}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {MANAGER_TASK_TABS.map((t) => {
            const n = counts[t.id];
            const on = tab === t.id;
            return (
              <Link key={t.id} href={url({ tab: t.id })} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ${on ? 'border-primary bg-primary-tint text-primary' : 'border-line bg-card text-muted'}`}>
                {t.label}{n > 0 && <span className={`tnum rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-primary text-white' : t.id === 'overdue' ? 'bg-danger-tint text-danger' : 'bg-subtle'}`}>{n}</span>}
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[24px] bg-card px-4 py-8 text-center shadow-[var(--shadow-card)]">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary"><Icon name="task_alt" size={26} fill /></span>
            <p className="m-0 text-sm font-semibold">{tab === 'all' ? (view === 'ozi' ? "O'zi qo'shgan ish yo'q" : view === 'mening' ? 'Sizga berilgan vazifa yo‘q' : 'Hozircha vazifa yo‘q') : 'Bu bo‘limda vazifa yo‘q'}</p>
            {view === 'berilgan' && tab === 'all' && <p className="m-0 text-[13px] text-muted">«Vazifa berish» — xodim Telegram&apos;da xabar va tugmalar oladi.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((r) => <Row key={r.id} r={r} tz={m.tz} batch={batches.get(r.batchId)} />)}
          </div>
        )}
      </div>
    </TgPage>
  );
}

function Row({ r, tz, batch }: { r: TaskListRow; tz: string; batch?: { total: number; approved: number } }) {
  return (
    <Link href={`/tg/vazifa/${r.id}`} className={`flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] ${r.overdue ? 'ring-1 ring-danger/40' : ''}`}>
      <div className="flex items-start gap-3">
        <Avatar name={r.assigneeName} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-snug font-bold">{r.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted">{r.assigneeName}{r.departmentName ? ` · ${r.departmentName}` : ''}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_PILL[r.status]}`}>{TASK_STATUS_LABELS[r.status]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
        {r.dueAt && <span className={`flex items-center gap-1 font-semibold ${r.overdue ? 'text-danger' : ''}`}><Icon name="schedule" size={15} />{dueText(r.dueAt, tz)}{r.overdue ? ' · o‘tdi' : ''}</span>}
        <span className="flex items-center gap-1 text-muted"><span className={`size-1.5 rounded-full ${PRIORITY_DOT[r.priority]}`} />{TASK_PRIORITY_LABELS[r.priority]}</span>
        {r.recurring && <span className="flex items-center gap-1 text-muted"><Icon name="repeat" size={15} />Takroriy</span>}
        {r.rating ? <span className="text-warning">{'★'.repeat(r.rating)}</span> : null}
        {batch && batch.total > 1 && <span className="tnum text-muted">{batch.approved}/{batch.total} tasdiqlandi</span>}
      </div>
    </Link>
  );
}
