import 'server-only';
/**
 * Bot: ruxsat so'rovi (xodim) — «📝 So'rov» → tur → sana(lar) → sabab; rahbar — xabardagi «✅ Tasdiqlash» / «❌ Rad etish».
 * Yozish faqat server/leave.ts orqali.
 */
import { eq } from 'drizzle-orm';
import { memberships, tenants, withTenant } from '@adone/db';
import { addDays, LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, LEAVE_KINDS, LEAVE_STATUS_LABELS, localDate, type LeaveKind, UUID_SRC } from '@adone/core';
import { answerCallback, editMarkup, send } from '@/server/telegram/api';
import type { TgCallback, TgMessage } from '@/server/telegram/types';
import { kick } from '@/server/jobs/enqueue';
import type { JobOutcome } from '@/server/jobs/types';
import { createLeave, decideLeave, leavePeriod, myLeaves } from '@/server/leave';
import { escHtml as esc } from '@/lib/task-text';
import { clearState, setState, type BotState } from './session';
import { employeeLinks, memberLinks } from './links';
import { menuKeyboard, T } from './texts';

export async function startLeave(uid: number, chat: number): Promise<JobOutcome> {
  const links = await employeeLinks(uid);
  if (links.length === 0) {
    await send(chat, T.noInvite);
    return { skip: 'bog‘lanmagan' };
  }
  const l = links[0]!;
  const mine = await withTenant(l.tenantId, (tx) => myLeaves(tx, l.employeeId));
  const recent = mine.slice(0, 3).map((r) => `${LEAVE_KIND_ICONS[r.kind]} ${leavePeriod(r.dateFrom, r.dateTo)} — ${LEAVE_STATUS_LABELS[r.status]}`).join('\n');
  await send(chat, `📝 <b>Ruxsat so'rash</b>\nSababni tanlang:${recent ? `\n\nOxirgi so'rovlar:\n${recent}` : ''}`, {
    inline_keyboard: [
      ...[[0, 1], [2, 3], [4]].map((row) => row.map((i) => ({ text: `${LEAVE_KIND_ICONS[LEAVE_KINDS[i]!]} ${LEAVE_KIND_LABELS[LEAVE_KINDS[i]!]}`, callback_data: `lv:k:${LEAVE_KINDS[i]}` }))),
      [{ text: '✖️ Bekor', callback_data: 'wk:cancel' }],
    ],
  });
  return {};
}

/** «20.10», «20.10.2026», «20.10–22.10» → [from, to] (ISO). */
export function parseDates(text: string, today: string): [string, string] | null {
  const y = Number(today.slice(0, 4));
  const one = (s: string) => {
    const m = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/.exec(s.trim());
    if (!m) return null;
    const yy = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : y;
    const iso = `${yy}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    return new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso) ? iso : null;
  };
  const parts = text.split(/\s*(?:–|—|-{1,2}|gacha|dan)\s*/).filter(Boolean);
  if (parts.length === 1) { const a = one(parts[0]!); return a ? [a, a] : null; }
  if (parts.length === 2) { const a = one(parts[0]!), b = one(parts[1]!); return a && b ? [a, b] : null; }
  return null;
}

export async function onLeaveCallback(cb: TgCallback): Promise<JobOutcome> {
  const uid = cb.from.id;
  const chat = cb.message?.chat.id ?? uid;
  const data = cb.data ?? '';
  const k = /^lv:k:(\w+)$/.exec(data);
  if (k && (LEAVE_KINDS as readonly string[]).includes(k[1]!)) {
    await answerCallback(cb.id);
    const l = (await employeeLinks(uid))[0];
    if (!l) return { skip: 'bog‘lanmagan' };
    await setState(uid, { step: 'leave_dates', tenantId: l.tenantId, employeeId: l.employeeId, kind: k[1]! });
    await send(chat, `${LEAVE_KIND_ICONS[k[1] as LeaveKind]} <b>${LEAVE_KIND_LABELS[k[1] as LeaveKind]}</b>\nQaysi kun(lar)?`, {
      inline_keyboard: [[{ text: 'Bugun', callback_data: 'lv:d:0' }, { text: 'Ertaga', callback_data: 'lv:d:1' }], [{ text: '✖️ Bekor', callback_data: 'wk:cancel' }]],
    });
    await send(chat, "Yoki sanani yozing: <code>25.10</code> yoki <code>25.10–28.10</code>");
    return {};
  }
  const d = /^lv:d:([01])$/.exec(data);
  if (d) {
    await answerCallback(cb.id);
    await pickDays(uid, chat, Number(d[1]));
    return {};
  }
  const m = new RegExp(`^lv:(ok|no):(${UUID_SRC})$`).exec(data);
  if (!m) {
    await answerCallback(cb.id);
    return { skip: `noma'lum: ${data}` };
  }
  // Baza xatosi «Ruxsat yo'q» bo'lib ketmasin — alohida ushlanadi
  let failed: unknown = null;
  for (const link of await memberLinks(uid)) {
    const res = await withTenant(link.tenantId, async (tx) => {
      const [mem] = await tx.select({ role: memberships.role, active: memberships.isActive }).from(memberships).where(eq(memberships.userId, link.userId)).limit(1);
      if (!mem?.active) return null;
      return decideLeave(tx, { tenantId: link.tenantId, id: m[2]!, to: m[1] === 'ok' ? 'approved' : 'rejected', actor: { userId: link.userId, role: mem.role } });
    }).catch((e) => { failed = e; return null; });
    if (!res) continue;
    await answerCallback(cb.id, 'error' in res ? res.error : m[1] === 'ok' ? 'Tasdiqlandi' : 'Rad etildi');
    if (cb.message) await editMarkup(chat, cb.message.message_id);
    if ('error' in res) return { skip: res.error };
    kick();
    await send(chat, m[1] === 'ok' ? '✅ Ruxsat tasdiqlandi — xodimga xabar ketdi.' : '❌ Rad etildi — xodimga xabar ketdi.');
    return {};
  }
  if (failed) {
    console.error('[bot] qaror saqlanmadi', (failed as Error).message);
    await answerCallback(cb.id, 'Xatolik — birozdan keyin qayta bosing');
    return { skip: 'baza xatosi' };
  }
  await answerCallback(cb.id, "Ruxsat yo'q");
  return { skip: 'rahbar emas' };
}

