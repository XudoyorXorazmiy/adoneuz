import 'server-only';
/**
 * Bot: vazifalar (CLAUDE.md §7, §7a). Xodim — «📋 Vazifalarim», qabul, boshlash, «Bajardim» + isbot (rasm/video/lokatsiya) + izoh,
 * savol; «➕ Ish qo'shish». Rahbar — hisobotni Telegram'dan tasdiqlash (baho) yoki qaytarish (sabab).
 * Holat o'zgarishi faqat server/tasks.ts orqali (CAS, task_events). Telegram'ga so'rovlar tranzaksiyadan tashqarida.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { memberships, taskBatches, tasks, tenants, withTenant } from '@adone/db';
import { formatTime, localDate, TASK_PROOF_LABELS, TASK_STATUS_LABELS, type TaskProof, type TaskStatus, UUID_SRC } from '@adone/core';
import { answerCallback, downloadFile, editMarkup, send, type Keyboard } from '@/server/telegram/api';
import type { TgCallback, TgMessage } from '@/server/telegram/types';
import { saveMedia } from '@/server/media';
import { kick } from '@/server/jobs/enqueue';
import type { JobOutcome } from '@/server/jobs/types';
import { commentTask, createTasks, proofFlags, selfTasksNeedApproval, transitionTask, type ActorRef } from '@/server/tasks';
import { taskButtons } from '@/server/task-notify';
import { dueLabel, escHtml as esc, proofText } from '@/lib/task-text';
import { clearState, getState, setState, type BotState } from './session';
import { employeeLinks, memberLinks, type EmployeeLink } from './links';
import { menuKeyboard, T } from './texts';
import { startDeadline } from './deadline';

const OPEN: TaskStatus[] = ['new', 'accepted', 'in_progress', 'revision'];
const ICON: Partial<Record<TaskStatus, string>> = { new: '🆕', accepted: '📌', in_progress: '▶️', revision: '🔁', submitted: '⏳' };
const MAX_FILES = 10;

const sendKb = (id: string | null): Keyboard => ({ inline_keyboard: [[{ text: '✅ Yuborish', callback_data: id ? `tk:send:${id}` : 'wk:send' }, { text: '✖️ Bekor', callback_data: 'wk:cancel' }]] });

// ---------------- Ro'yxat ----------------

export async function showMyTasks(uid: number, chat: number): Promise<JobOutcome> {
  const links = await employeeLinks(uid);
  if (links.length === 0) {
    await send(chat, T.noInvite);
    return { skip: 'bog‘lanmagan' };
  }
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  let review = 0;
  for (const l of links) {
    const rows = await withTenant(l.tenantId, async (tx) => {
      const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
      const list = await tx.select({ id: tasks.id, status: tasks.status, dueAt: tasks.dueAt, title: taskBatches.title })
        .from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
        .where(and(eq(tasks.assigneeEmployeeId, l.employeeId), inArray(tasks.status, [...OPEN, 'submitted'])))
        .orderBy(asc(tasks.dueAt)).limit(15);
      return list.map((x) => ({ ...x, tz: t!.tz }));
    });
    for (const r of rows) {
      if (r.status === 'submitted') { review++; continue; }
      const due = r.dueAt ? ` · ${formatTime(r.dueAt, r.tz)}${localDate(r.dueAt, r.tz) !== localDate(new Date(), r.tz) ? ` ${localDate(r.dueAt, r.tz).slice(5).split('-').reverse().join('.')}` : ''}` : '';
      buttons.push([{ text: `${ICON[r.status] ?? ''} ${r.title.slice(0, 40)}${due}`, callback_data: `tk:v:${r.id}` }]);
    }
  }
  const head = buttons.length ? `📋 <b>Ochiq vazifalaringiz: ${buttons.length}</b>\nBirini tanlang:` : '📋 Ochiq vazifa yo‘q.';
  await send(chat, `${head}${review ? `\n\n⏳ Tekshiruvda: ${review}` : ''}`, buttons.length ? { inline_keyboard: buttons.slice(0, 20) } : menuKeyboard);
  return {};
}

// ---------------- Callback'lar ----------------

/** Xodimning shu vazifasi (bir nechta ishxonadan qidiradi). */
async function findAsEmployee(uid: number, taskId: string) {
  for (const l of await employeeLinks(uid)) {
    const row = await withTenant(l.tenantId, async (tx) => {
      const [r] = await tx.select({ t: tasks, b: taskBatches, tz: tenants.timezone }).from(tasks)
        .innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId)).innerJoin(tenants, eq(tenants.id, tasks.tenantId))
        .where(and(eq(tasks.id, taskId), eq(tasks.assigneeEmployeeId, l.employeeId))).limit(1);
      return r;
    });
    if (row) return { link: l, ...row };
  }
  return null;
}

