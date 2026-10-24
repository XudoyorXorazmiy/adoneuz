import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Telegram Mini App initData tekshiruvi (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 *   secret = HMAC_SHA256(key="WebAppData", bot_token); hash = hex(HMAC_SHA256(key=secret, data_check_string)).
 * data_check_string — `hash` dan boshqa maydonlar, kalit bo'yicha saralangan, "k=v" qatorlari "\n" bilan.
 * Eskirgan (auth_date > maxAgeSec) initData rad etiladi — ushlab qolingan initData'ni qayta ishlatish oldi olinadi.
 */
export interface TgInitUser { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string }

export function verifyInitData(initData: string, botToken: string, maxAgeSec = 24 * 3600, now = Date.now()): { user: TgInitUser; authDate: number } | null {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec || authDate - now / 1000 > 300) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TgInitUser | null;
    if (!user || typeof user.id !== 'number') return null;
    return { user, authDate };
  } catch {
    return null;
  }
}

/** Sinov uchun: berilgan token bilan imzolangan initData (scripts/test-miniapp.ts). */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheck = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
