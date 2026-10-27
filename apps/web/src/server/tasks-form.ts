import 'server-only';
/**
 * «Vazifa berish» formasini o'qish va yaratish — panel drawer'i (lib/actions/tasks.ts) va rahbar Mini App'i (lib/actions/miniapp.ts)
 * bir xil tekshiruv bilan: bir nechta ijrochi → bitta to'plam, har kishiga alohida nusxa (§1.6). Takrorlash yoqilsa —
 * task_templates (har kuni / hafta kunlari / har oy) va bugungi nusxa darhol.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, employees, memberships, taskTemplates, withTenant } from '@adone/db';
import { assignableMemberRoles, isValidDate, isValidTime, TASK_PRIORITIES, TASK_PROOFS, zonedTime, type Recurrence, type TaskPriority, type TaskProof } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { createTasks, runTaskTemplates } from './tasks';
import { departmentScope } from './scope';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const isUuid = (v: string) => z.uuid().safeParse(v).success;

export type TaskFormResult = { error: string } | { ok: string };

export async function createTaskFromForm(user: TenantUser, f: FormData): Promise<TaskFormResult> {
  // Ijrochi: xodim (uuid) yoki panel a'zosi — administrator / bo'lim boshlig'i (`u:<userId>`, core assignableMemberRoles)
  const raw = [...new Set(f.getAll('assignee').map(String))];
  const empIds = raw.filter(isUuid);
  const userIds = raw.filter((v) => v.startsWith('u:') && isUuid(v.slice(2))).map((v) => v.slice(2));
  if (empIds.length + userIds.length === 0) return { error: 'Kimga — kamida bitta xodimni tanlang' };
  if (empIds.length + userIds.length > 200) return { error: 'Bir martada 200 tadan ko‘p emas' };
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
  if (dueAt && dueAt.getTime() < Date.now() - 60_000) return { error: 'Muddat o‘tib ketgan — keyinroq vaqtni yoki ertangi kunni tanlang' };

  return withTenant(user.tenantId, async (tx) => {
    // A'zolar: faol, rol beruvchiga ruxsat etilgan, o'zi emas. Xodim yozuvi bor a'zo — xodim sifatida (bot va davomat bilan bitta)
    const members: string[] = [];
    const ids = [...empIds];
    if (userIds.length) {
      const allowed = assignableMemberRoles(user.role);
      const rows = await tx.select({ id: memberships.userId, role: memberships.role }).from(memberships).where(and(inArray(memberships.userId, userIds), eq(memberships.isActive, true)));
      if (rows.length !== userIds.length || rows.some((r) => r.id === user.id || !allowed.includes(r.role))) return { error: 'Bu rahbarga vazifa bera olmaysiz' };
      const linked = await tx.select({ id: employees.id, userId: employees.userId }).from(employees).where(and(inArray(employees.userId, userIds), eq(employees.status, 'active')));
      for (const u of userIds) {
        const e = linked.find((x) => x.userId === u);
        if (e) ids.push(e.id);
        else members.push(u);
      }
    }
    const uniq = [...new Set(ids)];
    // Formadan kelgan uuid'lar shu ishxonaning faol xodimlari va (menejer bo'lsa) o'z bo'limidan
    const scope = await departmentScope(tx, user);
    const emps = uniq.length ? await tx.select({ id: employees.id, dep: employees.departmentId }).from(employees).where(and(inArray(employees.id, uniq), eq(employees.status, 'active'))) : [];
    if (emps.length !== uniq.length) return { error: 'Xodim topilmadi yoki faol emas' };
    // A'zo orqali kelgan xodim yozuvi (boshliq) bo'lim cheklovidan ozod — uni beruvchining roli tekshirildi
    const direct = new Set(empIds);
    if (scope !== null && emps.some((e) => direct.has(e.id) && (!e.dep || !scope.includes(e.dep)))) return { error: "Faqat o'z bo'limingiz xodimlariga vazifa bera olasiz" };
    const total = uniq.length + members.length;
    if (recurrence && members.length) return { error: 'Takrorlanuvchi vazifa faqat xodimlarga — rahbarlarga oddiy vazifa bering' };
    if (recurrence) {
      const ids = uniq;
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
      assignees: [...uniq.map((employeeId) => ({ employeeId })), ...members.map((userId) => ({ userId }))], createdBy: { userId: user.id },
    });
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'task.create', entity: 'task_batch', entityId: batchId, meta: { title, assignees: total, members: members.length } });
    return { ok: total > 1 ? `${total} ta nusxa yuborildi` : 'Vazifa yuborildi' };
  });
}
