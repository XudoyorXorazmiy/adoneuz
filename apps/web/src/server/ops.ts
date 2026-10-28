import 'server-only';
/**
 * Ekspluatatsiya (BARQARORLIK 3.3): sog'liq tekshiruvlari (/api/health), egasiga kunlik xulosa (`daily_report` ishi, 09:00 Toshkent)
 * va muhim holatda darhol ogohlantirish (`watchdog` — cron har daqiqa chaqiradi, 5 daqiqada bir tekshiradi). Platforma
 * darajasi: ishxona ichidagi ma'lumot (xodim, rasm) xabarga chiqmaydi — faqat navbat, servis, disk.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, rm, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { pool, withPlatform } from '@adone/db';
import { mediaRoot } from '@/server/media';
import { alertOwner, sendOwner } from '@/server/alerts';

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${ms} ms`)), ms))]);

export async function checkDb(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    await withTimeout(pool.query('select 1'), 2000);
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: (e as Error).message.slice(0, 100) };
  }
}

/** Media papkasiga yozib bo'ladimi (volume ulanmagan / disk to'lgan). */
export async function checkMedia(): Promise<{ ok: boolean; freePct?: number; error?: string }> {
  try {
    const dir = path.join(mediaRoot(), '.health');
    await mkdir(dir, { recursive: true });
    const f = path.join(dir, `${randomUUID()}.tmp`);
    await writeFile(f, 'ok');
    await rm(f, { force: true });
    const s = await statfs(mediaRoot());
    return { ok: true, freePct: Math.round((s.bavail / s.blocks) * 100) };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 100) };
  }
}

/** Yuz servisi — ogohlantirish uchun (u ishlamasa keldi-ketdi «shubhali» bo'lib saqlanadi, ilova yiqilmaydi). */
export async function checkFace(): Promise<{ ok: boolean | null; error?: string }> {
  const url = process.env.FACE_SERVICE_URL?.replace(/\/$/, '');
  if (!url) return { ok: null };
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return { ok: r.ok };
  } catch (e) {
    return { ok: false, error: (e as Error).message.slice(0, 100) };
  }
}

/** Navbat: oxirgi 24 soatda yiqilganlar (tur bo'yicha), 5 daqiqadan beri kutayotganlar. */
export async function queueStats(): Promise<{ failed24h: number; failedByType: Record<string, number>; backlog: number; done24h: number }> {
  return withPlatform(async (tx) => {
    const { rows } = await tx.execute<{ type: string; status: string; n: number }>(sql`
      select type, status, count(*)::int as n from jobs where created_at > now() - interval '24 hours' and status in ('done', 'failed') group by 1, 2`);
    const { rows: [b] } = await tx.execute<{ n: number }>(sql`select count(*)::int as n from jobs where status = 'queued' and run_at < now() - interval '5 minutes'`);
    const failedByType: Record<string, number> = {};
    for (const r of rows) if (r.status === 'failed') failedByType[r.type] = r.n;
    return {
      failed24h: rows.filter((r) => r.status === 'failed').reduce((a, r) => a + r.n, 0),
      done24h: rows.filter((r) => r.status === 'done').reduce((a, r) => a + r.n, 0),
      failedByType, backlog: b?.n ?? 0,
    };
  });
}

let lastWatch = 0;

/** Cron'dan (har daqiqa): 5 daqiqada bir — muhim muammo bo'lsa egasiga darhol (alertOwner o'zi 10 daqiqada bir marta takrorlaydi). */
export async function watchdog(): Promise<void> {
  if (Date.now() - lastWatch < 5 * 60_000) return;
  lastWatch = Date.now();
  const [face, media, q] = await Promise.all([checkFace(), checkMedia(), queueStats().catch(() => null)]);
  if (face.ok === false) await alertOwner('face', `Yuz servisi javob bermayapti (${face.error ?? 'xato'}) — keldi-ketdilar «shubhali» bo'lib saqlanmoqda.`);
  if (!media.ok) await alertOwner('media', `Media papkasiga yozib bo'lmayapti: ${media.error}`);
  else if (media.freePct != null && media.freePct < 10) await alertOwner('disk', `Serverda joy kam: ${media.freePct}% bo'sh.`);
  if (q && q.backlog >= 20) await alertOwner('queue', `Navbat tiqilgan: ${q.backlog} ta ish 5 daqiqadan beri kutmoqda.`);
}

/** Kunlik xulosa egasiga (09:00 dan keyin bir marta). */
export async function dailyReport(): Promise<{ skip?: string }> {
  const [db, media, face, q] = await Promise.all([checkDb(), checkMedia(), checkFace(), queueStats()]);
  const cleanup = await withPlatform(async (tx) => {
    const { rows } = await tx.execute<{ e: string | null }>(sql`select last_error as e from jobs where type = 'cleanup' and status = 'done' and created_at > now() - interval '24 hours' order by created_at desc limit 1`);
    return rows[0]?.e?.replace(/^skip: /, '') ?? null;
  });
  const failed = Object.entries(q.failedByType).map(([t, n]) => `${t} ${n}`).join(', ');
  const bad = !db.ok || !media.ok || face.ok === false || q.failed24h > 0 || q.backlog > 0;
  const text = [
    `${bad ? '⚠️' : '✅'} <b>adone — kunlik holat</b>`,
    `Baza: ${db.ok ? `ok (${db.ms} ms)` : `XATO — ${db.error}`}`,
    `Yuz servisi: ${face.ok === null ? 'sozlanmagan' : face.ok ? 'ok' : `XATO — ${face.error ?? ''}`}`,
    `Disk: ${media.ok ? `${media.freePct}% bo'sh` : `XATO — ${media.error}`}`,
    `Navbat (24 soat): ${q.done24h} bajarildi, ${q.failed24h} yiqildi${failed ? ` (${failed})` : ''}${q.backlog ? `, ${q.backlog} kutmoqda` : ''}`,
    cleanup ? `Tozalash: ${cleanup}` : 'Tozalash: bugun ishlamagan',
  ].join('\n');
  const sent = await sendOwner(text);
  return sent ? {} : { skip: 'PLATFORM_OWNER_CHAT_ID sozlanmagan' };
}
