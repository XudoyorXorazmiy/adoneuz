import 'server-only';
/**
 * Kunlik tozalash (`cleanup` ishi, har kuni 03:00 dan keyin bir marta — server/ticks.ts scheduleTicks). CLAUDE.md §1.4, BARQARORLIK 3.1:
 *   - navbat: bajarilgan/yiqilgan ishlar 14 kundan keyin; `tg_updates` (idempotentlik) 7 kun; `auth_throttle` — muddati o'tganlari;
 *   - media: keldi-ketdi isboti (dumaloq video, selfi) 60 kundan keyin (egasi qarori, 2026-10-29) — yozuv va fayl; hodisa qoladi,
 *     `media_id` bo'shaydi. Yuz namunasi (`face_sample`) va vazifa hisobotlari SAQLANADI;
 *   - yetim fayllar: diskda bor, bazada yozuvi yo'q (tranzaksiya bekor bo'lgan, yuklash uzilgan) va 1 kundan eski — o'chiriladi;
 *     kichik nusxalar (`.thumbs`) — asl yozuvi yo'q bo'lsa.
 * Fayllar faqat yozuv o'chgandan keyin (tranzaksiya tugagach) o'chiriladi.
 */
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { and, inArray, lt, sql } from 'drizzle-orm';
import { media, tenants, withPlatform, withTenant } from '@adone/db';
import { mediaRoot, thumbsRoot } from '@/server/media';

export const MEDIA_KEEP_DAYS = 60;
const DAY = 86_400_000;

export interface CleanupReport { jobs: number; tgUpdates: number; throttle: number; media: number; mediaMb: number; orphans: number; thumbs: number }

export async function cleanup(now = new Date()): Promise<CleanupReport> {
  const r: CleanupReport = { jobs: 0, tgUpdates: 0, throttle: 0, media: 0, mediaMb: 0, orphans: 0, thumbs: 0 };
  const platform = await withPlatform(async (tx) => {
    const j = await tx.execute(sql`delete from jobs where status in ('done', 'failed') and created_at < ${new Date(now.getTime() - 14 * DAY).toISOString()}::timestamptz`);
    const u = await tx.execute(sql`delete from tg_updates where received_at < ${new Date(now.getTime() - 7 * DAY).toISOString()}::timestamptz`);
    const t = await tx.execute(sql`delete from auth_throttle where reset_at < ${new Date(now.getTime() - DAY).toISOString()}::timestamptz`);
    return { jobs: j.rowCount ?? 0, tg: u.rowCount ?? 0, th: t.rowCount ?? 0, tenants: await tx.select({ id: tenants.id }).from(tenants) };
  });
  r.jobs = platform.jobs; r.tgUpdates = platform.tg; r.throttle = platform.th;

  const root = mediaRoot();
  const cutoff = new Date(now.getTime() - MEDIA_KEEP_DAYS * DAY);
  for (const { id: tenantId } of platform.tenants) {
    // 1) Muddati o'tgan keldi-ketdi isboti — bo'laklab (bitta uzun tranzaksiya bo'lmasin)
    for (;;) {
      const gone = await withTenant(tenantId, async (tx) => {
        const old = await tx.select({ id: media.id }).from(media)
          .where(and(inArray(media.kind, ['checkin_video', 'checkin_photo']), lt(media.createdAt, cutoff))).limit(500);
        if (!old.length) return [];
        return tx.delete(media).where(inArray(media.id, old.map((m) => m.id))).returning({ id: media.id, path: media.path, size: media.sizeBytes });
      });
      for (const m of gone) {
        await rm(path.join(root, m.path), { force: true });
        await rm(path.join(thumbsRoot(), tenantId, `${m.id}.jpg`), { force: true });
        r.media++; r.mediaMb += m.size / 1048576;
      }
      if (gone.length < 500) break;
    }
    // 2) Yetim fayllar (yozuvsiz, 1 kundan eski) va yetim kichik nusxalar
    const known = await withTenant(tenantId, async (tx) => (await tx.select({ id: media.id, path: media.path }).from(media)));
    const paths = new Set(known.map((m) => m.path));
    const ids = new Set(known.map((m) => m.id));
    const old = (t: number) => now.getTime() - t > DAY;
    for (const file of await walk(path.join(root, tenantId))) {
      const rel = path.relative(root, file);
      if (paths.has(rel)) continue;
      const st = await stat(file).catch(() => null);
      if (st && old(st.mtimeMs)) { await rm(file, { force: true }); r.orphans++; }
    }
    for (const file of await walk(path.join(thumbsRoot(), tenantId))) {
      if (!ids.has(path.basename(file, '.jpg'))) { await rm(file, { force: true }); r.thumbs++; }
    }
  }
  r.mediaMb = Math.round(r.mediaMb * 10) / 10;
  return r;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
