import 'server-only';
/**
 * Muddatni uzaytirish so'rovlari (§7, deadline_requests) — yagona yozish nuqtasi (bot, Mini App, panel).
 * Ijrochi ochiq vazifada yangi muddat so'raydi; rahbar (egasi/admin, bo'lim boshlig'i — o'z bo'limi, vazifani bergan) hal qiladi.
 * Tasdiqlansa `tasks.due_at` yangilanadi, eslatmalar qayta rejalashtiriladi; har qadam `task_events` izohi + audit_log.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { auditLog, deadlineRequests, departments, employees, taskBatches, taskEvents, tasks, tenants, withTenant, type Tx } from '@adone/db';
import { canRequestDeadline, formatDateTime, validDeadline, type DeadlineStatus, type MemberRole } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { escHtml as esc } from '@/lib/task-text';
import { enqueue } from './jobs/enqueue';
import { deliver, memberChats, miniAppRow, notifyEmployee } from './notify';
import { departmentScope, inScope } from './scope';
import { rescheduleReminders } from './tasks';
import { taskButtons } from './task-notify';
import { send } from './telegram/api';
import type { JobOutcome } from './jobs/types';

const tzOf = async (tx: Tx) => (await tx.select({ tz: tenants.timezone }).from(tenants).limit(1))[0]!.tz;

export async function createDeadlineRequest(
  tx: Tx, input: { tenantId: string; taskId: string; employeeId: string; requestedDueAt: Date; reason: string | null },
): Promise<{ id: string } | { error: string }> {
  const [r] = await tx.select({ t: tasks }).from(tasks).where(and(eq(tasks.id, input.taskId), eq(tasks.assigneeEmployeeId, input.employeeId))).limit(1);
  if (!r) return { error: 'Vazifa topilmadi' };
  if (!canRequestDeadline(r.t.status)) return { error: 'Bu vazifa uchun muddat so‘rab bo‘lmaydi' };
  const err = validDeadline(input.requestedDueAt, new Date(), r.t.dueAt);
  if (err) return { error: err };
  const [open] = await tx.select({ id: deadlineRequests.id }).from(deadlineRequests)
    .where(and(eq(deadlineRequests.taskId, input.taskId), eq(deadlineRequests.status, 'pending'))).limit(1);
  if (open) return { error: "So'rov allaqachon yuborilgan — rahbar javobini kuting" };
  const reason = input.reason?.trim().slice(0, 500) || null;
  const [ins] = await tx.insert(deadlineRequests).values({
    tenantId: input.tenantId, taskId: input.taskId, employeeId: input.employeeId, currentDueAt: r.t.dueAt, requestedDueAt: input.requestedDueAt, reason,
  }).returning({ id: deadlineRequests.id });
  const tz = await tzOf(tx);
  await tx.insert(taskEvents).values({
    tenantId: input.tenantId, taskId: input.taskId, actorEmployeeId: input.employeeId, fromStatus: r.t.status, toStatus: r.t.status,
    comment: `⏰ Muddatni uzaytirish so'raldi: ${formatDateTime(input.requestedDueAt, tz)}${reason ? ` — ${reason}` : ''}`,
  });
  await enqueue(tx, input.tenantId, 'deadline_notify', { id: ins!.id, kind: 'created' }, { maxAttempts: 3 });
  return { id: ins!.id };
}

/** Rahbar qarori: tasdiq — yangi muddat yoziladi; rad — faqat izoh. CAS: ikki rahbar bir vaqtda bossa — bittasi. */
export async function decideDeadlineRequest(
  tx: Tx, input: { tenantId: string; id: string; to: 'approved' | 'rejected'; actor: { userId: string; role: MemberRole }; comment?: string | null },
): Promise<{ ok: true } | { error: string }> {
  const [r] = await tx.select({ d: deadlineRequests, t: tasks, b: taskBatches, dep: employees.departmentId }).from(deadlineRequests)
    .innerJoin(tasks, eq(tasks.id, deadlineRequests.taskId)).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
    .leftJoin(employees, eq(employees.id, deadlineRequests.employeeId))
    .where(eq(deadlineRequests.id, input.id)).limit(1);
  if (!r) return { error: "So'rov topilmadi" };
  if (input.actor.role === 'manager') {
    const scope = await departmentScope(tx, { id: input.actor.userId, role: 'manager' } as TenantUser);
    if (!scope?.includes(r.dep ?? '') && r.b.createdByUserId !== input.actor.userId) return { error: "Faqat o'z bo'limingiz xodimlari" };
  }
  if (r.d.status !== 'pending') return { error: "So'rov allaqachon hal qilingan" };
  if (input.to === 'approved' && !canRequestDeadline(r.t.status)) return { error: 'Vazifa allaqachon topshirilgan yoki yopilgan' };
  const comment = input.comment?.trim().slice(0, 500) || null;
  const upd = await tx.update(deadlineRequests)
    .set({ status: input.to, decidedByUserId: input.actor.userId, decidedAt: new Date(), decisionComment: comment, updatedAt: new Date() })
    .where(and(eq(deadlineRequests.id, input.id), eq(deadlineRequests.status, 'pending'))).returning({ id: deadlineRequests.id });
  if (!upd.length) return { error: "So'rov allaqachon hal qilingan" };
  const tz = await tzOf(tx);
  const ev = { tenantId: input.tenantId, taskId: r.t.id, actorUserId: input.actor.userId, fromStatus: r.t.status, toStatus: r.t.status };
  if (input.to === 'approved') {
    await tx.update(tasks).set({ dueAt: r.d.requestedDueAt, updatedAt: new Date() }).where(eq(tasks.id, r.t.id));
    await tx.insert(taskEvents).values({ ...ev, comment: `✅ Muddat uzaytirildi: ${r.t.dueAt ? formatDateTime(r.t.dueAt, tz) : 'muddatsiz'} → ${formatDateTime(r.d.requestedDueAt, tz)}${comment ? ` — ${comment}` : ''}` });
    await rescheduleReminders(tx, input.tenantId, r.t.id, r.d.requestedDueAt, tz);
  } else {
    await tx.insert(taskEvents).values({ ...ev, comment: `❌ Muddatni uzaytirish rad etildi${comment ? `: ${comment}` : ''}` });
  }
  await tx.insert(auditLog).values({
    tenantId: input.tenantId, userId: input.actor.userId, action: `deadline.${input.to}`, entity: 'deadline_request', entityId: input.id,
    meta: { taskId: r.t.id, from: r.t.dueAt?.toISOString() ?? null, to: r.d.requestedDueAt.toISOString() },
  });
  await enqueue(tx, input.tenantId, 'deadline_notify', { id: input.id, kind: input.to }, { maxAttempts: 3 });
  return { ok: true };
}

