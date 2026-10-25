/** Geofence — server tomonida, deterministik (CLAUDE.md §1.3). */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Ikki nuqta orasidagi masofa (metr), haversine. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GeofenceInput {
  branch: LatLng & { radiusM: number };
  point: LatLng;
  /** GPS aniqligi (metr), Mini App `coords.accuracy` yoki Telegram `horizontal_accuracy`. Noma'lum bo'lsa null. */
  accuracyM: number | null;
}

export type GeofenceResult =
  | { status: 'ok'; distanceM: number }
  | { status: 'outside'; distanceM: number }
  | { status: 'low_accuracy'; distanceM: number };

/** Aniqlik shundan yomon bo'lsa natija ishonchsiz — xodimdan qayta urinish so'raladi. */
export const MAX_ACCURACY_M = 100;
/** Aniqlik zaxirasi radiusning ko'pi bilan shuncha qismi (katta xato radiusni «yeb» qo'ymasin). */
const ACCURACY_SLACK_RATIO = 0.5;

export function checkGeofence({ branch, point, accuracyM }: GeofenceInput): GeofenceResult {
  const distanceM = Math.round(distanceMeters(branch, point));
  if (accuracyM != null && accuracyM > MAX_ACCURACY_M) return { status: 'low_accuracy', distanceM };
  const slack = Math.min(accuracyM ?? 0, branch.radiusM * ACCURACY_SLACK_RATIO);
  return distanceM <= branch.radiusM + slack ? { status: 'ok', distanceM } : { status: 'outside', distanceM };
}

export function isValidLatLng(p: Partial<LatLng>): p is LatLng {
  return typeof p.lat === 'number' && typeof p.lng === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
}

/**
 * Filial koordinatasi: «41.3194, 61.0742», Google/Yandex xarita havolasi (…/@41.31,61.07,17z, ?q=41.31,61.07,
 * !3d41.31!4d61.07, /maps/search/41.31,+61.07 — qisqa havola ochilgandagi ko'rinish, ?ll=61.07,41.31 — Yandex'da
 * avval uzunlik). Qisqa havolani (maps.app.goo.gl) server avval ochadi — `isShortMapLink`. Topilmasa null.
 */
export function parseCoordinates(input: string): LatLng | null {
  const s = decodeURIComponent(input.trim());
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const tries: Array<[RegExp, boolean]> = [
    [new RegExp(`!3d${num}!4d${num}`), false],
    [new RegExp(`@${num},${num}`), false],
    [new RegExp(`[?&](?:q|query|destination)=${num},\\s*\\+?${num}`), false],
    [new RegExp(`/(?:search|place)/${num},\\s*\\+?${num}`), false],
    [new RegExp(`[?&](?:ll|pt)=${num},${num}`), true],
    [new RegExp(`^${num}\\s*[,; ]\\s*${num}$`), false],
  ];
  for (const [re, swapped] of tries) {
    const m = re.exec(s);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const p = swapped ? { lat: b, lng: a } : { lat: a, lng: b };
    if (isValidLatLng(p)) return p;
  }
  return null;
}

/**
 * Koordinatasiz qisqa xarita havolasi (Google «Ulashish»: maps.app.goo.gl/…, goo.gl/maps/…) — server uni ochib,
 * redirect manzilidan koordinata oladi. Faqat shu hostlar: boshqa manzilga server so'rov yubormaydi (SSRF).
 */
export function isShortMapLink(input: string): boolean {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  return u.hostname === 'maps.app.goo.gl' || (u.hostname === 'goo.gl' && u.pathname.startsWith('/maps/'));
}
