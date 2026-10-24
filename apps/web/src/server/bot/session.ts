import 'server-only';
import { eq } from 'drizzle-orm';
import { botSessions, withPlatform } from '@adone/db';

/** Suhbat holati (bot_sessions, platforma roli). Bitta Telegram foydalanuvchisiga bitta joriy qadam. */
export type BotState =
  | { step: 'reg_contact'; tenantId: string; employeeId: string; code: string }
  | { step: 'reg_consent'; tenantId: string; employeeId: string; code: string }
  | { step: 'reg_face'; tenantId: string; employeeId: string; code: string }
  | { step: 'ci_location'; tenantId: string; employeeId: string; action: 'check_in' | 'check_out'; startedAt: number }
  | {
      step: 'ci_video'; tenantId: string; employeeId: string; action: 'check_in'; startedAt: number;
      loc: { lat: number; lng: number; accuracyM: number | null; distanceM: number; branchId: string; live: boolean; at: number };
    }
  /** Vazifa hisoboti (yoki yangi «Ish qo'shish» — taskId null, title bor): fayllar, lokatsiya, izoh yig'iladi. */
  | { step: 'task_report'; tenantId: string; employeeId: string; taskId: string | null; title?: string; mediaIds: string[]; lat?: number; lng?: number; text?: string }
  | { step: 'task_ask'; tenantId: string; employeeId: string; taskId: string }
  | { step: 'task_revise'; tenantId: string; userId: string; taskId: string }
  | { step: 'work_title'; tenantId: string; employeeId: string }
  | { step: 'work_mode'; tenantId: string; employeeId: string; title: string }
  | { step: 'idle' };

export const SESSION_TTL_MS = 15 * 60_000;

export async function getState(tgUserId: number): Promise<BotState> {
  const [r] = await withPlatform((tx) => tx.select().from(botSessions).where(eq(botSessions.telegramUserId, tgUserId)).limit(1));
  if (!r || Date.now() - r.updatedAt.getTime() > SESSION_TTL_MS) return { step: 'idle' };
  return r.state as BotState;
}

export async function setState(tgUserId: number, state: BotState): Promise<void> {
  const tenantId = 'tenantId' in state ? state.tenantId : null;
  await withPlatform((tx) =>
    tx
      .insert(botSessions)
      .values({ telegramUserId: tgUserId, tenantId, state, updatedAt: new Date() })
      .onConflictDoUpdate({ target: botSessions.telegramUserId, set: { tenantId, state, updatedAt: new Date() } }),
  );
}

export const clearState = (tgUserId: number) => setState(tgUserId, { step: 'idle' });
