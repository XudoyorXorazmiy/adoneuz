import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS, leaveDays, LEAVE_STATUSES, type LeaveStatus } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { leavePeriod, listLeaves } from '@/server/leave';
import { decideLeaveAction, quickDecideLeaveAction } from '@/lib/actions/leave';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Field, FormDrawer } from '@/components/ui/form-drawer';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = { title: "So'rovlar" };

const TONE: Record<LeaveStatus, string> = { pending: 'bg-warning-tint text-warning', approved: 'bg-success-tint text-success', rejected: 'bg-danger-tint text-danger', cancelled: 'bg-subtle text-muted' };
const TABS: Array<[LeaveStatus | 'all', string]> = [['pending', 'Kutilmoqda'], ['approved', 'Tasdiqlangan'], ['rejected', 'Rad etilgan'], ['all', 'Barchasi']];

/** Ruxsat so'rovlari (kasal, ta'til, shaxsiy, masofadan): xodim botda / Mini App'da so'raydi, rahbar shu yerda hal qiladi. */
export default async function LeavePage({ searchParams }: PageProps<'/sorovlar'>) {
  const user = await requireArea('requests');
  const sp = await searchParams;
  const tab = ([...LEAVE_STATUSES, 'all'] as string[]).includes(String(sp.holat)) ? (String(sp.holat) as LeaveStatus | 'all') : 'pending';
  const { rows, counts } = await listLeaves(user, tab);
  const tz = user.tenantTimezone;
  return (
    <>
      <PageHeader title="So'rovlar" badge={counts.pending ? `${counts.pending} kutilmoqda` : undefined} subtitle="Ruxsat so'rovlari: kasal, ta'til, shaxsiy ish, masofadan ishlash" alert={!!counts.pending} />
      <section className="card flex flex-col gap-4 px-6 pt-3 pb-5 max-sm:px-4">
        <div className="flex gap-1 overflow-x-auto border-b border-line-soft">
          {TABS.map(([k, l]) => {
            const on = tab === k;
            const n = k === 'all' ? null : (counts[k] ?? 0);
            return (
              <Link key={k} href={k === 'pending' ? '/sorovlar' : `/sorovlar?holat=${k}`}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 pt-2.5 pb-3 text-[13px] whitespace-nowrap ${on ? 'border-primary font-bold text-ink' : 'border-transparent font-medium text-muted hover:text-ink'}`}>
                {l}
                {n != null && <span className={`tnum rounded-full px-[7px] py-px text-[11px] font-bold ${on ? 'bg-primary text-white' : k === 'pending' && n ? 'bg-warning-tint text-warning' : 'bg-subtle text-muted'}`}>{n}</span>}
              </Link>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <EmptyState text={tab === 'pending' ? "Kutilayotgan so'rov yo'q. Xodimlar botda «📝 So'rov» yoki Mini App'da ruxsat so'raydi." : "Bu bo'limda so'rov yo'q."} />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line p-4">
                <Link href={`/xodimlar/${r.employeeId}`} className="flex min-w-[200px] flex-1 items-center gap-3">
                  <Avatar name={r.name} size={40} />
                  <span className="min-w-0"><span className="block font-bold">{r.name}</span><span className="block text-xs text-muted">{[r.position, r.departmentName].filter(Boolean).join(' · ')}</span></span>
                </Link>
                <div className="min-w-[220px] flex-[1.4]">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold">{LEAVE_KIND_ICONS[r.kind]} {LEAVE_KIND_LABELS[r.kind]}</span>
                    <span className="tnum font-semibold">{leavePeriod(r.from, r.to)}</span>
                    <span className="text-xs text-muted">{leaveDays(r.from, r.to)} kun</span>
                  </div>
                  {r.reason && <div className="mt-1 text-[13px] text-ink-2">«{r.reason}»</div>}
                  <div className="mt-1 text-xs text-placeholder">{formatDateTime(r.createdAt, tz)}{r.decidedBy ? ` · ${r.decidedBy}${r.comment ? `: «${r.comment}»` : ''}` : ''}</div>
                </div>
                {r.status === 'pending' ? (
                  <div className="flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1 max-sm:[&_button]:w-full">
                    <form action={quickDecideLeaveAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="approved" /><button className="btn-primary h-10 shadow-none"><Icon name="check" size={18} />Tasdiqlash</button></form>
                    <FormDrawer trigger={<><Icon name="close" size={18} />Rad etish</>} triggerClass="btn-danger h-10" title="Rad etish" subtitle={`${r.name} · ${leavePeriod(r.from, r.to)}`} action={decideLeaveAction} submitLabel="Rad etish">
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="to" value="rejected" />
                      <Field label="Sabab" hint="Xodimga Telegram'da yuboriladi."><textarea name="comment" rows={3} maxLength={500} className="input h-auto py-2.5" /></Field>
                    </FormDrawer>
                  </div>
                ) : <span className={`badge ${TONE[r.status]}`}><span className="badge-dot" />{LEAVE_STATUS_LABELS[r.status]}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
