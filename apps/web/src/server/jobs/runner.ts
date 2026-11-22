import 'server-only';
/**
 * Navbat ishchisi (jobs jadvali). Chaqiriladi:
 *  - server cron → GET /api/cron/jobs (har daqiqa, CRON_SECRET) — zaxira;
 *  - navbatga yozgan joyning o'zidan `after(() => kickJobs())` — xabar darhol ketsin.
 *
 * Bir jarayonda BITTA ishchi (mutex): har webhook o'z ishchisini ochib, bir-birini bo'g'masin (09:00 to'lqini). Ishlayotgan
 * ishchiga «yana bor» belgisi qo'yiladi — u yana bir aylanadi. Jarayonlar orasida — `FOR UPDATE SKIP LOCKED`.
 * Ishlar BITTADAN egallanadi (2026-11-22): oldin to'plam (25 tagacha) olinardi — deploy/jarayon to'xtasa, navbati kelmagan
 * ishlar ham «running» bo'lib 3 daqiqa qotardi. Endi to'xtaganda ko'pi bilan bitta (bajarilayotgan) ish kutadi.
 * O'lchov: `started_at` (egallangan payt) va `finished_at` (yakun: done/failed/qayta urinish) — kutish = started_at − run_at,
 * davomiylik = finished_at − started_at.
 * Har ish — vaqt chegarasi bilan (JOB_TIMEOUT_MS): oshsa qayta urinishga. Egallash tokeni — `locked_at` (egallangan payt):
 * yakuniy yozuv faqat token mos kelsa — chegaradan oshib, keyin tugagan «arvoh» ish qayta egallangan ishning holatini buzmaydi.
 * Natija: done | qayta urinish (2^n daqiqa, 60 gacha; tg_update — 30 s dan) | failed (PermanentError yoki urinishlar tugadi).
 * Urinishlar tugab yiqilsa — `onFinalFailure` (foydalanuvchiga «qayta yuboring», egasiga ogohlantirish).
 * Tugatilgan, lekin bajarilmagan ish (masalan bot ulanmagan) — done + last_error'da «skip: …» izohi.
 */
import { sql } from 'drizzle-orm';
import { tenants, withPlatform, withTenant } from '@adone/db';
import { outsideQuietHours } from '@adone/core';
import { readSettings } from '@/server/settings';
import { HANDLERS, onFinalFailure, PermanentError, type JobRow } from './handlers';

export interface RunResult {
  claimed: number;
  done: number;
  retried: number;
  failed: number;
  details: Array<{ id: string; type: string; result: string }>;
}

/**
 * Ishchi o'lib qolgan «running» ishlar shundan keyin navbatga qaytadi (ish chegarasidan katta bo'lsin). Urinishlari tugagan
 * bo'lsa — qaytmaydi, «failed» bo'ladi: jarayonni har safar yiqitadigan ish (xotira, cheksiz sikl) cheksiz aylanmasin.
 */
const STALE_MINUTES = 3;
const STALE_ERROR = 'ishchi javobsiz qoldi — urinishlar tugadi';
export const JOB_TIMEOUT_MS = 120_000;
/** Telegram update'i — tez qayta urinish (xodim kutib turibdi, bot sessiyasi 15 daqiqa). */
const TG_UPDATE_RETRY_SEC = [30, 60, 120, 240, 480];
/**
 * Bildirishnomalar (NOTIFY_TYPES): 1, 5, 15, 60 daqiqa. Oldin 2 va 4 daqiqa edi — Telegram 6 daqiqadan ortiq uzilsa xabar
 * butunlay yo'qolardi (2026-11-18: 12 ta). 5 urinish bilan ~80 daqiqalik uzilishga chidaydi.
 */
const NOTIFY_RETRY_SEC = [60, 300, 900, 3600];

class JobTimeout extends Error {}

/**
 * Tinch vaqt (Sozlamalar → Vazifalar, standart 22:00–08:00) ishchida ham: rahbarlarga tarqatish (`notify_members` — kechikdi,
 * shubhali, yangi xodim…) va bildirishnoma ishlarining QAYTA urinishlari tunda yuborilmaydi — tinch vaqt tugashiga suriladi.
 * Foydalanuvchining o'z amaliga birinchi javobi (vazifa berildi, so'rovga qaror) — surilmaydi.
 */
const NOTIFY_TYPES = new Set(['notify_members', 'notify_employee', 'task_notify', 'leave_notify', 'deadline_notify', 'absent_digest']);

async function quietUntil(job: JobRow, cache: Map<string, { tz: string; quiet: { from: number; to: number } }>): Promise<Date | null> {
  if (!job.tenant_id || !NOTIFY_TYPES.has(job.type) || (job.type !== 'notify_members' && job.attempts <= 1)) return null;
  let q = cache.get(job.tenant_id);
  if (!q) {
    q = await withTenant(job.tenant_id, async (tx) => {
      const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
      return { tz: t?.tz ?? 'Asia/Tashkent', quiet: (await readSettings(tx)).quietHours };
    });
    cache.set(job.tenant_id, q);
  }
  const now = new Date();
  const until = outsideQuietHours(now, q.tz, q.quiet);
  return until.getTime() > now.getTime() + 60_000 ? until : null;
}

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

