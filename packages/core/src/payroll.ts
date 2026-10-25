/**
 * Ish haqi hisobi (CLAUDE.md §1.7) — sof funksiya, faqat butun so'm (float yo'q: har qism alohida yaxlitlanadi).
 * Qoidalar — ishxona ma'lumoti (`pay_rules`), kodda faqat standart qiymatlar. Natija `payroll_lines` ga snapshot qilinadi.
 */
import type { DayStatus } from './attendance';
import type { PayType } from './enums';

export interface PayRules {
  /** Oylik maoshni ishlangan kunlarga mutanosib hisoblash (reja kunlari bo'yicha). */
  monthlyProration: boolean;
  /** Tasdiqlangan ruxsat kunlari to'lanadimi (ishlangan kun hisobida). */
  paidLeave: boolean;
  late: { mode: 'off' | 'per_minute' | 'per_case'; amount: number };
  /** Sababsiz kelmagan har kun uchun jarima (maosh ulushidan tashqari). */
  absentPenalty: number;
  /** Erta ketishning har daqiqasi. */
  earlyPerMinute: number;
  /** Qo'shimcha ishlangan har soat uchun. */
  overtimePerHour: number;
  task: { onTimeBonus: number; latePenalty: number; fiveStarBonus: number; countSelfTasks: boolean };
  /** Jarimalar yig'indisi asosiy maoshning shu foizidan oshmaydi (0 — cheklovsiz). */
  maxPenaltyPercent: number;
  /** Xodim o'z ish haqini Mini App'da ko'radimi. */
  showToEmployee: boolean;
}

export const DEFAULT_PAY_RULES: PayRules = {
  monthlyProration: true,
  paidLeave: true,
  late: { mode: 'off', amount: 0 },
  absentPenalty: 0,
  earlyPerMinute: 0,
  overtimePerHour: 0,
  task: { onTimeBonus: 0, latePenalty: 0, fiveStarBonus: 0, countSelfTasks: false },
  maxPenaltyPercent: 30,
  showToEmployee: false,
};

const int = (v: unknown, max = 100_000_000) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** Bazadagi (yoki formadan kelgan) qoidalarni tekshirib, standart bilan to'ldiradi. */
export function normalizePayRules(raw: unknown): PayRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const d = DEFAULT_PAY_RULES;
  const mode = ['off', 'per_minute', 'per_case'].includes(r.late?.mode) ? r.late.mode : d.late.mode;
  return {
    monthlyProration: bool(r.monthlyProration, d.monthlyProration),
    paidLeave: bool(r.paidLeave, d.paidLeave),
    late: { mode, amount: int(r.late?.amount, 10_000_000) },
    absentPenalty: int(r.absentPenalty, 100_000_000),
    earlyPerMinute: int(r.earlyPerMinute, 1_000_000),
    overtimePerHour: int(r.overtimePerHour, 10_000_000),
    task: {
      onTimeBonus: int(r.task?.onTimeBonus, 100_000_000), latePenalty: int(r.task?.latePenalty, 100_000_000),
      fiveStarBonus: int(r.task?.fiveStarBonus, 100_000_000), countSelfTasks: bool(r.task?.countSelfTasks, d.task.countSelfTasks),
    },
    maxPenaltyPercent: Math.min(100, int(r.maxPenaltyPercent ?? d.maxPenaltyPercent, 100)),
    showToEmployee: bool(r.showToEmployee, d.showToEmployee),
  };
}

export interface PayDay { status: DayStatus; planned: boolean; workedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; overtimeMinutes: number }
export interface PayTask { onTime: boolean | null; rating: number | null; self: boolean }

export interface PayItem { kind: string; label: string; count: number; amount: number }
export interface PayResult {
  base: number;
  penalties: PayItem[];
  bonuses: PayItem[];
  penaltyTotal: number;
  bonusTotal: number;
  /** Jarima cheklovi sababli kechirilgan summa. */
  penaltyCapped: number;
  total: number;
  stats: { plannedDays: number; workedDays: number; leaveDays: number; absentDays: number; lateDays: number; lateMinutes: number; workedMinutes: number; overtimeMinutes: number; tasksOnTime: number; tasksLate: number };
}