/** Rahbar sifatida: vazifa qaysi ishxonada va uning roli. */
async function findAsMember(uid: number, taskId: string): Promise<{ tenantId: string; actor: ActorRef } | null> {
  for (const m of await memberLinks(uid)) {
    const found = await withTenant(m.tenantId, async (tx) => {
      const [t] = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!t) return null;
      const [mem] = await tx.select({ role: memberships.role, active: memberships.isActive }).from(memberships).where(eq(memberships.userId, m.userId)).limit(1);
      return mem?.active ? mem.role : null;
    });
    if (found) return { tenantId: m.tenantId, actor: { userId: m.userId, role: found } };
  }
  return null;
}

export async function onTaskCallback(cb: TgCallback): Promise<JobOutcome> {
  const uid = cb.from.id;
  const chat = cb.message?.chat.id ?? uid;
  const data = cb.data ?? '';
  if (data === 'wk:cancel') {
    await clearState(uid);
    await answerCallback(cb.id, 'Bekor qilindi');
    await send(chat, 'Bekor qilindi.', menuKeyboard);
    return {};
  }
  if (data === 'wk:send') {
    await answerCallback(cb.id);
    return finishReport(uid, chat);
  }
  if (data === 'wk:done' || data === 'wk:plan') {
    await answerCallback(cb.id);
    return chooseWorkMode(uid, chat, data === 'wk:done' ? 'done' : 'plan');
  }
  const wt = new RegExp(`^wk:t:(${UUID_SRC})$`).exec(data);
  if (wt) {
    await answerCallback(cb.id);
    const link = (await employeeLinks(uid)).find((l) => l.tenantId === wt[1]);
    if (!link) return { skip: 'bog‘lanish yo‘q' };
    return askWorkTitle(uid, chat, link);
  }
  const m = new RegExp(`^tk:(v|acc|go|done|ask|send|ok|rev|rt|ext):(${UUID_SRC})(?::([1-5]))?$`).exec(data);
  if (!m) {
    await answerCallback(cb.id);
    return { skip: `noma'lum callback: ${data}` };
  }
  const [, act, taskId, n] = m as unknown as [string, string, string, string | undefined];

  // Rahbar amallari
  if (act === 'ok' || act === 'rev' || act === 'rt') {
    const who = await findAsMember(uid, taskId);
    if (!who) {
      await answerCallback(cb.id, 'Ruxsat yo‘q');
      return { skip: 'rahbar emas' };
    }
    if (act === 'ok') {
      await answerCallback(cb.id);
      await send(chat, 'Baho qo‘ying:', { inline_keyboard: [[5, 4, 3, 2, 1].map((x) => ({ text: `${x}⭐️`, callback_data: `tk:rt:${taskId}:${x}` }))] });
      return {};
    }
    if (act === 'rev') {
      await answerCallback(cb.id);
      await setState(uid, { step: 'task_revise', tenantId: who.tenantId, userId: who.actor.userId!, taskId });
      await send(chat, '🔁 Qaytarish sababini yozing (xodim shu matnni ko‘radi):');
      return {};
    }
    const res = await withTenant(who.tenantId, (tx) => transitionTask(tx, { tenantId: who.tenantId, taskId, to: 'approved', actor: who.actor, rating: Number(n) || 5 }));
    await answerCallback(cb.id, 'error' in res ? res.error : 'Tasdiqlandi');
    if (cb.message) await editMarkup(chat, cb.message.message_id);
    if ('error' in res) {
      await send(chat, `⚠️ ${esc(res.error)}`);
      return { skip: res.error };
    }
    kick();
    await send(chat, `✅ Tasdiqlandi · ${'⭐️'.repeat(Number(n) || 5)}`);
    return {};
  }

  // Xodim amallari
  const f = await findAsEmployee(uid, taskId);
  if (!f) {
    await answerCallback(cb.id, 'Vazifa topilmadi');
    return { skip: 'vazifa topilmadi' };
  }
  const actor: ActorRef = { employeeId: f.link.employeeId };
  if (act === 'v') {
    await answerCallback(cb.id);
    const today = localDate(new Date(), f.tz);
    const due = f.t.dueAt ? dueLabel(localDate(f.t.dueAt, f.tz), formatTime(f.t.dueAt, f.tz), today) : null;
    const text = [`📋 <b>${esc(f.b.title)}</b>`, f.b.description ? esc(f.b.description) : '', `Holat: ${TASK_STATUS_LABELS[f.t.status]}`, due ? `⏰ Muddat: ${due}` : '', `📷 Hisobot: ${proofText(f.b.proofs as TaskProof[])}`,
      f.b.checklist.length ? `☑️ ${f.b.checklist.map(esc).join(' · ')}` : ''].filter(Boolean).join('\n');
    const kb = f.t.status === 'new' ? taskButtons.assigned(f.t.id) : OPEN.includes(f.t.status) ? taskButtons.work(f.t.id, f.t.status === 'in_progress' || f.t.status === 'revision') : undefined;
    await send(chat, text, kb);
    return {};
  }
  if (act === 'acc' || act === 'go') {
    const to: TaskStatus = act === 'acc' ? 'accepted' : 'in_progress';
    const res = await withTenant(f.link.tenantId, (tx) => transitionTask(tx, { tenantId: f.link.tenantId, taskId, to, actor }));
    await answerCallback(cb.id, 'error' in res ? res.error : act === 'acc' ? 'Qabul qilindi' : 'Boshlandi');
    if (cb.message) await editMarkup(chat, cb.message.message_id);
    if ('error' in res) return { skip: res.error };
    await send(chat, act === 'acc' ? `✅ Qabul qilindi: <b>${esc(f.b.title)}</b>\nIshni boshlaganda «▶️ Boshladim», tugatgach «✅ Bajardim».` : `▶️ Boshlandi: <b>${esc(f.b.title)}</b>`, taskButtons.work(taskId, act === 'go'));
    return {};
  }
  if (act === 'ext') {
    await answerCallback(cb.id);
    return startDeadline(uid, chat, f.link, { id: taskId, title: f.b.title, status: f.t.status, dueAt: f.t.dueAt }, f.tz);
  }
  if (act === 'ask') {
    await answerCallback(cb.id);
    await setState(uid, { step: 'task_ask', tenantId: f.link.tenantId, employeeId: f.link.employeeId, taskId });
    await send(chat, '❓ Savolingizni yozing — rahbaringizga yuboriladi:');
    return {};
  }
  if (act === 'done') {
    await answerCallback(cb.id);
    if (!OPEN.includes(f.t.status)) {
      await send(chat, `Bu vazifa holati: ${TASK_STATUS_LABELS[f.t.status]}.`, menuKeyboard);
      return { skip: 'ochiq emas' };
    }
    await setState(uid, { step: 'task_report', tenantId: f.link.tenantId, employeeId: f.link.employeeId, taskId, mediaIds: [] });
    const need = (f.b.proofs as TaskProof[]).filter((p) => p !== 'button');
    await send(chat, [
      `✅ <b>Hisobot</b>: ${esc(f.b.title)}`,
      need.length ? `Talab: <b>${need.map((p) => TASK_PROOF_LABELS[p].toLowerCase()).join(' + ')}</b>.${need.includes('location') ? '\n📍 Lokatsiya: 📎 → Joylashuv.' : ''}` : 'Rasm yoki izoh ixtiyoriy.',
      '\nYuboring, keyin izoh yozing yoki «✅ Yuborish»ni bosing.',
    ].join('\n'), sendKb(taskId));
    return {};
  }
  // send
  await answerCallback(cb.id);
  return finishReport(uid, chat);
}

