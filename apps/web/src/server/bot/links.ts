import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { tenants, tgLinks, withPlatform } from '@adone/db';

export interface EmployeeLink { tenantId: string; tenantName: string; employeeId: string; chatId: number }

/** Telegram foydalanuvchisining xodim bog'lanishlari (bir nechta ishxonada bo'lishi mumkin). Bloklangan ishxona chiqmaydi. */
export async function employeeLinks(tgUserId: number): Promise<EmployeeLink[]> {
  const rows = await withPlatform((tx) =>
    tx
      .select({ tenantId: tgLinks.tenantId, tenantName: tenants.name, employeeId: tgLinks.refId, chatId: tgLinks.chatId, status: tenants.status })
      .from(tgLinks)
      .innerJoin(tenants, eq(tenants.id, tgLinks.tenantId))
      .where(and(eq(tgLinks.telegramUserId, tgUserId), eq(tgLinks.kind, 'employee')))
      .orderBy(desc(tgLinks.createdAt)),
  );
  return rows.filter((r) => r.status !== 'blocked' && r.status !== 'archived');
}

export async function linkTelegram(input: { tgUserId: number; chatId: number; tenantId: string; kind: 'employee' | 'member'; refId: string }) {
  await withPlatform(async (tx) => {
    await tx.delete(tgLinks).where(and(eq(tgLinks.telegramUserId, input.tgUserId), eq(tgLinks.tenantId, input.tenantId), eq(tgLinks.kind, input.kind)));
    await tx.insert(tgLinks).values({ telegramUserId: input.tgUserId, chatId: input.chatId, tenantId: input.tenantId, kind: input.kind, refId: input.refId });
  });
}

/** Xodimning chat id'si (bildirishnoma uchun). */
export async function employeeChat(tenantId: string, employeeId: string): Promise<number | null> {
  const [r] = await withPlatform((tx) =>
    tx.select({ chatId: tgLinks.chatId }).from(tgLinks).where(and(eq(tgLinks.tenantId, tenantId), eq(tgLinks.kind, 'employee'), eq(tgLinks.refId, employeeId))).limit(1),
  );
  return r?.chatId ?? null;
}

export interface MemberLink { tenantId: string; userId: string; chatId: number }

/** Rahbar (panel foydalanuvchisi) Telegram bog'lanishlari — vazifani Telegram'dan tasdiqlash uchun. */
export async function memberLinks(tgUserId: number): Promise<MemberLink[]> {
  const rows = await withPlatform((tx) =>
    tx
      .select({ tenantId: tgLinks.tenantId, userId: tgLinks.refId, chatId: tgLinks.chatId, status: tenants.status })
      .from(tgLinks)
      .innerJoin(tenants, eq(tenants.id, tgLinks.tenantId))
      .where(and(eq(tgLinks.telegramUserId, tgUserId), eq(tgLinks.kind, 'member'))),
  );
  return rows.filter((r) => r.status !== 'blocked' && r.status !== 'archived');
}
