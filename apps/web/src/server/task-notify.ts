import 'server-only';
/**
 * `task_notify` ishi: vazifa bo'yicha Telegram xabarlari. Baza o'qish — withTenant ichida, yuborish — tashqarida.
 * Eslatmalar (not_accepted, due_soon, overdue) yuborish paytida holatni qayta tekshiradi — eskirgan bo'lsa jim o'tadi.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { employees, media, taskBatches, taskEvents, taskReports, tasks, tenants, users, withTenant } from '@adone/db';
import { formatTime, isOverdue, localDate, TASK_STATUS_LABELS, type TaskPriority, type TaskProof } from '@adone/core';
import { dueLabel, escHtml as esc, taskCardText } from '@/lib/task-text';
import { appOrigin, ROOT_DOMAIN } from '@/lib/host';
import { sendFile, send, type Keyboard } from '@/server/telegram/api';
import { memberChats, notifyEmployee } from '@/server/notify';
import { mediaRoot } from '@/server/media';
import type { JobOutcome } from '@/server/jobs/types';

export type TaskNotifyKind = 'assigned' | 'submitted' | 'approved' | 'revision' | 'cancelled' | 'comment' | 'question' | 'not_accepted' | 'due_soon' | 'overdue';

/** Inline tugmalar (callback_data ≤ 64 bayt: «tk:<amal>:<uuid>»). */
export const taskButtons = {
  assigned: (id: string): Keyboard => ({ inline_keyboard: [[{ text: '✅ Qabul qildim', callback_data: `tk:acc:${id}` }, { text: '❓ Savol', callback_data: `tk:ask:${id}` }]] }),
  work: (id: string, started: boolean): Keyboard => ({
    inline_keyboard: [[started ? { text: '✅ Bajardim', callback_data: `tk:done:${id}` } : { text: '▶️ Boshladim', callback_data: `tk:go:${id}` }, { text: '❓ Savol', callback_data: `tk:ask:${id}` }]],
  }),
  review: (id: string): Keyboard => {
    const rows: Array<Array<{ text: string; callback_data?: string; url?: string }>> = [[{ text: '✅ Tasdiqlash', callback_data: `tk:ok:${id}` }, { text: '🔁 Qaytarish', callback_data: `tk:rev:${id}` }]];
    // Telegram localhost havolasini qabul qilmaydi — faqat haqiqiy domen
    if (!ROOT_DOMAIN.includes('localhost')) rows.push([{ text: 'Panelda ochish ↗', url: `${appOrigin()}/vazifalar/${id}` }]);
    return { inline_keyboard: rows };
  },
};

