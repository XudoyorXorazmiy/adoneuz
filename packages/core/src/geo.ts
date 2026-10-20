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
