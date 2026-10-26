import { redirect } from 'next/navigation';
import { formatDateTime, LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, leaveDays } from '@adone/core';
import { appOrigin } from '@/lib/host';
import { currentTgMember, currentTgUser } from '@/lib/tg/session';
import { managerDecisions } from '@/server/manager';
import { leavePeriod } from '@/server/leave';
import { TgPage } from '@/components/tg/tg-shell';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { minutesText } from '@/components/tasks/task-card';
import { ApproveEmployee, LeaveDecision, TaskReview } from '@/components/tg/manager-decisions';

/** Rahbar Mini App'i — «Qarorlar»: yangi xodimlar, ruxsat so'rovlari, tekshiruvdagi hisobotlar. */
export default async function TgDecisionsPage() {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null; // xodim sessiyasi — o'z bosh sahifasi
  const d = await managerDecisions(m);
  const panel = appOrigin();
  const tz = m.tz;
  const card = 'flex flex-col gap-3 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]';
  return (
    <TgPage manager={{ panelUrl: panel, pending: d.total }}>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Qarorlar</h1>
          {d.total > 0 && <span className="tnum rounded-full bg-warning-tint px-3 py-1 text-[13px] font-bold text-warning">{d.total}</span>}
        </div>

        {d.total === 0 && (
          <div className={`${card} items-center py-8 text-center`}>
            <span className="flex size-12 items-center justify-center rounded-full bg-success-tint text-success"><Icon name="task_alt" size={26} fill /></span>
            <p className="m-0 text-sm font-semibold">Hammasi hal qilingan</p>
            <p className="m-0 text-[13px] text-muted">Yangi so&apos;rov yoki hisobot kelganda shu yerda chiqadi.</p>
          </div>
        )}

        {d.employees.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 text-sm font-bold text-muted">Yangi xodimlar · {d.employees.length}</h2>
            {d.employees.map((e) => (
              <div key={e.id} className={card}>
                <div className="flex items-center gap-3">
                  <Avatar name={e.fullName} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{e.fullName}</div>
                    <div className="truncate text-xs text-muted">{[e.position, e.branchName].filter(Boolean).join(' · ') || 'Botda ro‘yxatdan o‘tdi'}</div>
                  </div>
                </div>
                <ApproveEmployee id={e.id} />
              </div>
            ))}
          </section>
        )}

        {d.leaves.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 text-sm font-bold text-muted">Ruxsat so&apos;rovlari · {d.leaves.length}</h2>
            {d.leaves.map((l) => (
              <div key={l.id} className={card}>
                <div className="flex items-center gap-3">
                  <Avatar name={l.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{l.name}</div>
                    <div className="truncate text-xs text-muted">{[l.position, l.departmentName].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                </div>
                <div className="rounded-2xl bg-page px-3.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b>{LEAVE_KIND_ICONS[l.kind]} {LEAVE_KIND_LABELS[l.kind]}</b><span className="tnum font-semibold">{leavePeriod(l.from, l.to)}</span><span className="text-xs text-muted">{leaveDays(l.from, l.to)} kun</span></div>
                  {l.reason && <div className="mt-1 text-[13px] text-ink-2">«{l.reason}»</div>}
                  <div className="mt-1 text-xs text-placeholder">{formatDateTime(l.createdAt, tz)}</div>
                </div>
                <LeaveDecision id={l.id} />
              </div>
            ))}
          </section>
        )}

        {d.tasks.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 text-sm font-bold text-muted">Hisobotlar tekshiruvda · {d.tasks.length}</h2>
            {d.tasks.map((t) => (
              <div key={t.id} className={card}>
                <div className="flex items-start gap-3">
                  <Avatar name={t.assigneeName} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] leading-5 font-bold">{t.title}</div>
                    <div className="mt-0.5 text-xs text-muted">{t.assigneeName}{t.departmentName ? ` · ${t.departmentName}` : ''}{t.source !== 'assigned' ? " · o'zi qo'shgan ish" : ''}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-placeholder">
                      {t.submittedAt && <span>topshirildi {formatDateTime(t.submittedAt, tz)}</span>}
                      {t.spentMinutes ? <span>· {minutesText(t.spentMinutes)}</span> : null}
                      {t.overdue && <span className="font-semibold text-danger">· muddati o&apos;tgan</span>}
                    </div>
                  </div>
                </div>
                <a href={`${panel}/vazifalar/${t.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"><Icon name="photo_library" size={16} />Hisobot fayllari va yozishma — panelda ↗</a>
                <TaskReview id={t.id} />
              </div>
            ))}
          </section>
        )}
      </div>
    </TgPage>
  );
}
