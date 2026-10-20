import 'server-only';
import { after } from 'next/server';
import { jobs, type Tx } from '@adone/db';
import type { JobType } from './handlers';

/**
 * Tranzaksiya ichida navbatga yozadi. `dedupeKey` bo'lsa bir martalik: takror yozuv jim o'tkazib yuboriladi
 * (kunlik hisobot `daily:<tenant>:<sana>`, takrorlanuvchi vazifa `tpl:<id>:<sana>`). Darhol ishlatish — keyin kick().
 */
export async function enqueue(
  tx: Tx,
  tenantId: string | null,
  type: JobType,
  payload: Record<string, unknown>,
  opts: { delaySec?: number; maxAttempts?: number; dedupeKey?: string } = {},
) {
  await tx
    .insert(jobs)
    .values({
      tenantId,
      type,
      payload,
      runAt: opts.delaySec ? new Date(Date.now() + opts.delaySec * 1000) : new Date(),
      maxAttempts: opts.maxAttempts ?? 5,
      dedupeKey: opts.dedupeKey ?? null,
    })
    .onConflictDoNothing();
}

/** Javob ketgandan keyin navbatni darhol aylantirish (server cron — zaxira). */
export function kick() {
  after(async () => {
    const { kickJobs } = await import('./runner');
    await kickJobs();
  });
}
