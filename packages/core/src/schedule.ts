import { addDays, daysBetween, isoWeekday, localDate, zonedTime } from './time';

/**
 * Ish jadvali (tenant ma'lumoti, `schedules` jadvali). Uch xil:
 *   weekly — haftaning tanlangan kunlari (5/2: 1–5, 6/1: 1–6)
 *   cycle  — N kun ish / M kun dam (2/2), `cycleStart` dan hisoblanadi
 *   free   — erkin grafik: smena yo'q, kechikish hisoblanmaydi, faqat ishlagan vaqt
 * Tungi smena: `endTime <= startTime` — tugash ertasi kuni. Smena boshlangan sanaga tegishli («ish kuni»).
 */
export interface ScheduleRule {
  kind: 'weekly' | 'cycle' | 'free';
  weekdays: number[]; // 1..7, weekly uchun
  cycleOn: number;
  cycleOff: number;
  cycleStart: string | null; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
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

export function isWorkday(rule: ScheduleRule, date: string): boolean {
  if (rule.kind === 'free') return false;
  if (rule.kind === 'weekly') return rule.weekdays.includes(isoWeekday(date));
  if (!rule.cycleStart || rule.cycleOn < 1) return false;
  const period = rule.cycleOn + Math.max(0, rule.cycleOff);
  const n = daysBetween(rule.cycleStart, date);
  return ((n % period) + period) % period < rule.cycleOn;
}

export function shiftFor(rule: ScheduleRule, date: string, tz: string): Shift | null {
  if (!isWorkday(rule, date)) return null;
  const start = zonedTime(date, rule.startTime, tz);
  const overnight = rule.endTime <= rule.startTime;
  const end = zonedTime(overnight ? addDays(date, 1) : date, rule.endTime, tz);
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
export function describeSchedule(rule: Pick<ScheduleRule, 'kind' | 'weekdays' | 'cycleOn' | 'cycleOff' | 'startTime' | 'endTime'>): string {
  if (rule.kind === 'free') return 'Erkin grafik';
  const time = `${rule.startTime}–${rule.endTime}`;
  if (rule.kind === 'cycle') return `${rule.cycleOn}/${rule.cycleOff} · ${time}`;
  const days = [...rule.weekdays].sort();
  const contiguous = days.length > 0 && days.every((d, i) => i === 0 || d === days[i - 1]! + 1) && days[0] === 1;
  const label = contiguous ? `${days.length}/${7 - days.length}` : days.map((d) => ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'][d - 1]).join(', ');
  return `${label} · ${time}`;
}
