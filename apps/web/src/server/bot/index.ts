import 'server-only';
/**
 * Platforma boti (@adoneuz_bot). Webhook → tg_updates (idempotent) → jobs `tg_update` → shu yerda.
 * Qoidalar: tenant faqat tg_links / taklif kodidan (CLAUDE.md §1.1); isbot serverda tekshiriladi (§1.3);
 * davomat — append-only jurnal (§1.2). Telegram'ga so'rovlar tranzaksiyadan TASHQARIDA.
 */
import { and, eq, gt, isNull } from 'drizzle-orm';
import { attendanceEvents, branches, consents, employees, invites, onLeave, rebuildDay, tenants, users, withPlatform, withTenant, workdayOf, dayEvents, employeeRule } from '@adone/db';
import { checkGeofence, faceDecision, computeDay, formatDistance, formatMinutes, formatPhone, formatTime, nextAction, normalizePhone, shiftFor, UUID_SRC, workdayFor } from '@adone/core';
import { appOrigin } from '@/lib/host';
import { issueTelegramLogin } from '@/server/team';
import { answerCallback, downloadFile, esc, send } from '@/server/telegram/api';
import type { TgCallback, TgMessage, TgUpdate } from '@/server/telegram/types';
import { insertMedia, writeMediaFile } from '@/server/media';
import { queueNotifyMembers, queueSuspicious } from '@/server/notify';
import { enqueue, kick } from '@/server/jobs/enqueue';
import { faceContext, verifyFace } from '@/server/face';
import type { JobOutcome } from '@/server/jobs/types';
import { clearState, getState, SESSION_TTL_MS, setState, type BotState } from './session';
import { arrivedAt, firstAttempt } from './context';
import { employeeLinks, linkTelegram, type EmployeeLink } from './links';
import { isTaskState, onTaskCallback, onTaskMessage, showMyTasks, startAddWork } from './tasks';
import { isLeaveState, onLeaveCallback, onLeaveMessage, startLeave } from './leave';
import { isDeadlineState, onDeadlineCallback, onDeadlineMessage } from './deadline';
import { BTN, CONSENT_VERSION, consentKeyboard, contactKeyboard, menuKeyboard, removeKeyboard, T } from './texts';

/** Jonli joylashuv xabari shundan eski bo'lsa — eskirgan (forward/qayta yuborish). */
const LOCATION_MAX_AGE_SEC = 120;

export async function processUpdate(u: TgUpdate): Promise<JobOutcome> {
  if (u.callback_query) return onCallback(u.callback_query);
  const msg = u.message;
  if (!msg?.from || msg.from.is_bot) return { skip: 'xabar yo‘q' };
  if (msg.chat.type !== 'private') return { skip: 'guruh' };
  const uid = msg.from.id;
  const chat = msg.chat.id;
  const text = msg.text?.trim() ?? '';

  if (text.startsWith('/start')) {
    const payload = text.split(/\s+/)[1] ?? '';
    if (payload.startsWith('inv_')) return startInvite(msg, payload.slice(4));
    if (payload.startsWith('mem_')) return linkMember(msg, payload.slice(4));
    const links = await employeeLinks(uid);
    await send(chat, links.length ? T.help : T.noInvite, links.length ? menuKeyboard : removeKeyboard);
    return {};
  }
  if (msg.contact) return onContact(msg);
  if (text === BTN.tasks || text === '/vazifalar') return showMyTasks(uid, chat);
  if (text === BTN.addWork || text === '/ish') return startAddWork(uid, chat);
  if (text === BTN.leave || text === '/sorov') return startLeave(uid, chat);
  // Vazifa sessiyasi (hisobot fayli, lokatsiya, izoh, savol) — menyu tugmalari bosilmagan bo'lsa shu yerga
  const menuTexts: string[] = Object.values(BTN);
  if (!menuTexts.includes(text)) {
    const st = await getState(uid);
    if (isTaskState(st)) return onTaskMessage(msg, st);
    if (isLeaveState(st) && msg.text) return onLeaveMessage(msg, st);
    if (isDeadlineState(st) && msg.text) return onDeadlineMessage(msg, st);
  }
  if (msg.location) return onLocation(msg);
  if (msg.video_note) return onVideoNote(msg);
  if (text === BTN.checkIn || text === '/keldim') return startAction(msg, 'check_in');
  if (text === BTN.checkOut || text === '/ketdim') return startAction(msg, 'check_out');
  if (text === BTN.today || text === '/bugun') return showToday(msg);
  if (text === '/yuz') return startResample(msg);
  if (text === BTN.help || text === '/yordam') {
    await send(chat, T.help, menuKeyboard);
    return {};
  }
  const state = await getState(uid);
  if (msg.photo || msg.video) {
    if (state.step === 'reg_face' || state.step === 'ci_video') {
      await send(chat, T.needVideoNote);
      return {};
    }
  }
  const links = await employeeLinks(uid);
  await send(chat, links.length ? T.unknown : T.noInvite, links.length ? menuKeyboard : undefined);
  return {};
}

