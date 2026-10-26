'use server';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, employees, taskTemplates, withTenant } from '@adone/db';
import { isValidDate, isValidTime, TASK_STATUSES, zonedTime } from '@adone/core';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { commentTask, createTasks, selfTasksNeedApproval, transitionTask } from '@/server/tasks';
import { createTaskFromForm } from '@/server/tasks-form';
import { decideDeadlineRequest } from '@/server/deadline';
import { departmentScope } from '@/server/scope';
import { kick } from '@/server/jobs/enqueue';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const isUuid = (v: string) => z.uuid().safeParse(v).success;

function done(path?: string) {
  revalidatePath('/vazifalar');
  if (path) revalidatePath(path);
  revalidatePath('/');
  kick();
}

/** «Vazifa berish» (dizayn) — forma tekshiruvi va yaratish `server/tasks-form.ts` da (rahbar Mini App'i bilan bir xil). */
export async function createTaskAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('tasks');
  const res = await createTaskFromForm(user, f);
  if ('ok' in res) done();
  return res;
}

/**
 * «Ish qo'shish» (§7a): rahbar o'zi qilgan yoki rejalashtirgan ish. Xodim yozuvi bo'lsa (rahbar ham keldi/ketdi qiladi) — unga,
 * aks holda panel foydalanuvchisiga. Egasining bajargan ishi tasdiqsiz.
 */
export async function addWorkAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('tasks');
  const title = str(f, 'title').slice(0, 200);
  if (title.length < 3) return { error: 'Nima ish qildingiz — qisqacha yozing' };
  const mode = str(f, 'mode') === 'plan' ? 'self_plan' : 'self_done';
  const note = str(f, 'note').slice(0, 1000) || null;
  const spent = Number(str(f, 'spentMinutes')) || null;
  const dueDate = str(f, 'dueDate');
  const dueTime = str(f, 'dueTime') || '18:00';
  const dueAt = mode === 'self_plan' && isValidDate(dueDate) && isValidTime(dueTime) ? zonedTime(dueDate, dueTime, user.tenantTimezone) : null;
  await withTenant(user.tenantId, async (tx) => {
    const [own] = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.userId, user.id), eq(employees.status, 'active'))).limit(1);
    const needs = user.role === 'owner' ? false : await selfTasksNeedApproval(tx);
    await createTasks(tx, {
      tenantId: user.tenantId, source: mode, title, description: mode === 'self_plan' ? note : null, priority: 'medium', proofs: ['button'], checklist: [], dueAt,
      assignees: [own ? { employeeId: own.id } : { userId: user.id }], createdBy: { userId: user.id }, needsApproval: needs,
      report: mode === 'self_done' ? { text: note, spentMinutes: spent && spent > 0 && spent < 24 * 60 ? spent : null, source: 'panel' } : undefined,
    });
  });
  done();
  return { ok: mode === 'self_plan' ? 'Rejaga qo‘shildi' : 'Ish qayd etildi' };
}

/** Holat o'tishi (panel). Ruxsat — server/tasks.ts actorRole + core canTransition. */
export async function transitionTaskAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('tasks');
  const taskId = str(f, 'taskId');
  const to = str(f, 'to');
  if (!isUuid(taskId) || !(TASK_STATUSES as readonly string[]).includes(to)) return { error: "Ma'lumot noto'g'ri" };
  const spent = Number(str(f, 'spentMinutes')) || null;
  const res = await withTenant(user.tenantId, (tx) =>
    transitionTask(tx, {
      tenantId: user.tenantId, taskId, to: to as (typeof TASK_STATUSES)[number], actor: { userId: user.id, role: user.role },
      comment: str(f, 'comment').slice(0, 1000) || null, rating: Number(str(f, 'rating')) || null,
      report: to === 'submitted' ? { text: str(f, 'comment') || null, spentMinutes: spent, source: 'panel' } : undefined,
    }),
  );
  if ('error' in res) return { error: res.error };
  done(`/vazifalar/${taskId}`);
  return { ok: 'Saqlandi' };
}

/** Tugma bilan o'tish (izohsiz: Boshladim, Qabul qildim). Xato — sahifa error boundary'si emas, jim qaytadi. */
export async function quickTransitionAction(f: FormData): Promise<void> {
  await transitionTaskAction(undefined, f);
}

export async function commentTaskAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('tasks');
  const taskId = str(f, 'taskId');
  if (!isUuid(taskId)) return { error: "Ma'lumot noto'g'ri" };
  const res = await withTenant(user.tenantId, (tx) => commentTask(tx, { tenantId: user.tenantId, taskId, actor: { userId: user.id, role: user.role }, comment: str(f, 'comment') }));
  if ('error' in res) return { error: res.error };
  done(`/vazifalar/${taskId}`);
  return { ok: 'Yuborildi' };
}

/** Takrorlanuvchi vazifani to'xtatish (keyingi nusxalar yaratilmaydi; mavjudlari qoladi). */
export async function stopTemplateAction(f: FormData): Promise<void> {
  const user = await assertArea('tasks');
  const id = str(f, 'id');
  if (!isUuid(id)) return;
  await withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const [t] = await tx.select().from(taskTemplates).where(eq(taskTemplates.id, id)).limit(1);
    if (!t || (scope !== null && t.createdByUserId !== user.id)) return;
    await tx.update(taskTemplates).set({ isActive: false }).where(eq(taskTemplates.id, id));
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'task_template.stop', entity: 'task_template', entityId: id });
  });
  done();
}

/** Muddatni uzaytirish so'rovi — rahbar qarori (vazifa sahifasi). Ruxsat va CAS — server/deadline.ts. */
export async function decideDeadlineAction(f: FormData): Promise<void> {
  const user = await assertArea('tasks');
  const id = str(f, 'id');
  const to = str(f, 'to');
  if (!isUuid(id) || (to !== 'approved' && to !== 'rejected')) throw new Error("Ma'lumot noto'g'ri");
  const res = await withTenant(user.tenantId, (tx) => decideDeadlineRequest(tx, { tenantId: user.tenantId, id, to, actor: { userId: user.id, role: user.role }, comment: str(f, 'comment').slice(0, 500) || null }));
  if ('error' in res) throw new Error(res.error);
  done('/vazifalar/[id]');
}
