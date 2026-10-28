import 'server-only';
import { cookies } from 'next/headers';

/**
 * Bir martalik xabar (panel): `void` form amallari (tugma bosish) xatoni tashlamaydi — tashlansa butun sahifa yiqiladi.
 * Cookie'ga yoziladi, panel qobig'i tepada ko'rsatadi va o'chiradi (components/shell/flash.tsx). Cookie o'rnatilgan
 * amaldan keyin Next joriy sahifani o'zi yangilaydi.
 */
export const FLASH_COOKIE = 'adone_flash';

export async function flashError(message: string): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(message.slice(0, 300)), { path: '/', maxAge: 60, sameSite: 'lax' });
}

export async function readFlash(): Promise<string | null> {
  const v = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!v) return null;
  try { return decodeURIComponent(v); } catch { return null; }
}