// ---------------- Ro'yxatdan o'tish ----------------

async function startInvite(msg: TgMessage, code: string): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const inv = await withPlatform(async (tx) => {
    const [r] = await tx
      .select({ code: invites.code, tenantId: invites.tenantId, refId: invites.refId, kind: invites.kind, expiresAt: invites.expiresAt, usedAt: invites.usedAt, tenantName: tenants.name, tenantStatus: tenants.status })
      .from(invites)
      .innerJoin(tenants, eq(tenants.id, invites.tenantId))
      .where(eq(invites.code, code))
      .limit(1);
    return r;
  });
  if (!inv || inv.kind !== 'employee' || inv.usedAt || inv.expiresAt < new Date() || inv.tenantStatus === 'blocked' || inv.tenantStatus === 'archived') {
    await send(chat, T.badInvite, removeKeyboard);
    return { skip: 'yaroqsiz taklif' };
  }
  const emp = await withTenant(inv.tenantId, async (tx) => (await tx.select().from(employees).where(eq(employees.id, inv.refId)).limit(1))[0]);
  if (!emp || emp.status === 'disabled') {
    await send(chat, T.badInvite, removeKeyboard);
    return { skip: 'xodim yo‘q' };
  }
  await setState(uid, { step: 'reg_contact', tenantId: inv.tenantId, employeeId: emp.id, code });
  await send(chat, T.welcome(esc(inv.tenantName), esc(emp.fullName)), contactKeyboard);
  return {};
}

async function onContact(msg: TgMessage): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const state = await getState(uid);
  if (state.step === 'mem_contact') return finishMemberLink(msg, state);
  if (state.step !== 'reg_contact') {
    await send(chat, T.unknown);
    return { skip: 'kontakt kutilmagan' };
  }
  if (msg.contact!.user_id !== uid) {
    await send(chat, T.ownContactOnly, contactKeyboard);
    return { skip: 'begona kontakt' };
  }
  const phone = normalizePhone(msg.contact!.phone_number);
  const err = await withTenant(state.tenantId, async (tx) => {
    const [e] = await tx.select().from(employees).where(eq(employees.id, state.employeeId)).limit(1);
    if (!e) return T.badInvite;
    if (e.phone && phone && e.phone !== phone) return T.phoneMismatch;
    const [taken] = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.telegramUserId, uid))).limit(1);
    if (taken && taken.id !== e.id) return T.tgTaken;
    await tx.update(employees).set({ phone: e.phone ?? phone, telegramUserId: uid, telegramUsername: msg.from!.username ?? null }).where(eq(employees.id, e.id));
    return null;
  });
  if (err) {
    await send(chat, err, removeKeyboard);
    return { skip: 'kontakt rad etildi' };
  }
  await setState(uid, { ...state, step: 'reg_consent' });
  await send(chat, '✅ Raqam qabul qilindi.', removeKeyboard);
  await send(chat, T.consent, consentKeyboard);
  return {};
}

