import 'server-only';
/**
 * Vazifalar — yagona yozish nuqtasi (panel actionlari ham, bot ham shu yerdan). CLAUDE.md §1.5–1.6, §7, §7a:
 *   - holat FAQAT core `canTransition` jadvali bo'yicha, compare-and-swap UPDATE bilan; har o'tish task_events ga;
 *   - bitta vazifa N ijrochiga — task_batches + N ta tasks;
 *   - bildirishnomalar navbat orqali (`task_notify`), Telegram'ga yuborish tranzaksiyadan tashqarida.
 */
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { employees, media, memberships, taskBatches, taskEvents, taskReports, taskTemplates, tasks, tenants, type Tx } from '@adone/db';
import {
  canTransition, initialStatus, localDate, missingProofs, needsComment, occursOn, outsideQuietHours, TASK_PROOF_LABELS, zonedTime,
  type MemberRole, type TaskActor, type TaskPriority, type TaskProof, type TaskSource, type TaskStatus,
} from '@adone/core';
import { enqueue } from '@/server/jobs/enqueue';

/** Kim amal qilyapti: panel foydalanuvchisi yoki botdagi xodim. */
export type ActorRef = { userId: string; role: MemberRole; employeeId?: string | null } | { employeeId: string; userId?: undefined };

export interface ReportInput {
  text?: string | null;
  mediaIds?: string[];
  lat?: number | null;
  lng?: number | null;
  spentMinutes?: number | null;
  source: 'bot' | 'panel' | 'miniapp';
}

export interface CreateInput {
  tenantId: string;
  source: TaskSource;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  proofs: TaskProof[];
  checklist: string[];
  dueAt: Date | null;
  assignees: Array<{ employeeId: string } | { userId: string }>;
  createdBy: { userId?: string | null; employeeId?: string | null };
  templateId?: string | null;
  /** self_done uchun: tasdiq kerakmi (egasining o'z ishi yoki sozlama o'chiq — yo'q). */
  needsApproval?: boolean;
  report?: ReportInput;
}

const MINUTE = 60_000;

/** Ishxona sozlamasi: o'zi qo'shgan ish tasdiq talab qiladimi (standart — ha, §7a). */
export async function selfTasksNeedApproval(tx: Tx): Promise<boolean> {
  const [t] = await tx.select({ s: tenants.settings }).from(tenants).limit(1);
  return t?.s?.selfTasksNeedApproval !== false;
}

export async function createTasks(tx: Tx, input: CreateInput): Promise<{ batchId: string; taskIds: string[] }> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  const tz = t!.tz;
  const [batch] = await tx.insert(taskBatches).values({
    tenantId: input.tenantId, source: input.source, title: input.title.trim(), description: input.description?.trim() || null,
    priority: input.priority, proofs: input.proofs.length ? input.proofs : ['button'], checklist: input.checklist, dueAt: input.dueAt,
    templateId: input.templateId ?? null, createdByUserId: input.createdBy.userId ?? null, createdByEmployeeId: input.createdBy.employeeId ?? null,
  }).returning({ id: taskBatches.id });
  const status = initialStatus(input.source, input.needsApproval ?? true);
  const now = new Date();
  const taskIds: string[] = [];
  for (const a of input.assignees) {
    const [task] = await tx.insert(tasks).values({
      tenantId: input.tenantId, batchId: batch!.id,
      assigneeEmployeeId: 'employeeId' in a ? a.employeeId : null, assigneeUserId: 'userId' in a ? a.userId : null,
      status, dueAt: input.dueAt,
      acceptedAt: status !== 'new' ? now : null,
      submittedAt: status === 'submitted' || status === 'approved' ? now : null,
      approvedAt: status === 'approved' ? now : null,
      spentMinutes: input.report?.spentMinutes ?? null,
      checklistDone: input.checklist.map(() => status === 'submitted' || status === 'approved'),
    }).returning({ id: tasks.id });
    const id = task!.id;
    taskIds.push(id);
    await tx.insert(taskEvents).values({
      tenantId: input.tenantId, taskId: id, actorUserId: input.createdBy.userId ?? null, actorEmployeeId: input.createdBy.employeeId ?? null,
      fromStatus: null, toStatus: status, comment: input.report?.text?.trim() || null,
    });
    if (input.report) await insertReport(tx, input.tenantId, id, input.report);
    if (input.source === 'assigned' && 'employeeId' in a) {
      await enqueue(tx, input.tenantId, 'task_notify', { taskId: id, kind: 'assigned' }, { maxAttempts: 3 });
      await scheduleReminders(tx, input.tenantId, id, input.dueAt, tz);
    }
    if (status === 'submitted') await enqueue(tx, input.tenantId, 'task_notify', { taskId: id, kind: 'submitted' }, { maxAttempts: 3 });
  }
  return { batchId: batch!.id, taskIds };
}

