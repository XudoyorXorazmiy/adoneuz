import Link from 'next/link';
import { formatTime, isoWeekday, WEEKDAY_SHORT, type DayStatus } from '@adone/core';
import type { ProfileDay } from '@/server/profile';

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const DOT: Record<DayStatus, string> = { present: 'bg-success', late: 'bg-warning', absent: 'bg-danger', leave: 'bg-primary', holiday: 'bg-placeholder', off: 'bg-placeholder' };
const LABEL: Record<DayStatus, string> = { present: 'Ishda', late: 'Kechikdi', absent: 'Kelmadi', leave: 'Ruxsatda', holiday: 'Bayram', off: 'Dam olish' };

export const CALENDAR_LEGEND: Array<[string, string]> = [['Ishda', 'bg-success'], ['Kechikdi', 'bg-warning'], ['Kelmadi', 'bg-danger'], ['Ruxsatda', 'bg-primary'], ['Dam olish', 'bg-placeholder']];

/** Oylik tabel — kalendar ko'rinishi (dizayn: Xodim profili). Katak bosilsa — o'sha kunning davomati. */
export function MonthCalendar({ days, today, tz, dayHref }: { days: ProfileDay[]; today: string; tz: string; dayHref: (date: string) => string }) {
  const lead = days.length ? isoWeekday(days[0]!.date) - 1 : 0;
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="grid min-w-[560px] grid-cols-7 gap-2">
        {WEEKDAY_SHORT.map((w) => <div key={w} className="px-1 pb-0.5 text-xs font-semibold text-placeholder">{w}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
        {days.map((d) => <Cell key={d.date} d={d} today={today} tz={tz} href={dayHref(d.date)} />)}
      </div>
    </div>
  );
}

function Cell({ d, today, tz, href }: { d: ProfileDay; today: string; tz: string; href: string }) {
  const n = Number(d.date.slice(8));
  const box = 'relative flex h-[88px] flex-col justify-between overflow-hidden rounded-[14px] px-2.5 pt-2.5 pb-[9px]';
  const rest = !d.shift && (!d.status || d.status === 'off') && d.workedMinutes === 0;
  if (d.date > today) {
    return (
      <div className={`${box} ${rest ? 'bg-page' : 'border border-line opacity-55'}`}>
        <span className="text-[13px] font-bold text-placeholder">{n}</span>
        <span className="flex items-center gap-[5px] text-[11px] font-semibold text-placeholder">
          <span className={`size-[7px] rounded-full ${rest ? 'bg-placeholder' : 'bg-line-strong'}`} />
          {rest ? 'Dam olish' : d.shift ? `${formatTime(d.shift.start, tz)}–${formatTime(d.shift.end, tz)}` : ''}
        </span>
      </div>
    );
  }
  if (rest) {
    return (
      <div className={`${box} bg-page`}>
        <span className="text-[13px] font-bold text-placeholder">{n}</span>
        <span className="flex items-center gap-[5px] text-[11px] font-semibold text-placeholder"><span className="size-[7px] rounded-full bg-placeholder" />Dam olish</span>
      </div>
    );
  }
  const isToday = d.date === today;
  const st = d.status;
  const label = st ? `${LABEL[st]}${isToday && d.open ? ' · hozir' : ''}` : "Ma'lumot yo'q";
  const hours = d.workedMinutes > 0 ? hm(d.workedMinutes) : st === 'absent' ? '0:00' : '—';
  return (
    <Link href={href} title="Shu kunning davomati"
      className={`${box} bg-card transition hover:border-primary-line hover:shadow-[var(--shadow-card)] ${isToday ? 'border-[1.5px] border-primary' : 'border border-line'} ${d.suspicious ? 'ring-1 ring-warning' : ''}`}>
      <span className={`text-[13px] font-bold ${isToday ? 'text-primary' : ''}`}>{n}</span>
      <span className="flex flex-col gap-[3px]">
        <span className="flex items-center gap-[5px] text-[11px] leading-tight font-semibold text-ink-2"><span className={`size-[7px] shrink-0 rounded-full ${st ? DOT[st] : 'bg-line-strong'}`} />{label}</span>
        <span className={`tnum text-sm font-bold ${st === 'absent' ? 'text-danger' : hours === '—' ? 'text-placeholder' : ''}`}>{hours}</span>
      </span>
      {d.lateMinutes > 0 && (
        <>
          <span className="absolute top-0 right-0 size-[34px] bg-[linear-gradient(225deg,var(--color-warning)_50%,transparent_50%)]" />
          <span className="tnum absolute top-[3px] right-1 text-[10px] font-extrabold text-white">{d.lateMinutes}</span>
        </>
      )}
    </Link>
  );
}
