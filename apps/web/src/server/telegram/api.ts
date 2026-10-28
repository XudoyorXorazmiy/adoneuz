import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * Telegram Bot API — yupqa fetch mijozi (grammY shart emas: webhook → jobs → shu yerdan javob).
 * TELEGRAM_API_BASE — sinovda soxta server (scripts/test-bot.ts). Token yo'q bo'lsa yuborish jim o'tkazib yuboriladi.
 */
const base = () => (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
const token = () => process.env.PLATFORM_BOT_TOKEN || '';

export class TelegramError extends Error {
  constructor(public method: string, public code: number, public description: string, public retryAfter?: number) {
    super(`telegram ${method}: ${code} ${description}`);
  }
}

export function botConfigured(): boolean {
  return !!token();
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>, opts: { timeoutMs?: number } = {}): Promise<T> {
  if (!token()) throw new TelegramError(method, 0, 'PLATFORM_BOT_TOKEN sozlanmagan');
  const res = await fetch(`${base()}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string; parameters?: { retry_after?: number } };
  if (!json.ok) throw new TelegramError(method, json.error_code ?? res.status, json.description ?? 'xato', json.parameters?.retry_after);
  return json.result as T;
}

/** Vaqtinchalik xato (Telegram sekinlashdi, tarmoq uzildi, 5xx, 429) — qayta urinsa o'tishi mumkin. */
export function isTransient(e: unknown): boolean {
  if (e instanceof TelegramError) return e.code === 429 || e.code >= 500;
  const name = (e as { name?: string })?.name;
  return name === 'TimeoutError' || name === 'AbortError' || e instanceof TypeError; // fetch tarmoq xatosi — TypeError
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Keyboard =
  | { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string; web_app?: { url: string } }>> }
  | { keyboard: Array<Array<{ text: string; request_contact?: boolean; request_location?: boolean }>>; resize_keyboard?: boolean; one_time_keyboard?: boolean; is_persistent?: boolean }
  | { remove_keyboard: true };

export async function send(chatId: number, text: string, keyboard?: Keyboard) {
  return tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(keyboard ? { reply_markup: keyboard } : {}) });
}

/** Diskdagi faylni yuborish (rahbarga hisobot rasmi/videosi). multipart — Bot API 50 MB gacha. */
export async function sendFile(chatId: number, kind: 'photo' | 'video', data: Buffer, filename: string, caption?: string) {
  if (!token()) throw new TelegramError('send' + kind, 0, 'PLATFORM_BOT_TOKEN sozlanmagan');
  const form = new FormData();
  form.set('chat_id', String(chatId));
  if (caption) { form.set('caption', caption); form.set('parse_mode', 'HTML'); }
  form.set(kind, new Blob([new Uint8Array(data)]), filename);
  const method = kind === 'photo' ? 'sendPhoto' : 'sendVideo';
  const res = await fetch(`${base()}/bot${token()}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error_code?: number; description?: string };
  if (!json.ok) throw new TelegramError(method, json.error_code ?? res.status, json.description ?? 'xato');
}

/** Inline tugmali xabarni tahrirlash (bosilgandan keyin tugmalarni olib tashlash). Xato — jim. */
export async function editMarkup(chatId: number, messageId: number, keyboard?: Keyboard) {
  return tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: keyboard ?? { inline_keyboard: [] } }).catch(() => undefined);
}

export async function answerCallback(id: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) }).catch(() => undefined);
}

/**
 * Faylni yuklab olish (video_note ≤ 20 MB — Bot API chegarasi). Telegram `getFile` vaqti-vaqti bilan 15 s dan sekinlashadi
 * (28.10 prod: 4 ta dumaloq video yo'qoldi) — har qadam 60 s gacha kutadi, vaqtinchalik xatoda shu ishning o'zida yana
 * 2 marta urinadi (1 s, 3 s), lekin umumiy ~100 s dan oshmaydi (ish chegarasi — jobs/runner).
 */
export async function downloadFile(fileId: string): Promise<{ data: Buffer; path: string }> {
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      const f = await tg<{ file_path?: string; file_size?: number }>('getFile', { file_id: fileId }, { timeoutMs: 60_000 });
      if (!f.file_path) throw new TelegramError('getFile', 0, 'file_path yo‘q');
      const res = await fetch(`${base()}/file/bot${token()}/${f.file_path}`, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new TelegramError('download', res.status, 'yuklab bo‘lmadi');
      return { data: Buffer.from(await res.arrayBuffer()), path: f.file_path };
    } catch (e) {
      const wait = attempt === 1 ? 1000 : 3000;
      if (attempt >= 3 || !isTransient(e) || Date.now() - started + wait > 40_000) throw e;
      console.warn(`[telegram] fayl olish ${attempt}-urinish yiqildi, qayta: ${(e as Error).message}`);
      await sleep(wait);
    }
  }
}

/** Webhook siri — AUTH_SECRET dan (alohida env shart emas). Telegram uni X-Telegram-Bot-Api-Secret-Token da qaytaradi. */
export function webhookSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET sozlanmagan');
  return createHmac('sha256', s).update('telegram-webhook').digest('hex').slice(0, 48);
}

/** HTML parse_mode uchun matnni xavfsiz qilish. */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
