import { LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS, leaveDays, localDate } from '@adone/core';
import { withTenant } from '@adone/db';
import { currentTgUser } from '@/lib/tg/session';
import { leavePeriod, myLeaves } from '@/server/leave';
import { TgHeader } from '@/components/tg/tg-shell';
import { CancelLeave, LeaveForm } from '@/components/tg/leave-form';

const TONE = { pending: 'bg-warning-tint text-warning', approved: 'bg-success-tint text-success', rejected: 'bg-danger-tint text-danger', cancelled: 'bg-subtle text-muted' } as const;

export default async function TgLeavePage() {
  const u = await currentTgUser();
  if (!u) return null; // sessiya yo'q — layout avtorizatsiya ekranini ko'rsatadi (layout va page parallel render qilinadi)
  const list = await withTenant(u.tenantId, (tx) => myLeaves(tx, u.employeeId));
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page pb-6">
      <TgHeader title="Ruxsat so'rash" back="/tg/tarix" />
      <div className="flex flex-col gap-3 px-4 pt-3">
        <LeaveForm today={localDate(new Date(), u.tz)} />
        {list.length > 0 && <h2 className="m-0 mt-2 text-sm font-bold text-muted">So&apos;rovlarim</h2>}
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-[var(--shadow-card)]">
            <span className="text-2xl">{LEAVE_KIND_ICONS[r.kind]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{LEAVE_KIND_LABELS[r.kind]} · {leavePeriod(r.dateFrom, r.dateTo)}</div>
              <div className="text-xs text-muted">{leaveDays(r.dateFrom, r.dateTo)} kun{r.decisionComment ? ` · «${r.decisionComment}»` : ''}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`badge ${TONE[r.status]}`}>{LEAVE_STATUS_LABELS[r.status]}</span>
              {r.status === 'pending' && <CancelLeave id={r.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