async function onCallback(cb: TgCallback): Promise<JobOutcome> {
  const uid = cb.from.id;
  const chat = cb.message?.chat.id ?? uid;
  const data = cb.data ?? '';
  if (data === 'consent:yes' || data === 'consent:no') {
    const state = await getState(uid);
    if (state.step !== 'reg_consent') {
      await answerCallback(cb.id);
      return { skip: 'rozilik kutilmagan' };
    }
    if (data === 'consent:no') {
      await answerCallback(cb.id);
      await send(chat, T.consentNo, consentKeyboard);
      return {};
    }
    await withTenant(state.tenantId, (tx) => tx.insert(consents).values({ tenantId: state.tenantId, employeeId: state.employeeId, kind: 'biometric', version: CONSENT_VERSION }));
    await setState(uid, { ...state, step: 'reg_face' });
    await answerCallback(cb.id, 'Rahmat!');
    await send(chat, T.faceAsk);
    return {};
  }
  if (data.startsWith('tk:') || data.startsWith('wk:')) return onTaskCallback(cb);
  if (data.startsWith('lv:')) return onLeaveCallback(cb);
  if (data.startsWith('dl:')) return onDeadlineCallback(cb);
  // Bir nechta ishxona: act:<check_in|check_out>:<tenantId>
  const m = new RegExp(`^act:(check_in|check_out):(${UUID_SRC})$`).exec(data);
  if (m) {
    await answerCallback(cb.id);
    const link = (await employeeLinks(uid)).find((l) => l.tenantId === m[2]);
    if (!link) return { skip: 'bog‘lanish yo‘q' };
    return beginAction(uid, chat, link, m[1] as 'check_in' | 'check_out');
  }
  await answerCallback(cb.id);
  return { skip: `noma'lum callback: ${data}` };
}

async function onVideoNote(msg: TgMessage): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const state = await getState(uid);
  // Telegram'dan faylni olish sekin bo'lishi mumkin (yuz tekshiruvi ham) — xodim kutayotganini bilsin; qayta urinishda takrorlanmaydi
  if ((state.step === 'reg_face' || state.step === 'ci_video' || state.step === 'face_resample') && firstAttempt()) {
    await send(chat, '📥 Video qabul qilindi, tekshirilmoqda…').catch(() => undefined);
  }
  if (state.step === 'reg_face') return finishRegistration(msg, state);
  if (state.step === 'ci_video') return finishCheckIn(msg, state);
  if (state.step === 'face_resample') return finishResample(msg, state);
  const links = await employeeLinks(uid);
  await send(chat, links.length ? `Avval «${BTN.checkIn}» tugmasini bosing.` : T.noInvite, links.length ? menuKeyboard : undefined);
  return { skip: 'video kutilmagan' };
}

async function finishRegistration(msg: TgMessage, state: Extract<BotState, { step: 'reg_face' }>): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const file = await downloadFile(msg.video_note!.file_id);
  const stored = await writeMediaFile({ tenantId: state.tenantId, employeeId: state.employeeId, kind: 'face_sample', data: file.data, mime: 'video/mp4', ext: 'mp4', durationSec: msg.video_note!.duration });
  const res = await withTenant(state.tenantId, async (tx) => {
    const [t] = await tx.select({ name: tenants.name, settings: tenants.settings }).from(tenants).limit(1);
    const [e] = await tx.select().from(employees).where(eq(employees.id, state.employeeId)).limit(1);
    if (!t || !e) return null;
    const sampleId = await insertMedia(tx, stored);
    await enqueue(tx, state.tenantId, 'face_enroll', { employeeId: e.id, mediaId: sampleId }, { maxAttempts: 5 });
    const autoApprove = t.settings?.autoApprove === true;
    await tx.update(employees).set({ status: autoApprove ? 'active' : 'pending', joinedAt: autoApprove ? new Date() : e.joinedAt }).where(eq(employees.id, e.id));
    await queueNotifyMembers(
      tx, state.tenantId,
      autoApprove
        ? `👤 Yangi xodim ro'yxatdan o'tdi: <b>${esc(e.fullName)}</b>.`
        : `👤 <b>${esc(e.fullName)}</b> botda ro'yxatdan o'tdi — tasdiqlang: Mini App → Qarorlar yoki panelda Xodimlar → «Tasdiq kutmoqda».`,
      e.departmentId, 'new_employee', '/tg/qarorlar',
    );
    return { company: t.name, active: autoApprove };
  });
  if (!res) {
    await send(chat, T.badInvite);
    return { skip: 'xodim topilmadi' };
  }
  await withPlatform((tx) => tx.update(invites).set({ usedAt: new Date() }).where(and(eq(invites.code, state.code), isNull(invites.usedAt))));
  await linkTelegram({ tgUserId: uid, chatId: chat, tenantId: state.tenantId, kind: 'employee', refId: state.employeeId });
  await clearState(uid);
  kick();
  await send(chat, res.active ? T.approved(esc(res.company)) : T.registered(esc(res.company)), res.active ? menuKeyboard : removeKeyboard);
  return {};
}

