'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, employees, taskTemplates, withTenant } from '@adone/db';
import {
  isValidDate, isValidTime, TASK_PRIORITIES, TASK_PROOFS, TASK_STATUSES, zonedTime, type Recurrence, type TaskPriority, type TaskProof,
} from '@adone/core';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { commentTask, createTasks, runTaskTemplates, selfTasksNeedApproval, transitionTask } from '@/server/tasks';
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

/**
 * «Vazifa berish» (dizayn): bir nechta ijrochi → bitta to'plam, har kishiga alohida nusxa (§1.6).
 * Takrorlash yoqilsa — task_templates (har kuni / hafta kunlari / har oy) va bugungi nusxa darhol.
 */
export async function createTaskAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('tasks');
  const ids = [...new Set(f.getAll('assignee').map(String).filter(isUuid))];
  if (ids.length === 0) return { error: 'Kimga — kamida bitta xodimni tanlang' };
  if (ids.length > 200) return { error: 'Bir martada 200 tadan ko‘p emas' };
  const title = str(f, 'title').slice(0, 200);
  if (title.length < 3) return { error: 'Sarlavhani yozing' };
  const description = str(f, 'description').slice(0, 1000) || null;
  const priority = (TASK_PRIORITIES as readonly string[]).includes(str(f, 'priority')) ? (str(f, 'priority') as TaskPriority) : 'medium';
  const proofs = [...new Set(f.getAll('proof').map(String).filter((p): p is TaskProof => (TASK_PROOFS as readonly string[]).includes(p)))];
  const checklist = f.getAll('step').map((s) => String(s).trim().slice(0, 200)).filter(Boolean).slice(0, 20);
  const dueTime = str(f, 'dueTime') || '18:00';
  if (!isValidTime(dueTime)) return { error: "Vaqtni 17:00 ko'rinishida kiriting" };
  const repeat = f.get('repeat') === '1';
  let recurrence: Recurrence | null = null;
  if (repeat) {
    const kind = z.enum(['daily', 'weekly', 'monthly']).safeParse(str(f, 'repeatKind'));
    if (!kind.success) return { error: 'Takrorlash turini tanlang' };
    const weekdays = f.getAll('weekday').map(Number).filter((d) => d >= 1 && d <= 7);
    const monthDay = Math.min(31, Math.max(1, Number(str(f, 'monthDay')) || 1));
    if (kind.data === 'weekly' && weekdays.length === 0) return { error: 'Hafta kunlarini tanlang' };
    recurrence = { kind: kind.data, weekdays, monthDay };
  }
  const dueDate = str(f, 'dueDate');
  if (!repeat && dueDate && !isValidDate(dueDate)) return { error: 'Sana noto‘g‘ri' };
  const dueAt = !repeat && dueDate ? zonedTime(dueDate, dueTime, user.tenantTimezone) : null;
  if (dueAt && dueAt.getTime() < Date.now() - 60_000) return { error: 'Muddat o‘tib ketgan vaqtga qo‘yilmaydi' };

  const res = await withTenant(user.tenantId, async (tx) => {
    // Formadan kelgan uuid'lar shu ishxonaning faol xodimlari va (menejer bo'lsa) o'z bo'limidan
    const scope = await departmentScope(tx, user);
    const emps = await tx.select({ id: employees.id, dep: employees.departmentId }).from(employees).where(and(inArray(employees.id, ids), eq(employees.status, 'active')));
    if (emps.length !== ids.length) return { error: 'Xodim topilmadi yoki faol emas' };
    if (scope !== null && emps.some((e) => !e.dep || !scope.includes(e.dep))) return { error: "Faqat o'z bo'limingiz xodimlariga vazifa bera olasiz" };
    if (recurrence) {
      const [tpl] = await tx.insert(taskTemplates).values({
        tenantId: user.tenantId, title, description, priority, proofs: proofs.length ? proofs : ['button'], checklist, assigneeEmployeeIds: ids,
        recurrence, dueTime, createdByUserId: user.id,
      }).returning({ id: taskTemplates.id });
      const made = await runTaskTemplates(tx, user.tenantId, new Date(), tpl!.id);
      await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'task_template.create', entity: 'task_template', entityId: tpl!.id, meta: { title, assignees: ids.length } });
      return { ok: made ? `Takrorlanuvchi vazifa saqlandi, bugungi ${ids.length} ta nusxa yuborildi` : 'Takrorlanuvchi vazifa saqlandi — birinchi nusxa jadval bo‘yicha yuboriladi' };
    }
    const { batchId } = await createTasks(tx, {
      tenantId: user.tenantId, source: 'assigned', title, description, priority, proofs, checklist, dueAt,
      assignees: ids.map((employeeId) => ({ employeeId })), createdBy: { userId: user.id },
    });
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'task.create', entity: 'task_batch', entityId: batchId, meta: { title, assignees: ids.length } });
    return { ok: ids.length > 1 ? `${ids.length} ta nusxa yuborildi` : 'Vazifa yuborildi' };
  });
  if (res.ok) done();
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
