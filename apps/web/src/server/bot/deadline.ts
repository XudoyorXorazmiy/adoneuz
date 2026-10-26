import 'server-only';
/**
 * Bot: muddatni uzaytirish so'rovi. Xodim — vazifa kartasidagi «⏰ Muddatni uzaytirish» → yangi muddat (tugma yoki «28.10 18:00»)
 * → sabab → so'rov (server/deadline.ts). Rahbar — bildirishnomadagi «✅ Ruxsat» / «❌ Rad etish» (`dl:ok|no:<id>`).
 */
import { eq } from 'drizzle-orm';
import { memberships, tenants, withTenant } from '@adone/db';
import { addDays, canRequestDeadline, formatDateTime, isValidDate, isValidTime, localDate, UUID_SRC, validDeadline, zonedTime, type TaskStatus } from '@adone/core';
import { escHtml as esc } from '@/lib/task-text';
import { createDeadlineRequest, decideDeadlineRequest } from '@/server/deadline';
import { kick } from '@/server/jobs/enqueue';
import type { JobOutcome } from '@/server/jobs/types';
import { answerCallback, editMarkup, send } from '@/server/telegram/api';
import type { TgCallback, TgMessage } from '@/server/telegram/types';
import { employeeLinks, memberLinks, type EmployeeLink } from './links';
import { clearState, getState, setState, type BotState } from './session';
import { menuKeyboard } from './texts';

const cancelKb = { inline_keyboard: [[{ text: '✖️ Bekor', callback_data: 'wk:cancel' }]] };

export function isDeadlineState(s: BotState): boolean {
  return s.step === 'task_deadline';
}

/** «28.10 18:00» / «28.10» (18:00) / «18:00» (bugun) → Date. Yil ko'rsatilmasa — joriy, o'tib ketgan bo'lsa keyingi yil. */
export function parseDue(text: string, today: string, tz: string): Date | null {
  const t = text.trim();
  const m = /^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{4}))?(?:\s+(\d{1,2}:\d{2}))?$/.exec(t);
  if (m) {
    let date = `${m[3] ?? today.slice(0, 4)}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    if (!isValidDate(date)) return null;
    if (!m[3] && date < today) date = `${Number(today.slice(0, 4)) + 1}${date.slice(4)}`;
    const time = m[4] ? m[4].padStart(5, '0') : '18:00';
    return isValidTime(time) ? zonedTime(date, time, tz) : null;
  }
  const h = /^(\d{1,2}:\d{2})$/.exec(t);
  if (h) {
    const time = h[1]!.padStart(5, '0');
    return isValidTime(time) ? zonedTime(today, time, tz) : null;
  }
  return null;
}

export async function startDeadline(uid: number, chat: number, link: EmployeeLink, task: { id: string; title: string; status: TaskStatus; dueAt: Date | null }, tz: string): Promise<JobOutcome> {
  if (!canRequestDeadline(task.status)) {
    await send(chat, 'Bu vazifa uchun muddat so‘rab bo‘lmaydi (topshirilgan yoki yopilgan).', menuKeyboard);
    return { skip: 'ochiq emas' };
  }
  await setState(uid, { step: 'task_deadline', tenantId: link.tenantId, employeeId: link.employeeId, taskId: task.id });
  const cur = task.dueAt ? `Hozirgi muddat: ${formatDateTime(task.dueAt, tz)}\n` : '';
  await send(chat, `⏰ <b>${esc(task.title)}</b>\n${cur}Yangi muddatni tanlang yoki yozing: <code>28.10 18:00</code>`, {
    inline_keyboard: [
      [{ text: 'Ertaga 18:00', callback_data: `dl:p:${task.id}:1` }, { text: '+2 kun', callback_data: `dl:p:${task.id}:2` }, { text: '+3 kun', callback_data: `dl:p:${task.id}:3` }],
      [{ text: '✖️ Bekor', callback_data: 'wk:cancel' }],
    ],
  });
  return {};
}

async function pickDue(uid: number, chat: number, st: Extract<BotState, { step: 'task_deadline' }>, due: Date): Promise<JobOutcome> {
  const [t] = await withTenant(st.tenantId, (tx) => tx.select({ tz: tenants.timezone }).from(tenants).limit(1));
  const err = validDeadline(due, new Date(), null);
  if (err) {
    await send(chat, `⚠️ ${esc(err)}. Qaytadan yozing: <code>28.10 18:00</code>`, cancelKb);
    return { skip: err };
  }
  await setState(uid, { ...st, due: due.toISOString() });
  await send(chat, `📅 Yangi muddat: <b>${formatDateTime(due, t!.tz)}</b>\nSababini qisqacha yozing (yoki «-»):`, cancelKb);
  return {};
}

export async function onDeadlineCallback(cb: TgCallback): Promise<JobOutcome> {
  const uid = cb.from.id;
  const chat = cb.message?.chat.id ?? uid;
  const data = cb.data ?? '';
  const p = new RegExp(`^dl:p:(${UUID_SRC}):([1-7])$`).exec(data);
  if (p) {
    await answerCallback(cb.id);
    const st = await getState(uid);
    if (st.step !== 'task_deadline' || st.taskId !== p[1]) {
      await send(chat, 'Sessiya tugagan. Vazifa kartasidagi «⏰ Muddatni uzaytirish»ni qaytadan bosing.', menuKeyboard);
      return { skip: 'holat yo‘q' };
    }
    const [t] = await withTenant(st.tenantId, (tx) => tx.select({ tz: tenants.timezone }).from(tenants).limit(1));
    const day = addDays(localDate(new Date(), t!.tz), Number(p[2]));
    return pickDue(uid, chat, st, zonedTime(day, '18:00', t!.tz));
  }
  const m = new RegExp(`^dl:(ok|no):(${UUID_SRC})$`).exec(data);
  if (!m) {
    await answerCallback(cb.id);
    return { skip: `noma'lum: ${data}` };
  }
  for (const link of await memberLinks(uid)) {
    const res = await withTenant(link.tenantId, async (tx) => {
      const [mem] = await tx.select({ role: memberships.role, active: memberships.isActive }).from(memberships).where(eq(memberships.userId, link.userId)).limit(1);
      if (!mem?.active) return null;
      return decideDeadlineRequest(tx, { tenantId: link.tenantId, id: m[2]!, to: m[1] === 'ok' ? 'approved' : 'rejected', actor: { userId: link.userId, role: mem.role } });
    }).catch(() => null);
    if (!res) continue;
    await answerCallback(cb.id, 'error' in res ? res.error : m[1] === 'ok' ? 'Uzaytirildi' : 'Rad etildi');
    if (cb.message) await editMarkup(chat, cb.message.message_id);
    if ('error' in res) return { skip: res.error };
    kick();
    await send(chat, m[1] === 'ok' ? '✅ Muddat uzaytirildi — xodimga xabar ketdi.' : '❌ Rad etildi — xodimga xabar ketdi.');
    return {};
  }
  await answerCallback(cb.id, "Ruxsat yo'q");
  return { skip: 'rahbar emas' };
}

