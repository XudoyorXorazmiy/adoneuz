import { connection } from 'next/server';
import { checkDb, checkFace, checkMedia, queueStats } from '@/server/ops';

/**
 * Sog'liq (Coolify healthcheck, landing footer, egasi): baza `select 1` (2 s), media papkasiga yozish, yuz servisi va navbat.
 * 503 — faqat baza yoki media ishlamasa (ilova foydasiz); yuz servisi va navbat — ma'lumot uchun (keldi-ketdi baribir saqlanadi).
 * Yuz servisi va navbat 30 s keshlanadi (healthcheck tez-tez chaqiradi).
 */
let cache: { at: number; face: Awaited<ReturnType<typeof checkFace>>; jobs: Awaited<ReturnType<typeof queueStats>> | null } | null = null;

export async function GET() {
  await connection();
  const [db, media] = await Promise.all([checkDb(), checkMedia()]);
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
