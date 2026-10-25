/**
 * Yuz tekshiruvi qarori (CLAUDE.md §1.3, §6.4) — deterministik, Next.js tomonida. Yuz servisi faqat raqam beradi
 * (o'xshashlik, yaw oralig'i, yuzlar soni); chegaralar — ishxona sozlamasi (`tenants.settings.face`).
 * Yuz sababli check-in RAD etilmaydi — `suspicious` bo'lib rahbar navbatiga tushadi (bloklanmaydi).
 */
export interface FaceSettings {
  /** Kosinus o'xshashlik chegarasi (0..1). Standart 0.45 (buffalo_l uchun tavsiya). */
  threshold: number;
  /** Mini App challenge (chapga/o'ngga) — bosh burilishi kamida shuncha gradus. */
  minYawRange: number;
}
export const DEFAULT_FACE_SETTINGS: FaceSettings = { threshold: 0.45, minYawRange: 15 };

export function faceSettings(raw: unknown): FaceSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FaceSettings>;
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && v >= lo && v <= hi ? v : d);
  return { threshold: n(r.threshold, 0.2, 0.9, DEFAULT_FACE_SETTINGS.threshold), minYawRange: n(r.minYawRange, 0, 60, DEFAULT_FACE_SETTINGS.minYawRange) };
}

/** Yuz servisi javobi (services/face /verify). */
export type FaceVerify =
  | { ok: true; similarity: number; faceFrames: number; frames: number; manyFaces: boolean; yawRange: number }
  | { ok: false; reason: 'no_face' | 'bad_media' };

export interface FaceDecision {
  status: 'ok' | 'suspicious';
  reasons: string[];
  /** o'xshashlik 0..1 (attendance_events.face_score) */
  score: number | null;
  /** yaw oralig'i, gradus (attendance_events.liveness_score) */
  liveness: number | null;
}

/**
 * `result` null — servis sozlanmagan yoki javob bermadi; `templates` 0 — xodimda namuna yo'q.
 * `challenge` — Mini App bir necha kadr (bosh burish) yubordi: liveness talab qilinadi. Bot dumaloq videosi — jonli o'zi, talab yo'q.
 */
export function faceDecision(result: FaceVerify | null, opts: { templates: number; challenge: boolean; settings?: FaceSettings }): FaceDecision {
  const s = opts.settings ?? DEFAULT_FACE_SETTINGS;
  if (opts.templates === 0) return { status: 'suspicious', reasons: ['no_face_template'], score: null, liveness: null };
  if (!result) return { status: 'suspicious', reasons: ['face_unavailable'], score: null, liveness: null };
  if (!result.ok) return { status: 'suspicious', reasons: [result.reason === 'no_face' ? 'no_face' : 'face_unavailable'], score: null, liveness: null };
  const reasons: string[] = [];
  if (result.similarity < s.threshold) reasons.push('face_mismatch');
  if (result.manyFaces) reasons.push('many_faces');
  if (opts.challenge && result.yawRange < s.minYawRange) reasons.push('liveness_low');
  return { status: reasons.length ? 'suspicious' : 'ok', reasons, score: result.similarity, liveness: result.yawRange };
}

/** O'xshashlikni foizga (UI): 0.94 → 94. */
export const facePercent = (score: number | null | undefined) => (score == null ? null : Math.max(0, Math.round(score * 100)));