// ---------------- Xabarlar (holatga qarab) ----------------

export function isTaskState(s: BotState): boolean {
  return s.step === 'task_report' || s.step === 'task_ask' || s.step === 'task_revise' || s.step === 'work_title' || s.step === 'work_mode';
}

export async function onTaskMessage(msg: TgMessage, state: BotState): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const text = (msg.text ?? msg.caption ?? '').trim();
  if (state.step === 'task_ask') {
    if (!text) { await send(chat, 'Savolni matn bilan yozing.'); return { skip: 'matn yo‘q' }; }
    const res = await withTenant(state.tenantId, (tx) => commentTask(tx, { tenantId: state.tenantId, taskId: state.taskId, actor: { employeeId: state.employeeId }, comment: text }));
    await clearState(uid);
    kick();
    await send(chat, 'error' in res ? `⚠️ ${esc(res.error)}` : '📨 Savolingiz rahbarga yuborildi.', menuKeyboard);
    return {};
  }
  if (state.step === 'task_revise') {
    if (!text) { await send(chat, 'Sababni matn bilan yozing.'); return { skip: 'matn yo‘q' }; }
    const res = await withTenant(state.tenantId, async (tx) => {
      const [m] = await tx.select({ role: memberships.role }).from(memberships).where(eq(memberships.userId, state.userId)).limit(1);
      if (!m) return { error: 'Ruxsat yo‘q' };
      return transitionTask(tx, { tenantId: state.tenantId, taskId: state.taskId, to: 'revision', actor: { userId: state.userId, role: m.role }, comment: text });
    });
    await clearState(uid);
    kick();
    await send(chat, 'error' in res ? `⚠️ ${esc(res.error)}` : '🔁 Qaytarildi — xodimga sabab bilan xabar ketdi.');
    return {};
  }
  if (state.step === 'work_title') {
    if (text.length < 3) { await send(chat, 'Ish nomini matn bilan yozing (kamida 3 harf).'); return { skip: 'qisqa' }; }
    await setState(uid, { step: 'work_mode', tenantId: state.tenantId, employeeId: state.employeeId, title: text.slice(0, 200) });
    await send(chat, `<b>${esc(text.slice(0, 200))}</b>\n\nBu ish bajarildimi yoki reja?`, { inline_keyboard: [[{ text: '✅ Bajardim', callback_data: 'wk:done' }, { text: '🗓 Rejalashtiraman', callback_data: 'wk:plan' }], [{ text: '✖️ Bekor', callback_data: 'wk:cancel' }]] });
    return {};
  }
  if (state.step === 'work_mode') {
    await send(chat, 'Tugmalardan birini tanlang: «✅ Bajardim» yoki «🗓 Rejalashtiraman».');
    return { skip: 'tugma kutilmoqda' };
  }
  if (state.step !== 'task_report') return { skip: 'holat yo‘q' };

  // Hisobot: fayl / lokatsiya / izoh
  if (msg.forward_origin || msg.forward_date) {
    await send(chat, 'Forward qilingan xabar isbot sifatida qabul qilinmaydi — o‘zingiz yuboring.');
    return { skip: 'forward' };
  }
  const file = msg.photo?.length ? { id: msg.photo[msg.photo.length - 1]!.file_id, mime: 'image/jpeg', ext: 'jpg' }
    : msg.video ? { id: msg.video.file_id, mime: msg.video.mime_type ?? 'video/mp4', ext: 'mp4' }
      : msg.video_note ? { id: msg.video_note.file_id, mime: 'video/mp4', ext: 'mp4' } : null;
  if (file) {
    if (state.mediaIds.length >= MAX_FILES) { await send(chat, `Ko‘pi bilan ${MAX_FILES} ta fayl.`); return { skip: 'ko‘p fayl' }; }
    const dl = await downloadFile(file.id);
    const id = await withTenant(state.tenantId, (tx) => saveMedia(tx, { tenantId: state.tenantId, employeeId: state.employeeId, kind: 'task_report', data: dl.data, mime: file.mime, ext: file.ext }));
    const next = { ...state, mediaIds: [...state.mediaIds, id], text: text || state.text };
    await setState(uid, next);
    await send(chat, `📎 Qabul qilindi (${next.mediaIds.length}). Yana yuboring, izoh yozing yoki «✅ Yuborish».`, sendKb(state.taskId));
    return {};
  }
  if (msg.location) {
    await setState(uid, { ...state, lat: msg.location.latitude, lng: msg.location.longitude });
    await send(chat, '📍 Lokatsiya qabul qilindi. Izoh yozing yoki «✅ Yuborish».', sendKb(state.taskId));
    return {};
  }
  if (text) {
    await setState(uid, { ...state, text: text.slice(0, 1000) });
    return finishReport(uid, chat);
  }
  await send(chat, 'Rasm, video, lokatsiya yoki izoh yuboring.', sendKb(state.taskId));
  return { skip: 'kutilmagan xabar' };
}

