/**
 * O'zbekiston telefon raqamlari. Saqlash formati — 998XXXXXXXXX (12 raqam, plyussiz).
 * Ko'rsatish — +998 90 123 45 67.
 */

/** "90 123 45 67", "+998901234567", "8 90 123-45-67" → "998901234567"; noto'g'ri bo'lsa null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D+/g, '');
  if (d.length === 9) d = `998${d}`;
  else if (d.length === 10 && d.startsWith('8')) d = `998${d.slice(1)}`;
  if (!/^998\d{9}$/.test(d)) return null;
  // Operator/shahar kodi 2 raqam, 20 dan katta (20, 33, 50, 55, 61–79, 88, 90–99)
  if (Number(d.slice(3, 5)) < 20) return null;
  return d;
}

export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const d = stored.replace(/\D+/g, '');
  if (!/^998\d{9}$/.test(d)) return stored;
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}
