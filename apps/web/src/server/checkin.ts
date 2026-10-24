import 'server-only';
/**
 * Mini App keldi/ketdi/tanaffus — davomat jurnaliga yozish (CLAUDE.md §1.2–1.3). Klient natijasiga ishonilmaydi:
 * geofence (filial radiusi + aniqlik zaxirasi), ochiq/yopiq holat, vaqt — hammasi shu yerda, server vaqti bilan.
 * Bot o'z oqimida (server/bot) xuddi shu qoidalarni ishlatadi.
 */
import { eq } from 'drizzle-orm';
import { attendanceEvents, branches, dayEvents, employees, rebuildDay, tenants, workdayOf, type Tx } from '@adone/db';
import { checkGeofence, effectiveEvents, formatTime, nextAction } from '@adone/core';
import { escHtml as esc } from '@/lib/task-text';
import { queueNotifyMembers } from '@/server/notify';

export type CheckAction = 'check_in' | 'check_out';

export type CheckResult =
  | { ok: true; time: string; lateMinutes: number; workedMinutes: number; distanceM: number; branchName: string }
  | { ok: false; reason: 'outside' | 'low_accuracy' | 'state' | 'no_branch' | 'inactive' | 'no_photo'; message: string; distanceM?: number; branchName?: string };

/** Lokatsiya oldindan tekshiruvi (1-qadam ekrani): faqat masofa, hech narsa yozilmaydi. */
export async function previewGeofence(tx: Tx, employeeId: string, p: { lat: number; lng: number; accuracyM: number | null }) {
  const [e] = await tx.select({ branchId: employees.branchId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
  if (!e?.branchId) return null;
  const [b] = await tx.select().from(branches).where(eq(branches.id, e.branchId)).limit(1);
  if (!b) return null;
  const g = checkGeofence({ branch: { lat: b.lat, lng: b.lng, radiusM: b.radiusM }, point: { lat: p.lat, lng: p.lng }, accuracyM: p.accuracyM });
  return { ...g, branchName: b.name, radiusM: b.radiusM, branch: { lat: b.lat, lng: b.lng } };
}

export async function recordCheck(tx: Tx, input: {
  tenantId: string; employeeId: string; action: CheckAction; lat: number; lng: number; accuracyM: number | null; mediaId: string | null; source: 'miniapp' | 'bot';
}): Promise<CheckResult> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  const tz = t!.tz;
  const [e] = await tx.select().from(employees).where(eq(employees.id, input.employeeId)).limit(1);
  if (!e || e.status !== 'active') return { ok: false, reason: 'inactive', message: 'Hisobingiz faol emas yoki hali tasdiqlanmagan.' };
  if (!e.branchId) return { ok: false, reason: 'no_branch', message: 'Sizga filial biriktirilmagan. Rahbaringizga murojaat qiling.' };
  const [b] = await tx.select().from(branches).where(eq(branches.id, e.branchId)).limit(1);
  if (!b) return { ok: false, reason: 'no_branch', message: 'Filial topilmadi.' };
  const wd = await workdayOf(tx, e.id, new Date(), tz);
  const next = nextAction(await dayEvents(tx, e.id, wd.date));
  if (input.action !== next) return { ok: false, reason: 'state', message: input.action === 'check_in' ? 'Siz allaqachon ishdasiz.' : 'Siz hali «Keldim» qilmagansiz.' };
  if (input.action === 'check_in' && !input.mediaId) return { ok: false, reason: 'no_photo', message: 'Selfi kerak.' };
  const g = checkGeofence({ branch: { lat: b.lat, lng: b.lng, radiusM: b.radiusM }, point: { lat: input.lat, lng: input.lng }, accuracyM: input.accuracyM });
  const base = {
    tenantId: input.tenantId, employeeId: e.id, workDate: wd.date, branchId: b.id, lat: input.lat, lng: input.lng,
    accuracyM: input.accuracyM, distanceM: g.distanceM, isLiveLocation: null, source: input.source, mediaId: input.mediaId,
  };
  if (g.status === 'low_accuracy') return { ok: false, reason: 'low_accuracy', message: `GPS aniqligi past (±${input.accuracyM} m). Ochiq joyga chiqib qaytadan urinib ko'ring.`, distanceM: g.distanceM, branchName: b.name };
  if (g.status === 'outside') {
    // Rad etilgan urinish ham jurnalga (rahbar ko'radi), hisobga kirmaydi
    await tx.insert(attendanceEvents).values({ ...base, kind: input.action, checkStatus: 'rejected', reasons: ['outside'] });
    return { ok: false, reason: 'outside', message: `Zonadan tashqaridasiz: ${g.distanceM} m. Filialga yaqinroq boring.`, distanceM: g.distanceM, branchName: b.name };
  }
  // Yuz tekshiruvi (services/face) ulanmaguncha selfi saqlanadi va rahbar ko'radi; holat — ok
  await tx.insert(attendanceEvents).values({ ...base, kind: input.action, checkStatus: 'ok' });
  const r = await rebuildDay(tx, { tenantId: input.tenantId, employeeId: e.id, workDate: wd.date, tz });
  if (input.action === 'check_in' && r.lateMinutes > 0) {
    await queueNotifyMembers(tx, input.tenantId, `⏰ <b>${esc(e.fullName)}</b> kechikdi: ${r.lateMinutes} daqiqa (keldi ${formatTime(r.firstIn, tz)}, Mini App).`, e.departmentId);
  }
  return { ok: true, time: formatTime(new Date(), tz), lateMinutes: input.action === 'check_in' ? r.lateMinutes : 0, workedMinutes: r.workedMinutes, distanceM: g.distanceM, branchName: b.name };
}

/** Tanaffus: faqat ishda bo'lganda; boshlangan bo'lsa — tugatadi. */
export async function toggleBreak(tx: Tx, tenantId: string, employeeId: string): Promise<{ ok: boolean; onBreak?: boolean; message?: string }> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  const wd = await workdayOf(tx, employeeId, new Date(), t!.tz);
  const evs = await dayEvents(tx, employeeId, wd.date);
  if (nextAction(evs) !== 'check_out') return { ok: false, message: 'Avval «Keldim» qiling.' };
  const onBreak = isOnBreak(evs);
  await tx.insert(attendanceEvents).values({ tenantId, employeeId, workDate: wd.date, kind: onBreak ? 'break_end' : 'break_start', source: 'miniapp', checkStatus: 'ok' });
  await rebuildDay(tx, { tenantId, employeeId, workDate: wd.date, tz: t!.tz });
  return { ok: true, onBreak: !onBreak };
}

export function isOnBreak(evs: Parameters<typeof effectiveEvents>[0]): boolean {
  let on = false;
  for (const e of effectiveEvents(evs)) {
    if (e.kind === 'break_start') on = true;
    else if (e.kind === 'break_end' || e.kind === 'check_out' || e.kind === 'auto_close' || e.kind === 'check_in') on = false;
  }
  return on;
}

