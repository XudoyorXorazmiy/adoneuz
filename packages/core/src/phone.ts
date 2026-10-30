/**
 * Telefon raqamlari. Saqlash formati — mamlakat kodi bilan, plyussiz (E.164 raqamlari): O'zbekiston 998XXXXXXXXX (12 raqam),
 * Rossiya/Qozog'iston 7XXXXXXXXXX (11 raqam), boshqa mamlakatlar — «+» bilan kiritilsa 8–15 raqam.
 * Ko'rsatish — +998 90 123 45 67, +7 977 865 78 71.
 * Plyussiz kiritilgan raqam O'zbekiston deb olinadi (9 raqam, «8 90…», 998…); «7…»/«8…» 11 raqam — Rossiya.
 */

function uz(d: string): string | null {
  if (!/^998\d{9}$/.test(d)) return null;
  // Operator/shahar kodi 2 raqam, 20 dan katta (20, 33, 50, 55, 61–79, 88, 90–99)
  if (Number(d.slice(3, 5)) < 20) return null;
  return d;
}

/** "90 123 45 67", "+998901234567", "8 90 123-45-67" → "998901234567"; "+7 977 865 78 71" → "79778657871"; noto'g'ri bo'lsa null. */
export function normalizePhone(input: string): string | null {
  const s = input.trim();
  const d = s.replace(/\D+/g, '');
  if (s.startsWith('+')) {
    if (d.startsWith('998')) return uz(d);
    if (d.startsWith('7')) return d.length === 11 ? d : null;
    return /^[1-9]\d{7,14}$/.test(d) ? d : null;
  }
  if (d.length === 9) return uz(`998${d}`);
  if (d.length === 10 && d.startsWith('8')) return uz(`998${d.slice(1)}`);
  if (d.length === 12 && d.startsWith('998')) return uz(d);
  if (d.length === 11 && d.startsWith('7')) return d;
  if (d.length === 11 && d.startsWith('8')) return `7${d.slice(1)}`;
  return null;
}

export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const d = stored.replace(/\D+/g, '');
  if (/^998\d{9}$/.test(d)) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  if (/^7\d{10}$/.test(d)) return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
  if (/^[1-9]\d{7,14}$/.test(d)) return `+${d}`;
  return stored;
}

/** Kirish/jamoa formalaridagi mamlakat kodi tanlagichi (qiymat — plyussiz kod). */
export const PHONE_COUNTRIES = [
  { cc: '998', label: '🇺🇿 +998', placeholder: '90 123 45 67' },
  { cc: '7', label: '🇷🇺 +7', placeholder: '977 865 78 71' },
] as const;

/** Forma: tanlangan kod + raqam. Raqamning o'zida «+» bo'lsa kod e'tiborga olinmaydi. */
export function phoneFromForm(cc: string | null | undefined, raw: string): string | null {
  const r = raw.trim();
  if (!r) return null;
  if (r.startsWith('+') || !cc) return normalizePhone(r);
  return normalizePhone(`+${cc.replace(/\D/g, '')}${r}`);
}
