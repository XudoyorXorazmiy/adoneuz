'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { tasks, taskBatches, withTenant } from '@adone/db';
import { faceDecision, isValidDate, isValidTime, LEAVE_KINDS, zonedTime, type FaceDecision, isUuid } from '@adone/core';
import { assertTgMember, assertTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { setEmployeeStatus } from '@/server/employees';
import { saveMedia } from '@/server/media';
import { previewGeofence, recordCheck, toggleBreak, type CheckResult } from '@/server/checkin';
import { createTasks, proofFlags, selfTasksNeedApproval, transitionTask } from '@/server/tasks';
import { kick } from '@/server/jobs/enqueue';
import { faceContext, verifyFace } from '@/server/face';
import { createLeave, decideLeave } from '@/server/leave';

/**
 * Mini App amallari. Kim — FAQAT Mini App sessiyasidan (initData bilan berilgan cookie), formadan emas.
 * Rasm — kamera bilan olingan (client kichraytiradi, ≤ 5 MB), MIME tekshiriladi; galereyadan yuklash UI'da yo'q.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp']);

function coords(f: FormData) {
  const lat = Number(f.get('lat'));
  const lng = Number(f.get('lng'));
  const acc = f.get('accuracy') ? Math.round(Number(f.get('accuracy'))) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng, accuracyM: acc != null && Number.isFinite(acc) ? acc : null };
}

function photos(f: FormData, name = 'photo'): File[] {
  return f.getAll(name).filter((x): x is File => x instanceof File && x.size > 0);
}

async function readImage(file: File) {
  if (!IMAGE.has(file.type) || file.size > MAX_BYTES) return null;
  return { data: Buffer.from(await file.arrayBuffer()), mime: file.type, ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg' };
}

/** 1-qadam: masofa (hech narsa yozilmaydi). */
export async function tgGeoPreviewAction(f: FormData) {
  const u = await assertTgUser();
  const c = coords(f);
  if (!c) return { error: 'Lokatsiya aniqlanmadi' };
  const r = await withTenant(u.tenantId, (tx) => previewGeofence(tx, u.employeeId, c));
  if (!r) return { error: 'Sizga filial biriktirilmagan' };
  return { status: r.status, distanceM: r.distanceM, branchName: r.branchName, radiusM: r.radiusM, branch: r.branch };
}

/** Keldi (lokatsiya + selfi) / Ketdi (lokatsiya). Geofence serverda qayta hisoblanadi. */
export async function tgCheckAction(f: FormData): Promise<CheckResult> {
  const u = await assertTgUser();
  const action = f.get('action') === 'check_out' ? 'check_out' : 'check_in';
  const c = coords(f);
  if (!c) return { ok: false, reason: 'low_accuracy', message: 'Lokatsiya aniqlanmadi' };
  // Keldim: 1–3 kadr (markaz, chapga, o'ngga) — birinchisi saqlanadi, hammasi yuz servisiga (liveness = bosh burilishi)
  const frames: Array<NonNullable<Awaited<ReturnType<typeof readImage>>>> = [];
  if (action === 'check_in') for (const p of photos(f).slice(0, 3)) { const img = await readImage(p); if (img) frames.push(img); }
  if (action === 'check_in' && frames.length === 0) return { ok: false, reason: 'no_photo', message: 'Selfi olinmadi — kamerani qayta yoqing' };
  const deviceId = String(f.get('deviceId') ?? '');
  const device = isUuid(deviceId) ? { id: deviceId, label: String(f.get('deviceLabel') ?? '').slice(0, 60) || 'Telefon' } : null;
  let face: FaceDecision | undefined;
  if (action === 'check_in') {
    const fc = await withTenant(u.tenantId, (tx) => faceContext(tx, u.employeeId));
    const r = fc.templates.length ? await verifyFace(frames.map((x, i) => ({ data: x.data, mime: x.mime, name: `f${i}.${x.ext}` })), fc.templates) : null;
    face = faceDecision(r, { templates: fc.templates.length, challenge: frames.length > 1, settings: fc.settings });
  }
  const res = await withTenant(u.tenantId, async (tx) => {
    const mediaId = frames[0] ? await saveMedia(tx, { tenantId: u.tenantId, employeeId: u.employeeId, kind: 'checkin_photo', ...frames[0] }) : null;
    return recordCheck(tx, { tenantId: u.tenantId, employeeId: u.employeeId, action, ...c, mediaId, source: 'miniapp', face, device });
  });
  revalidatePath('/tg');
  kick();
  return res;
}

export async function tgBreakAction(): Promise<{ ok: boolean; message?: string }> {
  const u = await assertTgUser();
  const r = await withTenant(u.tenantId, (tx) => toggleBreak(tx, u.tenantId, u.employeeId));
  revalidatePath('/tg');
  return r;
}

/** Vazifa: qabul / boshladim / topshirish (rasm, lokatsiya, izoh). Isbot yetarliligi serverda (transitionTask). */
export async function tgTaskAction(f: FormData): Promise<{ ok?: boolean; error?: string }> {
  const u = await assertTgUser();
  const taskId = String(f.get('taskId') ?? '');
  const to = z.enum(['accepted', 'in_progress', 'submitted']).safeParse(f.get('to'));
  if (!z.uuid().safeParse(taskId).success || !to.success) return { error: "Ma'lumot noto'g'ri" };
  const files: Array<NonNullable<Awaited<ReturnType<typeof readImage>>>> = [];
  for (const p of photos(f).slice(0, 10)) {
    const img = await readImage(p);
    if (!img) return { error: 'Rasm formati noto‘g‘ri yoki juda katta' };
    files.push(img);
  }
  const c = coords(f);
  const text = String(f.get('text') ?? '').trim().slice(0, 1000) || null;
  const res = await withTenant(u.tenantId, async (tx) => {
    const mediaIds: string[] = [];
    for (const img of files) mediaIds.push(await saveMedia(tx, { tenantId: u.tenantId, employeeId: u.employeeId, kind: 'task_report', ...img }));
    const got = await proofFlags(tx, mediaIds, !!c);
    return transitionTask(tx, {
      tenantId: u.tenantId, taskId, to: to.data, actor: { employeeId: u.employeeId }, comment: to.data === 'submitted' ? text : null,
      report: to.data === 'submitted' ? { text, mediaIds, lat: c?.lat ?? null, lng: c?.lng ?? null, source: 'miniapp', got } : undefined,
    });
  });
  if ('error' in res) return { error: res.error };
  revalidatePath('/tg', 'layout');
  kick();
  return { ok: true };
}

/** Checklist bandini belgilash (holat emas — faqat ijrochining belgisi). */
export async function tgChecklistAction(taskId: string, index: number, done: boolean): Promise<void> {
  const u = await assertTgUser();
  if (!z.uuid().safeParse(taskId).success || !Number.isInteger(index) || index < 0 || index > 50) return;
  await withTenant(u.tenantId, async (tx) => {
    const [r] = await tx.select({ t: tasks, b: taskBatches }).from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .where(and(eq(tasks.id, taskId), eq(tasks.assigneeEmployeeId, u.employeeId))).limit(1);
    if (!r || index >= r.b.checklist.length || ['submitted', 'approved', 'cancelled'].includes(r.t.status)) return;
    const next = r.b.checklist.map((_, i) => (i === index ? done : !!r.t.checklistDone[i]));
    await tx.update(tasks).set({ checklistDone: next }).where(eq(tasks.id, taskId));
  });
}

/** «Ish qo'shish» (§7a): bajarilgan ish (rasm ixtiyoriy) yoki reja. */
export async function tgAddWorkAction(f: FormData): Promise<{ ok?: boolean; error?: string; needs?: boolean }> {
  const u = await assertTgUser();
  const title = String(f.get('title') ?? '').trim().slice(0, 200);
  if (title.length < 3) return { error: 'Nima ish qildingiz — qisqacha yozing' };
  const plan = f.get('mode') === 'plan';
  const note = String(f.get('note') ?? '').trim().slice(0, 1000) || null;
  const spent = Number(f.get('spentMinutes')) || null;
  const dueDate = String(f.get('dueDate') ?? '');
  const dueTime = String(f.get('dueTime') ?? '18:00');
  const files: Array<NonNullable<Awaited<ReturnType<typeof readImage>>>> = [];
  for (const p of photos(f).slice(0, 5)) {
    const img = await readImage(p);
    if (img) files.push(img);
  }
  const needs = await withTenant(u.tenantId, async (tx) => {
    const mediaIds: string[] = [];
    for (const img of files) mediaIds.push(await saveMedia(tx, { tenantId: u.tenantId, employeeId: u.employeeId, kind: 'task_report', ...img }));
    const needsApproval = await selfTasksNeedApproval(tx);
    await createTasks(tx, {
      tenantId: u.tenantId, source: plan ? 'self_plan' : 'self_done', title, description: plan ? note : null, priority: 'medium', proofs: ['button'], checklist: [],
      dueAt: plan && isValidDate(dueDate) && isValidTime(dueTime) ? zonedTime(dueDate, dueTime, u.tz) : null,
      assignees: [{ employeeId: u.employeeId }], createdBy: { employeeId: u.employeeId }, needsApproval,
      report: plan ? undefined : { text: note, mediaIds, spentMinutes: spent && spent > 0 && spent <= 1440 ? spent : null, source: 'miniapp' },
    });
    return needsApproval;
  });
  revalidatePath('/tg', 'layout');
  kick();
  return { ok: true, needs: !plan && needs };
}

/** Ruxsat so'rash (Mini App). */
export async function tgLeaveAction(f: FormData): Promise<{ ok?: boolean; error?: string }> {
  const u = await assertTgUser();
  const kind = z.enum(LEAVE_KINDS).safeParse(f.get('kind'));
  const from = String(f.get('from') ?? '');
  const to = String(f.get('to') || from);
  if (!kind.success) return { error: 'Sababni tanlang' };
  if (!isValidDate(from) || !isValidDate(to)) return { error: 'Sanani tanlang' };
  const res = await withTenant(u.tenantId, (tx) => createLeave(tx, { tenantId: u.tenantId, employeeId: u.employeeId, kind: kind.data, from, to, reason: String(f.get('reason') ?? '').trim() || null }));
  if ('error' in res) return { error: res.error };
  revalidatePath('/tg', 'layout');
  kick();
  return { ok: true };
}

export async function tgCancelLeaveAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const u = await assertTgUser();
  if (!z.uuid().safeParse(id).success) return { error: "Ma'lumot noto'g'ri" };
  const res = await withTenant(u.tenantId, (tx) => decideLeave(tx, { tenantId: u.tenantId, id, to: 'cancelled', actor: { employeeId: u.employeeId } }));
  revalidatePath('/tg', 'layout');
  return 'error' in res ? { error: res.error } : { ok: true };
}