export interface DeadlineRow {
  id: string; taskId: string; title: string; employeeId: string; employeeName: string; departmentName: string | null;
  currentDueAt: Date | null; requestedDueAt: Date; reason: string | null; status: DeadlineStatus; createdAt: Date; decidedAt: Date | null; decisionComment: string | null;
}

const rowSelect = {
  d: deadlineRequests, title: taskBatches.title, employeeName: employees.fullName, departmentName: departments.name,
  departmentId: employees.departmentId, creatorId: taskBatches.createdByUserId,
};
const toRow = (x: { d: typeof deadlineRequests.$inferSelect; title: string; employeeName: string; departmentName: string | null }): DeadlineRow => ({
  id: x.d.id, taskId: x.d.taskId, title: x.title, employeeId: x.d.employeeId, employeeName: x.employeeName, departmentName: x.departmentName,
  currentDueAt: x.d.currentDueAt, requestedDueAt: x.d.requestedDueAt, reason: x.d.reason, status: x.d.status, createdAt: x.d.createdAt,
  decidedAt: x.d.decidedAt, decisionComment: x.d.decisionComment,
});

/** Kutilayotgan so'rovlar (panel, rahbar Mini App'i «Qarorlar»): menejer — o'z bo'limi yoki o'zi bergan vazifalar. */
export async function listDeadlineRequests(user: TenantUser, status: DeadlineStatus | 'all' = 'pending'): Promise<DeadlineRow[]> {
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const rows = await tx.select(rowSelect).from(deadlineRequests)
      .innerJoin(tasks, eq(tasks.id, deadlineRequests.taskId)).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .innerJoin(employees, eq(employees.id, deadlineRequests.employeeId)).leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(and(status === 'all' ? undefined : eq(deadlineRequests.status, status), scope === null ? undefined : sql`(${inScope(employees.departmentId, scope)} or ${taskBatches.createdByUserId} = ${user.id})`))
      .orderBy(desc(deadlineRequests.createdAt)).limit(200);
    return rows.map(toRow);
  });
}

