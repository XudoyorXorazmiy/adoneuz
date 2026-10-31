import type { Metadata } from 'next';
import { addDays, describeSchedule, formatDate, isAltWeek, isWorkday, isoWeekday, localDate, timesFor, toRuleLike, WEEKDAY_SHORT } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listSchedules } from '@/server/structure';
import { archiveScheduleAction, saveScheduleAction } from '@/lib/actions/structure';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { ScheduleFields } from '@/components/structure/schedule-fields';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = { title: 'Jadvallar' };

type Sched = Awaited<ReturnType<typeof listSchedules>>[number];

/** Jadvallar: har jadval — kartochka, hafta lentasi (navbatlida — keyingi 14 kun). Uslub — Sozlamalar/Davomat. */
export default async function SchedulesPage() {
  const user = await requireArea('schedules');
  const rows = await listSchedules(user.tenantId);
  const today = localDate(new Date(), user.tenantTimezone);
  const add = (cls: string) => (
    <FormDrawer trigger={<><Icon name="add" />Jadval qo&apos;shish</>} triggerClass={cls} title="Yangi jadval" subtitle="Smena vaqti, tanaffus va kechikish chegarasi" action={saveScheduleAction}>
      <ScheduleFields today={today} />
    </FormDrawer>
  );
  return (
    <>
      <PageHeader title="Jadvallar" count={rows.length} subtitle="Smena vaqti, tanaffus va kechikish chegarasi. Xodimga jadval «Xodimlar» bo'limida biriktiriladi."
        actions={add('btn-primary h-11 pr-[22px] pl-[18px] text-sm max-md:hidden')} />
      {rows.length === 0 ? (
        <div className="card"><EmptyState text="Hali jadval yo'q. Masalan: «Asosiy smena», 6/1, 09:00–21:00.">{add('btn-primary h-11 px-[22px] text-sm')}</EmptyState></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {rows.map((s) => <ScheduleCard key={s.id} s={s} today={today} />)}
        </div>
      )}
      <div className="sticky bottom-3 z-10 md:hidden">{add('btn-primary h-[52px] w-full text-base shadow-[var(--shadow-primary)]')}</div>
    </>
  );
}

function ScheduleCard({ s, today }: { s: Sched; today: string }) {
  const night = s.kind !== 'free' && s.endTime <= s.startTime;
  const rule = toRuleLike(s);
  const monday = addDays(today, 1 - isoWeekday(today));
  const chip = 'inline-flex h-7 items-center gap-1.5 rounded-full bg-subtle px-3 text-xs font-semibold text-ink-2';
  return (
    <section className="card flex flex-col gap-4 p-5 max-sm:p-4">
      <div className="flex items-start gap-3">
        <span className="card-icon size-9"><Icon name={s.kind === 'free' ? 'all_inclusive' : 'event_repeat'} size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 flex flex-wrap items-center gap-2 text-base font-bold">
            {s.name}
            {night && <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">tungi</span>}
          </h2>
          <div className="text-[13px] text-muted">{s.kind === 'weekly' ? 'Hafta kunlari' : s.kind === 'cycle' ? 'Navbatli' : 'Erkin grafik'}</div>
        </div>
        <FormDrawer trigger={<Icon name="edit" size={18} />} triggerClass="btn-icon size-9" title="Jadvalni tahrirlash" subtitle={s.name} action={saveScheduleAction}
          danger={s.employees === 0 ? <form action={archiveScheduleAction}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost text-danger-text">O&apos;chirish</button></form> : undefined}>
          <ScheduleFields s={s} today={today} />
        </FormDrawer>
      </div>

      <div className="tnum text-[26px] leading-8 font-extrabold tracking-[-0.03em]">{s.kind === 'free' ? 'Erkin grafik' : `${s.startTime}–${s.endTime}`}</div>

      {s.kind === 'weekly' && (
        <div className="flex gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => {
            const on = s.weekdays.includes(i + 1);
            const t = on ? timesFor(rule, addDays(monday, i)) : null;
            const other = t && (t.startTime !== s.startTime || t.endTime !== s.endTime);
            return (
              <span key={d} className={`flex h-12 flex-1 flex-col items-center justify-center rounded-2xl text-[13px] leading-4 font-semibold ${on ? (other ? 'bg-primary text-white' : 'bg-navy text-white') : 'bg-subtle text-placeholder'}`}>
                {d}
                {other && <span className="tnum text-[10px] opacity-80">{t.startTime}</span>}
              </span>
            );
          })}
        </div>
      )}
      {s.dayTimes.length > 0 && (
        <div className="flex flex-col gap-1 text-[13px] text-ink-2">
          {s.dayTimes.map((dt, i) => <span key={i}><b>{dt.weekdays.map((w) => WEEKDAY_SHORT[w - 1]).join(', ')}</b> — {dt.startTime}–{dt.endTime}</span>)}
        </div>
      )}
      {rule.alt && (
        <div className="rounded-xl bg-page px-3.5 py-3 text-[13px] text-ink-2">
          Haftalik almashinuv: {s.startTime}–{s.endTime} ⇄ {rule.alt.startTime}–{rule.alt.endTime}. Bu hafta: <b className="tnum">{isAltWeek(rule, today) ? `${rule.alt.startTime}–${rule.alt.endTime}` : `${s.startTime}–${s.endTime}`}</b>
        </div>
      )}
      {s.kind === 'cycle' && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }, (_, i) => {
              const date = addDays(today, i);
              const on = isWorkday(rule, date);
              return (
                <span key={date} className={`flex flex-col items-center rounded-2xl py-1.5 text-[11px] leading-4 font-semibold ${on ? 'bg-navy text-white' : 'bg-subtle text-placeholder'} ${i === 0 ? 'ring-2 ring-primary ring-offset-1' : ''}`}>
                  <span className="opacity-70">{WEEKDAY_SHORT[isoWeekday(date) - 1]}</span>
                  <span className="tnum text-[13px]">{Number(date.slice(8))}</span>
                </span>
              );
            })}
          </div>
          <span className="text-xs text-muted">Keyingi 14 kun · boshlanish {s.cycleStart ? formatDate(`${s.cycleStart}T12:00:00Z`) : '—'}</span>
        </div>
      )}
      {s.kind === 'free' && (
        <p className="m-0 rounded-xl bg-page px-3.5 py-3 text-[13px] text-muted">Smena vaqti yo&apos;q — kechikish hisoblanmaydi, faqat ishlagan vaqt yoziladi.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {s.kind !== 'free' && <span className={chip}><Icon name="coffee" size={16} className="text-muted" />Tanaffus {s.breakMinutes} daq</span>}
        {s.kind !== 'free' && <span className={chip}><Icon name="schedule" size={16} className="text-warning" />Kechikish chegarasi {s.graceMinutes} daq</span>}
        <span className={`${chip} bg-primary-tint text-primary`}><Icon name="group" size={16} />{s.employees} xodim</span>
      </div>
    </section>
  );
}
