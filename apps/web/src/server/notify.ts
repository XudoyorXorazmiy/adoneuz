import 'server-only';
import { and, arrayContains, eq, inArray } from 'drizzle-orm';
import { departments, memberships, tgLinks, withPlatform, withTenant, type Tx } from '@adone/db';
import { notifyTargets, type NotifyEvent, type NotifyRole } from '@adone/core';
import { readSettings } from '@/server/settings';
import { publicApiOrigin } from '@/lib/host';
import { send, type Keyboard } from '@/server/telegram/api';
import { menuKeyboard } from '@/server/bot/texts';
import { employeeChat } from '@/server/bot/links';
import { enqueue } from '@/server/jobs/enqueue';
import type { JobOutcome } from '@/server/jobs/types';

/**
 * Rahbarlarga xabar: egasi + adminlar + (bo'lim berilsa) bo'lim boshlig'i — Telegram'ini ulaganlar.
 * `event` berilsa — kimga va yoqilganmi, Sozlamalar → Bildirishnomalar bo'yicha.
 * Navbat orqali (tranzaksiya ichidan enqueue, yuborish — ishchida).
 */
export async function queueNotifyMembers(tx: Tx, tenantId: string, text: string, departmentId?: string | null, event?: NotifyEvent, miniPath?: string) {
  await enqueue(tx, tenantId, 'notify_members', { text, departmentId: departmentId ?? null, event: event ?? null, miniPath: miniPath ?? null }, { maxAttempts: 3 });
}

/** Rahbar Mini App'iga tugma qatori — Telegram faqat https qabul qiladi (dev'da bo'sh). */
export function miniAppRow(path: string, text = 'Mini App’da ochish ↗'): Array<Array<{ text: string; web_app: { url: string } }>> {
  const url = `${publicApiOrigin()}${path}`;
  return url.startsWith('https://') ? [[{ text, web_app: { url } }]] : [];
}

export function miniAppKeyboard(path: string | null | undefined, text?: string): Keyboard | undefined {
  if (!path) return undefined;
  const rows = miniAppRow(path, text);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export async function queueNotifyEmployee(tx: Tx, tenantId: string, employeeId: string, text: string) {
  await enqueue(tx, tenantId, 'notify_employee', { employeeId, text }, { maxAttempts: 3 });
}

export async function notifyMembers(tenantId: string, text: string, departmentId: string | null, event?: NotifyEvent | null, keyboard?: Keyboard): Promise<JobOutcome> {
  const chats = await memberChats(tenantId, departmentId, null, { event });
  if (chats === null) return { skip: 'rahbar yo‘q' };
  if (chats.length === 0 && event) return { skip: 'sozlamada o‘chiq yoki rahbar Telegram ulamagan' };
  if (chats.length === 0) return { skip: 'rahbarlar Telegram ulamagan' };
  for (const c of chats) await send(c.chatId, text, keyboard);
  return {};
}

/**
 * Rahbarlar chatlari — Telegram ulaganlari. Standart: egasi + adminlar + (bo'lim berilsa) bo'lim boshlig'i
 * (`departments.manager_user_id` yoki shu bo'limga mas'ul menejer a'zoligi). `event` berilsa — ishxona sozlamasidagi
 * rollar (o'chiq hodisa — hech kim, `[]`); `creator` — vazifani bergan rahbar (`creatorUserId`).
 * `exclude` — o'zi amalni qilgan rahbar (o'ziga xabar ketmaydi). null — rahbar umuman yo'q.
 */
export async function memberChats(
  tenantId: string, departmentId: string | null, exclude?: string | null, opts: { event?: NotifyEvent | null; creatorUserId?: string | null } = {},
): Promise<Array<{ chatId: number; userId: string }> | null> {
  const userIds = await withTenant(tenantId, async (tx) => {
    const roles: NotifyRole[] = opts.event ? notifyTargets(await readSettings(tx), opts.event) : ['owner', 'admin', 'manager'];
    if (opts.event && roles.length === 0) return 'off' as const;
    const ids = new Set<string>();
    const top = roles.filter((r): r is 'owner' | 'admin' => r === 'owner' || r === 'admin');
    if (top.length) {
      const rows = await tx.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.isActive, true), inArray(memberships.role, top)));
      rows.forEach((r) => ids.add(r.id));
    }
    if (roles.includes('manager')) {
      if (departmentId) {
        const [d] = await tx.select({ m: departments.managerUserId }).from(departments).where(eq(departments.id, departmentId)).limit(1);
        if (d?.m) ids.add(d.m);
        const scoped = await tx.select({ id: memberships.userId }).from(memberships)
          .where(and(eq(memberships.isActive, true), eq(memberships.role, 'manager'), arrayContains(memberships.departmentIds, [departmentId])));
        scoped.forEach((r) => ids.add(r.id));
      } else {
        // Bo'limsiz hodisa (kunlik ro'yxat, bo'limsiz xodim) — barcha faol bo'lim boshliqlari
        const all = await tx.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.isActive, true), eq(memberships.role, 'manager')));
        all.forEach((r) => ids.add(r.id));
      }
    }
    if (roles.includes('creator')) {
      if (opts.creatorUserId) ids.add(opts.creatorUserId);
      else if (!top.length) {
        // Vazifani bergan rahbar yo'q (xodim o'zi qo'shgan ish) — egasi va adminlar
        const rows = await tx.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.isActive, true), inArray(memberships.role, ['owner', 'admin'])));
        rows.forEach((r) => ids.add(r.id));
      }
    }
    if (exclude) ids.delete(exclude);
    return [...ids];
  });
  if (userIds === 'off') return [];
  if (userIds.length === 0) return null;
  return withPlatform((tx) =>
    tx.select({ chatId: tgLinks.chatId, userId: tgLinks.refId }).from(tgLinks).where(and(eq(tgLinks.tenantId, tenantId), eq(tgLinks.kind, 'member'), inArray(tgLinks.refId, userIds))),
  );
}

export async function notifyEmployee(tenantId: string, employeeId: string, text: string, keyboard: Keyboard = menuKeyboard): Promise<JobOutcome> {
  const chatId = await employeeChat(tenantId, employeeId);
  if (!chatId) return { skip: 'xodim botga ulanmagan' };
  await send(chatId, text, keyboard);
  return {};
}