/** Panel foydalanuvchisi (rahbar) Telegram'ini bildirishnomalar uchun bog'laydi: /start mem_<kod>. */
/**
 * Rahbar Telegram'i (/start mem_<kod>). Havola begonaga yetib qolsa parol/bildirishnoma unga ketmasin: xodim oqimidagidek
 * avval kontakt (o'ziniki) so'raladi va paneldagi raqam bilan solishtiriladi; kod shundan keyingina ishlatilgan bo'ladi.
 */
async function linkMember(msg: TgMessage, code: string): Promise<JobOutcome> {
  const chat = msg.chat.id;
  const inv = await withPlatform(async (tx) => {
    const [r] = await tx.select({ i: invites, name: tenants.name, status: tenants.status }).from(invites).innerJoin(tenants, eq(tenants.id, invites.tenantId)).where(eq(invites.code, code)).limit(1);
    if (!r || (r.i.kind !== 'member' && r.i.kind !== 'member_login') || r.i.usedAt || r.i.expiresAt < new Date()) return null;
    return r;
  });
  if (!inv) {
    await send(chat, T.badInvite);
    return { skip: 'yaroqsiz kod' };
  }
  if (inv.status === 'blocked' || inv.status === 'archived') {
    await send(chat, T.tenantInactive);
    return { skip: 'ishxona faol emas' };
  }
  await setState(msg.from!.id, { step: 'mem_contact', tenantId: inv.i.tenantId, userId: inv.i.refId, code, login: inv.i.kind === 'member_login' });
  await send(chat, T.memberContact(esc(inv.name)), contactKeyboard);
  return {};
}

async function finishMemberLink(msg: TgMessage, state: Extract<BotState, { step: 'mem_contact' }>): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  if (msg.contact!.user_id !== uid) {
    await send(chat, T.ownContactOnly, contactKeyboard);
    return { skip: 'begona kontakt' };
  }
  const phone = normalizePhone(msg.contact!.phone_number);
  const res = await withPlatform(async (tx) => {
    const [u] = await tx.select({ phone: users.phone }).from(users).where(eq(users.id, state.userId)).limit(1);
    if (!u || !phone || u.phone !== phone) return 'mismatch' as const;
    // Bir martalik — atomik: ikki hisobdan bir vaqtda bosilsa ham faqat bittasi oladi
    const [used] = await tx.update(invites).set({ usedAt: new Date() })
      .where(and(eq(invites.code, state.code), isNull(invites.usedAt), gt(invites.expiresAt, new Date()))).returning({ tenantId: invites.tenantId });
    if (!used) return 'invalid' as const;
    const [t] = await tx.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, used.tenantId)).limit(1);
    return { name: t?.name ?? '' };
  });
  await clearState(uid);
  if (res === 'mismatch') {
    await send(chat, T.memberPhoneMismatch, removeKeyboard);
    return { skip: 'raqam mos emas' };
  }
  if (res === 'invalid') {
    await send(chat, T.badInvite, removeKeyboard);
    return { skip: 'yaroqsiz kod' };
  }
  await linkTelegram({ tgUserId: uid, chatId: chat, tenantId: state.tenantId, kind: 'member', refId: state.userId });
  await send(chat, T.memberLinked(esc(res.name)), removeKeyboard);
  // Jamoaga «Telegram orqali taklif» bilan qo'shilgan — panelga kirish ma'lumoti shu yerga
  if (state.login) {
    const cred = await issueTelegramLogin(state.tenantId, state.userId);
    if (cred) await send(chat, T.memberCredentials(appOrigin(), formatPhone(cred.phone), cred.password));
  }
  return {};
}

// ---------------- Keldi / ketdi ----------------

async function startAction(msg: TgMessage, action: 'check_in' | 'check_out'): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const links = await employeeLinks(uid);
  if (links.length === 0) {
    await send(chat, T.noInvite, removeKeyboard);
    return { skip: 'bog‘lanmagan' };
  }
  if (links.length > 1) {
    await send(chat, T.pickCompany, { inline_keyboard: links.map((l) => [{ text: l.tenantName, callback_data: `act:${action}:${l.tenantId}` }]) });
    return {};
  }
  return beginAction(uid, chat, links[0]!, action);
}