/** Hisobotni topshirish: isbot yetarlimi — serverda (missingProofs); yetmasa holat saqlanadi, xodim to'ldiradi. */
async function finishReport(uid: number, chat: number): Promise<JobOutcome> {
  const state = await getState(uid);
  if (state.step !== 'task_report') {
    await send(chat, 'Hisobot sessiyasi tugagan. «📋 Vazifalarim»dan qaytadan boshlang.', menuKeyboard);
    return { skip: 'sessiya yo‘q' };
  }
  const res = await withTenant(state.tenantId, async (tx) => {
    const got = await proofFlags(tx, state.mediaIds, state.lat != null);
    const report = { text: state.text ?? null, mediaIds: state.mediaIds, lat: state.lat ?? null, lng: state.lng ?? null, source: 'bot' as const, got };
    if (!state.taskId) {
      const needs = await selfTasksNeedApproval(tx);
      await createTasks(tx, {
        tenantId: state.tenantId, source: 'self_done', title: state.title ?? 'Ish', priority: 'medium', proofs: ['button'], checklist: [], dueAt: null,
        assignees: [{ employeeId: state.employeeId }], createdBy: { employeeId: state.employeeId }, needsApproval: needs, report,
      });
      return { ok: true as const, self: true, needs };
    }
    const r = await transitionTask(tx, { tenantId: state.tenantId, taskId: state.taskId, to: 'submitted', actor: { employeeId: state.employeeId }, report, comment: state.text ?? null });
    return 'error' in r ? r : { ok: true as const, self: false, needs: true };
  });
  if ('error' in res) {
    await send(chat, `⚠️ ${esc(res.error)}`, sendKb(state.taskId));
    return { skip: res.error };
  }
  await clearState(uid);
  kick();
  await send(chat, res.self ? (res.needs ? '✅ Ish qayd etildi — rahbaringiz tasdiqlaydi.' : '✅ Ish qayd etildi.') : '✅ Hisobot yuborildi — rahbar tekshiradi. Natija shu yerga keladi.', menuKeyboard);
  return {};
}

