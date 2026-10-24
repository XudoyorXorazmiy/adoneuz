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
