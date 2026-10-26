import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDateTime, isOverdue, nextStatuses, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskProof } from '@adone/core';
import type { TgMember } from '@/lib/tg/session';
import { managerTaskDetail } from '@/server/manager';
import { proofText } from '@/lib/task-text';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { dueText, minutesText, PRIORITY_DOT, STATUS_PILL } from '@/components/tasks/task-card';
import { TgHeader } from './tg-shell';
import { TaskCancel, TaskComment, TaskReview } from './manager-decisions';

const card = 'flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]';
const pill = 'flex h-6 items-center rounded-full px-2 text-xs font-semibold';

/**
 * Rahbar Mini App'i — vazifa sahifasi: holat, ijrochi, muddat, bosqichlar, hisobot (rasm/video/lokatsiya), boshqa nusxalar,
 * tarix va yozishma. Qaror (tasdiqlash/qaytarish/bekor) — panel bilan bir xil `transitionTask` orqali.
 */
export async function ManagerTask({ m, id }: { m: TgMember; id: string }) {
  const d = await managerTaskDetail(m, id);
  if (!d) notFound();
  const tz = m.tz;
  const { task: t, batch: b } = d;
  const allowed = d.role ? nextStatuses(t.status, d.role) : [];
  const overdue = isOverdue({ status: t.status, dueAt: t.dueAt }, new Date());
  const done = t.checklistDone.filter(Boolean).length;
  const others = d.copies.filter((c) => c.id !== t.id);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page pb-8">
      <TgHeader title="Vazifa" sub={d.assignee?.name} back="/tg/vazifalar" />
      <div className="flex flex-col gap-3 px-4 pt-3">
        <section className={card}>
          <div className="flex flex-wrap gap-1.5">
            <span className={`${pill} ${STATUS_PILL[t.status]}`}>{TASK_STATUS_LABELS[t.status]}</span>
            <span className={`${pill} gap-1 bg-subtle text-muted`}><span className={`size-1.5 rounded-full ${PRIORITY_DOT[b.priority]}`} />{TASK_PRIORITY_LABELS[b.priority]}</span>
            {overdue && <span className={`${pill} bg-danger-tint text-danger`}>Muddati o&apos;tdi</span>}
            {t.revisionCount > 0 && <span className={`${pill} bg-danger-tint text-danger`}>{t.revisionCount} marta qaytarilgan</span>}
            {d.template && <span className={`${pill} gap-1 bg-primary-soft text-primary`}><Icon name="repeat" size={14} />Takroriy</span>}
            {b.source !== 'assigned' && <span className={`${pill} bg-subtle text-muted`}>{b.source === 'self_done' ? "O'zi qo'shgan · bajarilgan ish" : "O'zi qo'shgan · reja"}</span>}
          </div>
          <h1 className="m-0 text-xl leading-tight font-bold tracking-[-0.02em]">{b.title}</h1>
          {b.description && <p className="m-0 text-sm leading-relaxed whitespace-pre-line text-ink-2">{b.description}</p>}
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <Meta k="Ijrochi" v={d.assignee ? <span className="flex items-center gap-1.5"><Avatar name={d.assignee.name} size={20} /><span className="truncate">{d.assignee.name}</span></span> : '—'} />
            <Meta k="Kimdan" v={d.creator ?? '—'} />
            <Meta k="Muddat" v={t.dueAt ? <span className={overdue ? 'text-danger' : ''}>{dueText(t.dueAt, tz)}</span> : 'muddatsiz'} />
            <Meta k="Hisobot talabi" v={proofText(b.proofs as TaskProof[])} />
            {t.spentMinutes ? <Meta k="Sarflangan vaqt" v={minutesText(t.spentMinutes)} /> : null}
            {t.rating ? <Meta k="Baho" v={<span className="text-warning">{'★'.repeat(t.rating)}<span className="text-line-strong">{'★'.repeat(5 - t.rating)}</span></span>} /> : null}
          </dl>
          {b.checklist.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Bosqichlar · <span className="tnum">{done}/{b.checklist.length}</span></span>
              {b.checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl bg-page px-3 py-2.5 text-sm">
                  <Icon name={t.checklistDone[i] ? 'check_box' : 'check_box_outline_blank'} size={20} fill={!!t.checklistDone[i]} className={t.checklistDone[i] ? 'text-success' : 'text-placeholder'} />{c}
                </div>
              ))}
            </div>
          )}
        </section>

        {(allowed.includes('approved') || allowed.includes('revision')) && (
          <section className={card}>
            <h2 className="m-0 text-base font-bold">{t.status === 'submitted' ? 'Hisobot tekshiruvda' : 'Qaror'}</h2>
            <TaskReview id={t.id} />
          </section>
        )}

        {d.reports.length > 0 && (
          <section className={card}>
            <h2 className="m-0 text-base font-bold">Hisobot</h2>
            {d.reports.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-2xl bg-page p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Icon name="schedule" size={15} />{formatDateTime(r.createdAt, tz)}
                  <span className="rounded-full bg-primary-tint px-2 py-0.5 font-bold text-primary">{r.source === 'bot' ? 'Bot' : r.source === 'miniapp' ? 'Mini App' : 'Panel'}</span>
                  {r.spentMinutes ? <span>· {minutesText(r.spentMinutes)}</span> : null}
                </div>
                {r.text && <p className="m-0 text-sm whitespace-pre-line">{r.text}</p>}
                {(r.mediaIds.length > 0 || r.lat != null) && (
                  <div className="grid grid-cols-3 gap-2">
                    {r.mediaIds.map((mid) => (
                      <a key={mid} href={`/api/media/${mid}`} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-xl bg-subtle">
                        {d.mime.get(mid)?.startsWith('video/')
                          ? <><video src={`/api/media/${mid}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" /><Icon name="play_circle" fill size={28} className="absolute inset-0 m-auto h-fit w-fit text-white drop-shadow" /></>
                          : <img src={`/api/media/${mid}`} alt="Hisobot" className="size-full object-cover" />}
                      </a>
                    ))}
                    {r.lat != null && r.lng != null && (
                      <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-[#EAEFF3] text-xs font-semibold text-primary"><Icon name="location_on" size={28} fill />Xaritada</a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {others.length > 0 && (
          <section className={card}>
            <h2 className="m-0 text-base font-bold">Boshqa ijrochilar · {others.length}</h2>
            <div className="flex flex-col divide-y divide-line-soft">
              {others.map((c) => (
                <Link key={c.id} href={`/tg/vazifa/${c.id}`} className="flex items-center gap-2.5 py-2 text-sm">
                  <Avatar name={c.name} size={28} /><span className="flex-1 truncate font-semibold">{c.name}</span>
                  {c.rating ? <span className="text-xs text-warning">{'★'.repeat(c.rating)}</span> : null}
                  <span className={`${pill} ${STATUS_PILL[c.status]}`}>{TASK_STATUS_LABELS[c.status]}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className={card}>
          <h2 className="m-0 text-base font-bold">Tarix va yozishma</h2>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {d.events.map((e) => (
              <li key={e.id} className="flex gap-2.5">
                <Avatar name={e.actor} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                    <b>{e.actor}</b>
                    <span className="text-muted">{e.fromStatus === e.toStatus ? 'izoh' : e.fromStatus ? `${TASK_STATUS_LABELS[e.fromStatus]} → ${TASK_STATUS_LABELS[e.toStatus]}` : `yaratdi · ${TASK_STATUS_LABELS[e.toStatus]}`}</span>
                    <span className="text-xs text-placeholder">{formatDateTime(e.createdAt, tz)}</span>
                  </div>
                  {e.comment && <div className={`mt-1 w-fit max-w-full rounded-xl px-3 py-2 text-sm whitespace-pre-line ${e.fromStatus === e.toStatus ? 'bg-primary-soft' : 'bg-page'}`}>{e.comment}</div>}
                </div>
              </li>
            ))}
          </ol>
          {d.role && t.status !== 'cancelled' && <TaskComment id={t.id} />}
        </section>

        {allowed.includes('cancelled') && <TaskCancel id={t.id} />}
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted">{k}</dt><dd className="m-0 mt-0.5 truncate font-semibold">{v}</dd></div>;
}
