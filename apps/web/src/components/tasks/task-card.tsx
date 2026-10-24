import Link from 'next/link';
import { formatTime, localDate, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from '@adone/core';
import type { TaskListRow } from '@/server/task-queries';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

export const STATUS_PILL: Record<TaskStatus, string> = {
  new: 'bg-primary-tint text-primary',
  accepted: 'bg-navy text-white',
  in_progress: 'border-[1.5px] border-primary text-primary',
  submitted: 'bg-warning-tint text-warning',
  approved: 'bg-success-tint text-success',
  revision: 'bg-danger-tint text-danger',
  cancelled: 'bg-subtle text-muted',
};
export const STATUS_BAR: Record<TaskStatus, string> = {
  new: 'bg-primary-line', accepted: 'bg-primary', in_progress: 'bg-primary', submitted: 'bg-warning', approved: 'bg-success', revision: 'bg-danger', cancelled: 'bg-line',
};
export const PRIORITY_DOT: Record<TaskPriority, string> = { low: 'bg-placeholder', medium: 'bg-warning', high: 'bg-danger' };

export function StatusPill({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold ${STATUS_PILL[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}

/** «Bugun 17:00» / «Ertaga 18:00» / «Kecha 21:30» / «21.10 18:00». */
export function dueText(d: Date, tz: string, now = new Date()) {
  const day = localDate(d, tz);
  const today = localDate(now, tz);
  const shift = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const label = day === today ? 'Bugun' : day === shift(1) ? 'Ertaga' : day === shift(-1) ? 'Kecha' : day.slice(5).split('-').reverse().join('.');
  return `${label} ${formatTime(d, tz)}`;
}

/** 80 → «1 soat 20 daq» */
export function minutesText(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} soat${r ? ` ${r} daq` : ''}` : `${r} daq`;
}

/**
 * Kanban kartasi (dizayn). Bir topshiriqning shu ustundagi bir nechta nusxasi bitta kartada: avatarlar + «3 ijrochi · 1/3 tasdiqlandi»
 * va har nusxa holati rangli chiziqda.
 */
export function TaskCard({ rows, batch, tz }: {
  rows: TaskListRow[]; tz: string; batch?: { total: number; approved: number; names: string[]; statuses: TaskStatus[] };
}) {
  const r = rows[0]!;
  const now = new Date();
  const group = rows.length > 1;
  const overdue = rows.some((x) => x.overdue);
  const lateMin = overdue && r.dueAt ? Math.round((now.getTime() - r.dueAt.getTime()) / 60_000) : 0;
  return (
    <Link href={`/vazifalar/${r.id}`} className={`flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5 transition hover:shadow-[var(--shadow-card)] ${overdue ? 'border-danger/40 shadow-[0_0_0_3px_rgba(229,72,77,.06)]' : 'border-line'}`}>
      <div className="flex flex-wrap gap-1.5">
        <StatusPill status={r.status} />
        {r.source !== 'assigned' && <span className="inline-flex h-6 items-center gap-1 rounded-full bg-subtle px-2 text-xs font-semibold text-ink-2"><Icon name="edit_note" size={15} />O&apos;zi qo&apos;shdi</span>}
        {r.recurring && <span className="inline-flex h-6 items-center gap-1 rounded-full bg-primary-soft px-2 text-xs font-semibold text-primary"><Icon name="repeat" size={15} />Takroriy</span>}
        {overdue && <span className="inline-flex h-6 items-center rounded-full bg-danger-tint px-2 text-xs font-semibold text-danger">Muddati o&apos;tdi</span>}
      </div>
      <div className="text-[15px] leading-snug font-bold">{r.title}</div>
      {group ? (
        <div className="flex flex-col gap-2 rounded-xl bg-page p-2.5">
          <div className="flex items-center gap-2">
            <span className="flex -space-x-1.5">{rows.slice(0, 4).map((x) => <Avatar key={x.id} name={x.assigneeName} size={26} className="ring-2 ring-white" />)}</span>
            <span className="text-xs font-semibold">{rows.length} ijrochi{batch ? ` · ${batch.approved}/${batch.total} tasdiqlandi` : ''}</span>
          </div>
          {batch && <div className="flex gap-1">{batch.statuses.map((s, i) => <span key={i} className={`h-1 flex-1 rounded-full ${STATUS_BAR[s]}`} />)}</div>}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px]">
          <Avatar name={r.assigneeName} size={26} />
          <span className="min-w-0 flex-1 truncate font-semibold">{r.assigneeName}{batch && batch.total > 1 ? <span className="font-normal text-muted"> · {batch.total} nusxa</span> : null}</span>
          {r.spentMinutes ? <span className="text-xs text-muted">{minutesText(r.spentMinutes)}</span> : null}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2.5 text-xs">
        {r.dueAt && <span className={`flex items-center gap-1 font-semibold whitespace-nowrap ${overdue ? 'text-danger' : ''}`}><Icon name="schedule" size={16} />{dueText(r.dueAt, tz, now)}</span>}
        <span className="flex items-center gap-1 text-muted"><span className={`size-1.5 rounded-full ${PRIORITY_DOT[r.priority]}`} />{TASK_PRIORITY_LABELS[r.priority]}</span>
        <span className="ml-auto flex gap-1.5 text-muted">
          {r.proofs.includes('photo') && <Icon name="photo_camera" size={16} />}
          {r.proofs.includes('video') && <Icon name="videocam" size={16} />}
          {r.proofs.includes('location') && <Icon name="location_on" size={16} />}
          {r.checklist > 0 && <Icon name="checklist" size={16} />}
        </span>
      </div>
      {lateMin > 0 && <div className="-mt-1 text-xs font-bold text-danger">{minutesText(lateMin)} kechikdi</div>}
    </Link>
  );
}