export function computePay(input: { payType: PayType; rate: number; days: PayDay[]; tasks: PayTask[] }, rules: PayRules): PayResult {
  const rate = int(input.rate);
  const s = { plannedDays: 0, workedDays: 0, leaveDays: 0, absentDays: 0, lateDays: 0, lateMinutes: 0, workedMinutes: 0, overtimeMinutes: 0, tasksOnTime: 0, tasksLate: 0, earlyMinutes: 0 };
  for (const d of input.days) {
    if (d.planned) s.plannedDays++;
    if (d.workedMinutes > 0 || d.status === 'present' || d.status === 'late') s.workedDays++;
    if (d.status === 'leave') s.leaveDays++;
    if (d.status === 'absent') s.absentDays++;
    if (d.status === 'late') { s.lateDays++; s.lateMinutes += d.lateMinutes; }
    s.workedMinutes += d.workedMinutes;
    s.overtimeMinutes += d.overtimeMinutes;
    s.earlyMinutes += d.earlyLeaveMinutes;
  }
  const paidDays = s.workedDays + (rules.paidLeave ? s.leaveDays : 0);
  let base: number;
  if (input.payType === 'hourly') base = Math.round((rate * s.workedMinutes) / 60);
  else if (input.payType === 'daily') base = rate * paidDays;
  else base = rules.monthlyProration && s.plannedDays > 0 ? Math.round((rate * Math.min(paidDays, s.plannedDays)) / s.plannedDays) : rate;

  const penalties: PayItem[] = [];
  const bonuses: PayItem[] = [];
  const add = (list: PayItem[], kind: string, label: string, count: number, amount: number) => { if (amount > 0 && count > 0) list.push({ kind, label, count, amount: Math.round(amount) }); };
  if (rules.late.mode === 'per_minute') add(penalties, 'late', 'Kechikish (daqiqa)', s.lateMinutes, s.lateMinutes * rules.late.amount);
  if (rules.late.mode === 'per_case') add(penalties, 'late', 'Kechikish (marta)', s.lateDays, s.lateDays * rules.late.amount);
  add(penalties, 'absent', 'Sababsiz kelmagan (kun)', s.absentDays, s.absentDays * rules.absentPenalty);
  add(penalties, 'early', 'Erta ketish (daqiqa)', s.earlyMinutes, s.earlyMinutes * rules.earlyPerMinute);
  const ovHours = Math.floor(s.overtimeMinutes / 60);
  add(bonuses, 'overtime', "Qo'shimcha ish (soat)", ovHours, ovHours * rules.overtimePerHour);

  const tasks = input.tasks.filter((t) => rules.task.countSelfTasks || !t.self);
  s.tasksOnTime = tasks.filter((t) => t.onTime === true).length;
  s.tasksLate = tasks.filter((t) => t.onTime === false).length;
  const five = tasks.filter((t) => t.rating === 5).length;
  add(bonuses, 'task_on_time', "Vazifa o'z vaqtida", s.tasksOnTime, s.tasksOnTime * rules.task.onTimeBonus);
  add(bonuses, 'task_five', 'Vazifa 5 baho', five, five * rules.task.fiveStarBonus);
  add(penalties, 'task_late', 'Vazifa kechikdi', s.tasksLate, s.tasksLate * rules.task.latePenalty);

  const rawPenalty = penalties.reduce((a, p) => a + p.amount, 0);
  const cap = rules.maxPenaltyPercent > 0 ? Math.floor((base * rules.maxPenaltyPercent) / 100) : Infinity;
  const penaltyTotal = Math.min(rawPenalty, cap);
  const bonusTotal = bonuses.reduce((a, b) => a + b.amount, 0);
  return {
    base, penalties, bonuses, penaltyTotal, bonusTotal, penaltyCapped: rawPenalty - penaltyTotal,
    total: Math.max(0, base - penaltyTotal + bonusTotal),
    stats: { plannedDays: s.plannedDays, workedDays: s.workedDays, leaveDays: s.leaveDays, absentDays: s.absentDays, lateDays: s.lateDays, lateMinutes: s.lateMinutes, workedMinutes: s.workedMinutes, overtimeMinutes: s.overtimeMinutes, tasksOnTime: s.tasksOnTime, tasksLate: s.tasksLate },
  };
}

export const PAY_TYPE_LABELS: Record<PayType, string> = { monthly: 'Oylik', daily: 'Kunbay', hourly: 'Soatbay' };

export const PAYROLL_STATUSES = ['draft', 'closed'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];
export const PAYROLL_STATUS_LABELS: Record<PayrollStatus, string> = { draft: 'Qoralama', closed: 'Yopilgan' };
