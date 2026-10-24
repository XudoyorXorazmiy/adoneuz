import { timingSafeEqual } from 'node:crypto';
import { tgUpdates, withPlatform } from '@adone/db';
import { webhookSecret } from '@/server/telegram/api';
import { enqueue, kick } from '@/server/jobs/enqueue';

/**
 * Platforma boti webhook'i. Tez javob: siri tekshiriladi → update_id idempotent yoziladi → navbat → 200.
 * Ishlov (Telegram'ga javob, fayl yuklash) — `tg_update` ishida (server/bot).
 */
export async function POST(req: Request) {
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const want = webhookSecret();
  if (got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return new Response('Forbidden', { status: 403 });
  const update = (await req.json().catch(() => null)) as { update_id?: number } | null;
  if (!update || typeof update.update_id !== 'number') return new Response('ok');
  const fresh = await withPlatform(async (tx) => {
    const rows = await tx.insert(tgUpdates).values({ updateId: update.update_id! }).onConflictDoNothing().returning({ id: tgUpdates.updateId });
    if (rows.length === 0) return false;
    await enqueue(tx, null, 'tg_update', { update }, { maxAttempts: 3 });
    return true;
  });
  if (fresh) kick();
  return new Response('ok');
}
