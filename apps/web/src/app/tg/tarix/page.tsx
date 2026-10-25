import { formatDate, formatTime, isoWeekday, localDate, MONTHS, WEEKDAY_SHORT } from '@adone/core';
import Link from 'next/link';
import { currentTgUser } from '@/lib/tg/session';
import { myMonth } from '@/server/miniapp';
import { TgPage } from '@/components/tg/tg-shell';
import { DayStatusBadge } from '@/components/attendance/badges';

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

export default async function TgHistoryPage() {
  const u = (await currentTgUser())!;
  const month = localDate(new Date(), u.tz).slice(0, 7);
  const m = await myMonth(u, month);
  const [y, mo] = month.split('-').map(Number) as [number, number];
  return (
    <TgPage>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Tarix · {MONTHS[mo - 1]} {y}</h1>
          <Link href="/tg/sorov" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-card px-3.5 text-[13px] font-bold shadow-[var(--shadow-card)]">📝 So&apos;rov</Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[['Ish kuni', String(m.workedDays)], ['Soat', hm(m.worked)], ['Kechikish', String(m.late)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-card p-3.5 shadow-[var(--shadow-card)]"><div className="tnum text-xl font-extrabold">{v}</div><div className="text-xs text-muted">{l}</div></div>
          ))}
        </div>
        <div className="flex flex-col divide-y divide-line-soft rounded-[20px] bg-card shadow-[var(--shadow-card)]">
          {m.days.filter((d) => d.status !== 'off' || d.workedMinutes > 0).map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="w-14"><div className="font-bold">{formatDate(`${d.workDate}T12:00:00Z`).slice(0, 5)}</div><div className="text-xs text-muted">{WEEKDAY_SHORT[isoWeekday(d.workDate) - 1]}</div></div>
              <div className="tnum flex-1 text-[13px] text-ink-2">{d.firstIn ? `${formatTime(d.firstIn, u.tz)} – ${d.lastOut && !d.isOpen ? formatTime(d.lastOut, u.tz) : '…'}` : '—'}</div>
              <span className="tnum w-12 text-right font-semibold">{d.workedMinutes ? hm(d.workedMinutes) : ''}</span>
              <DayStatusBadge status={d.status} open={d.isOpen} />
            </div>
          ))}
          {m.days.length === 0 && <p className="m-0 p-5 text-center text-sm text-muted">Bu oyda yozuv yo&apos;q.</p>}
        </div>
        <p className="m-0 text-center text-xs text-muted">Xato bo&apos;lsa rahbaringizga ayting — tuzatish jurnalga yoziladi.</p>
      </div>
    </TgPage>
  );
}