async function insertReport(tx: Tx, tenantId: string, taskId: string, r: ReportInput) {
  if (!r.text?.trim() && !r.mediaIds?.length && r.lat == null) return;
  await tx.insert(taskReports).values({
    tenantId, taskId, text: r.text?.trim() || null, mediaIds: r.mediaIds ?? [], lat: r.lat ?? null, lng: r.lng ?? null,
    spentMinutes: r.spentMinutes ?? null, source: r.source,
  });
}

/** Eslatmalar (§7): 30 daqiqada qabul qilinmasa, muddatga 1 soat qolganda, muddat o'tganda. Tungi vaqtda — ertalabga. */
async function scheduleReminders(tx: Tx, tenantId: string, taskId: string, dueAt: Date | null, tz: string) {
  const now = Date.now();
  const at = (d: Date, kind: string) => {
    const when = outsideQuietHours(d, tz).getTime();
    return enqueue(tx, tenantId, 'task_notify', { taskId, kind }, { delaySec: Math.max(0, Math.round((when - now) / 1000)), maxAttempts: 2, dedupeKey: `tr:${kind}:${taskId}` });
  };
  await at(new Date(now + 30 * MINUTE), 'not_accepted');
  if (dueAt) {
    if (dueAt.getTime() - 60 * MINUTE > now + 5 * MINUTE) await at(new Date(dueAt.getTime() - 60 * MINUTE), 'due_soon');
    await at(new Date(Math.max(dueAt.getTime() + MINUTE, now + MINUTE)), 'overdue');
  }
}

export interface TaskRow {
  task: typeof tasks.$inferSelect;
  batch: typeof taskBatches.$inferSelect;
  departmentId: string | null;
  assigneeUserLinkedId: string | null;
}

export async function loadTask(tx: Tx, taskId: string): Promise<TaskRow | null> {
  const [r] = await tx
    .select({ task: tasks, batch: taskBatches, departmentId: employees.departmentId, assigneeUserLinkedId: employees.userId })
    .from(tasks)
    .innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
    .leftJoin(employees, eq(employees.id, tasks.assigneeEmployeeId))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return r ?? null;
}

/**
 * Amal qiluvchining shu vazifadagi o'rni. Ijrochi — o'z vazifasi; tasdiqlovchi — egasi/admin hamma vazifada,
 * bo'lim boshlig'i faqat o'z bo'limi xodimlarida. O'z ishini o'zi tasdiqlay olmaydi (ijrochi birinchi tekshiriladi).
 */
export async function actorRole(tx: Tx, actor: ActorRef, row: TaskRow): Promise<TaskActor | null> {
  const t = row.task;
  if (actor.employeeId && t.assigneeEmployeeId === actor.employeeId) return 'assignee';
  if (actor.userId && (t.assigneeUserId === actor.userId || (row.assigneeUserLinkedId && row.assigneeUserLinkedId === actor.userId))) return 'assignee';
  if (!actor.userId || !('role' in actor)) return null;
  if (actor.role === 'owner' || actor.role === 'admin') return 'reviewer';
  if (actor.role !== 'manager' || !row.departmentId) return null;
  const [m] = await tx.select({ ids: memberships.departmentIds }).from(memberships).where(eq(memberships.userId, actor.userId)).limit(1);
  if (m?.ids?.includes(row.departmentId)) return 'reviewer';
  const { rows } = await tx.execute<{ ok: number }>(sql`select 1 as ok from departments where id = ${row.departmentId}::uuid and manager_user_id = ${actor.userId}::uuid`);
  return rows.length ? 'reviewer' : null;
}

