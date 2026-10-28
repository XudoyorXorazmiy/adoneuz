import 'server-only';
/**
 * Navbat ishlari. Qoida: baza o'qish/yozish withTenant ichida, tashqi HTTP (Telegram, yuz servisi) TRANZAKSIYADAN TASHQARIDA.
 * Qaytariladigan xato — oddiy Error (qayta urinish), qaytarilmaydigani — PermanentError.
 */
import { processUpdate } from '@/server/bot';
import type { TgUpdate } from '@/server/telegram/types';
import { pool } from '@adone/db';
import { send, TelegramError } from '@/server/telegram/api';
import { withUpdateContext } from '@/server/bot/context';
import { alertOwner } from '@/server/alerts';
import { cleanup } from '@/server/cleanup';
import { dailyReport } from '@/server/ops';
import { miniAppKeyboard, notifyEmployee, notifyMembers } from '@/server/notify';
import { deadlineNotify } from '@/server/deadline';
import { absentDigest, attendanceTick } from '@/server/ticks';
import { taskNotify, type TaskNotifyKind } from '@/server/task-notify';
import { enrollFace } from '@/server/face';
import { leaveNotify } from '@/server/leave';
import { needTenant, PermanentError, str, type JobOutcome, type JobRow } from './types';
import type { NotifyEvent } from '@adone/core';

export { PermanentError, type JobRow };

export const JOB_TYPES = ['ping', 'tg_update', 'notify_members', 'notify_employee', 'attendance_tick', 'absent_digest', 'task_notify', 'face_enroll', 'leave_notify', 'deadline_notify', 'cleanup', 'daily_report'] as const;
export type JobType = (typeof JOB_TYPES)[number];

type Handler = (job: JobRow) => Promise<JobOutcome>;

/** Telegram'ning 400/403 (bot bloklangan, chat yo'q) — qayta urinish foydasiz. */
async function tgSafe(fn: () => Promise<JobOutcome>): Promise<JobOutcome> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof TelegramError && (e.code === 400 || e.code === 403 || e.code === 0)) throw new PermanentError(e.message);
    throw e;
  }
}

export const HANDLERS: Record<JobType, Handler> = {
  /** Navbat ishlayotganini tekshirish (super admin → Navbat). */
  async ping() {
    return {};
  },
  async tg_update(job) {
    // Vaqt — webhook qabul qilgan payt (qayta urinishda ham), «qabul qilindi» — faqat birinchi urinishda (bot/context).
    // Bir chat — ketma-ket (jarayonlar orasida ham): lokatsiya va video bir vaqtda ishlansa sessiya holati buziladi
    const u = job.payload.update as TgUpdate;
    const chat = u.message?.chat.id ?? u.callback_query?.message?.chat.id ?? u.callback_query?.from.id ?? null;
    return withChatLock(chat, () => withUpdateContext({ receivedAt: new Date(job.created_at).getTime(), attempt: job.attempts }, () => tgSafe(() => processUpdate(u))));
  },
  async notify_members(job) {
    const text = str(job.payload.text);
    if (!text) throw new PermanentError('matn yo‘q');
    return tgSafe(() => notifyMembers(needTenant(job), text, str(job.payload.departmentId), (str(job.payload.event) || null) as NotifyEvent | null, miniAppKeyboard(str(job.payload.miniPath))));
  },
  async notify_employee(job) {
    const text = str(job.payload.text);
    const employeeId = str(job.payload.employeeId);
    if (!text || !employeeId) throw new PermanentError('payload noto‘g‘ri');
    const kb = miniAppKeyboard(str(job.payload.miniPath), '👔 Rahbar rejimini ochish');
    return tgSafe(() => (kb ? notifyEmployee(needTenant(job), employeeId, text, kb) : notifyEmployee(needTenant(job), employeeId, text)));
  },
  async attendance_tick(job) {
    return attendanceTick(needTenant(job));
  },
  async task_notify(job) {
    const taskId = str(job.payload.taskId);
    const kind = str(job.payload.kind) as TaskNotifyKind | null;
    if (!taskId || !kind) throw new PermanentError('payload noto‘g‘ri');
    return tgSafe(() => taskNotify(needTenant(job), taskId, kind, { comment: str(job.payload.comment), by: str(job.payload.by) }));
  },
  async face_enroll(job) {
    const employeeId = str(job.payload.employeeId);
    const mediaId = str(job.payload.mediaId);
    if (!employeeId || !mediaId) throw new PermanentError('payload noto‘g‘ri');
    return enrollFace(needTenant(job), employeeId, mediaId, job.payload.replace === true);
  },
  async leave_notify(job) {
    const id = str(job.payload.id);
    const kind = str(job.payload.kind);
    if (!id || !kind) throw new PermanentError('payload noto‘g‘ri');
    return tgSafe(() => leaveNotify(needTenant(job), id, kind));
  },
  async deadline_notify(job) {
    const id = str(job.payload.id);
    const kind = str(job.payload.kind);
    if (!id || !kind) throw new PermanentError('payload noto‘g‘ri');
    return tgSafe(() => deadlineNotify(needTenant(job), id, kind));
  },
  /** Kunlik tozalash (server/cleanup.ts). Natija `last_error` ga «skip: …» izohi sifatida — kunlik xulosa shuni ko'rsatadi. */
  async cleanup() {
    const r = await cleanup();
    return { skip: `${r.media} ta isbot fayli (${r.mediaMb} MB), ${r.orphans} yetim fayl, ${r.thumbs} kichik nusxa, ${r.jobs} ish, ${r.tgUpdates} update, ${r.throttle} cheklov yozuvi o'chirildi` };
  },
  async daily_report() {
    return tgSafe(() => dailyReport());
  },
  async absent_digest(job) {
    const date = str(job.payload.date);
    if (!date) throw new PermanentError('sana yo‘q');
    return tgSafe(() => absentDigest(needTenant(job), date));
  },
};