export async function taskNotify(tenantId: string, taskId: string, kind: TaskNotifyKind, extra: { comment?: string | null; by?: string | null } = {}): Promise<JobOutcome> {
  const data = await withTenant(tenantId, async (tx) => {
    const [r] = await tx
      .select({ t: tasks, b: taskBatches, empName: employees.fullName, deptId: employees.departmentId, tz: tenants.timezone, userName: users.name })
      .from(tasks)
      .innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .innerJoin(tenants, eq(tenants.id, tasks.tenantId))
      .leftJoin(employees, eq(employees.id, tasks.assigneeEmployeeId))
      .leftJoin(users, eq(users.id, tasks.assigneeUserId))
      .where(eq(tasks.id, taskId))
      .limit(1);
    if (!r) return null;
    let from = 'Rahbar';
    if (r.b.createdByUserId) from = (await tx.select({ n: users.name }).from(users).where(eq(users.id, r.b.createdByUserId)).limit(1))[0]?.n ?? from;
    const [last] = await tx.select({ comment: taskEvents.comment }).from(taskEvents).where(and(eq(taskEvents.taskId, taskId), eq(taskEvents.toStatus, r.t.status))).orderBy(desc(taskEvents.createdAt)).limit(1);
    let files: Array<{ path: string; mime: string }> = [];
    let reportText: string | null = null;
    if (kind === 'submitted') {
      const [rep] = await tx.select().from(taskReports).where(eq(taskReports.taskId, taskId)).orderBy(desc(taskReports.createdAt)).limit(1);
      reportText = rep?.text ?? null;
      if (rep?.mediaIds.length) files = await tx.select({ path: media.path, mime: media.mime }).from(media).where(inArray(media.id, rep.mediaIds.slice(0, 3)));
    }
    return { ...r, from, lastComment: last?.comment ?? null, files, reportText };
  });
  if (!data) return { skip: 'vazifa yo‘q' };
  const { t, b, tz } = data;
  const who = data.empName ?? data.userName ?? 'Xodim';
  const today = localDate(new Date(), tz);
  const due = t.dueAt ? dueLabel(localDate(t.dueAt, tz), formatTime(t.dueAt, tz), today) : null;
  const title = `<b>${esc(b.title)}</b>`;
  const toEmp = (text: string, kb?: Keyboard) => (t.assigneeEmployeeId ? notifyEmployee(tenantId, t.assigneeEmployeeId, text, kb) : Promise.resolve({ skip: 'ijrochi xodim emas' }));
  const toMembers = async (text: string, kb?: Keyboard) => {
    const chats = await memberChats(tenantId, data.deptId, extra.by ?? null);
    if (!chats?.length) return { skip: 'rahbarlar Telegram ulamagan' };
    for (const c of chats) {
      await send(c.chatId, text, kb);
      for (const f of data.files) {
        const buf = await readFile(path.join(mediaRoot(), f.path)).catch(() => null);
        if (buf) await sendFile(c.chatId, f.mime.startsWith('video/') ? 'video' : 'photo', buf, path.basename(f.path));
      }
    }
    return {};
  };

  switch (kind) {
    case 'assigned':
      if (t.status !== 'new') return { skip: `holat ${t.status}` };
      return toEmp(taskCardText({ title: b.title, description: b.description, from: data.from, due, priority: b.priority as TaskPriority, proofs: b.proofs as TaskProof[], checklist: b.checklist }), taskButtons.assigned(t.id));
    case 'submitted':
      if (t.status !== 'submitted') return { skip: `holat ${t.status}` };
      return toMembers(
        [`📥 <b>Hisobot keldi</b>${b.source === 'self_done' ? ' · o‘zi qo‘shgan ish' : ''}`, title, `👤 ${esc(who)}`, data.reportText ? `💬 ${esc(data.reportText)}` : '', t.spentMinutes ? `⏱ ${t.spentMinutes} daqiqa` : '', data.files.length ? `📎 ${data.files.length} ta fayl quyida` : ''].filter(Boolean).join('\n'),
        taskButtons.review(t.id),
      );
    case 'approved':
      return toEmp(`✅ Vazifa tasdiqlandi: ${title}${t.rating ? `\n⭐️ Baho: ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}` : ''}\n\nRahmat!`);
    case 'revision':
      return toEmp(`🔁 Vazifa qaytarildi: ${title}\n\nSabab: ${esc(data.lastComment ?? '—')}\n\nTuzatib, qaytadan topshiring.`, taskButtons.work(t.id, true));
    case 'cancelled':
      return toEmp(`❌ Vazifa bekor qilindi: ${title}${data.lastComment ? `\nSabab: ${esc(data.lastComment)}` : ''}`);
    case 'comment':
      return toEmp(`💬 Vazifa bo‘yicha xabar: ${title}\n\n${esc(extra.comment ?? '')}`);
    case 'question':
      return toMembers(`❓ <b>Savol</b> · ${esc(who)}\n${title}\n\n${esc(extra.comment ?? '')}`);
    case 'not_accepted':
      if (t.status !== 'new') return { skip: 'qabul qilingan' };
      return toEmp(`⏰ Sizga berilgan vazifa hali qabul qilinmadi: ${title}`, taskButtons.assigned(t.id));
    case 'due_soon':
      if (!['new', 'accepted', 'in_progress', 'revision'].includes(t.status)) return { skip: `holat ${TASK_STATUS_LABELS[t.status]}` };
      return toEmp(`⏳ Muddatga 1 soat qoldi: ${title}${due ? ` (${due})` : ''}`, taskButtons.work(t.id, t.status !== 'new'));
    case 'overdue': {
      if (!isOverdue({ status: t.status, dueAt: t.dueAt }, new Date())) return { skip: 'muddati o‘tmagan yoki topshirilgan' };
      await toEmp(`⚠️ Vazifa muddati o‘tdi: ${title}${due ? ` (${due})` : ''}\nIloji boricha tezroq bajaring.`, taskButtons.work(t.id, t.status !== 'new'));
      const chats = await memberChats(tenantId, data.deptId);
      for (const c of chats ?? []) await send(c.chatId, `⚠️ Muddati o‘tdi: ${title}\n👤 ${esc(who)}${due ? ` · ${due}` : ''}`);
      return {};
    }
  }
}
