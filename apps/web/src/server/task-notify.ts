import 'server-only';
/**
 * `task_notify` ishi: vazifa bo'yicha Telegram xabarlari. Baza o'qish — withTenant ichida, yuborish — tashqarida.
 * Eslatmalar (not_accepted, due_soon, overdue) yuborish paytida holatni qayta tekshiradi — eskirgan bo'lsa jim o'tadi.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { employees, media, taskBatches, taskEvents, taskReports, tasks, tenants, users, withTenant } from '@adone/db';
import { formatTime, isOverdue, localDate, TASK_STATUS_LABELS, type NotifyEvent, type TaskPriority, type TaskProof } from '@adone/core';
import { dueLabel, escHtml as esc, taskCardText } from '@/lib/task-text';
import { appOrigin, publicApiOrigin, ROOT_DOMAIN } from '@/lib/host';
import { sendFile, send, type Keyboard } from '@/server/telegram/api';
import { memberChats, memberTaskReviewerChats, miniAppKeyboard, miniAppRow, notifyEmployee, notifyUser } from '@/server/notify';
import { getSettings } from '@/server/settings';
import { mediaRoot } from '@/server/media';
import type { JobOutcome } from '@/server/jobs/types';

export type TaskNotifyKind = 'assigned' | 'submitted' | 'approved' | 'revision' | 'cancelled' | 'comment' | 'question' | 'not_accepted' | 'due_soon' | 'overdue' | 'review_stale';

/** Inline tugmalar (callback_data ≤ 64 bayt: «tk:<amal>:<uuid>»). */
export const taskButtons = {
  assigned: (id: string): Keyboard => {
    const rows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string } }>> = [[{ text: '✅ Qabul qildim', callback_data: `tk:acc:${id}` }, { text: '❓ Savol', callback_data: `tk:ask:${id}` }]];
    // Mini App faqat https manzilda ochiladi (prod)
    const mini = `${publicApiOrigin()}/tg/vazifa/${id}`;
    if (mini.startsWith('https://')) rows.push([{ text: 'Mini App’da ochish ↗', web_app: { url: mini } }]);
    return { inline_keyboard: rows };
  },
  /** `ext` — muddat so'rovi tugmasi (faqat xodimga; panel a'zosi muddatni bergan rahbar bilan izohda kelishadi). */
  work: (id: string, started: boolean, ext = true): Keyboard => ({
    inline_keyboard: [
      [started ? { text: '✅ Bajardim', callback_data: `tk:done:${id}` } : { text: '▶️ Boshladim', callback_data: `tk:go:${id}` }, { text: '❓ Savol', callback_data: `tk:ask:${id}` }],
      ...(ext ? [[{ text: '⏰ Muddatni uzaytirish', callback_data: `tk:ext:${id}` }]] : []),
    ],
  }),
  review: (id: string): Keyboard => {
    const rows: Array<Array<{ text: string; callback_data?: string; url?: string; web_app?: { url: string } }>> = [[{ text: '✅ Tasdiqlash', callback_data: `tk:ok:${id}` }, { text: '🔁 Qaytarish', callback_data: `tk:rev:${id}` }]];
    // Rahbar Mini App'i (faqat https) va panel; Telegram localhost havolasini qabul qilmaydi — faqat haqiqiy domen
    rows.push(...miniAppRow(`/tg/vazifa/${id}`));
    if (!ROOT_DOMAIN.includes('localhost')) rows.push([{ text: 'Panelda ochish ↗', url: `${appOrigin()}/vazifalar/${id}` }]);
    return { inline_keyboard: rows };
  },
};

