import 'server-only';
/**
 * Navbat ishchisi (jobs jadvali). Chaqiriladi:
 *  - server cron → GET /api/cron/jobs (har daqiqa, CRON_SECRET) — zaxira;
 *  - navbatga yozgan joyning o'zidan `after(() => kickJobs())` — xabar darhol ketsin.
 *
 * Bir jarayonda BITTA ishchi (mutex): har webhook o'z ishchisini ochib, bir-birini bo'g'masin (09:00 to'lqini). Ishlayotgan
 * ishchiga «yana bor» belgisi qo'yiladi — u yana bir aylanadi. Jarayonlar orasida — `FOR UPDATE SKIP LOCKED`.
 * Har ish — vaqt chegarasi bilan (JOB_TIMEOUT_MS): oshsa qayta urinishga. Egallash tokeni — `locked_at` (egallangan payt):
 * yakuniy yozuv faqat token mos kelsa — chegaradan oshib, keyin tugagan «arvoh» ish qayta egallangan ishning holatini buzmaydi.
 * Natija: done | qayta urinish (2^n daqiqa, 60 gacha; tg_update — 30 s dan) | failed (PermanentError yoki urinishlar tugadi).
 * Urinishlar tugab yiqilsa — `onFinalFailure` (foydalanuvchiga «qayta yuboring», egasiga ogohlantirish).
 * Tugatilgan, lekin bajarilmagan ish (masalan bot ulanmagan) — done + last_error'da «skip: …» izohi.
 */
import { sql } from 'drizzle-orm';
import { withPlatform } from '@adone/db';
import { HANDLERS, onFinalFailure, PermanentError, type JobRow } from './handlers';

export interface RunResult {
  claimed: number;
  done: number;
  retried: number;
  failed: number;
  details: Array<{ id: string; type: string; result: string }>;
}

/** Ishchi o'lib qolgan «running» ishlar shundan keyin navbatga qaytadi (ish chegarasidan katta bo'lsin). */
const STALE_MINUTES = 3;
export const JOB_TIMEOUT_MS = 120_000;
/** Telegram update'i — tez qayta urinish (xodim kutib turibdi, bot sessiyasi 15 daqiqa). */
const TG_UPDATE_RETRY_SEC = [30, 60, 120, 240, 480];

class JobTimeout extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new JobTimeout(`vaqt tugadi (${Math.round(ms / 1000)} s)`)), ms); })]).finally(() => clearTimeout(t));
}

let active: Promise<RunResult> | null = null;
let again = false;

export async function runJobs(opts: { limit?: number; budgetMs?: number } = {}): Promise<RunResult> {
  if (active) {
    again = true;
    return { claimed: 0, done: 0, retried: 0, failed: 0, details: [{ id: '-', type: '-', result: 'busy: ishchi ishlayapti' }] };
  }
  active = loop(opts).finally(() => { active = null; });
  return active;
}

