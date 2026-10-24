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
import { needTenant, PermanentError, str, type JobOutcome, type JobRow } from './types';

export { PermanentError, type JobRow };

export const JOB_TYPES = ['ping', 'tg_update', 'notify_members', 'notify_employee', 'attendance_tick', 'absent_digest'] as const;
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
    return tgSafe(() => notifyMembers(needTenant(job), text, str(job.payload.departmentId)));
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
  async absent_digest(job) {
    const date = str(job.payload.date);
    if (!date) throw new PermanentError('sana yo‘q');
    return tgSafe(() => absentDigest(needTenant(job), date));
  },
};