/** Vazifaning kutilayotgan so'rovi (vazifa sahifalari). */
export async function pendingDeadlineFor(tx: Tx, taskId: string): Promise<DeadlineRow | null> {
  const [x] = await tx.select(rowSelect).from(deadlineRequests)
    .innerJoin(tasks, eq(tasks.id, deadlineRequests.taskId)).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
    .innerJoin(employees, eq(employees.id, deadlineRequests.employeeId)).leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(and(eq(deadlineRequests.taskId, taskId), eq(deadlineRequests.status, 'pending'))).orderBy(desc(deadlineRequests.createdAt)).limit(1);
  return x ? toRow(x) : null;
}

/** Ijrochi uchun: vazifaning oxirgi so'rovi (kutilmoqda yoki 7 kun ichida hal qilingan). */
export async function latestDeadlineFor(tx: Tx, taskId: string, employeeId: string): Promise<DeadlineRow | null> {
  const [x] = await tx.select(rowSelect).from(deadlineRequests)
    .innerJoin(tasks, eq(tasks.id, deadlineRequests.taskId)).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
    .innerJoin(employees, eq(employees.id, deadlineRequests.employeeId)).leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(and(eq(deadlineRequests.taskId, taskId), eq(deadlineRequests.employeeId, employeeId), inArray(deadlineRequests.status, ['pending', 'approved', 'rejected'])))
    .orderBy(desc(deadlineRequests.createdAt)).limit(1);
  if (!x) return null;
  if (x.d.status !== 'pending' && x.d.decidedAt && Date.now() - x.d.decidedAt.getTime() > 7 * 86_400_000) return null;
  return toRow(x);
}

/** `deadline_notify`: yangi so'rov → rahbarlarga (tugmalar + Mini App); qaror → ijrochiga. */
export async function deadlineNotify(tenantId: string, id: string, kind: string): Promise<JobOutcome> {
  const data = await withTenant(tenantId, async (tx) => {
    const [x] = await tx.select({ ...rowSelect, status: tasks.status, tz: tenants.timezone }).from(deadlineRequests)
      .innerJoin(tasks, eq(tasks.id, deadlineRequests.taskId)).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .innerJoin(tenants, eq(tenants.id, tasks.tenantId))
      .innerJoin(employees, eq(employees.id, deadlineRequests.employeeId)).leftJoin(departments, eq(departments.id, employees.departmentId))
      .where(eq(deadlineRequests.id, id)).limit(1);
    return x ?? null;
  });
  if (!data) return { skip: "so'rov yo‘q" };
  const row = toRow(data);
  const what = `📋 <b>${esc(row.title)}</b>\n⏰ ${row.currentDueAt ? formatDateTime(row.currentDueAt, data.tz) : 'muddatsiz'} → <b>${formatDateTime(row.requestedDueAt, data.tz)}</b>${row.reason ? `\n💬 ${esc(row.reason)}` : ''}`;
  if (kind === 'created') {
    if (row.status !== 'pending') return { skip: 'hal qilingan' };
    const chats = await memberChats(tenantId, data.departmentId, null, { event: 'task_submitted', creatorUserId: data.creatorId });
    if (!chats?.length) return { skip: 'rahbarlar Telegram ulamagan' };
    return deliver(chats, (chat) => send(chat, `📅 <b>Muddatni uzaytirish so'rovi</b> · ${esc(row.employeeName)}\n${what}`, {
      inline_keyboard: [[{ text: '✅ Ruxsat', callback_data: `dl:ok:${id}` }, { text: '❌ Rad etish', callback_data: `dl:no:${id}` }], ...miniAppRow('/tg/qarorlar')],
    }));
  }
  const text = kind === 'approved'
    ? `✅ Muddat uzaytirildi:\n${what}`
    : `❌ Muddatni uzaytirish rad etildi:\n${what}${row.decisionComment ? `\nSabab: ${esc(row.decisionComment)}` : ''}`;
  return notifyEmployee(tenantId, row.employeeId, text, canRequestDeadline(data.status) ? taskButtons.work(row.taskId, data.status !== 'new') : undefined);
}