async function loop(opts: { limit?: number; budgetMs?: number }): Promise<RunResult> {
  // Bir aylanmada ozroq ish olinadi: har biri 120 s gacha ketishi mumkin, qolganlari boshqa jarayonga ochiq tursin
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const res: RunResult = { claimed: 0, done: 0, retried: 0, failed: 0, details: [] };

  // Bir chaqiriqda bir necha aylanma: ish o'zidan keyingisini navbatga qo'ysa —
  // keyingi cron daqiqasini kutmasdan shu yerda davom etadi
  for (let round = 0; round < 30 && Date.now() < deadline - 2000; round++) {
    again = false;
    const jobs = await withPlatform(async (tx) => {
      // Qotib qolgan (ishchi o'lib qolgan) ishlarni navbatga qaytaramiz
      await tx.execute(sql`update jobs set status = 'queued', locked_at = null where status = 'running' and locked_at < now() - make_interval(mins => ${STALE_MINUTES})`);
      const { rows } = await tx.execute<JobRow & { locked_at: string }>(sql`
        update jobs set status = 'running', locked_at = clock_timestamp(), attempts = attempts + 1
        where id in (
          select id from jobs where status = 'queued' and run_at <= now()
          order by run_at limit ${limit} for update skip locked
        )
        returning id, tenant_id, type, payload, attempts, max_attempts, run_at, created_at, locked_at::text as locked_at`);
      // RETURNING tartibi kafolatlanmaydi — xabarlar navbatdagi tartibda ketsin
      return rows.sort((a, b) => +new Date(a.run_at) - +new Date(b.run_at) || +new Date(a.created_at) - +new Date(b.created_at));
    });
    res.claimed += jobs.length;

    for (const job of jobs) {
      // Token: shu egallash (boshqa ishchi qayta egallagan bo'lsa — yozuv o'tkazib yuboriladi)
      const mine = sql`id = ${job.id}::uuid and status = 'running' and locked_at = ${job.locked_at}::timestamptz`;
      if (Date.now() > deadline) {
        // Vaqt tugadi — urinish hisoblanmaydi, keyingi chaqiriqqa qoladi
        await withPlatform((tx) => tx.execute(sql`update jobs set status = 'queued', locked_at = null, attempts = greatest(attempts - 1, 0) where ${mine}`));
        res.details.push({ id: job.id, type: job.type, result: 'deferred' });
        continue;
      }
      const handler = (HANDLERS as Record<string, (j: JobRow) => Promise<{ skip?: string }>>)[job.type];
      try {
        if (!handler) throw new PermanentError(`noma'lum ish turi: ${job.type}`);
        const out = await withTimeout(handler(job), JOB_TIMEOUT_MS);
        await withPlatform((tx) =>
          tx.execute(sql`update jobs set status = 'done', locked_at = null, last_error = ${out.skip ? `skip: ${out.skip}` : null} where ${mine}`),
        );
        res.done++;
        res.details.push({ id: job.id, type: job.type, result: out.skip ? `skip: ${out.skip}` : 'done' });
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
        const permanent = e instanceof PermanentError || job.attempts >= job.max_attempts;
        if (permanent) {
          const upd = await withPlatform((tx) => tx.execute(sql`update jobs set status = 'failed', locked_at = null, last_error = ${msg} where ${mine} returning id`));
          res.failed++;
          res.details.push({ id: job.id, type: job.type, result: `failed: ${msg}` });
          // Kutilgan rad (bot bloklangan, xodim o'chirilgan) emas — urinishlar tugadi: foydalanuvchi va egasi bilsin
          if (upd.rows.length && !(e instanceof PermanentError)) await onFinalFailure(job, msg).catch((er) => console.error('[jobs] onFinalFailure', (er as Error).message));
        } else {
          const delaySec = job.type === 'tg_update' ? (TG_UPDATE_RETRY_SEC[job.attempts - 1] ?? 600) : Math.min(2 ** job.attempts, 60) * 60;
          await withPlatform((tx) =>
            tx.execute(sql`update jobs set status = 'queued', locked_at = null, last_error = ${msg}, run_at = now() + make_interval(secs => ${delaySec}) where ${mine}`),
          );
          res.retried++;
          res.details.push({ id: job.id, type: job.type, result: `retry ${delaySec}s: ${msg}` });
        }
      }
    }
    if (jobs.length === 0 && !again) break;
  }
  return res;
}

/** `after()` ichidan: xatoni yutadi (javob allaqachon ketgan), log qoldiradi */
export async function kickJobs(): Promise<void> {
  try {
    const r = await runJobs({ limit: 10, budgetMs: 15_000 });
    const bad = r.details.filter((d) => d.result !== 'done' && !d.result.startsWith('busy'));
    if (bad.length) console.warn('[jobs] kick', JSON.stringify(bad));
  } catch (e) {
    console.error('[jobs] kick failed', (e as Error).message);
  }
}
