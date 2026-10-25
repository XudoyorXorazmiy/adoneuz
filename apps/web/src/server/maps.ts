import 'server-only';
import { isShortMapLink } from '@adone/core';

/**
 * Qisqa xarita havolasi (maps.app.goo.gl/…) → to'liq manzil. Faqat redirect `Location` sarlavhasi o'qiladi, sahifa
 * yuklanmaydi; so'rov faqat `isShortMapLink` hostlariga ketadi. Ochilmasa — kirish o'zgarmasdan qaytadi.
 */
export async function expandMapLink(input: string): Promise<string> {
  let url = input.trim();
  for (let hop = 0; hop < 3 && isShortMapLink(url); hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5_000) }).catch(() => null);
    await res?.body?.cancel().catch(() => {});
    const next = res?.headers.get('location');
    if (!next) break;
    url = new URL(next, url).toString();
  }
  return url;
}
