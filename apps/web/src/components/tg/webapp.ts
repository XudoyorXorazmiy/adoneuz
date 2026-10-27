/** Telegram WebApp (telegram-web-app.js) — yupqa yordamchilar. Telegram tashqarisida (brauzer) hammasi jim ishlaydi. */
type Haptic = { notificationOccurred(t: 'success' | 'error' | 'warning'): void; impactOccurred(s: 'light' | 'medium'): void };
type BackButton = { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
type LocationManager = { isInited: boolean; isLocationAvailable: boolean; init(cb?: () => void): void; getLocation(cb: (d: { latitude: number; longitude: number; horizontal_accuracy?: number } | null) => void): void };
export type WebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  close(): void;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  openTelegramLink?(url: string): void;
  HapticFeedback?: Haptic;
  BackButton?: BackButton;
  LocationManager?: LocationManager;
};

export function webApp(): WebApp | null {
  if (typeof window === 'undefined') return null;
  const w = (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
  return w ?? null;
}

export function haptic(kind: 'success' | 'error' | 'warning') {
  try { webApp()?.HapticFeedback?.notificationOccurred(kind); } catch { /* eski klient */ }
}

export type Coords = { lat: number; lng: number; accuracy: number | null };

/** GPS: brauzer geolocation (aniq rejim), bo'lmasa Telegram LocationManager (Bot API 8.0). */
export function getCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    const viaTelegram = () => {
      const lm = webApp()?.LocationManager;
      if (!lm) return reject(new Error('Lokatsiyaga ruxsat berilmadi. Telefon sozlamalarida Telegram uchun joylashuvni yoqing.'));
      const go = () => lm.getLocation((d) => (d ? resolve({ lat: d.latitude, lng: d.longitude, accuracy: d.horizontal_accuracy ?? null }) : reject(new Error('Lokatsiyaga ruxsat berilmadi.'))));
      if (lm.isInited) go(); else lm.init(go);
    };
    if (!navigator.geolocation) return viaTelegram();
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => viaTelegram(),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/** Rasmni kichraytirish (≤ maxSide px, JPEG) — server 5 MB chegarasi va tez yuklash uchun. */
export async function shrinkImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
}

/** Deploy'dan keyin ochiq qolgan eski Mini App: server action topilmaydi — foydalanuvchiga «yangilang». */
export const STALE_APP = 'Ilova yangilandi — davom etish uchun «Yangilash»ni bosing.';

/** Server action / fetch xatosi → tushunarli matn (eski klient, internet uzilishi). */
export function actionError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? '');
  if (/Server Action|older or newer deployment|unexpected response|Expected RSC|Failed to find/i.test(m)) return STALE_APP;
  if (/Failed to fetch|Load failed|NetworkError|network/i.test(m)) return 'Internet uzildi — qayta urinib ko‘ring';
  return m || 'Xatolik — qayta urinib ko‘ring';
}

/**
 * Faylni oqim bilan yuklash (XHR — progress uchun; fetch upload progress bermaydi). `/api/tg/upload` → { id }.
 * `abort` — bekor qilish.
 */
export function uploadFile(url: string, file: Blob, onProgress: (pct: number) => void): { done: Promise<{ id: string }>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const done = new Promise<{ id: string }>((resolve, reject) => {
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100))); };
    xhr.onload = () => {
      let body: { id?: string; error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* bo'sh */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.id) { onProgress(100); resolve({ id: body.id }); }
      else reject(new Error(body.error ?? (xhr.status === 413 ? 'Fayl juda katta' : `Yuklab bo‘lmadi (${xhr.status})`)));
    };
    xhr.onerror = () => reject(new Error('Internet uzildi — qayta urinib ko‘ring'));
    xhr.onabort = () => reject(new Error('Bekor qilindi'));
    xhr.send(file);
  });
  return { done, abort: () => xhr.abort() };
}