export async function onDeadlineMessage(msg: TgMessage, st: BotState): Promise<JobOutcome> {
  if (st.step !== 'task_deadline') return { skip: 'holat yo‘q' };
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const text = (msg.text ?? '').trim();
  const [t] = await withTenant(st.tenantId, (tx) => tx.select({ tz: tenants.timezone }).from(tenants).limit(1));
  if (!st.due) {
    const due = parseDue(text, localDate(new Date(), t!.tz), t!.tz);
    if (!due) {
      await send(chat, 'Sana va vaqtni shunday yozing: <code>28.10 18:00</code> (yoki tugmani bosing).', cancelKb);
      return { skip: 'sana noto‘g‘ri' };
    }
    return pickDue(uid, chat, st, due);
  }
  const link = (await employeeLinks(uid)).find((l) => l.tenantId === st.tenantId);
  if (!link) { await clearState(uid); return { skip: 'bog‘lanmagan' }; }
  const reason = text === '-' ? null : text.slice(0, 500);
  const res = await withTenant(st.tenantId, (tx) => createDeadlineRequest(tx, { tenantId: st.tenantId, taskId: st.taskId, employeeId: st.employeeId, requestedDueAt: new Date(st.due!), reason }));
  await clearState(uid);
  if ('error' in res) {
    await send(chat, `⚠️ ${esc(res.error)}`, menuKeyboard);
    return { skip: res.error };
  }
  kick();
  await send(chat, `📨 So'rov rahbarga yuborildi: <b>${formatDateTime(new Date(st.due), t!.tz)}</b>. Javob kelganda xabar beramiz.`, menuKeyboard);
  return {};
}
