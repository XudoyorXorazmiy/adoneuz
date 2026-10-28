/**
 * Muhim env'lar (prod): yo'q bo'lsa server ishga tushmaydi — xato logda aniq yoziladi. Qiymatlar logga chiqmaydi (§1.10).
 * Ogohlantirish — ishlaydi, lekin funksiya o'chiq (yuz tekshiruvi, egasiga xabar).
 */
const REQUIRED = ['DATABASE_URL', 'AUTH_SECRET', 'ROOT_DOMAIN', 'PLATFORM_BOT_TOKEN', 'CRON_SECRET', 'MEDIA_DIR'] as const;
const WARN: Array<[string, string]> = [
  ['FACE_SERVICE_URL', 'yuz tekshiruvi o‘chiq — keldi-ketdilar «shubhali» bo‘ladi'],
  ['PLATFORM_OWNER_CHAT_ID', 'egasiga ogohlantirish va kunlik xulosa faqat logga'],
];

export function checkEnv(): void {
  const prod = process.env.NODE_ENV === 'production';
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  for (const [k, why] of WARN) if (!process.env[k]?.trim()) console.warn(`[env] ${k} yo'q — ${why}`);
  if (process.env.FACE_SERVICE_URL && !process.env.FACE_SERVICE_KEY) console.warn('[env] FACE_SERVICE_KEY yo‘q — yuz servisi kalitsiz ishga tushmaydi');
  if (!missing.length) return;
  const msg = `[env] muhim o'zgaruvchilar yo'q: ${missing.join(', ')}`;
  if (prod) throw new Error(msg);
  console.warn(msg);
}
