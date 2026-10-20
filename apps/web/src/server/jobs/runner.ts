import 'server-only';
/**
 * Navbat ishchisi (jobs jadvali). Chaqiriladi:
 *  - server cron → GET /api/cron/jobs (har daqiqa, CRON_SECRET) — zaxira;
 *  - navbatga yozgan joyning o'zidan `after(() => kickJobs())` — xabar darhol ketsin.
 *
 * Egallash: `FOR UPDATE SKIP LOCKED` — bir vaqtda bir nechta ishchi bitta ishni olmaydi.
 * Natija: done | qayta urinish (2^n daqiqa, 60 gacha) | failed (PermanentError yoki urinishlar tugadi).
 * Tugatilgan, lekin bajarilmagan ish (masalan bot ulanmagan) — done + last_error'da «skip: …» izohi.
 */
import { sql } from 'drizzle-orm';
import { withPlatform } from '@adone/db';
import { HANDLERS, PermanentError, type JobRow } from './handlers';

export interface RunResult {
  claimed: number;
  done: number;
  retried: number;
  failed: number;
  details: Array<{ id: string; type: string; result: string }>;
}

const STALE_MINUTES = 10;

export async function runJobs(opts: { limit?: number; budgetMs?: number } = {}): Promise<RunResult> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const res: RunResult = { claimed: 0, done: 0, retried: 0, failed: 0, details: [] };

  // Bir chaqiriqda bir necha aylanma: ish o'zidan keyingisini navbatga qo'ysa —
  // keyingi cron daqiqasini kutmasdan shu yerda davom etadi
  for (let round = 0; round < 30 && Date.now() < deadline - 2000; round++) {
    const jobs = await withPlatform(async (tx) => {
      // Qotib qolgan (ishchi o'lib qolgan) ishlarni navbatga qaytaramiz
      await tx.execute(sql`update jobs set status = 'queued', locked_at = null where status = 'running' and locked_at < now() - make_interval(mins => ${STALE_MINUTES})`);
      const { rows } = await tx.execute<JobRow>(sql`
        update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
        where id in (
          select id from jobs where status = 'queued' and run_at <= now()
          order by run_at limit ${limit} for update skip locked
        )
        returning id, tenant_id, type, payload, attempts, max_attempts, run_at, created_at`);
      // RETURNING tartibi kafolatlanmaydi — xabarlar navbatdagi tartibda ketsin
      return rows.sort((a, b) => +new Date(a.run_at) - +new Date(b.run_at) || +new Date(a.created_at) - +new Date(b.created_at));
    });
    res.claimed += jobs.length;

    for (const job of jobs) {
      if (Date.now() > deadline) {
        // Vaqt tugadi — urinish hisoblanmaydi, keyingi chaqiriqqa qoladi
        await withPlatform((tx) => tx.execute(sql`update jobs set status = 'queued', locked_at = null, attempts = greatest(attempts - 1, 0) where id = ${job.id}::uuid`));
        res.details.push({ id: job.id, type: job.type, result: 'deferred' });
        continue;
      }
      const handler = (HANDLERS as Record<string, (j: JobRow) => Promise<{ skip?: string }>>)[job.type];
      try {
        if (!handler) throw new PermanentError(`noma'lum ish turi: ${job.type}`);
        const out = await handler(job);
        await withPlatform((tx) =>
          tx.execute(sql`update jobs set status = 'done', locked_at = null, last_error = ${out.skip ? `skip: ${out.skip}` : null} where id = ${job.id}::uuid`),
        );
        res.done++;
        res.details.push({ id: job.id, type: job.type, result: out.skip ? `skip: ${out.skip}` : 'done' });
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        const permanent = e instanceof PermanentError || job.attempts >= job.max_attempts;
        if (permanent) {
          await withPlatform((tx) => tx.execute(sql`update jobs set status = 'failed', locked_at = null, last_error = ${msg} where id = ${job.id}::uuid`));
          res.failed++;
          res.details.push({ id: job.id, type: job.type, result: `failed: ${msg}` });
        } else {
          const delayMin = Math.min(2 ** job.attempts, 60);
          await withPlatform((tx) =>
            tx.execute(sql`update jobs set status = 'queued', locked_at = null, last_error = ${msg}, run_at = now() + make_interval(mins => ${delayMin}) where id = ${job.id}::uuid`),
          );
          res.retried++;
          res.details.push({ id: job.id, type: job.type, result: `retry ${delayMin}m: ${msg}` });
        }
      }
    }
    if (jobs.length === 0) break;
  }
  return res;
}

/** `after()` ichidan: xatoni yutadi (javob allaqachon ketgan), log qoldiradi */
export async function kickJobs(): Promise<void> {
  try {
    const r = await runJobs({ limit: 10, budgetMs: 15_000 });
    if (r.failed || r.retried) console.warn('[jobs] kick', JSON.stringify(r.details.filter((d) => d.result !== 'done')));
  } catch (e) {
    console.error('[jobs] kick failed', (e as Error).message);
  }
}
