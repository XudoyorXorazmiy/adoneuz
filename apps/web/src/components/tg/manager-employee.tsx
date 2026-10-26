import Link from 'next/link';
import { notFound } from 'next/navigation';
import { toRule } from '@adone/db';
import { describeSchedule, formatDate, formatPhone, formatTime, MONTHS, TASK_STATUS_LABELS } from '@adone/core';
import type { TgMember } from '@/lib/tg/session';
import { managerEmployee, managerShell } from '@/server/manager';
import { profileTotals } from '@/server/profile';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { DayStatusBadge } from '@/components/attendance/badges';
import { MonthCalendar } from '@/components/attendance/month-calendar';
import { EmployeeStatusBadge } from '@/components/employees/status-badge';
import { minutesText, STATUS_PILL } from '@/components/tasks/task-card';
import { RemindButton } from './manager-decisions';
import { TgProof } from './tg-proof';
import { TgHeader } from './tg-shell';

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};
const card = 'flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]';

/** Rahbar Mini App'i — xodim kartasi: bugungi holat va isbotlar, oy tabeli (kalendar, KPI), ish jurnali, aloqa va amallar. */
export async function ManagerEmployee({ m, id, month }: { m: TgMember; id: string; month: string }) {
  const data = await managerEmployee(m, id, month);
  if (!data) notFound();
  const { p, journal, todayRow } = data;
  const { e } = p;
  const tz = m.tz;
  const cur = p.today.slice(0, 7);
  const tot = profileTotals(p.days, p.today);
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const res = todayRow?.result ?? null;
  const proofs = todayRow?.events.filter((ev) => ev.kind !== 'correction') ?? [];
  const remind = !!todayRow && !!res && !res.firstIn && !!todayRow.shift && Date.now() > todayRow.shift.start.getTime() && res.status !== 'leave' && res.status !== 'holiday';
  const panel = managerShell(m, 0).panelUrl;
  const href = (mm: string) => (mm === cur ? `/tg/xodim/${id}` : `/tg/xodim/${id}?oy=${mm}`);
  const kpis: Array<[string, string, string]> = [
    ['Ish kunlari', `${tot.workedDays} / ${tot.plannedSoFar}`, `reja ${tot.planned} kun`],
    ['Kechikishlar', String(tot.lateDays), tot.lateMinutes ? `jami ${tot.lateMinutes} daq` : "yo'q"],
    ['Ishlagan soat', hm(tot.worked), tot.workedDays ? `o'rtacha ${hm(Math.round(tot.worked / tot.workedDays))}` : '—'],
    ["Vazifalar o'z vaqtida", journal.onTimePct == null ? '—' : `${journal.onTimePct}%`, `${journal.onTimeOf[0]} / ${journal.onTimeOf[1]}${tot.absent ? ` · kelmagan ${tot.absent}` : ''}`],
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page pb-8">
      <TgHeader title="Xodim" sub={e.fullName} back="/tg" />
      <div className="flex flex-col gap-3 px-4 pt-3">
        <section className={card}>
          <div className="flex items-center gap-3">
            <Avatar name={e.fullName} size={56} online={!!res?.open} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h1 className="m-0 truncate text-lg leading-6 font-bold tracking-[-0.02em]">{e.fullName}</h1><EmployeeStatusBadge status={e.status} /></div>
              <div className="truncate text-[13px] text-muted">{[e.position, p.departmentName, p.branchName].filter(Boolean).join(' · ') || '—'}</div>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-[13px] text-muted">
            {e.phone && <a href={`tel:+${e.phone}`} className="tnum flex items-center gap-1.5"><Icon name="call" size={16} />{formatPhone(e.phone)}</a>}
            <span className="flex items-center gap-1.5"><Icon name="schedule" size={16} />{p.schedule ? describeSchedule(toRule(p.schedule)) : 'Jadval biriktirilmagan'}</span>
            <span className="flex items-center gap-1.5"><Icon name="send" size={16} />{e.telegramUsername ? <a href={`https://t.me/${e.telegramUsername}`} target="_blank" rel="noreferrer" className="font-semibold text-[#229ED9]">@{e.telegramUsername}</a> : e.telegramUserId ? 'Telegram ulangan' : 'Botga ulanmagan'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {e.status === 'active' && <Link href={`/tg/vazifa-berish?xodim=${e.id}`} className="btn-primary h-11 text-sm shadow-none"><Icon name="add_task" size={18} />Vazifa berish</Link>}
            {e.telegramUsername
              ? <a href={`https://t.me/${e.telegramUsername}`} target="_blank" rel="noreferrer" className="btn-secondary h-11 text-sm"><Icon name="send" size={18} className="text-[#229ED9]" />Yozish</a>
              : e.phone ? <a href={`tel:+${e.phone}`} className="btn-secondary h-11 text-sm"><Icon name="call" size={18} className="text-primary" />Qo&apos;ng&apos;iroq</a> : null}
          </div>
          {remind && <RemindButton employeeId={e.id} />}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold">Bugun</h2>
            {res ? <DayStatusBadge status={res.status} open={res.open} early={res.earlyLeaveMinutes > 0} waiting={!!todayRow?.shift && !res.firstIn} /> : <span className="text-[13px] text-muted">{e.status === 'active' ? 'Smena yo‘q' : 'Faol emas'}</span>}
          </div>
          {res && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {([['Keldi', res.firstIn ? formatTime(res.firstIn, tz) : '—', res.lateMinutes > 0 ? `+${res.lateMinutes} daq` : todayRow?.shift ? `smena ${formatTime(todayRow.shift.start, tz)}` : ''], ['Ketdi', res.lastOut ? formatTime(res.lastOut, tz) : res.open ? 'ishda' : '—', res.earlyLeaveMinutes > 0 ? `erta ${res.earlyLeaveMinutes} daq` : ''], ['Ishlagan', res.workedMinutes ? hm(res.workedMinutes) : '—', res.overtimeMinutes ? `+${res.overtimeMinutes} daq` : '']] as const).map(([l, v, sub]) => (
                <div key={l} className="rounded-2xl bg-page px-2 py-2.5">
                  <div className={`tnum text-[15px] font-extrabold ${v === '—' ? 'text-placeholder' : ''}`}>{v}</div>
                  <div className="text-[11px] text-muted">{l}{sub ? ` · ${sub}` : ''}</div>
                </div>
              ))}
            </div>
          )}
          {proofs.map((ev) => <TgProof key={ev.id} e={ev} tz={tz} radiusM={todayRow?.branchRadiusM ?? null} />)}
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <Link href={href(shiftMonth(month, -1))} className="flex size-9 items-center justify-center rounded-full bg-page"><Icon name="chevron_left" size={20} /></Link>
            <h2 className="m-0 text-base font-bold">{MONTHS[mo - 1]} {y}</h2>
            {month < cur ? <Link href={href(shiftMonth(month, 1))} className="flex size-9 items-center justify-center rounded-full bg-page"><Icon name="chevron_right" size={20} /></Link> : <span className="flex size-9 items-center justify-center rounded-full bg-page text-placeholder"><Icon name="chevron_right" size={20} /></span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {kpis.map(([l, v, sub]) => (
              <div key={l} className="flex flex-col rounded-2xl bg-page px-3 py-2.5">
                <span className="text-[11px] font-medium text-muted">{l}</span>
                <span className="tnum text-xl font-extrabold tracking-[-0.02em]">{v}</span>
                <span className="tnum text-[11px] text-muted">{sub}</span>
              </div>
            ))}
          </div>
          <MonthCalendar days={p.days} today={p.today} tz={tz} dayHref={(date) => `${panel}/davomat?sana=${date}`} />
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold">Ishlar · {MONTHS[mo - 1]}</h2>
            <span className="tnum text-[13px] text-muted">{journal.items.length} ta</span>
          </div>
          {journal.items.length === 0 ? <p className="m-0 text-sm text-muted">Bu oyda vazifa yo&apos;q.</p> : (
            <div className="flex flex-col divide-y divide-line-soft">
              {journal.items.slice(0, 10).map((it) => (
                <Link key={it.id} href={`/tg/vazifa/${it.id}`} className="flex items-center gap-2.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.title}</div>
                    <div className="truncate text-xs text-muted">{formatDate(`${it.day}T12:00:00Z`)}{it.source !== 'assigned' ? " · o'zi qo'shgan" : ''}{it.spentMinutes ? ` · ${minutesText(it.spentMinutes)}` : ''}{it.rating ? ` · ${'★'.repeat(it.rating)}` : ''}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_PILL[it.status]}`}>{TASK_STATUS_LABELS[it.status]}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
