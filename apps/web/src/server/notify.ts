import 'server-only';
import { and, arrayContains, eq, inArray, ne } from 'drizzle-orm';
import { departments, employees, memberships, tgLinks, withPlatform, withTenant, type Tx } from '@adone/db';
import { notifyTargets, type NotifyEvent, type NotifyRole } from '@adone/core';
import { readSettings } from '@/server/settings';
import { publicApiOrigin } from '@/lib/host';
import { isTransient, send, TelegramError, type Keyboard } from '@/server/telegram/api';
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
  return deliver(chats, (chat) => send(chat, text, keyboard));
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
  return userChatsFor(tenantId, userIds);
}

/**
 * Rahbar hisoblari → Telegram chatlari: o'z rahbar bog'lanishi (kind=member), bo'lmasa — shu hisobga bog'langan xodimning chati
 * (xodimdan tayinlangan bo'lim boshlig'i). Bir chatga bir marta.
 */
export async function userChatsFor(tenantId: string, userIds: string[]): Promise<Array<{ chatId: number; userId: string }>> {
  if (!userIds.length) return [];
  const own = await withPlatform((tx) =>
    tx.select({ chatId: tgLinks.chatId, userId: tgLinks.refId }).from(tgLinks).where(and(eq(tgLinks.tenantId, tenantId), eq(tgLinks.kind, 'member'), inArray(tgLinks.refId, userIds))),
  );
  const missing = userIds.filter((id) => !own.some((o) => o.userId === id));
  const viaEmp = missing.length
    ? await withTenant(tenantId, (tx) => tx.select({ id: employees.id, userId: employees.userId }).from(employees).where(and(inArray(employees.userId, missing), eq(employees.status, 'active'))))
    : [];
  const empChats = viaEmp.length
    ? await withPlatform((tx) => tx.select({ chatId: tgLinks.chatId, employeeId: tgLinks.refId }).from(tgLinks)
      .where(and(eq(tgLinks.tenantId, tenantId), eq(tgLinks.kind, 'employee'), inArray(tgLinks.refId, viaEmp.map((e) => e.id)))))
    : [];
  const out = [...own];
  for (const c of empChats) {
    const userId = viaEmp.find((e) => e.id === c.employeeId)?.userId;
    if (userId && !out.some((o) => o.chatId === c.chatId)) out.push({ chatId: c.chatId, userId });
  }
  return out;
}

export async function notifyEmployee(tenantId: string, employeeId: string, text: string, keyboard: Keyboard = menuKeyboard): Promise<JobOutcome> {
  const chatId = await employeeChat(tenantId, employeeId);
  if (!chatId) return { skip: 'xodim botga ulanmagan' };
  await send(chatId, text, keyboard);
  return {};
}

/**
 * Panel a'zosiga berilgan vazifa bo'yicha tasdiqlovchilar (core `canReviewMemberTask` bilan mos): bergan rahbar; u bo'lmasa yoki
 * ijrochining o'zi bo'lsa — egasi (ijrochi administrator bo'lmasa — administratorlar ham). Ijrochining o'zi chiqariladi.
 * `event` o'chiq bo'lsa — hech kim.
 */
export async function memberTaskReviewerChats(tenantId: string, t: { assigneeUserId: string; createdByUserId: string | null }, event?: NotifyEvent | null) {
  const ids = await withTenant(tenantId, async (tx) => {
    if (event && notifyTargets(await readSettings(tx), event).length === 0) return [];
    if (t.createdByUserId && t.createdByUserId !== t.assigneeUserId) return [t.createdByUserId];
    const [me] = await tx.select({ role: memberships.role }).from(memberships).where(eq(memberships.userId, t.assigneeUserId)).limit(1);
    const roles: Array<'owner' | 'admin'> = me?.role === 'admin' || me?.role === 'owner' ? ['owner'] : ['owner', 'admin'];
    const rows = await tx.select({ id: memberships.userId }).from(memberships)
      .where(and(eq(memberships.isActive, true), inArray(memberships.role, roles), ne(memberships.userId, t.assigneeUserId)));
    return rows.map((r) => r.id);
  });
  return userChatsFor(tenantId, ids);
}

/** Panel a'zosiga (vazifa ijrochisi) shaxsiy xabar — Telegram'ini ulagan bo'lsa (yoki xodim chati orqali). */
export async function notifyUser(tenantId: string, userId: string, text: string, keyboard?: Keyboard): Promise<JobOutcome> {
  const chats = await userChatsFor(tenantId, [userId]);
  if (!chats.length) return { skip: 'a’zo Telegram ulamagan' };
  return deliver(chats, (chat) => send(chat, text, keyboard));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Bir nechta chatga tarqatish — har qabul qiluvchi alohida: bittasi botni bloklagan (403) yoki chat yo'q (400) bo'lsa
 * qolganlari baribir oladi. Vaqtinchalik xato (429 — `retry_after`, 5xx, tarmoq) — shu yerning o'zida 2 marta qayta.
 * Ish qayta urinilsa takror ketmasin: hech kimga yetmagan va vaqtinchalik xato bo'lgandagina xato tashlanadi
 * (navbat qayta uradi); kimdir olgan bo'lsa — qolganlari logga, ish yakunlanadi.
 */
export async function deliver(chats: Array<{ chatId: number }>, fn: (chatId: number) => Promise<unknown>): Promise<JobOutcome> {
  let sent = 0;
  let transient: unknown = null;
  const dead: number[] = [];
  for (const { chatId } of chats) {
    for (let attempt = 1; ; attempt++) {
      try {
        await fn(chatId);
        sent++;
        break;
      } catch (e) {
        if (e instanceof TelegramError && (e.code === 400 || e.code === 403)) { dead.push(chatId); break; }
        if (!isTransient(e) || attempt >= 3) { transient = e; break; }
        const wait = e instanceof TelegramError && e.retryAfter ? Math.min(e.retryAfter, 30) * 1000 : attempt * 1500;
        await sleep(wait);
      }
    }
  }
  if (dead.length) console.warn(`[notify] ${dead.length} ta chat bot bilan aloqani uzgan (403/400) — o'tkazib yuborildi`);
  if (transient && sent === 0) throw transient;
  if (transient) console.warn(`[notify] ba'zi qabul qiluvchilarga yetmadi: ${(transient as Error).message}`);
  if (sent === 0 && dead.length) return { skip: 'hamma qabul qiluvchi botni bloklagan' };
  return {};
}