// ---------------- «➕ Ish qo'shish» ----------------

export async function startAddWork(uid: number, chat: number): Promise<JobOutcome> {
  const links = await employeeLinks(uid);
  if (links.length === 0) {
    await send(chat, T.noInvite);
    return { skip: 'bog‘lanmagan' };
  }
  if (links.length > 1) {
    await send(chat, T.pickCompany, { inline_keyboard: links.map((l) => [{ text: l.tenantName, callback_data: `wk:t:${l.tenantId}` }]) });
    return {};
  }
  return askWorkTitle(uid, chat, links[0]!);
}

async function askWorkTitle(uid: number, chat: number, link: EmployeeLink): Promise<JobOutcome> {
  await setState(uid, { step: 'work_title', tenantId: link.tenantId, employeeId: link.employeeId });
  await send(chat, "➕ <b>Ish qo'shish</b>\n\nQanday ish qildingiz yoki qilmoqchisiz? Qisqacha yozing:", { inline_keyboard: [[{ text: '✖️ Bekor', callback_data: 'wk:cancel' }]] });
  return {};
}

async function chooseWorkMode(uid: number, chat: number, mode: 'done' | 'plan'): Promise<JobOutcome> {
  const state = await getState(uid);
  if (state.step !== 'work_mode') {
    await send(chat, "Sessiya tugagan. «➕ Ish qo'shish»ni qaytadan bosing.", menuKeyboard);
    return { skip: 'sessiya yo‘q' };
  }
  if (mode === 'plan') {
    await withTenant(state.tenantId, (tx) => createTasks(tx, {
      tenantId: state.tenantId, source: 'self_plan', title: state.title, priority: 'medium', proofs: ['button'], checklist: [], dueAt: null,
      assignees: [{ employeeId: state.employeeId }], createdBy: { employeeId: state.employeeId },
    }));
    await clearState(uid);
    await send(chat, `🗓 Rejaga qo'shildi: <b>${esc(state.title)}</b>\nBajargach «📋 Vazifalarim» → «✅ Bajardim».`, menuKeyboard);
    return {};
  }
  await setState(uid, { step: 'task_report', tenantId: state.tenantId, employeeId: state.employeeId, taskId: null, title: state.title, mediaIds: [] });
  await send(chat, 'Rasm yoki video yuboring (ixtiyoriy), keyin izoh yozing yoki «✅ Yuborish».\nIzohda qancha vaqt ketganini ham yozishingiz mumkin.', sendKb(null));
  return {};
}
