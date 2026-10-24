'use server';
import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { invites, withTenant } from '@adone/db';
import { requireUser } from '@/lib/auth/session';
import { BOT_USERNAME } from '@/server/employees';

/** Rahbar Telegram'ini bildirishnomalar uchun bog'lash havolasi (bir martalik, 1 kun). */
export async function memberTelegramLinkAction(): Promise<{ url: string }> {
  const user = await requireUser();
  const code = randomBytes(9).toString('base64url');
  await withTenant(user.tenantId, async (tx) => {
    await tx.update(invites).set({ expiresAt: new Date() }).where(and(eq(invites.kind, 'member'), eq(invites.refId, user.id), isNull(invites.usedAt)));
    await tx.insert(invites).values({ code, tenantId: user.tenantId, kind: 'member', refId: user.id, expiresAt: new Date(Date.now() + 86_400_000) });
  });
  return { url: `https://t.me/${BOT_USERNAME}?start=mem_${code}` };
}
