import type { MemberRole } from './enums';

/**
 * Panel bo'limlari. Tekshiruv faqat can() orqali — sahifada qo'lda emas.
 * Yangi bo'lim oxiriga qo'shiladi. `employee` panelga kirmaydi — faqat bot va Mini App.
 */
export const AREAS = [
  'dashboard', 'attendance', 'tasks', 'requests', 'employees', 'schedules', 'branches', 'reports', 'payroll', 'settings', 'billing',
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