export async function taskNotify(tenantId: string, taskId: string, kind: TaskNotifyKind, extra: { comment?: string | null; by?: string | null } = {}): Promise<JobOutcome> {
  const data = await withTenant(tenantId, async (tx) => {
    const [r] = await tx
      .select({ t: tasks, b: taskBatches, empName: employees.fullName, deptId: employees.departmentId, empUserId: employees.userId, tz: tenants.timezone, userName: users.name })
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
  // Ijrochi: xodim (bot) yoki panel a'zosi (rahbar Telegram'i). A'zoning berilmagan (o'zi qo'shgan) ishida unga xabar ketmaydi.
  const userAssignee = t.assigneeUserId && b.source === 'assigned' ? t.assigneeUserId : null;
  const toEmp = (text: string, kb?: Keyboard) => (t.assigneeEmployeeId ? notifyEmployee(tenantId, t.assigneeEmployeeId, text, kb)
    : userAssignee ? notifyUser(tenantId, userAssignee, text, kb) : Promise.resolve({ skip: 'ijrochi xodim emas' }));
  const work = (started: boolean) => taskButtons.work(t.id, started, !!t.assigneeEmployeeId);
  // Tasdiqlovchilar: a'zo vazifasida — bergan rahbar / egasi (core canReviewMemberTask); xodimnikida — Sozlamalar → Bildirishnomalar
  // (kimga, yoqilganmi), bo'lim boshlig'i bo'lgan ijrochining o'zi chiqariladi
  const reviewers = (event?: NotifyEvent | null, by: string | null = extra.by ?? null) => userAssignee
    ? memberTaskReviewerChats(tenantId, { assigneeUserId: userAssignee, createdByUserId: b.createdByUserId }, event)
    : memberChats(tenantId, data.deptId, by ?? data.empUserId ?? null, { event, creatorUserId: b.createdByUserId });
  const toMembers = async (text: string, kb?: Keyboard, event?: NotifyEvent) => {
    const chats = await reviewers(event);
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

  // Eslatmalar: sozlama keyin o'chirilgan bo'lsa — navbatdagi ish yuborilmaydi
  if (kind === 'not_accepted' || kind === 'due_soon' || kind === 'overdue' || kind === 'review_stale') {
    const r = (await getSettings(tenantId)).reminders;
    const enabled = kind === 'not_accepted' ? r.notAccepted : kind === 'due_soon' ? r.dueSoon : kind === 'overdue' ? r.overdue : r.reviewStale;
    if (!enabled) return { skip: 'eslatma sozlamada o‘chiq' };
  }

  switch (kind) {
    case 'assigned':
      if (t.status !== 'new') return { skip: `holat ${t.status}` };
      return toEmp(taskCardText({ title: b.title, description: b.description, from: data.from, due, priority: b.priority as TaskPriority, proofs: b.proofs as TaskProof[], checklist: b.checklist }), taskButtons.assigned(t.id));
    case 'submitted':
      if (t.status !== 'submitted') return { skip: `holat ${t.status}` };
      return toMembers(
        [`📥 <b>Hisobot keldi</b>${b.source === 'self_done' ? ' · o‘zi qo‘shgan ish' : ''}`, title, `👤 ${esc(who)}`, data.reportText ? `💬 ${esc(data.reportText)}` : '', t.spentMinutes ? `⏱ ${t.spentMinutes} daqiqa` : '', data.files.length ? `📎 ${data.files.length} ta fayl quyida` : ''].filter(Boolean).join('\n'),
        taskButtons.review(t.id),
        'task_submitted',
      );
    case 'approved':
      return toEmp(`✅ Vazifa tasdiqlandi: ${title}${t.rating ? `\n⭐️ Baho: ${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}` : ''}\n\nRahmat!`);
    case 'revision':
      return toEmp(`🔁 Vazifa qaytarildi: ${title}\n\nSabab: ${esc(data.lastComment ?? '—')}\n\nTuzatib, qaytadan topshiring.`, work(true));
    case 'cancelled':
      return toEmp(`❌ Vazifa bekor qilindi: ${title}${data.lastComment ? `\nSabab: ${esc(data.lastComment)}` : ''}`);
    case 'comment':
      return toEmp(`💬 Vazifa bo‘yicha xabar: ${title}\n\n${esc(extra.comment ?? '')}`);
    case 'question':
      return toMembers(`❓ <b>Savol</b> · ${esc(who)}\n${title}\n\n${esc(extra.comment ?? '')}`, miniAppKeyboard(`/tg/vazifa/${t.id}`));
    case 'not_accepted':
      if (t.status !== 'new') return { skip: 'qabul qilingan' };
      return toEmp(`⏰ Sizga berilgan vazifa hali qabul qilinmadi: ${title}`, taskButtons.assigned(t.id));
    case 'due_soon':
      if (!['new', 'accepted', 'in_progress', 'revision'].includes(t.status)) return { skip: `holat ${TASK_STATUS_LABELS[t.status]}` };
      return toEmp(`⏳ Muddatga 1 soat qoldi: ${title}${due ? ` (${due})` : ''}`, work(t.status !== 'new'));
    case 'overdue': {
      if (!isOverdue({ status: t.status, dueAt: t.dueAt }, new Date())) return { skip: 'muddati o‘tmagan yoki topshirilgan' };
      await toEmp(`⚠️ Vazifa muddati o‘tdi: ${title}${due ? ` (${due})` : ''}\nIloji boricha tezroq bajaring.`, work(t.status !== 'new'));
      const chats = await reviewers('task_overdue', null);
      for (const c of chats ?? []) await send(c.chatId, `⚠️ Muddati o‘tdi: ${title}\n👤 ${esc(who)}${due ? ` · ${due}` : ''}`, miniAppKeyboard(`/tg/vazifa/${t.id}`));
      return {};
    }
    case 'review_stale': {
      if (t.status !== 'submitted' || !t.submittedAt || Date.now() - t.submittedAt.getTime() < 23 * 3600_000) return { skip: 'tekshirilgan yoki qayta topshirilgan' };
      const chats = await reviewers('task_submitted', null);
      for (const c of chats ?? []) await send(c.chatId, `⏰ Hisobot 24 soatdan beri tekshirilmagan: ${title}\n👤 ${esc(who)}`, taskButtons.review(t.id));
      return {};
    }
  }
}
