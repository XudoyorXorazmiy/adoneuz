/** Vaqt mintaqasi yordamchilari (kutubxonasiz, Intl orqali). Sana — 'YYYY-MM-DD', vaqt — 'HH:MM'. */

const dtf = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = dtf.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    dtf.set(tz, f);
  }
  return f;
}

export function zonedParts(d: Date, tz: string) {
  const p = Object.fromEntries(fmt(tz).formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: Number(p.minute), s: Number(p.second) };
}

/** Lahzaning shu mintaqadagi sanasi: 'YYYY-MM-DD'. */
export function localDate(d: Date, tz: string): string {
  const p = zonedParts(d, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

/** Mintaqaning shu lahzadagi UTC'dan farqi (daqiqa). Toshkent → +300. */
function offsetMinutes(d: Date, tz: string): number {
  const p = zonedParts(d, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60_000);
}

/** Mahalliy sana + vaqt → Date (UTC lahza). */
export function zonedTime(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetMinutes(new Date(guess), tz);
  const off2 = offsetMinutes(new Date(guess - off1 * 60_000), tz);
  return new Date(guess - off2 * 60_000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** ISO hafta kuni: 1 = dushanba … 7 = yakshanba. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/** Formadan kelgan vaqt: "18:30", "18.30", "1830", "18 30", "9:5" → "18:30" / "09:05"; noto'g'ri bo'lsa null. */
export function normalizeTime(input: string): string | null {
  const m = /^\s*(\d{1,2})\s*[:.\s-]?\s*(\d{2})\s*$/.exec(input);
  if (!m) return null;
  const t = `${m[1]!.padStart(2, '0')}:${m[2]}`;
  return isValidTime(t) ? t : null;
}

export function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
}

/** 'YYYY-MM' oyining kunlari. */
export function monthDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export const WEEKDAY_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'] as const;
export const WEEKDAY_LONG = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'] as const;
export const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'] as const;