export type TransitionResult = { ok: true; status: TaskStatus } | { error: string };

/**
 * Holat o'tishi — yagona kirish nuqtasi. CAS: UPDATE ko'rilgan holatga bog'langan, ikki kishi bir vaqtda bossa
 * ikkinchisi «holat o'zgargan» oladi va task_events ikki marta yozilmaydi.
 */
export async function transitionTask(tx: Tx, input: {
  tenantId: string; taskId: string; to: TaskStatus; actor: ActorRef; comment?: string | null; rating?: number | null;
  report?: ReportInput & { got?: { photo: boolean; video: boolean; location: boolean } };
}): Promise<TransitionResult> {
  const row = await loadTask(tx, input.taskId);
  if (!row) return { error: 'Vazifa topilmadi' };
  const from = row.task.status;
  const role = await actorRole(tx, input.actor, row);
  if (!role || !canTransition(from, input.to, role)) return { error: from === input.to ? 'Holat allaqachon shunday' : 'Bu amal mumkin emas' };
  const comment = input.comment?.trim() || null;
  if (needsComment(input.to) && !comment) return { error: input.to === 'revision' ? 'Qaytarish sababini yozing' : 'Bekor qilish sababini yozing' };
  if (input.to === 'submitted' && input.report?.got && row.batch.source === 'assigned') {
    const miss = missingProofs(row.batch.proofs as TaskProof[], input.report.got);
    if (miss.length) return { error: `Hisobotda yetishmayapti: ${miss.map((p) => TASK_PROOF_LABELS[p].toLowerCase()).join(', ')}` };
  }
  const rating = input.to === 'approved' && input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null;
  const now = new Date();
  const set: Partial<typeof tasks.$inferInsert> = { status: input.to };
  if (input.to === 'accepted') set.acceptedAt = now;
  if (input.to === 'in_progress') { set.startedAt = now; set.acceptedAt = row.task.acceptedAt ?? now; }
  if (input.to === 'submitted') {
    set.submittedAt = now;
    set.acceptedAt = row.task.acceptedAt ?? now;
    if (input.report?.spentMinutes) set.spentMinutes = (row.task.spentMinutes ?? 0) + input.report.spentMinutes;
    set.checklistDone = (row.batch.checklist ?? []).map(() => true);
  }
  if (input.to === 'approved') { set.approvedAt = now; set.rating = rating; set.reviewedByUserId = input.actor.userId ?? null; }
  if (input.to === 'revision') { set.revisionCount = row.task.revisionCount + 1; set.reviewedByUserId = input.actor.userId ?? null; }
  const upd = await tx.update(tasks).set(set).where(and(eq(tasks.id, row.task.id), eq(tasks.status, from))).returning({ id: tasks.id });
  if (upd.length === 0) return { error: "Holat o'zgargan — sahifani yangilang" };
  await tx.insert(taskEvents).values({
    tenantId: input.tenantId, taskId: row.task.id, actorUserId: input.actor.userId ?? null, actorEmployeeId: input.actor.employeeId ?? null,
    fromStatus: from, toStatus: input.to, comment: input.to === 'approved' && rating ? [comment, `Baho: ${rating}/5`].filter(Boolean).join(' · ') : comment,
  });
  if (input.to === 'submitted' && input.report) await insertReport(tx, input.tenantId, row.task.id, input.report);
  if (input.to === 'submitted') {
    // O'z ishini topshirgan egasi — tasdiqlovchisi yo'q, darhol tasdiqlanadi
    if (input.actor.userId && 'role' in input.actor && input.actor.role === 'owner' && !row.task.assigneeEmployeeId) {
      await tx.update(tasks).set({ status: 'approved', approvedAt: now }).where(eq(tasks.id, row.task.id));
      await tx.insert(taskEvents).values({ tenantId: input.tenantId, taskId: row.task.id, actorUserId: input.actor.userId, fromStatus: 'submitted', toStatus: 'approved' });
      return { ok: true, status: 'approved' };
    }
    await enqueue(tx, input.tenantId, 'task_notify', { taskId: row.task.id, kind: 'submitted', by: input.actor.userId ?? null }, { maxAttempts: 3 });
  }
  if ((input.to === 'approved' || input.to === 'revision' || input.to === 'cancelled') && row.task.assigneeEmployeeId && role === 'reviewer') {
    await enqueue(tx, input.tenantId, 'task_notify', { taskId: row.task.id, kind: input.to }, { maxAttempts: 3 });
  }
  return { ok: true, status: input.to };
}