async function pickDays(uid: number, chat: number, offset: number) {
  const { getState } = await import('./session');
  const st = await getState(uid);
  if (st.step !== 'leave_dates') { await send(chat, "Sessiya tugagan. «📝 So'rov»ni qaytadan bosing.", menuKeyboard); return {}; }
  const [t] = await withTenant(st.tenantId, (tx) => tx.select({ tz: tenants.timezone }).from(tenants).limit(1));
  const day = addDays(localDate(new Date(), t!.tz), offset);
  await setState(uid, { step: 'leave_reason', tenantId: st.tenantId, employeeId: st.employeeId, kind: st.kind, from: day, to: day });
  await send(chat, `📅 ${leavePeriod(day, day)}\nSababini qisqacha yozing (yoki «-»):`);
  return {};
}

export function isLeaveState(s: BotState) {
  return s.step === 'leave_dates' || s.step === 'leave_reason';
}

export async function onLeaveMessage(msg: TgMessage, st: BotState): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const text = (msg.text ?? '').trim();
  if (st.step === 'leave_dates') {
    const [t] = await withTenant(st.tenantId, (tx) => tx.select({ tz: tenants.timezone }).from(tenants).limit(1));
    const range = parseDates(text, localDate(new Date(), t!.tz));
    if (!range) { await send(chat, 'Sanani tushunmadim. Masalan: <code>25.10</code> yoki <code>25.10–28.10</code>'); return { skip: 'sana' }; }
    await setState(uid, { step: 'leave_reason', tenantId: st.tenantId, employeeId: st.employeeId, kind: st.kind, from: range[0], to: range[1] });
    await send(chat, `📅 ${leavePeriod(range[0], range[1])}\nSababini qisqacha yozing (yoki «-»):`);
    return {};
  }
  if (st.step !== 'leave_reason') return { skip: 'holat yo‘q' };
  const res = await withTenant(st.tenantId, (tx) => createLeave(tx, { tenantId: st.tenantId, employeeId: st.employeeId, kind: st.kind as LeaveKind, from: st.from, to: st.to, reason: text === '-' ? null : text }));
  if ('error' in res) {
    await clearState(uid);
    await send(chat, `⚠️ ${esc(res.error)}`, menuKeyboard);
    return { skip: res.error };
  }
  await clearState(uid);
  kick();
  await send(chat, `📨 So'rov yuborildi: ${LEAVE_KIND_LABELS[st.kind as LeaveKind]}, ${leavePeriod(st.from, st.to)}.\nRahbar javobi shu yerga keladi.`, menuKeyboard);
  return {};
}