async function beginAction(uid: number, chat: number, link: EmployeeLink, action: 'check_in' | 'check_out'): Promise<JobOutcome> {
  const err = await withTenant(link.tenantId, async (tx) => {
    const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
    const [e] = await tx.select().from(employees).where(eq(employees.id, link.employeeId)).limit(1);
    if (!e || e.status === 'disabled') return T.disabled;
    if (e.status !== 'active') return T.notActive;
    if (!e.branchId) return T.noBranch;
    const wd = await workdayOf(tx, e.id, new Date(), t!.tz);
    const evs = await dayEvents(tx, e.id, wd.date);
    // Kecha tungi smenadan chiqmagan bo'lsa ham ketishga ruxsat (ish kuni workdayOf'dan)
    const next = nextAction(evs);
    if (action === 'check_in' && next === 'check_out') return T.alreadyIn;
    if (action === 'check_out' && next === 'check_in') return T.notIn;
    return null;
  });
  if (err) {
    await send(chat, err, menuKeyboard);
    return { skip: 'amal mumkin emas' };
  }
  await setState(uid, { step: 'ci_location', tenantId: link.tenantId, employeeId: link.employeeId, action, startedAt: Date.now() });
  await send(chat, T.locAsk(action));
  return {};
}

async function onLocation(msg: TgMessage): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const state = await getState(uid);
  if (state.step !== 'ci_location') {
    const links = await employeeLinks(uid);
    await send(chat, links.length ? `Avval «${BTN.checkIn}» yoki «${BTN.checkOut}» tugmasini bosing.` : T.noInvite, links.length ? menuKeyboard : undefined);
    return { skip: 'lokatsiya kutilmagan' };
  }
  if (arrivedAt() - state.startedAt > SESSION_TTL_MS) {
    await clearState(uid);
    await send(chat, T.expired, menuKeyboard);
    return { skip: 'muddat o‘tdi' };
  }
  const loc = msg.location!;
  if (msg.forward_origin || msg.forward_date) {
    await send(chat, T.forwarded);
    return { skip: 'forward' };
  }
  if (!loc.live_period) {
    await send(chat, T.notLive);
    return { skip: 'jonli emas' };
  }
  if (Math.floor(arrivedAt() / 1000) - msg.date > LOCATION_MAX_AGE_SEC) {
    await send(chat, T.stale);
    return { skip: 'eskirgan' };
  }
  const accuracy = loc.horizontal_accuracy != null ? Math.round(loc.horizontal_accuracy) : null;

  const out = await withTenant(state.tenantId, async (tx) => {
    const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
    const [e] = await tx.select().from(employees).where(eq(employees.id, state.employeeId)).for('update').limit(1); // Mini App bilan bir vaqtda — ketma-ket
    if (!e?.branchId) return { kind: 'error' as const, text: T.noBranch };
    const [b] = await tx.select().from(branches).where(eq(branches.id, e.branchId)).limit(1);
    if (!b) return { kind: 'error' as const, text: T.noBranch };
    const g = checkGeofence({ branch: { lat: b.lat, lng: b.lng, radiusM: b.radiusM }, point: { lat: loc.latitude, lng: loc.longitude }, accuracyM: accuracy });
    // Vaqt — xabar serverga kelgan payt (Telegram sekinlashib ish qayta urinilsa ham to'g'ri)
    const at = new Date(arrivedAt());
    const wd = await workdayOf(tx, e.id, at, t!.tz);
    const base = {
      tenantId: state.tenantId, employeeId: e.id, workDate: wd.date, branchId: b.id, lat: loc.latitude, lng: loc.longitude,
      accuracyM: accuracy, distanceM: g.distanceM, isLiveLocation: true, source: 'bot' as const, serverAt: at,
    };
    if (g.status === 'low_accuracy') return { kind: 'error' as const, text: T.lowAccuracy(accuracy ?? 0) };
    if (g.status === 'outside') {
      // Rad etilgan urinish ham jurnalga (rahbar ko'radi), hisobga kirmaydi
      await tx.insert(attendanceEvents).values({ ...base, kind: state.action, checkStatus: 'rejected', reasons: ['outside'] });
      return { kind: 'error' as const, text: T.outside(formatDistance(g.distanceM), esc(b.name)) };
    }
    if (state.action === 'check_out') {
      // Ikki marta «Ketdim» (qayta yuborilgan lokatsiya / Mini App bilan bir vaqtda) — xodim qatori qulflangan, holat qayta tekshiriladi
      if (nextAction(await dayEvents(tx, e.id, wd.date)) !== 'check_out') return { kind: 'error' as const, text: 'Siz allaqachon «Ketdim» qilgansiz.' };
      await tx.insert(attendanceEvents).values({ ...base, kind: 'check_out', checkStatus: 'ok' });
      const r = await rebuildDay(tx, { tenantId: state.tenantId, employeeId: e.id, workDate: wd.date, tz: t!.tz });
      return { kind: 'out' as const, time: formatTime(at, t!.tz), worked: formatMinutes(r.workedMinutes) };
    }
    return { kind: 'in' as const, loc: { lat: loc.latitude, lng: loc.longitude, accuracyM: accuracy, distanceM: g.distanceM, branchId: b.id, live: true, at: at.getTime() } };
  });

  if (out.kind === 'error') {
    await send(chat, out.text);
    return { skip: 'lokatsiya rad etildi' };
  }
  if (out.kind === 'out') {
    await clearState(uid);
    await send(chat, T.checkedOut(out.time, out.worked), menuKeyboard);
    return {};
  }
  await setState(uid, { step: 'ci_video', tenantId: state.tenantId, employeeId: state.employeeId, action: 'check_in', startedAt: state.startedAt, loc: out.loc });
  await send(chat, T.videoAsk);
  return {};
}

