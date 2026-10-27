'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, employees, jobs, tasks, taskBatches, withTenant } from '@adone/db';
import { can, faceDecision, isValidDate, isValidTime, LEAVE_KINDS, zonedTime, type FaceDecision, isUuid } from '@adone/core';
import { cookies } from 'next/headers';
import { assertTgMember, assertTgUser, currentTgMember, currentTgUser, memberAsTenantUser, TG_MODE_COOKIE, tgCookieOptions } from '@/lib/tg/session';
import type { FormState } from '@/components/ui/form-drawer';
import { canTouch, inviteLink, setEmployeeStatus } from '@/server/employees';
import { saveEmployeeFromForm } from '@/server/employees-form';
import { resolveSuspicious } from '@/server/attendance-correct';
import { createDeadlineRequest, decideDeadlineRequest } from '@/server/deadline';
import { today } from '@/server/attendance';
import { escHtml as esc } from '@/lib/task-text';
import { saveMedia } from '@/server/media';
import { previewGeofence, recordCheck, toggleBreak, type CheckResult } from '@/server/checkin';
import { commentTask, createTasks, proofFlags, selfTasksNeedApproval, transitionTask, type ActorRef } from '@/server/tasks';
import { createTaskFromForm } from '@/server/tasks-form';
import { enqueue, kick } from '@/server/jobs/enqueue';
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

/**
 * Vazifa ijrochisi: xodim sessiyasi yoki (xodim yozuvi yo'q) rahbar sessiyasi — panel a'zosiga berilgan vazifa.
 * Ikki rejimli boshliq — xodim sifatida (unga berilgan vazifa xodim yozuviga tushadi).
 */
async function tgAssignee(): Promise<{ tenantId: string; employeeId: string | null; actor: ActorRef; own: ReturnType<typeof eq> }> {
  const u = await currentTgUser();
  if (u) return { tenantId: u.tenantId, employeeId: u.employeeId, actor: { employeeId: u.employeeId }, own: eq(tasks.assigneeEmployeeId, u.employeeId) };
  const m = await currentTgMember();
  if (!m) throw new Error('Mini App sessiyasi tugagan — ilovani qaytadan oching');
  return { tenantId: m.tenantId, employeeId: null, actor: { userId: m.userId, role: m.role }, own: eq(tasks.assigneeUserId, m.userId) };
}

