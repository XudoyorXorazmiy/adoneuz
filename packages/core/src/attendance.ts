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
    if (e.kind !== 'correction') continue;
    const m = e.meta as CorrectionMeta | undefined;
    if (!m) continue;
    if (m.action === 'void') voided.add(m.target);
    else if (m.action === 'approve') approved.add(m.target);
    else added.push({ id: `${e.id}:${m.action}`, kind: m.action === 'add_in' ? 'check_in' : 'check_out', at: new Date(m.at), checkStatus: 'ok' });
  }
  return [
    ...events
      .filter((e) => e.kind !== 'correction' && e.checkStatus !== 'rejected' && !voided.has(e.id))
      .map((e) => (approved.has(e.id) ? { ...e, checkStatus: 'ok' as const } : e)),
    ...added,
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
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
