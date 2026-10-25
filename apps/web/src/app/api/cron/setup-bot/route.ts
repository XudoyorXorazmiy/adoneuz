import { timingSafeEqual } from 'node:crypto';
import { publicApiOrigin } from '@/lib/host';
import { botConfigured, tg, webhookSecret } from '@/server/telegram/api';

/**
 * Bir marta (deploy'dan keyin): webhook va bot buyruqlari.
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.adone.uz/api/cron/setup-bot
 */
export async function POST(req: Request) {
  const want = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const got = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return new Response('Unauthorized', { status: 401 });
  if (!botConfigured()) return Response.json({ ok: false, error: 'PLATFORM_BOT_TOKEN sozlanmagan' }, { status: 400 });
  const url = `${publicApiOrigin()}/api/telegram/webhook`;
  // TELEGRAM_WEBHOOK_IP — Telegram DNS'ga qaramay to'g'ridan-to'g'ri serverga ulanadi (prod: 109.199.121.164)
  const ip = process.env.TELEGRAM_WEBHOOK_IP;
  await tg('setWebhook', { url, secret_token: webhookSecret(), allowed_updates: ['message', 'callback_query'], drop_pending_updates: false, max_connections: 20, ...(ip ? { ip_address: ip } : {}) });
  await tg('setMyCommands', {
    commands: [
      { command: 'keldim', description: 'Ishga keldim' },
      { command: 'ketdim', description: 'Ishdan ketyapman' },
      { command: 'bugun', description: 'Bugungi holat' },
      { command: 'vazifalar', description: 'Vazifalarim' },
      { command: 'ish', description: "Ish qo'shish" },
      { command: 'yordam', description: 'Yordam' },
    ],
  });
  // Mini App: chat menyusidagi «Ochish» tugmasi (faqat https — Telegram boshqasini qabul qilmaydi)
  const miniApp = `${publicApiOrigin()}/tg`;
  if (miniApp.startsWith('https://')) await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: miniApp } } });
  const me = await tg<{ username: string }>('getMe', {});
  return Response.json({ ok: true, webhook: url, miniApp, bot: me.username });
}
