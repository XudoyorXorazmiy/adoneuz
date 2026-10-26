import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { describeRecurrence, formatDateTime, isOverdue, nextStatuses, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskProof, isUuid } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { taskDetail } from '@/server/task-queries';
import { decideDeadlineAction, quickTransitionAction, stopTemplateAction, transitionTaskAction } from '@/lib/actions/tasks';
import { CardHead, PageHeader } from '@/components/ui/page-header';
import { Field, FormDrawer } from '@/components/ui/form-drawer';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { CommentBox } from '@/components/tasks/comment-box';
import { dueText, minutesText, PRIORITY_DOT, StatusPill } from '@/components/tasks/task-card';
import { proofText } from '@/lib/task-text';

export const metadata: Metadata = { title: 'Vazifa' };

export default async function TaskPage({ params }: PageProps<'/vazifalar/[id]'>) {
  const user = await requireArea('tasks');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await taskDetail(user, id);
  if (!d) notFound();
  const tz = user.tenantTimezone;
  const { task: t, batch: b } = d;
  const can = d.role ? nextStatuses(t.status, d.role) : [];
  const overdue = isOverdue({ status: t.status, dueAt: t.dueAt }, new Date());
  const hidden = <input type="hidden" name="taskId" value={t.id} />;
  const quick = (to: string, label: string, icon: string, cls = 'btn-secondary') => (
    <form action={quickTransitionAction}>{hidden}<input type="hidden" name="to" value={to} /><button className={cls}><Icon name={icon} size={18} />{label}</button></form>
  );
  const meta: Array<[string, React.ReactNode]> = [
    ['Ijrochi', d.assignee ? <span className="flex items-center gap-2"><Avatar name={d.assignee.name} size={24} />{d.assignee.name}</span> : '—'],
    ['Kimdan', d.creator ?? '—'],
    ['Muddat', t.dueAt ? <span className={overdue ? 'text-danger' : ''}>{dueText(t.dueAt, tz)}{overdue ? ' · muddati o‘tdi' : ''}</span> : 'muddatsiz'],
    ['Muhimlik', <span key="p" className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${PRIORITY_DOT[b.priority]}`} />{TASK_PRIORITY_LABELS[b.priority]}</span>],
    ['Hisobot', proofText(b.proofs as TaskProof[])],
    ['Turi', b.source === 'assigned' ? (d.template ? `Takroriy · ${describeRecurrence(d.template.recurrence)}` : 'Berilgan') : b.source === 'self_done' ? "O'zi qo'shgan · bajarilgan ish" : "O'zi qo'shgan · reja"],
  ];
  if (t.spentMinutes) meta.push(['Sarflangan vaqt', minutesText(t.spentMinutes)]);
  if (t.rating) meta.push(['Baho', <span key="r" className="text-warning">{'★'.repeat(t.rating)}<span className="text-line-strong">{'★'.repeat(5 - t.rating)}</span></span>]);

  return (
    <>
      <PageHeader title={b.title} back={{ href: '/vazifalar', label: 'Vazifalar' }} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="card flex flex-col gap-4 p-6 max-sm:p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={t.status} />
              {t.revisionCount > 0 && <span className="inline-flex h-6 items-center rounded-full bg-danger-tint px-2 text-xs font-semibold text-danger">{t.revisionCount} marta qaytarilgan</span>}
              {overdue && <span className="inline-flex h-6 items-center rounded-full bg-danger-tint px-2 text-xs font-semibold text-danger">Muddati o&apos;tdi</span>}
            </div>
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">{b.title}</h1>
            {b.description && <p className="m-0 text-sm leading-relaxed whitespace-pre-line text-ink-2">{b.description}</p>}
            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {meta.map(([k, v]) => <div key={k}><dt className="text-xs font-medium text-muted">{k}</dt><dd className="m-0 mt-0.5 font-semibold">{v}</dd></div>)}
            </dl>
            {b.checklist.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Bosqichlar</span>
                {b.checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl bg-page px-3 py-2.5 text-sm">
                    <Icon name={t.checklistDone[i] ? 'check_box' : 'check_box_outline_blank'} size={20} fill={t.checklistDone[i]} className={t.checklistDone[i] ? 'text-success' : 'text-placeholder'} />{c}
                  </div>
                ))}
              </div>
            )}
            {can.length > 0 && (
              <div className="flex flex-wrap gap-2.5 border-t border-line-soft pt-4">
                {can.includes('approved') && (
                  <FormDrawer trigger={<><Icon name="check" size={18} />Tasdiqlash</>} triggerClass="btn-primary" title="Tasdiqlash" subtitle={`${d.assignee?.name ?? ''} · ${b.title}`} action={transitionTaskAction} submitLabel="Tasdiqlash">
                    {hidden}<input type="hidden" name="to" value="approved" />
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold">Baho</span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="cursor-pointer">
                            <input type="radio" name="rating" value={n} defaultChecked={n === 5} className="peer sr-only" />
                            <span className="flex size-11 items-center justify-center rounded-full border border-line text-sm font-bold peer-checked:border-warning peer-checked:bg-warning-tint peer-checked:text-warning">{n}★</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <Field label="Izoh"><textarea name="comment" rows={2} maxLength={1000} className="input h-auto py-2.5" placeholder="Yaxshi bajarildi (ixtiyoriy)" /></Field>
                  </FormDrawer>
                )}
                {can.includes('revision') && (
                  <FormDrawer trigger={<><Icon name="undo" size={18} />Qaytarish</>} triggerClass="btn-secondary" title="Qaytarish" subtitle="Xodim sababni Telegram'da ko'radi" action={transitionTaskAction} submitLabel="Qaytarish">
                    {hidden}<input type="hidden" name="to" value="revision" />
                    <Field label="Sabab" required><textarea name="comment" rows={3} required maxLength={1000} className="input h-auto py-2.5" placeholder="Narx yorliqlari ko'rinmayapti — qayta suratga oling" /></Field>
                  </FormDrawer>
                )}
                {can.includes('accepted') && quick('accepted', 'Qabul qildim', 'thumb_up', 'btn-primary')}
                {can.includes('in_progress') && quick('in_progress', 'Boshladim', 'play_arrow')}
                {can.includes('submitted') && (
                  <FormDrawer trigger={<><Icon name="task_alt" size={18} />Bajardim</>} triggerClass="btn-primary" title="Bajardim" subtitle={b.title} action={transitionTaskAction} submitLabel="Topshirish">
                    {hidden}<input type="hidden" name="to" value="submitted" />
                    <Field label="Hisobot"><textarea name="comment" rows={3} maxLength={1000} className="input h-auto py-2.5" placeholder="Nima qilindi" /></Field>
                    <Field label="Sarflangan vaqt (daqiqa)"><input name="spentMinutes" type="number" min={1} max={1440} className="input tnum w-40" /></Field>
                  </FormDrawer>
                )}
                {can.includes('cancelled') && (
                  <FormDrawer trigger={<><Icon name="block" size={18} />Bekor qilish</>} triggerClass="btn-danger ml-auto" title="Vazifani bekor qilish" subtitle="Vazifa o'chirilmaydi — «Bekor qilindi» bo'lib qoladi" action={transitionTaskAction} submitLabel="Bekor qilish">
                    {hidden}<input type="hidden" name="to" value="cancelled" />
                    <Field label="Sabab" required><textarea name="comment" rows={2} required maxLength={1000} className="input h-auto py-2.5" /></Field>
                  </FormDrawer>
                )}
              </div>
            )}
          </section>

          {d.deadline && (
            <section className="card flex flex-col gap-4 border border-warning/40 p-6 max-sm:p-4">
              <CardHead icon={<Icon name="more_time" size={18} fill />} title="Muddatni uzaytirish so'rovi" badge={<span className="badge bg-warning-tint text-warning">Kutilmoqda</span>} />
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                <b>{d.deadline.employeeName}</b>
                <span className="text-muted">{d.deadline.currentDueAt ? dueText(d.deadline.currentDueAt, tz) : 'muddatsiz'}</span><Icon name="arrow_forward" size={16} className="text-muted" /><b className="tnum">{dueText(d.deadline.requestedDueAt, tz)}</b>
                <span className="text-xs text-placeholder">· {formatDateTime(d.deadline.createdAt, tz)}</span>
              </div>
              {d.deadline.reason && <p className="m-0 w-fit rounded-xl bg-page px-3 py-2 text-sm">«{d.deadline.reason}»</p>}
              {d.role === 'reviewer' && (
                <div className="flex flex-wrap items-end gap-2.5">
                  <form action={decideDeadlineAction}><input type="hidden" name="id" value={d.deadline.id} /><input type="hidden" name="to" value="approved" /><button className="btn-primary"><Icon name="event_available" size={18} />Ruxsat berish</button></form>
                  <form action={decideDeadlineAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={d.deadline.id} /><input type="hidden" name="to" value="rejected" />
                    <input name="comment" maxLength={500} placeholder="Rad etish sababi (ixtiyoriy)" className="input w-64" />
                    <button className="btn-danger"><Icon name="close" size={18} />Rad etish</button>
                  </form>
                </div>
              )}
            </section>
          )}

          {d.reports.length > 0 && (
            <section className="card flex flex-col gap-4 p-6 max-sm:p-4">
              <CardHead icon={<Icon name="assignment_turned_in" size={18} fill />} title="Hisobot" />
              {d.reports.map((r) => (
                <div key={r.id} className="flex flex-col gap-2.5 rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Icon name="schedule" size={15} />{formatDateTime(r.createdAt, tz)}
                    <span className="rounded-full bg-primary-tint px-2 py-0.5 font-bold text-primary">{r.source === 'bot' ? 'Bot' : r.source === 'miniapp' ? 'Mini App' : 'Panel'}</span>
                    {r.spentMinutes ? <span>· {minutesText(r.spentMinutes)}</span> : null}
                  </div>
                  {r.text && <p className="m-0 text-sm whitespace-pre-line">{r.text}</p>}
                  {(r.mediaIds.length > 0 || r.lat != null) && (
                    <div className="flex flex-wrap gap-2">
                      {r.mediaIds.map((m) => (
                        <a key={m} href={`/api/media/${m}`} target="_blank" rel="noreferrer" className="relative size-28 overflow-hidden rounded-xl bg-subtle">
                          {d.mime.get(m)?.startsWith('video/')
                            ? <><video src={`/api/media/${m}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" /><Icon name="play_circle" fill size={28} className="absolute inset-0 m-auto h-fit w-fit text-white drop-shadow" /></>
                            : <img src={`/api/media/${m}`} alt="Hisobot" className="size-full object-cover" />}
                        </a>
                      ))}
                      {r.lat != null && r.lng != null && (
                        <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" className="flex size-28 flex-col items-center justify-center gap-1 rounded-xl bg-[#EAEFF3] text-xs font-semibold text-primary">
                          <Icon name="location_on" size={28} fill />Xaritada
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <section className="card flex flex-col gap-4 p-6 max-sm:p-4">
            <CardHead icon={<Icon name="forum" size={18} fill />} title="Tarix va yozishma" />
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {d.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <Avatar name={e.actor} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <b>{e.actor}</b>
                      <span className="text-muted">{e.fromStatus === e.toStatus ? 'izoh' : e.fromStatus ? `${TASK_STATUS_LABELS[e.fromStatus]} → ${TASK_STATUS_LABELS[e.toStatus]}` : `yaratdi · ${TASK_STATUS_LABELS[e.toStatus]}`}</span>
                      <span className="text-xs text-placeholder">{formatDateTime(e.createdAt, tz)}</span>
                    </div>
                    {e.comment && <div className={`mt-1 w-fit max-w-full rounded-xl px-3 py-2 text-sm whitespace-pre-line ${e.fromStatus === e.toStatus ? 'bg-primary-soft' : 'bg-page'}`}>{e.comment}</div>}
                  </div>
                </li>
              ))}
            </ol>
            {d.role && t.status !== 'cancelled' && <CommentBox taskId={t.id} />}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          {d.copies.length > 1 && (
            <section className="card flex flex-col gap-3 p-5">
              <CardHead icon={<Icon name="group" size={18} fill />} title="Nusxalar" badge={<span className="tnum text-xs font-bold text-muted">{d.copies.filter((c) => c.status === 'approved').length}/{d.copies.length} tasdiqlandi</span>} />
              {d.copies.map((c) => (
                <Link key={c.id} href={`/vazifalar/${c.id}`} className={`flex items-center gap-2.5 rounded-xl p-2 text-[13px] hover:bg-page ${c.id === t.id ? 'bg-primary-soft' : ''}`}>
                  <Avatar name={c.name} size={30} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  <StatusPill status={c.status} />
                </Link>
              ))}
            </section>
          )}
          {d.assignee && (
            <section className="card flex flex-col gap-3 p-5">
              <CardHead icon={<Icon name="person" size={18} fill />} title="Ijrochi" />
              <div className="flex items-center gap-3">
                <Avatar name={d.assignee.name} size={44} />
                <div className="min-w-0"><div className="font-bold">{d.assignee.name}</div><div className="text-xs text-muted">{[d.assignee.position, d.assignee.departmentName].filter(Boolean).join(' · ') || '—'}</div></div>
              </div>
              {t.assigneeEmployeeId && <Link href={`/xodimlar/${t.assigneeEmployeeId}?tab=vazifalar`} className="btn-secondary h-9 text-xs">Ish jurnali</Link>}
            </section>
          )}
          {d.template?.isActive && (
            <section className="card flex flex-col gap-3 p-5">
              <CardHead icon={<Icon name="repeat" size={18} />} title="Takrorlanadi" />
              <p className="m-0 text-sm">{describeRecurrence(d.template.recurrence)} · muddat {d.template.dueTime}</p>
              <form action={stopTemplateAction}><input type="hidden" name="id" value={d.template.id} /><button className="btn-danger h-9 w-full text-xs">Takrorlashni to&apos;xtatish</button></form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
