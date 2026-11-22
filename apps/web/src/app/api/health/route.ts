import { connection } from 'next/server';
import { checkDb, checkFace, checkMedia, queueStats } from '@/server/ops';

/**
 * Sog'liq (Coolify healthcheck, landing footer, egasi): baza `select 1` (2 s), media papkasiga yozish, yuz servisi va navbat.
 * 503 — faqat baza yoki media ishlamasa (ilova foydasiz); yuz servisi va navbat — ma'lumot uchun (keldi-ketdi baribir saqlanadi).
 * Yuz servisi va navbat 30 s keshlanadi (healthcheck tez-tez chaqiradi). Baza va media — 10 s: yo'l ochiq (kirishsiz), landing
 * uni har tashrifchi uchun chaqiradi — har chaqiriqda baza so'rovi va diskka yozish bo'lmasin (2026-11-22).
 */
let cache: { at: number; face: Awaited<ReturnType<typeof checkFace>>; jobs: Awaited<ReturnType<typeof queueStats>> | null } | null = null;
let core: { at: number; db: Awaited<ReturnType<typeof checkDb>>; media: Awaited<ReturnType<typeof checkMedia>> } | null = null;

export async function GET() {
  await connection();
  if (!core || Date.now() - core.at > 10_000) {
    const [d, m] = await Promise.all([checkDb(), checkMedia()]);
    core = { at: Date.now(), db: d, media: m };
  }
  const { db, media } = core;
  if (!cache || Date.now() - cache.at > 30_000) {
    const [face, jobs] = await Promise.all([checkFace(), db.ok ? queueStats().catch(() => null) : Promise.resolve(null)]);
    cache = { at: Date.now(), face, jobs };
  }
  const ok = db.ok && media.ok;
  return Response.json(
    { ok, uptime: Math.round(process.uptime()), db, media, face: cache.face, jobs: cache.jobs && { failed24h: cache.jobs.failed24h, backlog: cache.jobs.backlog } },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
