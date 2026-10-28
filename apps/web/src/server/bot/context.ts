import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Bitta Telegram update'ini qayta ishlash konteksti: webhook qabul qilgan vaqt (`tg_update` ishi yaratilgan payt — server vaqti)
 * va urinish raqami. Telegram sekinlashib ish qayta urinilsa (2–15 daqiqa keyin) — sessiya muddati, lokatsiya yoshi va
 * keldi/ketdi vaqti xabar KELGAN paytga qarab hisoblanadi, qayta urinish paytiga emas.
 */
const store = new AsyncLocalStorage<{ receivedAt: number; attempt: number }>();

export function withUpdateContext<T>(ctx: { receivedAt: number; attempt: number }, fn: () => Promise<T>): Promise<T> {
  return store.run(ctx, fn);
}

/** Xabar serverga kelgan vaqt (ms); kontekstsiz — hozir. */
export const arrivedAt = (): number => store.getStore()?.receivedAt ?? Date.now();

/** Birinchi urinishmi (foydalanuvchiga «qabul qilindi» bir marta ketsin). */
export const firstAttempt = (): boolean => (store.getStore()?.attempt ?? 1) <= 1;