// ---------- Rahbar Mini App'i (tg_links kind=member): kim — sessiyadan, rol va bo'lim cheklovi — panel funksiyalaridan ----------

const bad = (): { error: string } => ({ error: "Ma'lumot noto'g'ri" });
function refreshManager() {
  kick();
  revalidatePath('/tg');
  revalidatePath('/tg/qarorlar');
}

export async function tgApproveEmployeeAction(id: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(id)) return bad();
  const err = await withTenant(m.tenantId, (tx) => setEmployeeStatus(tx, memberAsTenantUser(m), id, 'active'));
  if (err) return { error: err };
  refreshManager();
  return {};
}

export async function tgDecideLeaveAction(id: string, to: 'approved' | 'rejected', comment: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(id) || (to !== 'approved' && to !== 'rejected')) return bad();
  const res = await withTenant(m.tenantId, (tx) => decideLeave(tx, { tenantId: m.tenantId, id, to, actor: { userId: m.userId, role: m.role }, comment: String(comment ?? '').slice(0, 500) }));
  if ('error' in res) return { error: res.error };
  refreshManager();
  return {};
}

export async function tgReviewTaskAction(taskId: string, to: 'approved' | 'revision', rating: number | null, comment: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(taskId) || (to !== 'approved' && to !== 'revision')) return bad();
  const res = await withTenant(m.tenantId, (tx) => transitionTask(tx, {
    tenantId: m.tenantId, taskId, to, actor: { userId: m.userId, role: m.role },
    comment: String(comment ?? '').slice(0, 1000) || null, rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
  }));
  if ('error' in res) return { error: res.error };
  refreshManager();
  return {};
}