async function finishCheckIn(msg: TgMessage, state: Extract<BotState, { step: 'ci_video' }>): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  if (arrivedAt() - state.startedAt > SESSION_TTL_MS) {
    await clearState(uid);
    await send(chat, T.expired, menuKeyboard);
    return { skip: 'muddat o‘tdi' };
  }
  const file = await downloadFile(msg.video_note!.file_id);
  // Yuz: namunalar tranzaksiyada o'qiladi, servis chaqiruvi — tashqarida (§2), servis yo'q bo'lsa — suspicious
  const fc = await withTenant(state.tenantId, (tx) => faceContext(tx, state.employeeId));
  const verdict = faceDecision(
    fc.templates.length ? await verifyFace([{ data: file.data, mime: 'video/mp4', name: 'checkin.mp4' }], fc.templates) : null,
    { templates: fc.templates.length, challenge: false, settings: fc.settings },
  );
  const stored = await writeMediaFile({ tenantId: state.tenantId, employeeId: state.employeeId, kind: 'checkin_video', data: file.data, mime: 'video/mp4', ext: 'mp4', durationSec: msg.video_note!.duration });
  const res = await withTenant(state.tenantId, async (tx) => {
    const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
    const [e] = await tx.select().from(employees).where(eq(employees.id, state.employeeId)).for('update').limit(1); // Mini App bilan bir vaqtda — ketma-ket
    if (!e || e.status !== 'active') return null;
    const at = new Date(arrivedAt());
    const wd = await workdayOf(tx, e.id, at, t!.tz);
    if (nextAction(await dayEvents(tx, e.id, wd.date)) === 'check_out') return { already: true as const };
    const mediaId = await insertMedia(tx, stored);
    await tx.insert(attendanceEvents).values({
      tenantId: state.tenantId, employeeId: e.id, workDate: wd.date, kind: 'check_in', branchId: state.loc.branchId,
      lat: state.loc.lat, lng: state.loc.lng, accuracyM: state.loc.accuracyM, distanceM: state.loc.distanceM, isLiveLocation: state.loc.live,
      mediaId, checkStatus: verdict.status, reasons: verdict.reasons, faceScore: verdict.score, livenessScore: verdict.liveness, source: 'bot', serverAt: at,
    });
    const r = await rebuildDay(tx, { tenantId: state.tenantId, employeeId: e.id, workDate: wd.date, tz: t!.tz });
    if (r.lateMinutes > 0) {
      await queueNotifyMembers(tx, state.tenantId, `⏰ <b>${esc(e.fullName)}</b> kechikdi: ${r.lateMinutes} daqiqa (keldi ${formatTime(r.firstIn, t!.tz)}).`, e.departmentId, 'late', '/tg');
    }
    if (verdict.status === 'suspicious') {
      await queueSuspicious(tx, state.tenantId, `🔎 <b>${esc(e.fullName)}</b> — kelish shubhali (${verdict.reasons.join(', ')}). Mini App → Qarorlar yoki Panel → Davomat → «Shubhali».`, e.departmentId);
    }
    return { already: false as const, time: formatTime(r.firstIn ?? at, t!.tz), late: r.lateMinutes, suspicious: verdict.status === 'suspicious' };
  });
  await clearState(uid);
  if (!res) {
    await send(chat, T.notActive);
    return { skip: 'faol emas' };
  }
  if (res.already) {
    await send(chat, T.alreadyIn, menuKeyboard);
    return { skip: 'allaqachon ishda' };
  }
  kick();
  await send(chat, T.checkedIn(res.time, res.late) + (res.suspicious ? '\n\n🔎 Yuz tekshiruvi aniq emas — rahbar ko‘rib chiqadi.' : ''), menuKeyboard);
  return {};
}

