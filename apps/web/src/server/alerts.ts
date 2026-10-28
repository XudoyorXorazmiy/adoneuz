import 'server-only';
import { esc, send } from '@/server/telegram/api';

/**
 * Platforma egasiga ogohlantirish (yiqilgan ish, sog'liq muammosi) — `PLATFORM_OWNER_CHAT_ID` ga Telegram xabari.
 * Sozlanmagan bo'lsa — faqat log. Xabarda shaxsiy ma'lumot (rasm, telefon, matn) bo'lmasin — faqat ish turi, id, xato.
 * Bir xil ogohlantirish 10 daqiqada bir marta (jarayon xotirasida).
 */
const recent = new Map<string, number>();

export async function alertOwner(key: string, text: string): Promise<void> {
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 10 * 60_000) return;
  recent.set(key, now);
  if (recent.size > 500) for (const [k, t] of recent) if (t < now - 10 * 60_000) recent.delete(k);
  console.error(`[alert] ${text}`);
  const chat = Number(process.env.PLATFORM_OWNER_CHAT_ID);
  if (!chat || !process.env.PLATFORM_BOT_TOKEN) return;
  await send(chat, `⚠️ <b>adone</b> · ${esc(text)}`).catch((e) => console.error('[alert] yuborilmadi', (e as Error).message));
}

/** Egasiga oddiy xabar (kunlik xulosa). Sozlanmagan bo'lsa — false. */
export async function sendOwner(text: string): Promise<boolean> {
  const chat = Number(process.env.PLATFORM_OWNER_CHAT_ID);
  if (!chat || !process.env.PLATFORM_BOT_TOKEN) {
    console.log(`[owner] ${text.replace(/<[^>]+>/g, '')}`);
    return false;
  }
  await send(chat, text);
  return true;
}
