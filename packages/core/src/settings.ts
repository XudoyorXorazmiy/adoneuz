/**
 * Ishxona sozlamalari (`tenants.settings` jsonb, Sozlamalar sahifasi). Baza qanday bo'lmasin — `tenantSettings()`
 * har doim to'liq, chegaralangan qiymat qaytaradi; standartlar = sozlama paydo bo'lishidan oldingi xatti-harakat.
 */
import { DEFAULT_EMPLOYEE_CRITERIA, DEFAULT_INSPECTION_CRITERIA, normalizeCriteria, type InspectionCriterion } from './inspection';
import { faceSettings, type FaceSettings } from './face';
import { isValidTime } from './time';

/** Rahbarlarga boradigan hodisalar (Sozlamalar → Bildirishnomalar). */
export const NOTIFY_EVENTS = ['late', 'absent', 'suspicious', 'leave', 'task_submitted', 'task_overdue', 'new_employee'] as const;
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number];

/** Kimga: egasi, administratorlar, xodim bo'limining boshlig'i, vazifani bergan rahbar (faqat vazifa hodisalari). */
export const NOTIFY_ROLES = ['owner', 'admin', 'manager', 'creator'] as const;
export type NotifyRole = (typeof NOTIFY_ROLES)[number];

export const NOTIFY_ROLE_LABELS: Record<NotifyRole, string> = {
  owner: 'Egasi',
  admin: 'Administrator',
  manager: "Bo'lim boshlig'i",
  creator: 'Vazifa bergan rahbar',
};

export const NOTIFY_EVENT_META: Record<NotifyEvent, { label: string; hint: string; roles: readonly NotifyRole[] }> = {
  late: { label: 'Xodim kechikdi', hint: 'Kechikish chegarasidan oshganda darhol', roles: ['owner', 'admin', 'manager'] },
  absent: { label: "Kelmaganlar ro'yxati", hint: 'Har kuni belgilangan vaqtda', roles: ['owner', 'admin', 'manager'] },
  suspicious: { label: 'Shubhali keldi-ketdi', hint: 'Zona, yuz yoki qurilma mos kelmasa', roles: ['owner', 'admin', 'manager'] },
  leave: { label: "Yangi so'rov", hint: "Ruxsat, kasallik, ta'til", roles: ['owner', 'admin', 'manager'] },
  task_submitted: { label: 'Vazifa topshirildi', hint: 'Hisobot tekshiruvga kelganda', roles: ['owner', 'admin', 'manager', 'creator'] },
  task_overdue: { label: "Vazifa muddati o'tdi", hint: 'Muddat tugaganda', roles: ['owner', 'admin', 'manager', 'creator'] },
  new_employee: { label: "Yangi xodim ro'yxatdan o'tdi", hint: 'Botda ro‘yxatdan o‘tib, tasdiq kutganda', roles: ['owner', 'admin', 'manager'] },
};

export interface NotifyRule {
  on: boolean;
  to: NotifyRole[];
}

/** «Qabul qilinmasa» eslatmasi — daqiqa. */
export const NOT_ACCEPTED_OPTIONS = [15, 30, 60, 120] as const;

export interface TenantSettings {
  /** Botda ro'yxatdan o'tgan xodim darhol faol (tasdiqsiz). */
  autoApprove: boolean;
  /** «Kelmaganlar va kechikkanlar» xabari vaqti (HH:MM, ishxona vaqti). Yoqish/kimga — `notifications.absent`. */
  absentDigestAt: string;
  /** «Ketdim» bosilmasa smena tugaganidan keyin avto-yopish, soat. */
  autoCloseHours: number;
  /** Erkin grafikda — «Keldim»dan keyin, soat. */
  freeAutoCloseHours: number;
  face: FaceSettings;
  /** Boshqa telefondan «Keldim» — shubhali. */
  deviceBinding: boolean;
  /** O'zi qo'shgan bajarilgan ish rahbar tasdig'ini kutadi. */
  selfTasksNeedApproval: boolean;
  reminders: { notAccepted: boolean; notAcceptedMin: number; dueSoon: boolean; overdue: boolean; reviewStale: boolean };
  /** Tinch vaqt (soat): bu oraliqda xodimga eslatma yuborilmaydi, ertalabga suriladi. */
  quietHours: { from: number; to: number };
  notifications: Record<NotifyEvent, NotifyRule>;
  /** «Nazorat» mezonlari: `criteria` — bo'lim tekshiruvi, `employeeCriteria` — xodim tekshiruvi (core inspection.ts). */
  inspection: { criteria: InspectionCriterion[]; employeeCriteria: InspectionCriterion[] };
}

const ALL: NotifyRole[] = ['owner', 'admin', 'manager'];