/** Izoh (yozishma): task_events from == to. Ijrochi yozsa — rahbarlarga savol, rahbar yozsa — ijrochiga. */
export async function commentTask(tx: Tx, input: { tenantId: string; taskId: string; actor: ActorRef; comment: string }): Promise<TransitionResult> {
  const row = await loadTask(tx, input.taskId);
  if (!row) return { error: 'Vazifa topilmadi' };
  const role = await actorRole(tx, input.actor, row);
  if (!role) return { error: 'Bu vazifaga yozib bo‘lmaydi' };
  const comment = input.comment.trim().slice(0, 1000);
  if (!comment) return { error: 'Izoh bo‘sh' };
  await tx.insert(taskEvents).values({
    tenantId: input.tenantId, taskId: row.task.id, actorUserId: input.actor.userId ?? null, actorEmployeeId: input.actor.employeeId ?? null,
    fromStatus: row.task.status, toStatus: row.task.status, comment,
  });
  if (role === 'assignee') await enqueue(tx, input.tenantId, 'task_notify', { taskId: row.task.id, kind: 'question', comment, by: input.actor.userId ?? null }, { maxAttempts: 3 });
  else if (row.task.assigneeEmployeeId) await enqueue(tx, input.tenantId, 'task_notify', { taskId: row.task.id, kind: 'comment', comment }, { maxAttempts: 3 });
  return { ok: true, status: row.task.status };
}

/** Rasm/video media turi bo'yicha isbot bayroqlari (bot hisoboti). */
export async function proofFlags(tx: Tx, mediaIds: string[], hasLocation: boolean) {
  const rows = mediaIds.length ? await tx.select({ mime: media.mime }).from(media).where(inArray(media.id, mediaIds)) : [];
  return { photo: rows.some((r) => r.mime.startsWith('image/')), video: rows.some((r) => r.mime.startsWith('video/')), location: hasLocation };
}

/**
 * Takrorlanuvchi vazifalar (§7): bugun shu qoidaga tushsa va hali yaratilmagan bo'lsa — yangi nusxalar.
 * Ikki marta yaratilmaydi: `last_run_date` CAS bilan belgilanadi. `onlyId` — saqlangandan keyin darhol ishga tushirish.
 */
export async function runTaskTemplates(tx: Tx, tenantId: string, now = new Date(), onlyId?: string): Promise<number> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  const tz = t!.tz;
  const today = localDate(now, tz);
  const list = await tx.select().from(taskTemplates).where(and(eq(taskTemplates.isActive, true), onlyId ? eq(taskTemplates.id, onlyId) : undefined, or(isNull(taskTemplates.lastRunDate), lt(taskTemplates.lastRunDate, today))));
  let made = 0;
  for (const tpl of list) {
    if (!occursOn(tpl.recurrence, today)) continue;
    const claimed = await tx.update(taskTemplates).set({ lastRunDate: today })
      .where(and(eq(taskTemplates.id, tpl.id), or(isNull(taskTemplates.lastRunDate), lt(taskTemplates.lastRunDate, today)))).returning({ id: taskTemplates.id });
    if (!claimed.length) continue;
    const active = tpl.assigneeEmployeeIds.length
      ? await tx.select({ id: employees.id }).from(employees).where(and(inArray(employees.id, tpl.assigneeEmployeeIds), eq(employees.status, 'active')))
      : [];
    if (!active.length) continue;
    await createTasks(tx, {
      tenantId, source: 'assigned', title: tpl.title, description: tpl.description, priority: tpl.priority, proofs: tpl.proofs as TaskProof[],
      checklist: tpl.checklist, dueAt: zonedTime(today, tpl.dueTime, tz), assignees: active.map((e) => ({ employeeId: e.id })),
      createdBy: { userId: tpl.createdByUserId }, templateId: tpl.id,
    });
    made++;
  }
  return made;
}
