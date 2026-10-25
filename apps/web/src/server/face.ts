import 'server-only';
/**
 * Yuz servisi (services/face) mijozi. CLAUDE.md §1.3–1.4, §6.4:
 *   - HTTP chaqiruv TRANZAKSIYADAN TASHQARIDA (servis 1–3 s ishlaydi);
 *   - servis sozlanmagan / javob bermasa — null → check-in `suspicious` (bloklanmaydi);
 *   - rasm va vektor logga chiqmaydi, boshqa tenantga o'tmaydi (namunalar RLS ostida).
 */
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { employees, faceTemplates, media, tenants, withTenant, type Tx } from '@adone/db';
import { faceSettings, type FaceSettings, type FaceVerify } from '@adone/core';
import { escHtml as esc } from '@/lib/task-text';
import { mediaRoot } from './media';
import { queueNotifyEmployee, queueNotifyMembers } from './notify';
import type { JobOutcome } from './jobs/types';

const url = () => process.env.FACE_SERVICE_URL?.replace(/\/$/, '') || '';
export const faceConfigured = () => !!url();
const TIMEOUT_MS = 25_000;

type File = { data: Buffer; mime: string; name: string };

async function call<T>(endpoint: string, files: File[], fields: Record<string, string> = {}): Promise<T | null> {
  if (!faceConfigured()) return null;
  const form = new FormData();
  for (const f of files) form.append('media', new Blob([new Uint8Array(f.data)], { type: f.mime }), f.name);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  try {
    const res = await fetch(`${url()}${endpoint}`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: process.env.FACE_SERVICE_KEY ? { 'X-Face-Key': process.env.FACE_SERVICE_KEY } : {},
    });
    if (!res.ok) {
      console.warn(`[face] ${endpoint} ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[face] ${endpoint} ${(e as Error).name}`);
    return null;
  }
}

type VerifyRaw = { ok: boolean; reason?: string; similarity?: number; face_frames?: number; frames?: number; many_faces?: boolean; liveness?: { yaw_range?: number } };

/** Solishtirish: rasm(lar) yoki video + namunalar → FaceVerify | null (servis yo'q). */
export async function verifyFace(files: File[], templates: number[][]): Promise<FaceVerify | null> {
  if (templates.length === 0) return null;
  const r = await call<VerifyRaw>('/verify', files, { templates: JSON.stringify(templates) });
  if (!r) return null;
  if (!r.ok) return { ok: false, reason: r.reason === 'no_face' ? 'no_face' : 'bad_media' };
  return { ok: true, similarity: r.similarity ?? 0, faceFrames: r.face_frames ?? 0, frames: r.frames ?? 0, manyFaces: !!r.many_faces, yawRange: r.liveness?.yaw_range ?? 0 };
}

/** Xodimning faol namunalari va ishxona chegaralari (tranzaksiya ichida o'qiladi, chaqiruv — tashqarida). */
export async function faceContext(tx: Tx, employeeId: string): Promise<{ templates: number[][]; settings: FaceSettings }> {
  const [t] = await tx.select({ s: tenants.settings }).from(tenants).limit(1);
  const rows = await tx.select({ e: faceTemplates.embedding }).from(faceTemplates).where(and(eq(faceTemplates.employeeId, employeeId), eq(faceTemplates.isActive, true))).limit(5);
  return { templates: rows.map((r) => r.e), settings: faceSettings(t?.s?.face) };
}

/**
 * `face_enroll` ishi: ro'yxatdan o'tishdagi (yoki /yuz bilan qayta olingan) namuna videosidan vektor. `replace` — eski namunalar o'chiriladi.
 * Yuz topilmasa — xodimga «qayta yuboring» va rahbarga xabar.
 */
export async function enrollFace(tenantId: string, employeeId: string, mediaId: string, replace: boolean): Promise<JobOutcome> {
  if (!faceConfigured()) return { skip: 'FACE_SERVICE_URL sozlanmagan' };
  const m = await withTenant(tenantId, async (tx) => (await tx.select().from(media).where(and(eq(media.id, mediaId), eq(media.employeeId, employeeId))).limit(1))[0]);
  if (!m) return { skip: 'media yo‘q' };
  const data = await readFile(path.join(mediaRoot(), m.path));
  const r = await call<{ ok: boolean; reason?: string; embedding?: number[]; quality?: { det_score: number; face_px: number; sharpness: number } }>('/embed', [{ data, mime: m.mime, name: path.basename(m.path) }]);
  if (!r) throw new Error('yuz servisi javob bermadi'); // qayta urinish (jobs)
  await withTenant(tenantId, async (tx) => {
    const [e] = await tx.select({ name: employees.fullName, dep: employees.departmentId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
    if (!r.ok || !r.embedding) {
      await queueNotifyEmployee(tx, tenantId, employeeId, "⚠️ Yuz namunasida yuzingiz aniq ko'rinmadi. /yuz buyrug'ini bosib, yorug' joyda 3–5 soniyalik dumaloq video qayta yuboring.");
      if (e) await queueNotifyMembers(tx, tenantId, `⚠️ <b>${esc(e.name)}</b> yuz namunasi sifatsiz (${r.reason ?? 'yuz yo‘q'}) — xodimdan qayta olish so'raldi.`, e.dep);
      return;
    }
    if (replace) await tx.update(faceTemplates).set({ isActive: false }).where(eq(faceTemplates.employeeId, employeeId));
    await tx.insert(faceTemplates).values({ tenantId, employeeId, embedding: r.embedding, quality: r.quality ?? null, mediaId });
  });
  return r.ok ? {} : { skip: `namuna: ${r.reason}` };
}

/** Xodim o'chirilganda biometrika o'chiriladi (§1.4): vektorlar + yuz namunasi fayllari. */
export async function deleteBiometrics(tx: Tx, employeeId: string) {
  await tx.delete(faceTemplates).where(eq(faceTemplates.employeeId, employeeId));
  const files = await tx.delete(media).where(and(eq(media.employeeId, employeeId), eq(media.kind, 'face_sample'))).returning({ path: media.path });
  for (const f of files) await unlink(path.join(mediaRoot(), f.path)).catch(() => undefined);
}