export const DEFAULT_SETTINGS: TenantSettings = {
  autoApprove: false,
  absentDigestAt: '10:00',
  autoCloseHours: 3,
  freeAutoCloseHours: 16,
  face: faceSettings(undefined),
  deviceBinding: true,
  selfTasksNeedApproval: true,
  reminders: { notAccepted: true, notAcceptedMin: 30, dueSoon: true, overdue: true, reviewStale: true },
  quietHours: { from: 22, to: 8 },
  notifications: Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, { on: true, to: [...ALL] }])) as Record<NotifyEvent, NotifyRule>,
  inspection: { criteria: DEFAULT_INSPECTION_CRITERIA, employeeCriteria: DEFAULT_EMPLOYEE_CRITERIA },
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : d);

function rule(raw: unknown, event: NotifyEvent): NotifyRule {
  const r = obj(raw);
  const d = DEFAULT_SETTINGS.notifications[event];
  const allowed = NOTIFY_EVENT_META[event].roles;
  const to = Array.isArray(r.to) ? NOTIFY_ROLES.filter((x) => allowed.includes(x) && (r.to as unknown[]).includes(x)) : [...d.to];
  return { on: bool(r.on, d.on), to };
}

export function tenantSettings(raw: unknown): TenantSettings {
  const s = obj(raw);
  const d = DEFAULT_SETTINGS;
  const rem = obj(s.reminders);
  const q = obj(s.quietHours);
  const n = obj(s.notifications);
  const quiet = { from: int(q.from, 0, 23, d.quietHours.from), to: int(q.to, 0, 23, d.quietHours.to) };
  return {
    autoApprove: bool(s.autoApprove, d.autoApprove),
    absentDigestAt: typeof s.absentDigestAt === 'string' && isValidTime(s.absentDigestAt) ? s.absentDigestAt : d.absentDigestAt,
    autoCloseHours: int(s.autoCloseHours, 1, 12, d.autoCloseHours),
    freeAutoCloseHours: int(s.freeAutoCloseHours, 4, 24, d.freeAutoCloseHours),
    face: faceSettings(s.face),
    deviceBinding: bool(s.deviceBinding, d.deviceBinding),
    selfTasksNeedApproval: bool(s.selfTasksNeedApproval, d.selfTasksNeedApproval),
    reminders: {
      notAccepted: bool(rem.notAccepted, d.reminders.notAccepted),
      notAcceptedMin: (NOT_ACCEPTED_OPTIONS as readonly number[]).includes(rem.notAcceptedMin as number) ? (rem.notAcceptedMin as number) : d.reminders.notAcceptedMin,
      dueSoon: bool(rem.dueSoon, d.reminders.dueSoon),
      overdue: bool(rem.overdue, d.reminders.overdue),
      reviewStale: bool(rem.reviewStale, d.reminders.reviewStale),
    },
    // Bir xil soat — tinch vaqt yo'q degani emas, xato kiritish: standartga qaytadi
    quietHours: quiet.from === quiet.to ? { ...d.quietHours } : quiet,
    notifications: Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, rule(n[e], e)])) as Record<NotifyEvent, NotifyRule>,
    inspection: { criteria: normalizeCriteria(obj(s.inspection).criteria), employeeCriteria: normalizeCriteria(obj(s.inspection).employeeCriteria, DEFAULT_EMPLOYEE_CRITERIA) },
  };
}

/** Hodisa kimlarga boradi: o'chiq bo'lsa — hech kimga. */
export function notifyTargets(settings: TenantSettings, event: NotifyEvent): NotifyRole[] {
  const r = settings.notifications[event];
  return r.on ? r.to : [];
}

/** Brauzer User-Agent → «MacBook · Chrome» (Sozlamalar → Kirishlar). */
export function describeDevice(ua: string | null | undefined): { label: string; icon: string } {
  const s = ua ?? '';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /YaBrowser/.test(s) ? 'Yandex' : /Firefox\//.test(s) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : '';
  const [device, icon] = /iPhone/.test(s) ? ['iPhone', 'phone_iphone'] : /iPad/.test(s) ? ['iPad', 'tablet_mac'] : /Android/.test(s) ? ['Android', 'phone_android']
    : /Macintosh|Mac OS X/.test(s) ? ['Mac', 'laptop_mac'] : /Windows/.test(s) ? ['Windows', 'desktop_windows'] : /Linux/.test(s) ? ['Linux', 'computer'] : ['Qurilma', 'devices'];
  return { label: browser ? `${device} · ${browser}` : device, icon };
}

/** Parol talabi (Profilim): kamida 8 belgi, harf va raqam. Xato matni yoki null. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Parol kamida 8 belgi bo‘lsin';
  if (!/[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/.test(pw) || !/\d/.test(pw)) return 'Parolda harf ham, raqam ham bo‘lsin';
  return null;
}

/** Parol kuchi 0..4 (shkala uchun). */
export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/\d/.test(pw) && /[A-Za-z]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) score++;
  if (!pw) return { score: 0, label: '' };
  return { score, label: ['Juda zaif', 'Zaif', "O'rtacha", 'Yaxshi', 'Kuchli'][score]! };
}
