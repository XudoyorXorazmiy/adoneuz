import { addDays, daysBetween, isoWeekday, localDate, zonedTime } from './time';

/**
 * Ish jadvali (tenant ma'lumoti, `schedules` jadvali). Uch xil:
 *   weekly — haftaning tanlangan kunlari (5/2: 1–5, 6/1: 1–6)
 *   cycle  — N kun ish / M kun dam (2/2), `cycleStart` dan hisoblanadi
 *   free   — erkin grafik: smena yo'q, kechikish hisoblanmaydi, faqat ishlagan vaqt
 * Tungi smena: `endTime <= startTime` — tugash ertasi kuni. Smena boshlangan sanaga tegishli («ish kuni»).
 * Qo'shimcha: `dayTimes` — ayrim hafta kunlarida boshqa vaqt; `alt` — haftalik almashinuv (anchor haftasida bazaviy,
 * keyingisida alt vaqt, navbat bilan). Bo'linma smena (08:00–11:30 va 18:00–23:00) — bitta smena + katta tanaffus.
 */
export interface DayTimes {
  weekdays: number[]; // 1..7
  startTime: string;
  endTime: string;
}
export interface ScheduleRule {
  kind: 'weekly' | 'cycle' | 'free';
  weekdays: number[]; // 1..7, weekly uchun
  cycleOn: number;
  cycleOff: number;
  cycleStart: string | null; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  dayTimes: DayTimes[];
  alt: { startTime: string; endTime: string; anchor: string } | null; // anchor: YYYY-MM-DD — bazaviy vaqt haftasi
  breakMinutes: number;
  graceMinutes: number;
}

export interface Shift {
  date: string; // ish kuni
  start: Date;
  end: Date;
  breakMinutes: number;
  graceMinutes: number;
}

export const SCHEDULE_KINDS = ['weekly', 'cycle', 'free'] as const;

/** Baza qatoridan (schedules) qoidaga — db/attendance.ts toRule bilan bir xil, lekin sof (sahifalar uchun). */
export function toRuleLike(s: {
  kind: ScheduleRule['kind']; weekdays: number[]; cycleOn: number; cycleOff: number; cycleStart: string | null; startTime: string; endTime: string;
  dayTimes: DayTimes[]; altStartTime: string | null; altEndTime: string | null; altAnchor: string | null; breakMinutes: number; graceMinutes: number;
}): ScheduleRule {
  return {
    kind: s.kind, weekdays: s.weekdays, cycleOn: s.cycleOn, cycleOff: s.cycleOff, cycleStart: s.cycleStart, startTime: s.startTime, endTime: s.endTime,
    dayTimes: s.dayTimes ?? [],
    alt: s.altStartTime && s.altEndTime && s.altAnchor ? { startTime: s.altStartTime, endTime: s.altEndTime, anchor: s.altAnchor } : null,
    breakMinutes: s.breakMinutes, graceMinutes: s.graceMinutes,
  };
}

export function isWorkday(rule: ScheduleRule, date: string): boolean {
  if (rule.kind === 'free') return false;
  if (rule.kind === 'weekly') return rule.weekdays.includes(isoWeekday(date));
  if (!rule.cycleStart || rule.cycleOn < 1) return false;
  const period = rule.cycleOn + Math.max(0, rule.cycleOff);
  const n = daysBetween(rule.cycleStart, date);
  return ((n % period) + period) % period < rule.cycleOn;
}

