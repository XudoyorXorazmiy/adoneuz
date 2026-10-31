import type { MemberRole } from './enums';

/**
 * Panel bo'limlari. Tekshiruv faqat can() orqali — sahifada qo'lda emas.
 * Yangi bo'lim oxiriga qo'shiladi. `employee` panelga kirmaydi — faqat bot va Mini App.
 */
export const AREAS = [
  'dashboard', 'attendance', 'tasks', 'requests', 'employees', 'schedules', 'branches', 'reports', 'payroll', 'settings', 'billing',
  /** «Nazorat» — admin bo'limlarni tekshiradi (egasi, admin; bo'lim boshlig'iga ko'rinmaydi) */
  'inspections',
] as const;
export type Area = (typeof AREAS)[number];

const MATRIX: Record<MemberRole, ReadonlySet<Area>> = {
  owner: new Set(AREAS),
  admin: new Set(AREAS.filter((a) => a !== 'billing')),
  // Bo'lim/filial boshlig'i: faqat o'z bo'limi (cheklov so'rovlarda, memberships.department_ids)
  manager: new Set<Area>(['dashboard', 'attendance', 'tasks', 'requests', 'employees']),
  employee: new Set<Area>(),
};

export function can(role: MemberRole | null | undefined, area: Area): boolean {
  if (!role) return false;
  return MATRIX[role].has(area);
}

/** Panelga kira oladigan rol. Xodim — faqat Telegram (bot / Mini App). */
export function canUsePanel(role: MemberRole | null | undefined): boolean {
  return !!role && role !== 'employee';
}

export function homeFor(_role: MemberRole): string {
  return '/';
}

/**
 * Panel a'zosiga (xodim yozuvi bo'lmagan rahbarga) vazifa berish: egasi — administrator va bo'lim boshliqlariga,
 * administrator — bo'lim boshliqlariga. Bo'lim boshlig'i — faqat o'z bo'limi xodimlariga (a'zolarga emas).
 */
export function assignableMemberRoles(role: MemberRole | null | undefined): MemberRole[] {
  if (role === 'owner') return ['admin', 'manager'];
  if (role === 'admin') return ['manager'];
  return [];
}

/**
 * A'zoga berilgan vazifani kim tasdiqlaydi: egasi, vazifani bergan rahbar; administrator — bo'lim boshlig'ining vazifasini ham
 * (administratorning o'z vazifasini — faqat egasi yoki bergan). Ijrochining o'zi emas (bu tekshiruv chaqiruvchida).
 */
export function canReviewMemberTask(actor: { role: MemberRole; userId: string }, task: { assigneeRole: MemberRole | null; createdByUserId: string | null }): boolean {
  if (actor.role === 'owner') return true;
  if (task.createdByUserId && task.createdByUserId === actor.userId && actor.role !== 'employee') return true;
  return actor.role === 'admin' && task.assigneeRole !== 'admin' && task.assigneeRole !== 'owner';
}
