import 'server-only';
/**
 * Navbat ishlari. Qoida: baza o'qish/yozish withTenant ichida, tashqi HTTP (Telegram, yuz servisi) TRANZAKSIYADAN TASHQARIDA.
 * Qaytariladigan xato — oddiy Error (qayta urinish), qaytarilmaydigani — PermanentError.
 */
import { processUpdate } from '@/server/bot';
import type { TgUpdate } from '@/server/telegram/types';
import { TelegramError } from '@/server/telegram/api';
import { notifyEmployee, notifyMembers } from '@/server/notify';
import { absentDigest, attendanceTick } from '@/server/ticks';
import { taskNotify, type TaskNotifyKind } from '@/server/task-notify';
import { enrollFace } from '@/server/face';
import { leaveNotify } from '@/server/leave';
import { needTenant, PermanentError, str, type JobOutcome, type JobRow } from './types';
import type { NotifyEvent } from '@adone/core';

export { PermanentError, type JobRow };

export const JOB_TYPES = ['ping', 'tg_update', 'notify_members', 'notify_employee', 'attendance_tick', 'absent_digest', 'task_notify', 'face_enroll', 'leave_notify'] as const;
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
    return tgSafe(() => processUpdate(job.payload.update as TgUpdate));
  },
  async notify_members(job) {
    const text = str(job.payload.text);
    if (!text) throw new PermanentError('matn yo‘q');
    return tgSafe(() => notifyMembers(needTenant(job), text, str(job.payload.departmentId), (str(job.payload.event) || null) as NotifyEvent | null));
  },
  async notify_employee(job) {
    const text = str(job.payload.text);
    const employeeId = str(job.payload.employeeId);
    if (!text || !employeeId) throw new PermanentError('payload noto‘g‘ri');
    return tgSafe(() => notifyEmployee(needTenant(job), employeeId, text));
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
  async absent_digest(job) {
    const date = str(job.payload.date);
    if (!date) throw new PermanentError('sana yo‘q');
    return tgSafe(() => absentDigest(needTenant(job), date));
  },
};
