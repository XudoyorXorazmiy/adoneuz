import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { departments, memberships, tgLinks, withPlatform, withTenant, type Tx } from '@adone/db';
import { send, type Keyboard } from '@/server/telegram/api';
import { menuKeyboard } from '@/server/bot/texts';
import { employeeChat } from '@/server/bot/links';
import { enqueue } from '@/server/jobs/enqueue';
import type { JobOutcome } from '@/server/jobs/types';

/**
 * Rahbarlarga xabar: egasi + adminlar + (bo'lim berilsa) bo'lim boshlig'i — Telegram'ini ulaganlar.
 * Navbat orqali (tranzaksiya ichidan enqueue, yuborish — ishchida).
 */
export async function queueNotifyMembers(tx: Tx, tenantId: string, text: string, departmentId?: string | null) {
  await enqueue(tx, tenantId, 'notify_members', { text, departmentId: departmentId ?? null }, { maxAttempts: 3 });
}

export async function queueNotifyEmployee(tx: Tx, tenantId: string, employeeId: string, text: string) {
  await enqueue(tx, tenantId, 'notify_employee', { employeeId, text }, { maxAttempts: 3 });
}

export async function notifyMembers(tenantId: string, text: string, departmentId: string | null): Promise<JobOutcome> {
  const chats = await memberChats(tenantId, departmentId);
  if (chats === null) return { skip: 'rahbar yo‘q' };
  if (chats.length === 0) return { skip: 'rahbarlar Telegram ulamagan' };
  for (const c of chats) await send(c.chatId, text);
  return {};
}

/**
 * Rahbarlar chatlari: egasi + adminlar + (bo'lim berilsa) bo'lim boshlig'i — Telegram ulaganlari.
 * `exclude` — o'zi amalni qilgan rahbar (o'ziga xabar ketmaydi). null — rahbar umuman yo'q.
 */
export async function memberChats(tenantId: string, departmentId: string | null, exclude?: string | null): Promise<Array<{ chatId: number; userId: string }> | null> {
  const userIds = await withTenant(tenantId, async (tx) => {
    const admins = await tx.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.isActive, true), inArray(memberships.role, ['owner', 'admin'])));
    const ids = new Set(admins.map((a) => a.id));
    if (departmentId) {
      const [d] = await tx.select({ m: departments.managerUserId }).from(departments).where(eq(departments.id, departmentId)).limit(1);
      if (d?.m) ids.add(d.m);
    }
    if (exclude) ids.delete(exclude);
    return [...ids];
  });
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
