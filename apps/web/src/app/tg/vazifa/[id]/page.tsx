import { notFound } from 'next/navigation';
import { formatDateTime, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, isUuid } from '@adone/core';
import { currentTgUser } from '@/lib/tg/session';
import { myTask } from '@/server/miniapp';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { TgHeader } from '@/components/tg/tg-shell';
import { TaskReport } from '@/components/tg/task-report';
import { dueText, minutesText, STATUS_PILL } from '@/components/tasks/task-card';

const PRI = { low: 'bg-subtle text-muted', medium: 'bg-warning-tint text-warning', high: 'bg-danger-tint text-danger' } as const;

export default async function TgTaskPage({ params }: PageProps<'/tg/vazifa/[id]'>) {
  const u = await currentTgUser();
  if (!u) return null; // sessiya yo'q — layout avtorizatsiya ekranini ko'rsatadi (layout va page parallel render qilinadi)
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await myTask(u, id);
  if (!d) notFound();
  const { t, b } = d;
  const left = t.dueAt ? Math.round((t.dueAt.getTime() - Date.now()) / 60_000) : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title="Vazifa" back="/tg/vazifalar" />
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3">
        {d.revision && (
          <div className="flex gap-2.5 rounded-2xl bg-danger-tint p-3.5 text-danger">
            <Icon name="undo" size={22} />
            <div className="text-sm"><b>Qaytarildi:</b> «{d.revision.comment}»<div className="mt-0.5 text-xs opacity-75">{d.revision.by ?? 'Rahbar'} · {formatDateTime(d.revision.at, u.tz)}</div></div>
          </div>
        )}
        <section className="flex flex-col gap-2.5 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap gap-1.5">
            <span className={`flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold ${PRI[b.priority]}`}><span className="size-1.5 rounded-full bg-current" />{TASK_PRIORITY_LABELS[b.priority]}</span>
            <span className={`flex h-6 items-center rounded-full px-2 text-xs font-semibold ${STATUS_PILL[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</span>
          </div>
          <h1 className="m-0 text-xl leading-tight font-bold tracking-[-0.02em]">{b.title}</h1>
          {d.creator && <div className="flex items-center gap-2 text-sm"><Avatar name={d.creator} size={22} /><span className="text-muted">Kimdan:</span><b>{d.creator}</b></div>}
          {t.dueAt && (
            <div className="flex items-center gap-2 text-sm"><Icon name="schedule" size={20} className="text-muted" /><b>{dueText(t.dueAt, u.tz)}</b>
              {left != null && ['new', 'accepted', 'in_progress', 'revision'].includes(t.status) && <span className={left < 0 ? 'font-semibold text-danger' : 'text-warning'}>· {left < 0 ? `${minutesText(-left)} kechikdi` : `${minutesText(left)} qoldi`}</span>}
            </div>
          )}
          {b.description && <p className="m-0 text-sm leading-relaxed whitespace-pre-line text-ink-2">{b.description}</p>}
        </section>
        {(t.status === 'submitted' || t.status === 'approved' || t.status === 'cancelled') && (
          <section className="rounded-[20px] bg-card p-4 text-sm shadow-[var(--shadow-card)]">
            <div className="font-bold">{t.status === 'submitted' ? '⏳ Rahbar tekshirmoqda' : t.status === 'approved' ? `✅ Tasdiqlandi${t.rating ? ` · ${'★'.repeat(t.rating)}` : ''}` : '❌ Bekor qilingan'}</div>
            {d.reports[0]?.text && <p className="m-0 mt-2 text-ink-2">«{d.reports[0].text}»</p>}
            {d.reports[0]?.mediaIds.length ? <div className="mt-2 text-xs text-muted">{d.reports[0].mediaIds.length} ta rasm yuborilgan</div> : null}
          </section>
        )}
        <TaskReport taskId={t.id} status={t.status} checklist={b.checklist} checklistDone={t.checklistDone} proofs={b.proofs} />
      </div>
    </div>
  );
}
