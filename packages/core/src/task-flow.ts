import { addDays, isoWeekday, localDate, zonedParts, zonedTime } from './time';

/**
 * Vazifalar oqimi (CLAUDE.md §1.5, §7, §7a). Holat FAQAT shu jadval bo'yicha o'zgaradi; har o'tish task_events ga yoziladi.
 *
 *   new → accepted → in_progress → submitted → approved
 *                                     ↑          ↓
 *                                 revision ←─────┘
 *   har qanday ochiq → cancelled (izoh majburiy) · muddat o'tishi — holat emas, belgi (isOverdue)
 */
export const TASK_STATUSES = ['new', 'accepted', 'in_progress', 'submitted', 'approved', 'revision', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Yangi',
  accepted: 'Qabul qilindi',
  in_progress: 'Jarayonda',
  submitted: 'Tekshiruvda',
  approved: 'Tasdiqlandi',
  revision: 'Qaytarildi',
  cancelled: 'Bekor qilindi',
};

/** assigned — rahbar berdi; self_plan — o'zi rejalashtirdi; self_done — bajarilgan ish hisoboti (§7a). */
export const TASK_SOURCES = ['assigned', 'self_plan', 'self_done'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'Oddiy', medium: "O'rta", high: 'Shoshilinch' };

/** Hisobot talabi: button — faqat tugma; qolganlari isbot sifatida talab qilinadi (to'plam). */
export const TASK_PROOFS = ['button', 'photo', 'video', 'location'] as const;
export type TaskProof = (typeof TASK_PROOFS)[number];
export const TASK_PROOF_LABELS: Record<TaskProof, string> = { button: 'Faqat tugma', photo: 'Rasm', video: 'Video', location: 'Lokatsiya' };

/** assignee — ijrochi (o'z vazifasi); reviewer — tasdiqlovchi rahbar (egasi, admin, bo'lim boshlig'i). */
export type TaskActor = 'assignee' | 'reviewer';

const FLOW: Record<TaskStatus, Partial<Record<TaskStatus, TaskActor[]>>> = {
  new: { accepted: ['assignee'], in_progress: ['assignee'], submitted: ['assignee'], cancelled: ['reviewer'] },
  accepted: { in_progress: ['assignee'], submitted: ['assignee'], cancelled: ['reviewer'] },
  in_progress: { submitted: ['assignee'], cancelled: ['reviewer'] },
  revision: { in_progress: ['assignee'], submitted: ['assignee'], cancelled: ['reviewer'] },
  submitted: { approved: ['reviewer'], revision: ['reviewer'], cancelled: ['reviewer'] },
  approved: {},
  cancelled: {},
};

export function canTransition(from: TaskStatus, to: TaskStatus, actor: TaskActor): boolean {
  return FLOW[from][to]?.includes(actor) ?? false;
}

export function nextStatuses(from: TaskStatus, actor: TaskActor): TaskStatus[] {
  return (Object.keys(FLOW[from]) as TaskStatus[]).filter((to) => canTransition(from, to, actor));
}

/** Qaytarish va bekor qilishda izoh (sabab) majburiy. */
export const needsComment = (to: TaskStatus) => to === 'revision' || to === 'cancelled';

export const isOpenTask = (s: TaskStatus) => s !== 'approved' && s !== 'cancelled';

/** Muddati o'tgan: ijrochida turgan (tekshiruvga topshirilmagan) va muddat o'tgan. */
export function isOverdue(t: { status: TaskStatus; dueAt: Date | null }, now: Date): boolean {
  return !!t.dueAt && ['new', 'accepted', 'in_progress', 'revision'].includes(t.status) && t.dueAt.getTime() < now.getTime();
}

/** O'z vaqtida topshirildimi (KPI): muddatsiz — ha. */
export function onTime(t: { dueAt: Date | null; submittedAt: Date | null }): boolean | null {
  if (!t.submittedAt) return null;
  return !t.dueAt || t.submittedAt.getTime() <= t.dueAt.getTime();
}

/** Kanban ustunlari (dizayn): Yangi · Jarayonda · Tekshiruvda · Tasdiqlandi. Bekor qilinganlar ko'rinmaydi. */
export const KANBAN_COLUMNS = ['new', 'progress', 'review', 'done'] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];
export const KANBAN_LABELS: Record<KanbanColumn, string> = { new: 'Yangi', progress: 'Jarayonda', review: 'Tekshiruvda', done: 'Tasdiqlandi' };
export function kanbanColumn(s: TaskStatus): KanbanColumn | null {
  if (s === 'new') return 'new';
  if (s === 'accepted' || s === 'in_progress' || s === 'revision') return 'progress';
  if (s === 'submitted') return 'review';
  if (s === 'approved') return 'done';
  return null;
}

/**
 * Yaratilgandagi holat. self_done — bajarilgan ish: tasdiq kerak bo'lsa `submitted`, aks holda (egasining o'z ishi yoki
 * sozlama o'chiq) darhol `approved`. self_plan — o'ziga reja, qabul qilish shart emas.
 */
export function initialStatus(source: TaskSource, needsApproval: boolean): TaskStatus {
  if (source === 'assigned') return 'new';
  if (source === 'self_plan') return 'accepted';
  return needsApproval ? 'submitted' : 'approved';
}

/** Topshirishda yetishmayotgan isbotlar. */
export function missingProofs(required: readonly TaskProof[], got: { photo: boolean; video: boolean; location: boolean }): TaskProof[] {
  return required.filter((p) => p !== 'button' && !got[p]);
}

/** Takrorlanuvchi vazifa qoidasi (task_templates). */
export interface Recurrence {
  kind: 'daily' | 'weekly' | 'monthly';
  /** weekly: ISO hafta kunlari 1..7 */
  weekdays: number[];
  /** monthly: oyning kuni 1..31 (oyda bo'lmasa — oxirgi kun) */
  monthDay: number;
}

export function occursOn(r: Recurrence, date: string): boolean {
  if (r.kind === 'daily') return true;
  if (r.kind === 'weekly') return r.weekdays.includes(isoWeekday(date));
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d === Math.min(r.monthDay, last);
}

export function describeRecurrence(r: Recurrence): string {
  if (r.kind === 'daily') return 'Har kuni';
  if (r.kind === 'monthly') return `Har oy, ${r.monthDay}-kuni`;
  const names = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  return `Har hafta: ${[...r.weekdays].sort().map((d) => names[d - 1]).join(', ')}`;
}

/**
 * Tungi tinchlik (CLAUDE.md §7): 22:00–08:00 oralig'idagi eslatma ertalab 08:00 ga suriladi. Kunduzgi vaqt — o'zgarmaydi.
 */
export function outsideQuietHours(at: Date, tz: string, quiet: { from: number; to: number } = { from: 22, to: 8 }): Date {
  const h = zonedParts(at, tz).h;
  if (h >= quiet.to && h < quiet.from) return at;
  const day = localDate(at, tz);
  const morning = `${String(quiet.to).padStart(2, '0')}:00`;
  return zonedTime(h >= quiet.from ? addDays(day, 1) : day, morning, tz);
}
