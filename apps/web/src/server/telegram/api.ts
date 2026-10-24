import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * Telegram Bot API — yupqa fetch mijozi (grammY shart emas: webhook → jobs → shu yerdan javob).
 * TELEGRAM_API_BASE — sinovda soxta server (scripts/test-bot.ts). Token yo'q bo'lsa yuborish jim o'tkazib yuboriladi.
 */
const base = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
const token = () => process.env.PLATFORM_BOT_TOKEN || '';

export class TelegramError extends Error {
  constructor(public method: string, public code: number, public description: string) {
    super(`telegram ${method}: ${code} ${description}`);
  }
}

export function botConfigured(): boolean {
  return !!token();
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!token()) throw new TelegramError(method, 0, 'PLATFORM_BOT_TOKEN sozlanmagan');
  const res = await fetch(`${base()}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string };
  if (!json.ok) throw new TelegramError(method, json.error_code ?? res.status, json.description ?? 'xato');
  return json.result as T;
}

export type Keyboard =
  | { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string; web_app?: { url: string } }>> }
  | { keyboard: Array<Array<{ text: string; request_contact?: boolean; request_location?: boolean }>>; resize_keyboard?: boolean; one_time_keyboard?: boolean; is_persistent?: boolean }
  | { remove_keyboard: true };

export async function send(chatId: number, text: string, keyboard?: Keyboard) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(keyboard ? { reply_markup: keyboard } : {}) });
}

export async function answerCallback(id: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) }).catch(() => undefined);
}

/** Faylni yuklab olish (video_note ≤ 20 MB — Bot API chegarasi). */
export async function downloadFile(fileId: string): Promise<{ data: Buffer; path: string }> {
  const f = await tg<{ file_path?: string; file_size?: number }>('getFile', { file_id: fileId });
  if (!f.file_path) throw new TelegramError('getFile', 0, 'file_path yo‘q');
  const res = await fetch(`${base()}/file/bot${token()}/${f.file_path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new TelegramError('download', res.status, 'yuklab bo‘lmadi');
  return { data: Buffer.from(await res.arrayBuffer()), path: f.file_path };
}

/** Webhook siri — AUTH_SECRET dan (alohida env shart emas). Telegram uni X-Telegram-Bot-Api-Secret-Token da qaytaradi. */
export function webhookSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET sozlanmagan');
  return createHmac('sha256', s).update('telegram-webhook').digest('hex').slice(0, 48);
}

/** HTML parse_mode uchun matnni xavfsiz qilish. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