async function showToday(msg: TgMessage): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const chat = msg.chat.id;
  const links = await employeeLinks(uid);
  if (links.length === 0) {
    await send(chat, T.noInvite);
    return { skip: 'bog‘lanmagan' };
  }
  const parts: string[] = [];
  for (const l of links) {
    const line = await withTenant(l.tenantId, async (tx) => {
      const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
      const tz = t!.tz;
      // Qoida bir marta o'qiladi (oldin workdayOf ichida ham — ikki marta)
      const rule = await employeeRule(tx, l.employeeId);
      const wd = workdayFor(rule, new Date(), tz);
      const shift = rule ? shiftFor(rule, wd.date, tz) : null;
      const r = computeDay({ events: await dayEvents(tx, l.employeeId, wd.date), shift, now: new Date(), onLeave: await onLeave(tx, l.employeeId, wd.date) });
      const s = shift ? `Smena: ${formatTime(shift.start, tz)}–${formatTime(shift.end, tz)}` : 'Smena: erkin grafik / dam';
      const came = r.firstIn ? `Keldingiz: ${formatTime(r.firstIn, tz)}${r.lateMinutes ? ` (kechikish ${r.lateMinutes} daq)` : ''}` : 'Hali kelmadingiz';
      const left = r.open ? 'Hozir ishdasiz' : r.lastOut ? `Ketdingiz: ${formatTime(r.lastOut, tz)}` : '';
      return [`<b>${esc(l.tenantName)}</b>`, s, came, left, r.workedMinutes ? `Ishlagan vaqt: ${formatMinutes(r.workedMinutes)}` : ''].filter(Boolean).join('\n');
    });
    parts.push(line);
  }
  await send(chat, `📊 Bugun\n\n${parts.join('\n\n')}`, menuKeyboard);
  return {};
}

// ---------------- Yuz namunasini qayta olish (/yuz) ----------------

async function startResample(msg: TgMessage): Promise<JobOutcome> {
  const uid = msg.from!.id;
  const links = await employeeLinks(uid);
  if (links.length === 0) {
    await send(msg.chat.id, T.noInvite);
    return { skip: 'bog‘lanmagan' };
  }
  const l = links[0]!;
  const hasConsent = await withTenant(l.tenantId, async (tx) => (await tx.select({ id: consents.id }).from(consents).where(eq(consents.employeeId, l.employeeId)).limit(1)).length > 0);
  if (!hasConsent) {
    await send(msg.chat.id, 'Biometrika roziligi yo‘q. Rahbaringizga murojaat qiling.');
    return { skip: 'rozilik yo‘q' };
  }
  await setState(uid, { step: 'face_resample', tenantId: l.tenantId, employeeId: l.employeeId });
  await send(msg.chat.id, `🔄 <b>Yuz namunasini yangilash</b>\n\n${T.faceAsk.split('\n\n').slice(1).join('\n\n')}`);
  return {};
}

async function finishResample(msg: TgMessage, state: Extract<BotState, { step: 'face_resample' }>): Promise<JobOutcome> {
  const file = await downloadFile(msg.video_note!.file_id);
  const stored = await writeMediaFile({ tenantId: state.tenantId, employeeId: state.employeeId, kind: 'face_sample', data: file.data, mime: 'video/mp4', ext: 'mp4', durationSec: msg.video_note!.duration });
  await withTenant(state.tenantId, async (tx) => {
    const mediaId = await insertMedia(tx, stored);
    await enqueue(tx, state.tenantId, 'face_enroll', { employeeId: state.employeeId, mediaId, replace: true }, { maxAttempts: 5 });
  });
  await clearState(msg.from!.id);
  kick();
  await send(msg.chat.id, '✅ Yangi yuz namunasi qabul qilindi.', menuKeyboard);
  return {};
}