/** Vazifa: qabul / boshladim / topshirish (rasm, lokatsiya, izoh). Isbot yetarliligi serverda (transitionTask). */
export async function tgTaskAction(f: FormData): Promise<{ ok?: boolean; error?: string }> {
  const a = await tgAssignee();
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
  const res = await withTenant(a.tenantId, async (tx) => {
    const mediaIds: string[] = [];
    for (const img of files) mediaIds.push(await saveMedia(tx, { tenantId: a.tenantId, employeeId: a.employeeId, kind: 'task_report', ...img }));
    const got = await proofFlags(tx, mediaIds, !!c);
    return transitionTask(tx, {
      tenantId: a.tenantId, taskId, to: to.data, actor: a.actor, comment: to.data === 'submitted' ? text : null,
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
  const a = await tgAssignee();
  if (!z.uuid().safeParse(taskId).success || !Number.isInteger(index) || index < 0 || index > 50) return;
  await withTenant(a.tenantId, async (tx) => {
    const [r] = await tx.select({ t: tasks, b: taskBatches }).from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .where(and(eq(tasks.id, taskId), a.own)).limit(1);
    if (!r || index >= r.b.checklist.length || ['submitted', 'approved', 'cancelled'].includes(r.t.status)) return;
    const next = r.b.checklist.map((_, i) => (i === index ? done : !!r.t.checklistDone[i]));
    await tx.update(tasks).set({ checklistDone: next }).where(eq(tasks.id, taskId));
  });
}

/** Ikki rejimli boshliq (xodim + bo'lim boshlig'i): «Xodim» ↔ «Rahbar» ko'rinishi (cookie, 30 kun). */
export async function tgSetModeAction(to: 'rahbar' | 'xodim'): Promise<{ error?: string }> {
  const [u, m] = await Promise.all([currentTgUser(), currentTgMember()]);
  if (!m && !u) return { error: 'Mini App sessiyasi tugagan — ilovani qaytadan oching' };
  if (to === 'rahbar' && !m) return { error: 'Siz bo‘lim boshlig‘i emassiz' };
  (await cookies()).set(TG_MODE_COOKIE, to === 'rahbar' ? 'rahbar' : 'xodim', { ...tgCookieOptions(), maxAge: 30 * 86_400 });
  revalidatePath('/tg', 'layout');
  return {};
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
/** Bugun, Qarorlar, Vazifalar, vazifa sahifasi — hammasi /tg ostida; bildirishnomalar navbatini ham turtadi. */
function refreshManager() {
  kick();
  revalidatePath('/tg', 'layout');
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

/** Hisobotni tasdiqlash (baho) / qaytarish (sabab majburiy) / vazifani bekor qilish (sabab majburiy) — ruxsat `transitionTask` ichida. */
export async function tgReviewTaskAction(taskId: string, to: 'approved' | 'revision' | 'cancelled', rating: number | null, comment: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(taskId) || (to !== 'approved' && to !== 'revision' && to !== 'cancelled')) return bad();
  const res = await withTenant(m.tenantId, (tx) => transitionTask(tx, {
    tenantId: m.tenantId, taskId, to, actor: { userId: m.userId, role: m.role },
    comment: String(comment ?? '').trim().slice(0, 1000) || null, rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
  }));
  if ('error' in res) return { error: res.error };
  refreshManager();
  return {};
}

/** Vazifaga izoh (yozishma) — xodimga Telegram'da boradi (`task_notify`). */
export async function tgCommentTaskAction(taskId: string, text: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  const comment = String(text ?? '').trim().slice(0, 1000);
  if (!isUuid(taskId) || !comment) return bad();
  const res = await withTenant(m.tenantId, (tx) => commentTask(tx, { tenantId: m.tenantId, taskId, actor: { userId: m.userId, role: m.role }, comment }));
  if ('error' in res) return { error: res.error };
  refreshManager();
  return {};
}

/** «Vazifa berish» — panel drawer'i bilan bir xil forma va tekshiruv (server/tasks-form.ts); menejer faqat o'z bo'limiga. */
export async function tgCreateTaskAction(_p: FormState, f: FormData): Promise<FormState> {
  const m = await assertTgMember();
  if (!can(m.role, 'tasks')) return { error: 'Ruxsat yo‘q' };
  const res = await createTaskFromForm(memberAsTenantUser(m), f);
  if ('ok' in res) refreshManager();
  return res;
}

/** Shubhali keldi-ketdi: tasdiqlash yoki rad etish (bosh sahifadagi kabi — `correction` hodisasi, sabab avtomatik). */
export async function tgResolveSuspiciousAction(employeeId: string, workDate: string, target: string, approve: boolean): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(employeeId) || !isUuid(target) || !isValidDate(workDate)) return bad();
  const err = await withTenant(m.tenantId, (tx) => resolveSuspicious(tx, memberAsTenantUser(m), { employeeId, workDate, target, approve: approve === true }));
  if (err) return { error: err };
  refreshManager();
  return {};
}

/** Kelmagan xodimga bir bosishda eslatma (Telegram) — kuniga bir marta (`remind:<xodim>:<sana>`). */
export async function tgRemindEmployeeAction(employeeId: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(employeeId)) return bad();
  const tu = memberAsTenantUser(m);
  const res = await withTenant(m.tenantId, async (tx): Promise<{ error?: string }> => {
    if (!(await canTouch(tx, tu, employeeId, null))) return { error: "Faqat o'z bo'limingiz xodimlari" };
    const [e] = await tx.select({ id: employees.id, name: employees.fullName, tg: employees.telegramUserId }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.status, 'active'))).limit(1);
    if (!e) return { error: 'Xodim topilmadi' };
    if (!e.tg) return { error: 'Xodim botga ulanmagan — xabar bormaydi' };
    const key = `remind:${employeeId}:${today(tu)}`;
    const [dup] = await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.dedupeKey, key)).limit(1);
    if (dup) return { error: 'Bugun eslatma allaqachon yuborilgan' };
    const text = `⏰ <b>${esc(m.name)}</b> eslatma yubordi: bugun «Keldim» qayd etilmagan.\nIshga kelgan bo'lsangiz «✅ Keldim»ni bosing, kelolmasangiz rahbaringizga xabar bering yoki «📝 So'rov» yuboring.`;
    await enqueue(tx, m.tenantId, 'notify_employee', { employeeId, text }, { maxAttempts: 2, dedupeKey: key });
    await tx.insert(auditLog).values({ tenantId: m.tenantId, userId: m.userId, action: 'employee.remind', entity: 'employee', entityId: employeeId, meta: { date: today(tu) } });
    return {};
  });
  if (res.error) return res;
  kick();
  return {};
}

export type EmployeeFormState = { error?: string; ok?: string; invite?: string | null } | undefined;

/** «Xodim qo'shish» — panel formasi bilan bir xil tekshiruv (server/employees-form.ts); javobda taklif kodi. */
export async function tgSaveEmployeeAction(_p: EmployeeFormState, f: FormData): Promise<EmployeeFormState> {
  const m = await assertTgMember();
  if (!can(m.role, 'employees')) return { error: 'Ruxsat yo‘q' };
  const res = await saveEmployeeFromForm(memberAsTenantUser(m), f);
  if ('error' in res) return res;
  refreshManager();
  return { ok: res.ok, invite: res.invite ? inviteLink(res.invite) : null };
}

/** Ijrochi: muddatni uzaytirish so'rovi (sana, vaqt — ishxona vaqt mintaqasida). */
export async function tgDeadlineRequestAction(taskId: string, date: string, time: string, reason: string): Promise<{ error?: string }> {
  const u = await assertTgUser();
  if (!isUuid(taskId) || !isValidDate(date) || !isValidTime(time)) return { error: 'Sana yoki vaqt noto‘g‘ri' };
  const res = await withTenant(u.tenantId, (tx) => createDeadlineRequest(tx, {
    tenantId: u.tenantId, taskId, employeeId: u.employeeId, requestedDueAt: zonedTime(date, time, u.tz), reason: String(reason ?? '').slice(0, 500) || null,
  }));
  if ('error' in res) return { error: res.error };
  revalidatePath('/tg', 'layout');
  kick();
  return {};
}

/** Rahbar: muddat so'roviga qaror. */
export async function tgDecideDeadlineAction(id: string, to: 'approved' | 'rejected', comment: string): Promise<{ error?: string }> {
  const m = await assertTgMember();
  if (!isUuid(id) || (to !== 'approved' && to !== 'rejected')) return bad();
  const res = await withTenant(m.tenantId, (tx) => decideDeadlineRequest(tx, { tenantId: m.tenantId, id, to, actor: { userId: m.userId, role: m.role }, comment: String(comment ?? '').slice(0, 500) || null }));
  if ('error' in res) return { error: res.error };
  refreshManager();
  return {};
}
