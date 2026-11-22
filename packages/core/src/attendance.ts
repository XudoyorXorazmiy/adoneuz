import { plannedMinutes, type Shift } from './schedule';

/**
 * Kunlik davomat hisobi — `attendance_days` faqat shundan quriladi (CLAUDE.md §1.2). Sof funksiya.
 * Kirish: shu ish kunining hodisalari (jurnaldan, server vaqti bilan) va smena (yoki null — erkin/jadvalsiz).
 */
export const ATTENDANCE_EVENT_KINDS = ['check_in', 'check_out', 'break_start', 'break_end', 'correction', 'auto_close'] as const;
export type AttendanceEventKind = (typeof ATTENDANCE_EVENT_KINDS)[number];

export const CHECK_STATUSES = ['ok', 'suspicious', 'rejected'] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

export const ATTENDANCE_SOURCES = ['bot', 'miniapp', 'admin'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

export const DAY_STATUSES = ['present', 'late', 'absent', 'leave', 'holiday', 'off'] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  present: 'Ishda',
  late: 'Kechikdi',
  absent: 'Kelmadi',
  leave: 'Ruxsatda',
  holiday: 'Bayram',
  off: 'Dam olish',
};

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = { ok: 'Tasdiqlandi', suspicious: 'Shubhali', rejected: 'Rad etildi' };

/**
 * Tuzatish (admin): yangi kirish/chiqish qo'shadi, mavjud hodisani bekor qiladi yoki shubhali hodisani tasdiqlaydi.
 * Eski yozuv o'chmaydi — jurnal append-only. `reason` majburiy (panel).
 */
export type CorrectionMeta =
  | { action: 'add_in'; at: string; reason?: string }
  | { action: 'add_out'; at: string; reason?: string }
  | { action: 'void'; target: string; reason?: string }
  | { action: 'approve'; target: string; reason?: string };

export interface DayEvent {
  id: string;
  kind: AttendanceEventKind;
  at: Date;
  checkStatus: CheckStatus;
  meta?: Record<string, unknown> | null;
}

export interface DayResult {
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: DayStatus;
  /** Ochiq: kirgan, hali chiqmagan. */
  open: boolean;
  suspicious: boolean;
}

const mins = (ms: number) => Math.max(0, Math.round(ms / 60_000));

