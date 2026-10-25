import { daysBetween } from './time';

/**
 * Ruxsat so'rovlari (CLAUDE.md §5): xodim botda / Mini App'da so'raydi, rahbar tasdiqlaydi yoki rad etadi.
 * Tasdiqlangan so'rov kunlari davomatda «Ruxsatda» (`computeDay({ onLeave })`) — kelmagan deb hisoblanmaydi.
 */
export const LEAVE_KINDS = ['sick', 'vacation', 'personal', 'remote', 'other'] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = { sick: 'Kasal', vacation: "Ta'til", personal: 'Shaxsiy ish', remote: 'Masofadan ishlash', other: 'Boshqa' };
export const LEAVE_KIND_ICONS: Record<LeaveKind, string> = { sick: '🤒', vacation: '🏖', personal: '👤', remote: '🏠', other: '📝' };

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = { pending: 'Kutilmoqda', approved: 'Tasdiqlandi', rejected: 'Rad etildi', cancelled: 'Bekor qilindi' };

/** Davr tekshiruvi: boshi ≤ oxiri, 60 kundan uzun emas, 30 kundan ortiq o'tmishga emas. */
export function validLeaveRange(from: string, to: string, today: string): string | null {
  if (to < from) return "Tugash sanasi boshlanishdan oldin bo'lmasin";
  if (daysBetween(from, to) > 60) return "Bir so'rov 60 kundan oshmasin";
  if (daysBetween(from, today) > 30) return "30 kundan eski kunlarga so'rov berilmaydi — rahbar tuzatish qiladi";
  return null;
}

export const leaveDays = (from: string, to: string) => daysBetween(from, to) + 1;

/** Holat o'tishi: kutilayotgan so'rovni rahbar hal qiladi, xodim bekor qiladi. Hal qilingani o'zgarmaydi. */
export function canDecideLeave(from: LeaveStatus, to: LeaveStatus, actor: 'employee' | 'reviewer'): boolean {
  if (from !== 'pending') return false;
  return actor === 'reviewer' ? to === 'approved' || to === 'rejected' : to === 'cancelled';
}
