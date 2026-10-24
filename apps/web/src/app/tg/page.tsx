import Link from 'next/link';
import { formatDate, formatMinutes, formatTime, isoWeekday, localDate, WEEKDAY_LONG } from '@adone/core';
import { currentTgUser } from '@/lib/tg/session';
import { homeData, myMonth } from '@/server/miniapp';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { TgPage } from '@/components/tg/tg-shell';
import { PresenceCard } from '@/components/tg/presence-card';
import { TaskRow } from '@/components/tg/task-row';

/** Mini App bosh sahifasi (dizayn: «Kelishdan oldin» / «Check-in dan keyin»). */
export default async function TgHome() {
  const u = (await currentTgUser())!;
  const [h, m] = await Promise.all([homeData(u), myMonth(u, localDate(new Date(), u.tz).slice(0, 7))]);
  const tz = u.tz;
  const first = u.name.split(' ')[0];
  const state = h.day.open ? 'in' : h.day.firstIn ? 'done' : 'out';
  return (
    <TgPage>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size={48} />
          <div className="min-w-0">
            <div className="text-[13px] text-muted">{WEEKDAY_LONG[isoWeekday(h.date) - 1]}, {formatDate(`${h.date}T12:00:00Z`)}</div>
            <div className="truncate text-xl font-bold tracking-[-0.02em]">Assalomu alaykum, {first}</div>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap gap-2">
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-subtle px-3 text-[13px] font-semibold"><Icon name="schedule" size={16} className="text-primary" />{h.shift ? `${formatTime(h.shift.start, tz)}–${formatTime(h.shift.end, tz)}` : h.hasSchedule ? 'Dam olish kuni' : 'Erkin grafik'}</span>
            {u.branchName && <span className="flex h-8 items-center gap-1.5 rounded-full bg-subtle px-3 text-[13px] font-semibold"><Icon name="location_on" size={16} className="text-primary" />{u.branchName}</span>}
          </div>
          {u.status !== 'active' ? (
            <p className="m-0 rounded-2xl bg-warning-tint p-4 text-sm font-semibold text-warning-text">Hisobingiz hali tasdiqlanmagan. Rahbaringiz tasdiqlagach «Keldim» ishlaydi.</p>
          ) : (
            <PresenceCard state={state} since={h.day.firstIn ? formatTime(h.day.firstIn, tz) : null} worked={h.day.workedMinutes} renderedAt={Date.now()}
              shiftStart={h.shift?.start.getTime() ?? null} shiftEnd={h.shift?.end.getTime() ?? null} onBreak={h.onBreak} restDay={!h.shift && h.hasSchedule}
              doneText={`Bugun ishladingiz: ${formatMinutes(h.day.workedMinutes)}${h.day.lastOut ? ` · ketdingiz ${formatTime(h.day.lastOut, tz)}` : ''}`} />
          )}
        </section>

        <div className="flex items-center justify-between pt-1">
          <h2 className="m-0 text-lg font-bold">Bugungi vazifalar ({h.tasks.length})</h2>
          <Link href="/tg/ish" className="flex h-9 items-center gap-1 rounded-full bg-card px-3.5 text-[13px] font-bold shadow-[var(--shadow-card)]"><Icon name="add" size={18} className="text-primary" />Ish qo&apos;shish</Link>
        </div>
        {h.tasks.length === 0 ? (
          <p className="m-0 rounded-2xl bg-card p-5 text-center text-sm text-muted shadow-[var(--shadow-card)]">Bugunga vazifa yo&apos;q.{h.more ? ` Keyingi kunlarga: ${h.more} ta.` : ''}</p>
        ) : h.tasks.map((t) => <TaskRow key={t.id} t={t} tz={tz} />)}
        {h.more > 0 && h.tasks.length > 0 && <Link href="/tg/vazifalar" className="text-center text-[13px] font-bold text-primary">Yana {h.more} ta vazifa →</Link>}

        <section className="grid grid-cols-2 gap-3 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]">
          <div className="col-span-2 text-[13px] text-muted">Bu oy</div>
          {[
            ['Ish kunlari', String(m.workedDays)],
            ['Ishlagan soat', `${Math.floor(m.worked / 60)}:${String(m.worked % 60).padStart(2, '0')}`],
            ['Kechikishlar', String(m.late)],
            ["Vazifalar o'z vaqtida", m.onTimePct == null ? '—' : `${m.onTimePct}%`],
          ].map(([l, v]) => <div key={l}><div className="tnum text-2xl font-extrabold tracking-[-0.02em]">{v}</div><div className="text-xs text-muted">{l}</div></div>)}
        </section>
      </div>
    </TgPage>
  );
}