/** Tuzatishlarni qo'llab, haqiqiy kirish/chiqish/tanaffus hodisalari (vaqt bo'yicha). Rad etilganlar hisobga olinmaydi. */
export function effectiveEvents(events: DayEvent[]): DayEvent[] {
  const voided = new Set<string>();
  const approved = new Set<string>();
  const added: DayEvent[] = [];
  for (const e of events) {
    const m = e.kind === 'correction' ? (e.meta as CorrectionMeta | undefined) : undefined;
    if (m?.action === 'void') voided.add(m.target);
    else if (m?.action === 'approve') approved.add(m.target);
  }
  // Qo'shilgan vaqt (add_in/add_out) ham keyinroq bekor qilinishi mumkin — target = tuzatish hodisasining id'si
  for (const e of events) {
    const m = e.kind === 'correction' ? (e.meta as CorrectionMeta | undefined) : undefined;
    if ((m?.action === 'add_in' || m?.action === 'add_out') && !voided.has(e.id)) {
      added.push({ id: e.id, kind: m.action === 'add_in' ? 'check_in' : 'check_out', at: new Date(m.at), checkStatus: 'ok' });
    }
  }
  return [
    ...events
      .filter((e) => e.kind !== 'correction' && e.checkStatus !== 'rejected' && !voided.has(e.id))
      .map((e) => (approved.has(e.id) ? { ...e, checkStatus: 'ok' as const } : e)),
    ...added,
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * Kunning birinchi kirishimi (shu kirishdan OLDINGI hodisalar bo'yicha). Kechikish xabari faqat shunda ketadi:
 * tushlikdan yoki bo'lingan smenaning ikkinchi qismiga qaytgan xodim uchun ertalabki «kechikdi» qayta yuborilmaydi.
 */
export function isFirstCheckIn(eventsBefore: DayEvent[]): boolean {
  return !effectiveEvents(eventsBefore).some((e) => e.kind === 'check_in');
}

/**
 * Ochiq kun avtomatik yopilishi kerakmi (tick va «Keldim» oldidan — bitta qoida): smenali kun — smena oxiri + autoCloseHours;
 * smenasiz — oxirgi kirish + freeAutoCloseHours. Yopilishi kerak bo'lsa `at` — jurnalga yoziladigan vaqt (smena oxiri).
 */
export function autoCloseDue(input: { events: DayEvent[]; shift: Shift | null; now: Date; settings: { autoCloseHours: number; freeAutoCloseHours: number } }): { at: Date } | null {
  const { events, shift, now, settings } = input;
  if (!computeDay({ events, shift, now }).open) return null;
  const lastIn = [...events].reverse().find((x) => x.kind === 'check_in' && x.checkStatus !== 'rejected');
  const closeAt = shift ? new Date(shift.end.getTime() + settings.autoCloseHours * 3600_000) : lastIn ? new Date(lastIn.at.getTime() + settings.freeAutoCloseHours * 3600_000) : null;
  if (!closeAt || now < closeAt) return null;
  return { at: shift ? shift.end : closeAt };
}

export function computeDay(input: { events: DayEvent[]; shift: Shift | null; now: Date; onLeave?: boolean; holiday?: boolean }): DayResult {
  const evs = effectiveEvents(input.events);
  const suspicious = evs.some((e) => e.checkStatus === 'suspicious');
  let worked = 0;
  let inAt: Date | null = null;
  let breakAt: Date | null = null;
  let firstIn: Date | null = null;
  let lastOut: Date | null = null;
  let closedBy: AttendanceEventKind | null = null;
  for (const e of evs) {
    if (e.kind === 'check_in') {
      if (!inAt) inAt = e.at;
      firstIn ??= e.at;
    } else if ((e.kind === 'check_out' || e.kind === 'auto_close') && inAt) {
      const end = breakAt ?? e.at;
      worked += end.getTime() - inAt.getTime();
      inAt = null;
      breakAt = null;
      lastOut = e.at;
      closedBy = e.kind;
    } else if (e.kind === 'break_start' && inAt && !breakAt) {
      breakAt = e.at;
    } else if (e.kind === 'break_end' && inAt && breakAt) {
      worked += breakAt.getTime() - inAt.getTime();
      inAt = e.at;
      breakAt = null;
    }
  }
  const open = inAt != null;
  if (inAt && !breakAt) worked += Math.max(0, input.now.getTime() - inAt.getTime());
  if (inAt && breakAt) worked += breakAt.getTime() - inAt.getTime();

  const shift = input.shift;
  let late = 0;
  let early = 0;
  let overtime = 0;
  let workedMinutes = mins(worked);
  if (shift && firstIn) {
    const l = mins(firstIn.getTime() - shift.start.getTime());
    late = l > shift.graceMinutes ? l : 0;
    // Erta ketish: faqat xodim o'zi chiqqan bo'lsa (avto-yopish emas) va smena tugashidan oldin
    if (!open && lastOut && closedBy === 'check_out' && lastOut.getTime() < shift.end.getTime()) early = mins(shift.end.getTime() - lastOut.getTime());
    // Tanaffus bosilmagan bo'lsa jadvaldagi tanaffus ayiriladi (6 soatdan ko'p ishlaganda)
    const breakUsed = evs.some((e) => e.kind === 'break_start');
    if (!breakUsed && workedMinutes > 6 * 60) workedMinutes = Math.max(0, workedMinutes - shift.breakMinutes);
    overtime = Math.max(0, workedMinutes - plannedMinutes(shift));
  }

  let status: DayStatus;
  if (firstIn) status = late > 0 ? 'late' : 'present';
  else if (input.onLeave) status = 'leave';
  else if (input.holiday) status = 'holiday';
  else if (!shift) status = 'off';
  else status = input.now.getTime() >= shift.start.getTime() + shift.graceMinutes * 60_000 ? 'absent' : 'off';
  return { firstIn, lastOut, workedMinutes, lateMinutes: late, earlyLeaveMinutes: early, overtimeMinutes: overtime, status, open, suspicious };
}

/** «Keldim» / «Ketdim» tugmasidan oldin: hozirgi holatda qaysi amal mumkin. */
export function nextAction(events: DayEvent[]): 'check_in' | 'check_out' {
  const evs = effectiveEvents(events);
  let inside = false;
  for (const e of evs) {
    if (e.kind === 'check_in') inside = true;
    else if (e.kind === 'check_out' || e.kind === 'auto_close') inside = false;
  }
  return inside ? 'check_out' : 'check_in';
}

/** Yopilmagan «Keldim» shu qadar eski bo'lsa ham o'sha kunga «Ketdim» yoziladi (avto-yopish bundan oldin ishlaydi). */
export const OPEN_WORKDAY_MS = 24 * 3600_000;

/**
 * Kechikkan «Ketdim» (2026-11-05): smena tugagandan keyin ketayotgan xodim qo'shimcha ishlaganini tasdiqlaydi yoki
 * «qo'shimcha ish bo'lmadi» deydi (kun smena oxirida yopiladi).
 *   open_after_end — hali ochiq, smena tugagan: «ha» → hozir check_out (overtime), «yo'q» → check_out smena oxiri vaqtida;
 *   auto_closed    — tizim smena oxirida avto-yopgan (autoCloseHours = 0), xodim keyin «Ketdim» bosdi: «ha» → avto-yopish
 *                    bekor (void) + add_out hozir; «yo'q» → hech narsa (kun allaqachon smena oxirida yopilgan).
 * Avto-yopishdan 12 soat o'tgach so'ralmaydi (ertangi kun).
 */
export type LateCheckout =
  | { kind: 'none' }
  | { kind: 'open_after_end'; extraMinutes: number }
  | { kind: 'auto_closed'; autoCloseId: string; extraMinutes: number };
export const LATE_CHECKOUT_MAX_MS = 12 * 3600_000;

export function lateCheckout(events: DayEvent[], shift: Shift | null, now: Date): LateCheckout {
  if (!shift) return { kind: 'none' };
  const evs = effectiveEvents(events);
  if (nextAction(evs) === 'check_out') {
    const extra = mins(now.getTime() - shift.end.getTime());
    return extra >= 1 ? { kind: 'open_after_end', extraMinutes: extra } : { kind: 'none' };
  }
  const last = [...evs].reverse().find((e) => e.kind === 'check_out' || e.kind === 'auto_close');
  if (last?.kind === 'auto_close' && now.getTime() > last.at.getTime() && now.getTime() - last.at.getTime() <= LATE_CHECKOUT_MAX_MS) {
    return { kind: 'auto_closed', autoCloseId: last.id, extraMinutes: mins(now.getTime() - last.at.getTime()) };
  }
  return { kind: 'none' };
}

/**
 * Yarim tundan keyin «Ketdim» (2026-10-31): xodim kecha «Keldim» bosgan, 00:00 dan keyin ketmoqda — hodisa kechagi ish kuniga
 * tegishli (§1.8), yangi kun emas. Berilgan kunlar ichida (joriy kundan oldingilari) yopilmagan kirishi bor va oxirgi kirishdan
 * `maxOpenMs` o'tmagan birinchisini qaytaradi; bo'lmasa null.
 */
export function openWorkday(at: Date, days: Array<{ date: string; events: DayEvent[] }>, maxOpenMs = OPEN_WORKDAY_MS): string | null {
  for (const d of days) {
    const evs = effectiveEvents(d.events);
    if (nextAction(evs) !== 'check_out') continue;
    const lastIn = [...evs].reverse().find((e) => e.kind === 'check_in');
    if (lastIn && at.getTime() - lastIn.at.getTime() <= maxOpenMs) return d.date;
  }
  return null;
}

/**
 * «Keldi / Ketdi vaqtini belgilash» (panel): birinchi kirish va oxirgi chiqishni yangi vaqtga almashtirish uchun
 * kerakli tuzatishlar — eski hodisa bekor qilinadi (void), yangisi qo'shiladi (add_in/add_out). Vaqt o'zgarmasa — hech narsa.
 */
export function retimePlan(events: DayEvent[], want: { in?: Date; out?: Date }): CorrectionMeta[] {
  const evs = effectiveEvents(events);
  const out: CorrectionMeta[] = [];
  const same = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) < 60_000;
  if (want.in) {
    const first = evs.find((e) => e.kind === 'check_in');
    if (!first || !same(first.at, want.in)) {
      if (first) out.push({ action: 'void', target: first.id });
      out.push({ action: 'add_in', at: want.in.toISOString() });
    }
  }
  if (want.out) {
    const last = [...evs].reverse().find((e) => e.kind === 'check_out' || e.kind === 'auto_close');
    if (!last || !same(last.at, want.out)) {
      if (last) out.push({ action: 'void', target: last.id });
      out.push({ action: 'add_out', at: want.out.toISOString() });
    }
  }
  return out;
}

/** Ikkinchi «Keldim» eslatmasi birinchisidan shuncha daqiqa keyin. */
export const CHECKIN_REMINDER_REPEAT_MIN = 15;
/** Eslatma «oynasi»: tick kechiksa ham shu vaqt ichida yuboriladi; undan keyin — kech (smena ancha oldin boshlangan, masalan jadval kun o'rtasida o'zgargan). */
export const CHECKIN_REMINDER_WINDOW_MIN = 30;

/**
 * «Keldim» eslatmasi hozir kerakmi (tick har 10 daqiqada so'raydi; bir marta yuborilishi — navbatdagi dedupeKey bilan).
 * 1 — birinchi (smena boshi + afterMin), 2 — takror (+CHECKIN_REMINDER_REPEAT_MIN), null — kerak emas:
 * smena yo'q (dam olish kuni, erkin grafik), ruxsatda, yoki haqiqiy «Keldim» allaqachon bor (rad etilgan urinish hisobga olinmaydi).
 */
export function checkInReminderDue(input: { events: DayEvent[]; shift: Shift | null; now: Date; onLeave?: boolean; settings: { on: boolean; afterMin: number; repeat: boolean } }): 1 | 2 | null {
  const { shift, settings, now } = input;
  if (!settings.on || !shift || input.onLeave) return null;
  if (effectiveEvents(input.events).some((e) => e.kind === 'check_in')) return null;
  const first = shift.start.getTime() + settings.afterMin * 60_000;
  const second = first + CHECKIN_REMINDER_REPEAT_MIN * 60_000;
  const win = CHECKIN_REMINDER_WINDOW_MIN * 60_000;
  const t = now.getTime();
  if (settings.repeat && t >= second && t < second + win) return 2;
  if (t >= first && t < first + win && !(settings.repeat && t >= second)) return 1;
  return null;
}
