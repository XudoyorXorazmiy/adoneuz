import Link from 'next/link';
import { formatDate, formatTime, isoWeekday, MEMBER_ROLE_LABELS, WEEKDAY_LONG } from '@adone/core';
import type { TgMember } from '@/lib/tg/session';
import { managerDecisions, managerShell, managerTaskKpis, managerToday } from '@/server/manager';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { DayStatusBadge } from '@/components/attendance/badges';
import { TgPage } from './tg-shell';

/** Rahbar Mini App'i — «Bugun»: davomat raqamlari, vazifalar nazorati, qaror kutayotganlar, xodimlar ro'yxati. Panel uslubida, Mini App o'lchamlarida. */
export async function ManagerHome({ m }: { m: TgMember }) {
  const [t, d, k] = await Promise.all([managerToday(m), managerDecisions(m), managerTaskKpis(m)]);
  const tz = m.tz;
  const c = t.counts;
  const order = (r: (typeof t.rows)[number]) => (r.result.open ? 0 : r.result.status === 'late' ? 1 : r.result.status === 'present' ? 2 : r.result.status === 'absent' ? 3 : r.result.status === 'leave' ? 4 : 5);
  const rows = [...t.rows].sort((a, b) => order(a) - order(b) || a.fullName.localeCompare(b.fullName));
  const tiles: Array<[string, number, string]> = [['Ishda', c.inside, 'text-success'], ['Kechikdi', c.late, 'text-warning'], ['Kelmadi', c.absent, 'text-danger'], ['Ruxsatda', c.leave, 'text-primary']];
  const taskTiles: Array<[string, number, string, string]> = [['Faol', k.active, 'text-primary', '/tg/vazifalar'], ['Tekshiruvda', k.review, 'text-warning', '/tg/vazifalar?tab=review'], ["Muddati o'tgan", k.overdue, 'text-danger', '/tg/vazifalar?tab=overdue']];
  const decisions: Array<[string, number, string]> = [['Yangi xodimlar', d.employees.length, 'person_add'], ["Ruxsat so'rovlari", d.leaves.length, 'inbox'], ['Hisobotlar tekshiruvda', d.tasks.length, 'fact_check']];
  const shell = managerShell(m, d.total);
  const panel = shell.panelUrl;
  return (
    <TgPage manager={shell}>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-lg font-extrabold text-white">{m.tenantName.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-muted">{WEEKDAY_LONG[isoWeekday(t.date) - 1]}, {formatDate(`${t.date}T12:00:00Z`)}</div>
            <div className="truncate text-xl font-bold tracking-[-0.02em]">{m.tenantName}</div>
          </div>
          <span className="rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-primary">{MEMBER_ROLE_LABELS[m.role]}</span>
        </div>

        <div className={`grid gap-2.5 ${shell.reports ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Link href="/tg/vazifa-berish" className="btn-primary h-12 text-sm shadow-none"><Icon name="add_task" size={20} />Vazifa berish</Link>
          {shell.reports && <Link href="/tg/hisobot" className="btn-secondary h-12 text-sm"><Icon name="bar_chart" size={20} className="text-primary" />Hisobot</Link>}
        </div>

        <section className="flex flex-col gap-3 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold">Bugun</h2>
            <span className="tnum text-[13px] text-muted">{c.all} xodim · kelgan {c.present + c.late}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {tiles.map(([l, v, color]) => (
              <div key={l} className="flex flex-col items-center rounded-2xl bg-page py-3">
                <span className={`tnum text-2xl font-extrabold tracking-[-0.02em] ${v ? color : 'text-placeholder'}`}>{v}</span>
                <span className="text-[11px] font-medium text-muted">{l}</span>
              </div>
            ))}
          </div>
          {c.suspicious > 0 && (
            <p className="m-0 flex items-center gap-2 rounded-2xl bg-warning-tint px-3.5 py-2.5 text-[13px] font-semibold text-warning-text"><Icon name="gpp_maybe" size={18} />Shubhali keldi-ketdi: {c.suspicious} — panelda «Davomat → Shubhali»</p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold">Vazifalar</h2>
            <Link href="/tg/vazifalar" className="flex items-center text-[13px] font-semibold text-primary">Hammasi<Icon name="chevron_right" size={18} /></Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {taskTiles.map(([l, v, color, href]) => (
              <Link key={l} href={href} className="flex flex-col items-center rounded-2xl bg-page py-3">
                <span className={`tnum text-2xl font-extrabold tracking-[-0.02em] ${v ? color : 'text-placeholder'}`}>{v}</span>
                <span className="text-[11px] font-medium text-muted">{l}</span>
              </Link>
            ))}
          </div>
          {k.onTimePct != null && <p className="m-0 text-[13px] text-muted">Oxirgi 30 kunda o&apos;z vaqtida topshirilgan: <b className="tnum text-ink">{k.onTimePct}%</b></p>}
        </section>

        <Link href="/tg/qarorlar" className="flex flex-col gap-2.5 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2.5">
            <span className={`flex size-9 items-center justify-center rounded-[10px] ${d.total ? 'bg-warning-tint text-warning' : 'bg-success-tint text-success'}`}><Icon name={d.total ? 'pending_actions' : 'task_alt'} size={20} fill /></span>
            <h2 className="m-0 flex-1 text-base font-bold">Qaror kutmoqda</h2>
            {d.total ? <span className="tnum rounded-full bg-warning-tint px-2.5 py-0.5 text-[13px] font-bold text-warning">{d.total}</span> : <span className="text-[13px] font-semibold text-success">Hammasi hal qilingan</span>}
            <Icon name="chevron_right" className="text-placeholder" />
          </div>
          {d.total > 0 && (
            <div className="flex flex-col divide-y divide-line-soft">
              {decisions.filter(([, n]) => n > 0).map(([l, n, icon]) => (
                <div key={l} className="flex items-center gap-2.5 py-2 text-sm"><Icon name={icon} size={18} className="text-muted" /><span className="flex-1">{l}</span><b className="tnum">{n}</b></div>
              ))}
            </div>
          )}
        </Link>

        <section className="flex flex-col rounded-[24px] bg-card shadow-[var(--shadow-card)]">
          <h2 className="m-0 px-[18px] pt-4 pb-2 text-base font-bold">Xodimlar bugun</h2>
          {rows.length === 0 ? (
            <p className="m-0 px-[18px] pb-5 text-sm text-muted">Faol xodim yo&apos;q — xodimlar botda ro&apos;yxatdan o&apos;tib tasdiqlangach shu yerda ko&apos;rinadi.</p>
          ) : (
            <div className="flex flex-col divide-y divide-line-soft">
              {rows.map((r) => {
                const res = r.result;
                return (
                  <div key={r.id} className="flex items-center gap-3 px-[18px] py-2.5">
                    <Avatar name={r.fullName} size={36} online={res.open} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{r.fullName}</div>
                      <div className="truncate text-xs text-muted">{[r.position, r.departmentName].filter(Boolean).join(' · ') || r.branchName || '—'}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`tnum text-[13px] font-semibold ${res.lateMinutes > 0 ? 'text-warning' : res.firstIn ? '' : 'text-placeholder'}`}>
                        {res.firstIn ? formatTime(res.firstIn, tz) : r.shift ? `${formatTime(r.shift.start, tz)} kutilmoqda` : '—'}
                        {res.lateMinutes > 0 && <span className="ml-1 text-[11px]">+{res.lateMinutes} daq</span>}
                      </span>
                      <DayStatusBadge status={res.status} open={res.open} early={res.earlyLeaveMinutes > 0} waiting={!!r.shift && !res.firstIn} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <a href={panel} target="_blank" rel="noreferrer" className="btn-secondary h-12 w-full text-sm"><Icon name="open_in_new" size={18} className="text-primary" />Panelni ochish — {panel.replace(/^https?:\/\//, '')}</a>
      </div>
    </TgPage>
  );
}
