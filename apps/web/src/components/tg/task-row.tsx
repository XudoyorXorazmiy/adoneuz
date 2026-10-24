import Link from 'next/link';
import { TASK_PRIORITY_LABELS, type TaskPriority, type TaskProof, type TaskStatus } from '@adone/core';
import { Icon } from '@/components/ui/icon';
import { dueText } from '@/components/tasks/task-card';

const DOT: Record<TaskPriority, string> = { low: 'bg-placeholder', medium: 'bg-warning', high: 'bg-danger' };
const PROOF_ICON: Partial<Record<TaskProof, string>> = { photo: 'photo_camera', video: 'videocam', location: 'location_on' };

/** Mini App vazifa qatori (dizayn: «Bugungi vazifalar»). */
export function TaskRow({ t, tz }: { t: { id: string; title: string; status: TaskStatus; dueAt: Date | null; priority: TaskPriority; proofs: string[]; overdue?: boolean }; tz: string }) {
  const proofs = (t.proofs as TaskProof[]).filter((p) => p !== 'button');
  const action = t.status === 'new' ? 'Qabul' : t.status === 'submitted' ? 'Tekshiruvda' : t.status === 'approved' ? 'Tasdiqlandi' : 'Bajardim';
  return (
    <Link href={`/tg/vazifa/${t.id}`} className={`flex items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] ${t.overdue ? 'ring-1 ring-danger/40' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-snug font-bold">{t.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {t.dueAt && <span className={`flex items-center gap-1 font-semibold ${t.overdue ? 'text-danger' : ''}`}><Icon name="schedule" size={15} />{dueText(t.dueAt, tz)}</span>}
          <span className="flex items-center gap-1 text-muted"><span className={`size-1.5 rounded-full ${DOT[t.priority]}`} />{TASK_PRIORITY_LABELS[t.priority]}</span>
          {proofs.map((p) => <Icon key={p} name={PROOF_ICON[p]!} size={15} className="text-muted" />)}
          {t.status === 'revision' && <span className="font-semibold text-danger">Qaytarildi</span>}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold ${t.status === 'approved' ? 'bg-success-tint text-success' : t.status === 'submitted' ? 'bg-warning-tint text-warning' : 'bg-primary-tint text-primary'}`}>{action}</span>
    </Link>
  );
}
