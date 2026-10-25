/**
 * Hisobotlar (panel → /hisobotlar): davr, davomat va vazifalar yig'masi, reyting balli. Sof funksiyalar — ma'lumot
 * serverdan (`attendance_days` — yagona davomat manbai, `tasks`) keladi, bu yerda faqat hisob. Testlar `tests/reports.test.ts`.
 */
import type { DayStatus } from './attendance';
import { MONTHS, WEEKDAY_LONG, addDays, daysBetween, isoWeekday, isValidDate, monthDays } from './time';
import { onTime, isOverdue, type TaskSource, type TaskStatus } from './task-flow';

// ---------- Davr ----------

export const REPORT_PRESETS = ['hafta', 'otgan-hafta', 'oy', 'otgan-oy', 'tanlash'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = {
  hafta: 'Bu hafta', 'otgan-hafta': "O'tgan hafta", oy: 'Bu oy', 'otgan-oy': "O'tgan oy", tanlash: 'Tanlash…',
};
/** «Tanlash» oralig'i chegarasi (kunlar). */
export const MAX_REPORT_DAYS = 93;

export interface ReportPeriod {
  preset: ReportPreset;
  from: string;
  to: string;
  /** Solishtirish: shu uzunlikdagi oldingi davr (oy — oldingi oyning shu kunlari). */
  prevFrom: string;
  prevTo: string;
}

const monthStart = (d: string) => `${d.slice(0, 8)}01`;
const monthEnd = (d: string) => monthDays(d.slice(0, 7)).at(-1)!;
const weekStart = (d: string) => addDays(d, 1 - isoWeekday(d));
const prevMonthStart = (d: string) => monthStart(addDays(monthStart(d), -1));

/** Oy davrining oldingisi: butun oy — butun oldingi oy; oyning boshidan bugungacha — oldingi oyning shu kunlari (1–26.10 → 1–26.09). */
function prevMonthRange(from: string, to: string): [string, string] {
  const pf = prevMonthStart(from);
  const last = monthEnd(pf);
  if (to === monthEnd(from)) return [pf, last];
  return [pf, Number(last.slice(8)) < Number(to.slice(8)) ? last : `${pf.slice(0, 8)}${to.slice(8)}`];
}

/** URL parametrlaridan davr. Kelajak kunlar — bugungacha; noto'g'ri «Tanlash» — «Bu oy». */
export function reportPeriod(preset: string | undefined, today: string, custom?: { from?: string; to?: string }): ReportPeriod {
  const p = (REPORT_PRESETS as readonly string[]).includes(preset ?? '') ? (preset as ReportPreset) : 'oy';
  if (p === 'hafta' || p === 'otgan-hafta') {
    const from = p === 'hafta' ? weekStart(today) : addDays(weekStart(today), -7);
    const to = p === 'hafta' ? today : addDays(from, 6);
    return { preset: p, from, to, prevFrom: addDays(from, -7), prevTo: addDays(to, -7) };
  }
  if (p === 'oy' || p === 'otgan-oy') {
    const from = p === 'oy' ? monthStart(today) : prevMonthStart(today);
    const to = p === 'oy' ? today : monthEnd(from);
    const [prevFrom, prevTo] = prevMonthRange(from, to);
    return { preset: p, from, to, prevFrom, prevTo };
  }
  let from = custom?.from && isValidDate(custom.from) ? custom.from : '';
  let to = custom?.to && isValidDate(custom.to) ? custom.to : '';
  if (!from || !to) return reportPeriod('oy', today);
  if (from > to) [from, to] = [to, from];
  if (to > today) to = today;
  if (from > to) from = to;
  if (daysBetween(from, to) >= MAX_REPORT_DAYS) from = addDays(to, -(MAX_REPORT_DAYS - 1));
  // Butun oy tanlansa — oldingi butun oy bilan; aks holda shu uzunlikdagi oldingi oraliq
  if (from === monthStart(from) && to === monthEnd(from)) return { preset: 'tanlash', from, to, prevFrom: prevMonthStart(from), prevTo: monthEnd(prevMonthStart(from)) };
  const len = daysBetween(from, to) + 1;
  return { preset: 'tanlash', from, to, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}

const dm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;
const dmy = (d: string) => `${dm(d)}.${d.slice(0, 4)}`;

/** Davr yorlig'i: butun oy (yoki oyning boshidan bugungacha) — «Oktabr 2026», aks holda «19–25.10.2026» / «28.09 – 04.10.2026». */
export function periodLabel(from: string, to: string, today?: string): string {
  if (from === monthStart(from) && from.slice(0, 7) === to.slice(0, 7) && (to === monthEnd(from) || to === today)) {
    return `${MONTHS[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
  }
  return shortRange(from, to, true);
}

/** «19–25.10» (yil bilan — «19–25.10.2026»); oy/yil farq qilsa «28.09 – 04.10». */
export function shortRange(from: string, to: string, withYear = false): string {
  if (from === to) return withYear ? dmy(from) : dm(from);
  const y = withYear ? `.${to.slice(0, 4)}` : '';
  if (from.slice(0, 7) === to.slice(0, 7)) return `${from.slice(8)}–${dm(to)}${y}`;
  return `${withYear && from.slice(0, 4) !== to.slice(0, 4) ? dmy(from) : dm(from)} – ${dm(to)}${y}`;
}

export function periodDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Davr ichidagi haftalar (dushanbadan), chetlari kesilgan: «1-hafta · 01–04.10». */
export function weekBuckets(from: string, to: string): Array<{ from: string; to: string; label: string; range: string }> {
  const out: Array<{ from: string; to: string; label: string; range: string }> = [];
  for (let s = from; s <= to; ) {
    const e = addDays(weekStart(s), 6) < to ? addDays(weekStart(s), 6) : to;
    out.push({ from: s, to: e, label: `${out.length + 1}-hafta`, range: shortRange(s, e) });
    s = addDays(e, 1);
  }
  return out;
}

// ---------- Format ----------

/** 10600 → «176:40» (soat:daqiqa). */
export function hhmm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** 24 → «24 daq», 90 → «1 soat 30 daq», 120 → «2 soat». */
export function shortDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} daq`;
  return `${Math.floor(m / 60)} soat${m % 60 ? ` ${m % 60} daq` : ''}`;
}

/** Ulush → butun foiz; maxraj 0 — null. */
export function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Foiz punkti farqi (bir kasr): 94.0 va 92.2 → 1.8. */
export function ppDelta(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null) return null;
  return Math.round((cur - prev) * 10) / 10;
}

// ---------- Davomat ----------

/** `attendance_days` qatori (hisobot uchun). `planned` — smena bor va kun boshlangan; `arrival` — kelish smena boshidan necha daqiqa farq. */
export interface ReportDay {
  employeeId: string;
  workDate: string;
  status: DayStatus;
  planned: boolean;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  arrival: number | null;
}

export interface AttendanceStats {
  planned: number;
  came: number;
  late: number;
  lateMinutes: number;
  early: number;
  earlyMinutes: number;
  absent: number;
  leave: number;
  workedMinutes: number;
  overtimeMinutes: number;
  /** Kelgan / kutilgan (kelgan + sababsiz kelmagan) — ruxsat va dam olish kunlari hisobga kirmaydi. */
  pct: number | null;
  /** Aniq ulush (reyting uchun, yaxlitlanmagan). */
  rate: number | null;
}

export function attendanceStats(days: ReportDay[]): AttendanceStats {
  const s = { planned: 0, came: 0, late: 0, lateMinutes: 0, early: 0, earlyMinutes: 0, absent: 0, leave: 0, workedMinutes: 0, overtimeMinutes: 0 };
  for (const d of days) {
    if (d.planned) s.planned++;
    if (d.status === 'present' || d.status === 'late') s.came++;
    if (d.status === 'late') { s.late++; s.lateMinutes += d.lateMinutes; }
    if (d.earlyLeaveMinutes > 0) { s.early++; s.earlyMinutes += d.earlyLeaveMinutes; }
    if (d.status === 'absent') s.absent++;
    if (d.status === 'leave') s.leave++;
    s.workedMinutes += d.workedMinutes;
    s.overtimeMinutes += d.overtimeMinutes;
  }
  const expected = s.came + s.absent;
  return { ...s, pct: pct(s.came, expected), rate: expected ? (s.came / expected) * 100 : null };
}

export interface DaySeries { date: string; present: number; late: number; absent: number; leave: number; off: number }

/** Kunlar bo'yicha ustunlar: ishda (o'z vaqtida), kechikdi, kelmadi, ruxsatda; qolgani — dam olish (`headcount` gacha). */
export function dailySeries(days: ReportDay[], dates: string[], headcount: number): DaySeries[] {
  const by = new Map(dates.map((d) => [d, { date: d, present: 0, late: 0, absent: 0, leave: 0, off: 0 }]));
  for (const d of days) {
    const r = by.get(d.workDate);
    if (!r) continue;
    if (d.status === 'present') r.present++;
    else if (d.status === 'late') r.late++;
    else if (d.status === 'absent') r.absent++;
    else if (d.status === 'leave') r.leave++;
  }
  return [...by.values()].map((r) => ({ ...r, off: Math.max(0, headcount - r.present - r.late - r.absent - r.leave) }));
}

/** Kunlarni haftalarga yig'ish («Hafta» ko'rinishi) — hafta bo'yicha jami. */
export function weeklySeries(series: DaySeries[]): Array<DaySeries & { label: string; range: string }> {
  if (!series.length) return [];
  return weekBuckets(series[0]!.date, series.at(-1)!.date).map((w) => {
    const part = series.filter((s) => s.date >= w.from && s.date <= w.to);
    const sum = (k: keyof Omit<DaySeries, 'date'>) => part.reduce((a, s) => a + s[k], 0);
    return { date: w.from, label: w.label, range: w.range, present: sum('present'), late: sum('late'), absent: sum('absent'), leave: sum('leave'), off: sum('off') };
  });
}

/** O'rtacha kelganlar soni — kimdir kutilgan kunlar bo'yicha (to'liq dam olish kunlari kirmaydi). */
export function averageCame(series: DaySeries[]): number {
  const work = series.filter((s) => s.present + s.late + s.absent > 0);
  return work.length ? Math.round(work.reduce((a, s) => a + s.present + s.late, 0) / work.length) : 0;
}

export const ARRIVAL_BINS = [-15, -10, -5, 0, 5, 10, 15, 20, 25, 30] as const;

/**
 * Kelish vaqti gistogrammasi: smena boshiga nisbatan daqiqa, 5 daqiqalik qutilar. Quti `L` — (L−5, L] oralig'i;
 * −15 va undan erta — birinchi, +30 dan kech — oxirgi qutiga. `onTime` — 0 gacha (smenadan oldin).
 */
export function arrivalHistogram(days: ReportDay[]): { bins: Array<{ label: number; n: number; onTime: boolean }>; avg: number | null; count: number } {
  const n: number[] = ARRIVAL_BINS.map(() => 0);
  let sum = 0;
  let count = 0;
  for (const d of days) {
    if (d.arrival == null) continue;
    const i = Math.min(ARRIVAL_BINS.length - 1, Math.max(0, Math.ceil(d.arrival / 5) + 3));
    n[i]!++;
    sum += d.arrival;
    count++;
  }
  return { bins: ARRIVAL_BINS.map((label, i) => ({ label, n: n[i]!, onTime: label <= 0 })), avg: count ? Math.round(sum / count) : null, count };
}

/** «smenadan 4 daqiqa oldin» / «… keyin» / «aynan smena boshida». */
export function arrivalText(avg: number): string {
  if (avg === 0) return 'aynan smena boshida';
  return `smenadan ${Math.abs(avg)} daqiqa ${avg < 0 ? 'oldin' : 'keyin'}`;
}

// ---------- Vazifalar ----------

export interface ReportTask {
  id: string;
  employeeId: string | null;
  source: TaskSource;
  status: TaskStatus;
  createdAt: Date;
  dueAt: Date | null;
  submittedAt: Date | null;
  rating: number | null;
  revisionCount: number;
  spentMinutes: number | null;
}

export interface TaskStats {
  /** Rahbar bergan (bekor qilinganlarsiz). */
  given: number;
  done: number;
  submitted: number;
  onTime: number;
  /** Kech topshirilgan + hozir muddati o'tgan ochiq. */
  late: number;
  /** Kamida bir marta qaytarilgan. */
  returned: number;
  ratingSum: number;
  ratingCount: number;
  selfDone: number;
  selfPlan: number;
  selfMinutes: number;
  donePct: number | null;
  onTimePct: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
}

/** Berilgan vazifalar (`assigned`) va o'zi qo'shgan ishlar. Davr — vazifa yaratilgan sana (server filtrlaydi). */
export function taskStats(list: ReportTask[], now: Date): TaskStats {
  const s = { given: 0, done: 0, submitted: 0, onTime: 0, late: 0, returned: 0, ratingSum: 0, ratingCount: 0, selfDone: 0, selfPlan: 0, selfMinutes: 0 };
  for (const t of list) {
    if (t.status === 'cancelled') continue;
    if (t.source !== 'assigned') {
      if (t.source === 'self_done') s.selfDone++;
      else s.selfPlan++;
      s.selfMinutes += t.spentMinutes ?? 0;
      continue;
    }
    s.given++;
    if (t.status === 'approved') s.done++;
    if (t.revisionCount > 0) s.returned++;
    if (t.rating != null) { s.ratingSum += t.rating; s.ratingCount++; }
    const ot = onTime(t);
    if (ot !== null) {
      s.submitted++;
      if (ot) s.onTime++;
      else s.late++;
    } else if (isOverdue(t, now)) s.late++;
  }
  return {
    ...s,
    donePct: pct(s.done, s.given),
    onTimePct: pct(s.onTime, s.submitted),
    onTimeRate: s.submitted ? (s.onTime / s.submitted) * 100 : null,
    avgRating: s.ratingCount ? Math.round((s.ratingSum / s.ratingCount) * 10) / 10 : null,
  };
}

// ---------- Reyting ----------

/** Ball = davomat 40% + vazifalar o'z vaqtida 40% + o'rtacha baho 20% (keyin — ishxona sozlamasi). */
export const RATING_WEIGHTS = { attendance: 40, onTime: 40, rating: 20 } as const;
export type RatingWeights = { attendance: number; onTime: number; rating: number };

export interface ScoreParts { attendance: number | null; onTime: number | null; rating: number | null }

/**
 * 0–100 ball. Tarkibiy qism yo'q bo'lsa (masalan, vazifa berilmagan) — qolganlari og'irligi bo'yicha qayta taqsimlanadi;
 * hech biri yo'q — null (reytingga kirmaydi). Baho 1–5 → 0–100 (5 = 100).
 */
export function ratingScore(p: ScoreParts, w: RatingWeights = RATING_WEIGHTS): number | null {
  const parts: Array<[number | null, number]> = [[p.attendance, w.attendance], [p.onTime, w.onTime], [p.rating == null ? null : (p.rating / 5) * 100, w.rating]];
  let sum = 0;
  let weight = 0;
  for (const [v, k] of parts) {
    if (v == null || k <= 0) continue;
    sum += v * k;
    weight += k;
  }
  return weight ? Math.round(sum / weight) : null;
}

export interface Ranked<T> { item: T; score: number; place: number }

/** Ball bo'yicha kamayish tartibida; teng ball — `name` alifbosi. Ballsizlar chiqariladi. */
export function rankBy<T>(items: T[], score: (x: T) => number | null, name: (x: T) => string): Array<Ranked<T>> {
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((x): x is { item: T; score: number } => x.score != null)
    .sort((a, b) => b.score - a.score || name(a.item).localeCompare(name(b.item)))
    .map((x, i) => ({ ...x, place: i + 1 }));
}

/** O'rin o'zgarishi: musbat — ko'tarildi. Oldingi davrda bo'lmasa null. */
export function placeChange(place: number, prevPlace: number | undefined): number | null {
  return prevPlace == null ? null : prevPlace - place;
}

export type AttentionReason = { kind: 'late' | 'absent' | 'tasks_late' | 'low_rating'; text: string };

/**
 * «E'tibor talab qiladi»: ballni eng ko'p tushirgan qism (100 dan og'irlik bo'yicha yo'qotish).
 * Davomatda — kelmagan kunlar ko'p bo'lsa «Kelmagan», aks holda «Ko'p kechikadi».
 */
export function attentionReason(
  p: ScoreParts & { late: number; absent: number; tasksLate: number; avgRating: number | null },
  w: RatingWeights = RATING_WEIGHTS,
): AttentionReason | null {
  const loss: Array<[AttentionReason['kind'], number]> = [];
  if (p.attendance != null) loss.push([p.absent > 0 && p.absent * 2 >= p.late ? 'absent' : 'late', (100 - p.attendance) * w.attendance]);
  if (p.onTime != null) loss.push(['tasks_late', (100 - p.onTime) * w.onTime]);
  if (p.rating != null) loss.push(['low_rating', (100 - (p.rating / 5) * 100) * w.rating]);
  const top = loss.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const text = {
    late: `Ko'p kechikadi: ${p.late} marta`,
    absent: `Kelmagan: ${p.absent} kun`,
    tasks_late: `Vazifalar kechikmoqda: ${p.tasksLate}`,
    low_rating: `Past baho: ${(p.avgRating ?? p.rating ?? 0).toFixed(1)}`,
  }[top[0]];
  return { kind: top[0], text };
}

// ---------- Ish jurnali ----------

/** Kun sarlavhasi: «Bugun», «Kecha», aks holda hafta kuni. Sana alohida ko'rsatiladi. */
export function journalHeading(date: string, today: string): string {
  if (date === today) return 'Bugun';
  if (date === addDays(today, -1)) return 'Kecha';
  return WEEKDAY_LONG[isoWeekday(date) - 1]!;
}
