/**
 * «Nazorat» — admin bo'limlarni mezonlar bo'yicha tekshiradi (2026-10-31, egasi talabi). Mezonlar — ishxona sozlamasi
 * (`tenants.settings.inspection.criteria`); har mezon qaysi bo'limlarga tegishli (null — hammasiga). Tekshiruv yozuvi —
 * `inspections` (append-only): har mezonga ✓/✗, ✗ da izoh va rasm. ✗ → javobgar xodimga avtomatik vazifa (server/inspections.ts).
 */

export interface InspectionCriterion {
  id: string;
  label: string;
  /** Qaysi bo'limlarga tegishli (bo'lim id'lari); null — hamma bo'limga. */
  departments: string[] | null;
}

export interface InspectionItem {
  criterion: string;
  ok: boolean;
  note: string | null;
  mediaId: string | null;
}

export const DEFAULT_INSPECTION_CRITERIA: InspectionCriterion[] = [
  { id: 'polka', label: "Polka bo'sh qolmasligi", departments: null },
  { id: 'sennik', label: "Senniklar to'g'ri turishi", departments: null },
  { id: 'tozalik', label: 'Tozalik', departments: null },
  { id: 'tartib', label: 'Tartib', departments: null },
  { id: 'ortiqcha', label: "Ortiqcha narsa yo'qligi", departments: null },
  { id: 'kiyim', label: 'Kiyim turishi', departments: null },
];

export const MAX_CRITERIA = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sozlamadan (yoki formadan) kelgan mezonlar: id — lotin/raqam/chiziqcha, yorliq ≤ 60, bo'limlar — uuid ro'yxati yoki null. */
export function normalizeCriteria(raw: unknown): InspectionCriterion[] {
  if (!Array.isArray(raw)) return DEFAULT_INSPECTION_CRITERIA.map((c) => ({ ...c }));
  const out: InspectionCriterion[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label.trim().slice(0, 60) : '';
    if (!label) continue;
    let id = typeof o.id === 'string' ? o.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) : '';
    if (!id) id = `m${out.length + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    const deps = Array.isArray(o.departments) ? [...new Set(o.departments.filter((d): d is string => typeof d === 'string' && UUID_RE.test(d)))] : null;
    out.push({ id, label, departments: deps && deps.length ? deps : null });
    if (out.length >= MAX_CRITERIA) break;
  }
  return out;
}

/** Bo'limga tegishli mezonlar (hammaga tegishlilar + shu bo'lim uchun belgilanganlar). */
export function criteriaFor(criteria: InspectionCriterion[], departmentId: string): InspectionCriterion[] {
  return criteria.filter((c) => !c.departments || c.departments.includes(departmentId));
}

/** Formadan kelgan belgilar: mezon bo'limga tegishli bo'lishi shart; ✓ da izoh/rasm saqlanmaydi. Bitta ham bo'lmasa — null. */
export function buildItems(allowed: InspectionCriterion[], raw: Array<{ criterion: string; ok: boolean; note?: string | null; mediaId?: string | null }>): InspectionItem[] | null {
  const ids = new Set(allowed.map((c) => c.id));
  const seen = new Set<string>();
  const items: InspectionItem[] = [];
  for (const r of raw) {
    if (!ids.has(r.criterion) || seen.has(r.criterion)) continue;
    seen.add(r.criterion);
    const note = r.ok ? null : (r.note ?? '').trim().slice(0, 500) || null;
    items.push({ criterion: r.criterion, ok: !!r.ok, note, mediaId: r.ok ? null : r.mediaId && UUID_RE.test(r.mediaId) ? r.mediaId : null });
  }
  return items.length ? items : null;
}

export interface InspectionLike { departmentId: string; responsibleEmployeeId: string | null; items: InspectionItem[]; at: Date }

export interface InspectionStats { checks: number; items: number; ok: number; fail: number; /** ✓ ulushi, % (0–100); tekshiruv bo'lmasa null */ pct: number | null }

export function inspectionStats(list: InspectionLike[]): InspectionStats {
  let items = 0, ok = 0;
  for (const i of list) for (const it of i.items) { items++; if (it.ok) ok++; }
  return { checks: list.length, items, ok, fail: items - ok, pct: items ? Math.round((ok / items) * 100) : null };
}

/** Kalit bo'yicha guruhlab statistika (bo'lim, javobgar, kun). */
export function statsBy<K extends string>(list: InspectionLike[], key: (i: InspectionLike) => K | null): Map<K, InspectionStats> {
  const groups = new Map<K, InspectionLike[]>();
  for (const i of list) {
    const k = key(i);
    if (k == null) continue;
    const g = groups.get(k) ?? [];
    g.push(i);
    groups.set(k, g);
  }
  return new Map([...groups].map(([k, v]) => [k, inspectionStats(v)]));
}

/** Reyting: ✓ ulushi bo'yicha kamayish, teng bo'lsa ko'proq tekshirilgan oldin. */
export function rankInspections<T extends { stats: InspectionStats }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.stats.pct ?? -1) - (a.stats.pct ?? -1) || b.stats.checks - a.stats.checks);
}

/** Avtomatik vazifa sarlavhasi — shu bo'yicha ochiq vazifa qidiriladi (takror ochilmaydi). */
export function inspectionTaskTitle(departmentName: string, criterionLabel: string): string {
  return `${departmentName}: ${criterionLabel}`;
}
