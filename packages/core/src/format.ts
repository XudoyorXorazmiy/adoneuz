/** Standart vaqt mintaqasi. Tenant o'zinikini `tenants.timezone` da saqlaydi — funksiyalar `tz` qabul qiladi. */
export const DEFAULT_TZ = 'Asia/Tashkent';

/** 210000 → "210 000 so'm" (bo'shliq bilan, kasrsiz). */
export function formatSom(n: number | string | null | undefined, withUnit = true): string {
  if (n == null || n === '') return '';
  const v = Math.round(Number(n));
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${v < 0 ? '−' : ''}${s}${withUnit ? " so'm" : ''}`;
}

export function formatNumber(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: p.year!, m: p.month!, d: p.day!, h: String(Number(p.hour) % 24).padStart(2, '0'), min: p.minute! };
}

/** 20.10.2026 */
export function formatDate(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return '';
  const p = parts(new Date(d), tz);
  return `${p.d}.${p.m}.${p.y}`;
}

/** 09:07 */
export function formatTime(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return '';
  const p = parts(new Date(d), tz);
  return `${p.h}:${p.min}`;
}

export function formatDateTime(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return '';
  return `${formatDate(d, tz)} ${formatTime(d, tz)}`;
}

/** 492 → "8 soat 12 daqiqa" (daqiqalardan). */
export function formatMinutes(total: number): string {
  const m = Math.max(0, Math.round(total));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} daqiqa`;
  return r ? `${h} soat ${r} daqiqa` : `${h} soat`;
}

/** 35 → "35 m", 1420 → "1,4 km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Ism → bosh harflar (avatar). */
export function initials(name: string | null | undefined): string {
  if (!name) return '#';
  const w = name.replace(/[‘’ʻʼ'`]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '#';
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase();
}