/** Sana dushanbasi (ISO hafta boshi). */
function weekMonday(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Almashinuvda shu sana «alt» haftasiga tushadimi (anchor haftasidan toq hafta). */
export function isAltWeek(rule: Pick<ScheduleRule, 'alt'>, date: string): boolean {
  if (!rule.alt) return false;
  const weeks = Math.round(daysBetween(weekMonday(rule.alt.anchor), weekMonday(date)) / 7);
  return ((weeks % 2) + 2) % 2 === 1;
}

/** Shu kunning smena vaqti: almashinuv haftasi → alt; kun uchun alohida vaqt → dayTimes; aks holda bazaviy. */
export function timesFor(rule: Pick<ScheduleRule, 'startTime' | 'endTime' | 'dayTimes' | 'alt'>, date: string): { startTime: string; endTime: string } {
  if (isAltWeek(rule, date)) return { startTime: rule.alt!.startTime, endTime: rule.alt!.endTime };
  const wd = isoWeekday(date);
  const o = rule.dayTimes.find((d) => d.weekdays.includes(wd));
  return o ? { startTime: o.startTime, endTime: o.endTime } : { startTime: rule.startTime, endTime: rule.endTime };
}

export function shiftFor(rule: ScheduleRule, date: string, tz: string): Shift | null {
  if (!isWorkday(rule, date)) return null;
  const t = timesFor(rule, date);
  const start = zonedTime(date, t.startTime, tz);
  const overnight = t.endTime <= t.startTime;
  const end = zonedTime(overnight ? addDays(date, 1) : date, t.endTime, tz);
  return { date, start, end, breakMinutes: rule.breakMinutes, graceMinutes: rule.graceMinutes };
}

/** Smenadan oldin/keyin shu oraliqda kelgan hodisa o'sha smenaga tegishli. */
const BEFORE_MS = 4 * 3600_000;
const AFTER_MS = 8 * 3600_000;

/**
 * Lahza qaysi ish kuniga tegishli: kecha boshlangan tungi smena hali davom etsa — kechagi sana.
 * Jadval yo'q yoki erkin bo'lsa — mahalliy sana.
 */
export function workdayFor(rule: ScheduleRule | null, at: Date, tz: string): { date: string; shift: Shift | null } {
  const today = localDate(at, tz);
  if (!rule || rule.kind === 'free') return { date: today, shift: null };
  const current = shiftFor(rule, today, tz);
  if (current && at.getTime() >= current.start.getTime() - BEFORE_MS) return { date: today, shift: current };
  // Kecha boshlangan tungi smena bugun tugaydi va lahza uning oralig'ida
  const yesterday = addDays(today, -1);
  const prev = shiftFor(rule, yesterday, tz);
  if (prev && localDate(prev.end, tz) === today && at.getTime() <= prev.end.getTime() + AFTER_MS) return { date: yesterday, shift: prev };
  return { date: today, shift: current };
}

export function plannedMinutes(shift: Shift): number {
  return Math.max(0, Math.round((shift.end.getTime() - shift.start.getTime()) / 60_000) - shift.breakMinutes);
}

/** «5/2 · 09:00–18:00», «2/2 · 08:30–22:00», «Erkin grafik» */
export function describeSchedule(rule: Pick<ScheduleRule, 'kind' | 'weekdays' | 'cycleOn' | 'cycleOff' | 'startTime' | 'endTime'> & Partial<Pick<ScheduleRule, 'dayTimes' | 'alt'>>): string {
  if (rule.kind === 'free') return 'Erkin grafik';
  const time = rule.alt ? `${rule.startTime}–${rule.endTime} ⇄ ${rule.alt.startTime}–${rule.alt.endTime}` : `${rule.startTime}–${rule.endTime}`;
  if (rule.kind === 'cycle') return `${rule.cycleOn}/${rule.cycleOff} · ${time}`;
  const days = [...rule.weekdays].sort();
  const contiguous = days.length > 0 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1) && days[0] === 1;
  const label = contiguous ? `${days.length}/${7 - days.length}` : days.map((d) => ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'][d - 1]).join(', ');
  const extra = rule.dayTimes?.length ? ` (${rule.dayTimes.map((d) => `${d.weekdays.map((w) => ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'][w - 1]).join(',')} ${d.startTime}–${d.endTime}`).join('; ')})` : '';
  return `${label} · ${time}${extra}`;
}