/**
 * Urinishlar tugab yiqilgan ish (vaqtinchalik xato takrorlandi — Telegram/baza/servis ishlamadi): Telegram xabari bo'lsa —
 * yuborgan odamga «qayta yuboring» (aks holda video jim yo'qoladi), egasiga — ish turi va xato (shaxsiy ma'lumotsiz).
 */
export async function onFinalFailure(job: JobRow, error: string): Promise<void> {
  if (job.type === 'tg_update') {
    const u = job.payload.update as TgUpdate | undefined;
    const chat = u?.message?.chat.id ?? u?.callback_query?.message?.chat.id;
    if (chat) {
      const what = u?.message?.video_note || u?.message?.video ? 'Videongiz' : u?.message?.photo ? 'Rasmingiz' : 'Xabaringiz';
      await send(chat, `⚠️ ${what} qabul qilinmadi — Telegram bilan aloqa uzildi. Iltimos, qaytadan yuboring.`).catch(() => undefined);
    }
  }
  // Yuz namunasi qayta ishlanmadi (servis ishlamadi) — xodim ham, rahbar ham bilsin (aks holda keldi-ketdilar «namuna yo'q» bo'lib qoladi)
  if (job.type === 'face_enroll' && job.tenant_id) {
    const employeeId = str(job.payload.employeeId);
    if (employeeId) {
      await notifyEmployee(job.tenant_id, employeeId, "⚠️ Yuz namunangizni hozir qayta ishlay olmadik. Birozdan keyin /yuz buyrug'ini bosib, 3–5 soniyalik dumaloq videoni qayta yuboring.").catch(() => undefined);
      await notifyMembers(job.tenant_id, '⚠️ Bir xodimning yuz namunasi qayta ishlanmadi (yuz servisi javob bermadi) — xodimga /yuz orqali qayta yuborish aytildi.', null).catch(() => undefined);
    }
  }
  await alertOwner(`job:${job.type}`, `Ish yiqildi: ${job.type} (${job.id.slice(0, 8)}, ${job.attempts} urinish)\n${error.slice(0, 200)}`);
}

/**
 * Chat bo'yicha qulf (Postgres advisory lock, sessiya darajasida — alohida ulanish): bir chatning update'lari bir vaqtda
 * ishlanmaydi. Jarayonda ishchi bitta (jobs/runner mutex), bu — bir nechta jarayon/konteyner bo'lganda ham. 30 s ichida
 * olinmasa — qayta urinish (ish keyinroq qaytadi).
 */
async function withChatLock<T>(chat: number | null, fn: () => Promise<T>): Promise<T> {
  if (chat == null) return fn();
  const client = await pool.connect();
  const key = `tg-chat:${chat}`;
  try {
    for (let i = 0; ; i++) {
      const { rows } = await client.query<{ ok: boolean }>('select pg_try_advisory_lock(hashtext($1)) as ok', [key]);
      if (rows[0]?.ok) break;
      if (i >= 30) throw new Error('chat band — keyinroq');
      await new Promise((r) => setTimeout(r, 1000));
    }
    try {
      return await fn();
    } finally {
      await client.query('select pg_advisory_unlock(hashtext($1))', [key]).catch(() => undefined);
    }
  } finally {
    client.release();
  }
}