/** Qotib qolgan (ishchi o'lib qolgan) ishlar: urinishi qolgani — navbatga, tugagani — «failed» + `onFinalFailure`. */
async function sweepStale(res: RunResult): Promise<void> {
  const dead = await withPlatform(async (tx) => {
    const { rows } = await tx.execute<JobRow>(sql`
      update jobs set status = 'failed', locked_at = null, finished_at = clock_timestamp(), last_error = ${STALE_ERROR}
      where status = 'running' and locked_at < now() - make_interval(mins => ${STALE_MINUTES}) and attempts >= max_attempts
      returning id, tenant_id, type, payload, attempts, max_attempts, run_at, created_at`);
    await tx.execute(sql`update jobs set status = 'queued', locked_at = null where status = 'running' and locked_at < now() - make_interval(mins => ${STALE_MINUTES})`);
    return rows;
  });
  for (const job of dead) {
    res.failed++;
    res.details.push({ id: job.id, type: job.type, result: `failed: ${STALE_ERROR}` });
    await onFinalFailure(job, STALE_ERROR).catch((er) => console.error('[jobs] onFinalFailure', (er as Error).message));
  }
}

async function loop(opts: { limit?: number; budgetMs?: number }): Promise<RunResult> {
  // Bir chaqiriqda ko'pi bilan shuncha ish (oldingi 30 aylanma × to'plam bilan bir xil chegara); asosiy to'xtatuvchi — vaqt byudjeti
  const maxJobs = Math.min(Math.max(opts.limit ?? 10, 1), 25) * 30;
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const res: RunResult = { claimed: 0, done: 0, retried: 0, failed: 0, details: [] };
  const quietCache = new Map<string, { tz: string; quiet: { from: number; to: number } }>();

  await sweepStale(res);

  // Ish o'zidan keyingisini navbatga qo'ysa — keyingi cron daqiqasini kutmasdan shu yerda davom etadi
  for (let n = 0; n < maxJobs && Date.now() < deadline - 2000; n++) {
    again = false;
    const job = await withPlatform(async (tx) => {
      const { rows } = await tx.execute<JobRow & { locked_at: string }>(sql`
        update jobs set status = 'running', locked_at = clock_timestamp(), started_at = clock_timestamp(), finished_at = null, attempts = attempts + 1
        where id = (
          select id from jobs where status = 'queued' and run_at <= now()
          order by run_at, created_at limit 1 for update skip locked
        )
        returning id, tenant_id, type, payload, attempts, max_attempts, run_at, created_at, locked_at::text as locked_at`);
      return rows[0] ?? null;
    });
    if (!job) {
      if (again) continue;
      break;
    }
    res.claimed++;

    // Token: shu egallash (boshqa ishchi qayta egallagan bo'lsa — yozuv o'tkazib yuboriladi)
    const mine = sql`id = ${job.id}::uuid and status = 'running' and locked_at = ${job.locked_at}::timestamptz`;
    const handler = (HANDLERS as Record<string, (j: JobRow) => Promise<{ skip?: string }>>)[job.type];
    const wait = await quietUntil(job, quietCache).catch(() => null);
    if (wait) {
      // Urinish hisoblanmaydi — tinch vaqt tugagach ketadi
      await withPlatform((tx) => tx.execute(sql`update jobs set status = 'queued', locked_at = null, started_at = null, attempts = greatest(attempts - 1, 0), run_at = ${wait.toISOString()}::timestamptz where ${mine}`));
      res.details.push({ id: job.id, type: job.type, result: `quiet → ${wait.toISOString().slice(11, 16)}Z` });
      continue;
    }
    try {
      if (!handler) throw new PermanentError(`noma'lum ish turi: ${job.type}`);
      const out = await withTimeout(handler(job), JOB_TIMEOUT_MS);
      await withPlatform((tx) =>
        tx.execute(sql`update jobs set status = 'done', locked_at = null, finished_at = clock_timestamp(), last_error = ${out.skip ? `skip: ${out.skip}` : null} where ${mine}`),
      );
      res.done++;
      res.details.push({ id: job.id, type: job.type, result: out.skip ? `skip: ${out.skip}` : 'done' });
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      const permanent = e instanceof PermanentError || job.attempts >= job.max_attempts;
      if (permanent) {
        const upd = await withPlatform((tx) => tx.execute(sql`update jobs set status = 'failed', locked_at = null, finished_at = clock_timestamp(), last_error = ${msg} where ${mine} returning id`));
        res.failed++;
        res.details.push({ id: job.id, type: job.type, result: `failed: ${msg}` });
        // Kutilgan rad (bot bloklangan, xodim o'chirilgan) emas — urinishlar tugadi: foydalanuvchi va egasi bilsin
        if (upd.rows.length && !(e instanceof PermanentError)) await onFinalFailure(job, msg).catch((er) => console.error('[jobs] onFinalFailure', (er as Error).message));
      } else {
        const delaySec = job.type === 'tg_update' ? (TG_UPDATE_RETRY_SEC[job.attempts - 1] ?? 600) : NOTIFY_TYPES.has(job.type) ? (NOTIFY_RETRY_SEC[job.attempts - 1] ?? 3600) : Math.min(2 ** job.attempts, 60) * 60;
        await withPlatform((tx) =>
          tx.execute(sql`update jobs set status = 'queued', locked_at = null, finished_at = clock_timestamp(), last_error = ${msg}, run_at = now() + make_interval(secs => ${delaySec}) where ${mine}`),
        );
        res.retried++;
        res.details.push({ id: job.id, type: job.type, result: `retry ${delaySec}s: ${msg}` });
      }
    }
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
