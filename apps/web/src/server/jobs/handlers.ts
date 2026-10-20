import 'server-only';
/**
 * Navbat ishlari. Qoida: baza o'qish/yozish withTenant ichida, tashqi HTTP (Telegram, yuz servisi) TRANZAKSIYADAN TASHQARIDA.
 * Qaytariladigan xato — oddiy Error (qayta urinish), qaytarilmaydigani — PermanentError.
 * Yangi ish turi: shu yerga handler + JOB_TYPES ga nom (1-bosqichdan: bot xabarlari, eslatmalar, kunlik hisobot).
 */
import { PermanentError, type JobOutcome, type JobRow } from './types';

export { PermanentError, type JobRow };

export const JOB_TYPES = ['ping'] as const;
export type JobType = (typeof JOB_TYPES)[number];

type Handler = (job: JobRow) => Promise<JobOutcome>;

export const HANDLERS: Record<JobType, Handler> = {
  /** Navbat ishlayotganini tekshirish (super admin → Navbat). */
  async ping() {
    return {};
  },
};
