import 'server-only';
/**
 * Mini App keldi/ketdi/tanaffus — davomat jurnaliga yozish (CLAUDE.md §1.2–1.3). Klient natijasiga ishonilmaydi:
 * geofence (filial radiusi + aniqlik zaxirasi), ochiq/yopiq holat, vaqt — hammasi shu yerda, server vaqti bilan.
 * Bot o'z oqimida (server/bot) xuddi shu qoidalarni ishlatadi.
 */
import { eq } from 'drizzle-orm';
import { attendanceEvents, autoClosedWorkday, branches, currentWorkday, employees, rebuildDay, tenants, type Tx } from '@adone/db';
import { checkGeofence, effectiveEvents, facePercent, formatTime, lateCheckout, type FaceDecision, type LateCheckout } from '@adone/core';
import { escHtml as esc } from '@/lib/task-text';
import { queueNotifyMembers, queueSuspicious } from '@/server/notify';
import { readSettings } from '@/server/settings';

export type CheckAction = 'check_in' | 'check_out';

export type CheckResult =
  | { ok: true; time: string; lateMinutes: number; workedMinutes: number; overtimeMinutes: number; distanceM: number; branchName: string; status: 'ok' | 'suspicious'; reasons: string[]; facePercent: number | null }
  /** Smena tugagan, xodim kechroq ketmoqda — «qo'shimcha ishladim» yoki «qo'shimcha ish bo'lmadi» tanlovi (overtime bilan qayta yuboriladi) */
  | { ok: false; reason: 'overtime_choice'; message: string; extraMinutes: number; shiftEndTime: string; autoClosed: boolean }
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
  /** Yuz qarori (faceDecision) — faqat Keldim'da; tranzaksiyadan oldin hisoblangan. */
  face?: FaceDecision;
  /** Mini App qurilmasi: birinchi marta bog'lanadi, boshqasidan — «shubhali». */
  device?: { id: string; label: string } | null;
  /** Bot: jonli lokatsiya (null — Mini App) */
  live?: boolean | null;
  /** Kechikkan «Ketdim» javobi (core lateCheckout): 'yes' — qo'shimcha ishladim, 'no' — qo'shimcha ish bo'lmadi */
  overtime?: 'yes' | 'no';
}): Promise<CheckResult> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  const tz = t!.tz;
  // Xodim qatori qulflanadi: ikki bosish yoki bot + Mini App bir vaqtda — ikkinchisi birinchisi tugashini kutadi va
  // «allaqachon ishdasiz» oladi (ikki marta «Keldim» yozilmaydi)
  const [e] = await tx.select().from(employees).where(eq(employees.id, input.employeeId)).for('update').limit(1);
  if (!e || e.status !== 'active') return { ok: false, reason: 'inactive', message: 'Hisobingiz faol emas yoki hali tasdiqlanmagan.' };
  if (!e.branchId) return { ok: false, reason: 'no_branch', message: 'Sizga filial biriktirilmagan. Rahbaringizga murojaat qiling.' };
  const [b] = await tx.select().from(branches).where(eq(branches.id, e.branchId)).limit(1);
  if (!b) return { ok: false, reason: 'no_branch', message: 'Filial topilmadi.' };
  // Yarim tundan keyin «Ketdim» — kechagi ochiq kunga (currentWorkday)
  const now = new Date();
  const cur = await currentWorkday(tx, e.id, now, tz);
  let wd: { date: string; shift: typeof cur.shift; events: typeof cur.events; open: boolean } = cur;
  let late: LateCheckout = wd.open ? lateCheckout(wd.events, wd.shift, now) : { kind: 'none' };
  // Avto-yopilgan kun, xodim kechroq ketmoqda — «Ketdim» qo'shimcha vaqt savoli bilan (core lateCheckout)
  if (input.action === 'check_out' && !wd.open) {
    const ac = await autoClosedWorkday(tx, e.id, now, tz);
    if (ac) { wd = { ...ac, open: false }; late = ac.late; }
  }
  const next = wd.open || late.kind === 'auto_closed' ? 'check_out' : 'check_in';
  if (input.action !== next) return { ok: false, reason: 'state', message: input.action === 'check_in' ? 'Siz allaqachon ishdasiz.' : 'Siz hali «Keldim» qilmagansiz.' };
  if (input.action === 'check_in' && !input.mediaId) return { ok: false, reason: 'no_photo', message: 'Selfi kerak.' };
  const g = checkGeofence({ branch: { lat: b.lat, lng: b.lng, radiusM: b.radiusM }, point: { lat: input.lat, lng: input.lng }, accuracyM: input.accuracyM });
  const base = {
    tenantId: input.tenantId, employeeId: e.id, workDate: wd.date, branchId: b.id, lat: input.lat, lng: input.lng,
    accuracyM: input.accuracyM, distanceM: g.distanceM, isLiveLocation: input.live ?? null, source: input.source, mediaId: input.mediaId,
  };
  if (g.status === 'low_accuracy') return { ok: false, reason: 'low_accuracy', message: `GPS aniqligi past (±${input.accuracyM} m). Ochiq joyga chiqib qaytadan urinib ko'ring.`, distanceM: g.distanceM, branchName: b.name };
  if (g.status === 'outside') {
    // Rad etilgan urinish ham jurnalga (rahbar ko'radi), hisobga kirmaydi
    await tx.insert(attendanceEvents).values({ ...base, kind: input.action, checkStatus: 'rejected', reasons: ['outside'] });
    return { ok: false, reason: 'outside', message: `Zonadan tashqaridasiz: ${g.distanceM} m. Filialga yaqinroq boring.`, distanceM: g.distanceM, branchName: b.name };
  }
  // Kechikkan «Ketdim»: tanlov so'raladi, keyin tanlovga qarab yoziladi
  if (input.action === 'check_out' && late.kind !== 'none') {
    const endTime = formatTime(wd.shift!.end, tz);
    if (!input.overtime) {
      return {
        ok: false, reason: 'overtime_choice', extraMinutes: late.extraMinutes, shiftEndTime: endTime, autoClosed: late.kind === 'auto_closed',
        message: `Smenangiz ${endTime} da tugagan${late.kind === 'auto_closed' ? ' va kun avtomatik yopilgan' : ''}. Qo'shimcha ${late.extraMinutes} daqiqa ishladingizmi?`,
      };
    }
    if (late.kind === 'open_after_end') {
      // «ha» — hozir; «yo'q» — smena oxiri vaqti bilan (serverAt), kun o'sha paytda yopiladi
      await tx.insert(attendanceEvents).values({ ...base, kind: 'check_out', checkStatus: 'ok', reasons: [input.overtime === 'yes' ? 'overtime' : 'no_overtime'], serverAt: input.overtime === 'yes' ? now : wd.shift!.end });
    } else if (input.overtime === 'yes') {
      // Avto-yopish bekor, chiqish hozirgi vaqt bilan (tuzatish hodisalari — core effectiveEvents)
      await tx.insert(attendanceEvents).values({ ...base, kind: 'correction', checkStatus: 'ok', reasons: ['overtime'], meta: { action: 'void', target: late.autoCloseId, reason: 'overtime' } });
      await tx.insert(attendanceEvents).values({ ...base, kind: 'correction', checkStatus: 'ok', reasons: ['overtime'], meta: { action: 'add_out', at: now.toISOString(), reason: 'overtime' } });
    }
    const r = await rebuildDay(tx, { tenantId: input.tenantId, employeeId: e.id, workDate: wd.date, tz });
    if (input.overtime === 'yes') await queueNotifyMembers(tx, input.tenantId, `⏱ <b>${esc(e.fullName)}</b> qo'shimcha ishladi: ${late.extraMinutes} daqiqa (smena ${endTime}, ketdi ${formatTime(now, tz)}).`, e.departmentId, undefined, '/tg');
    return {
      ok: true, time: input.overtime === 'yes' ? formatTime(now, tz) : endTime, lateMinutes: 0, workedMinutes: r.workedMinutes, overtimeMinutes: r.overtimeMinutes, distanceM: g.distanceM, branchName: b.name,
      status: 'ok', reasons: [], facePercent: null,
    };
  }
  const reasons = [...(input.face?.reasons ?? [])];
  // Qurilma bog'lash (Sozlamalar → Davomat): o'chiq bo'lsa boshqa telefon shubhali emas
  if (input.device && (await readSettings(tx)).deviceBinding) {
    if (!e.deviceId) await tx.update(employees).set({ deviceId: input.device.id, deviceLabel: input.device.label, deviceBoundAt: new Date() }).where(eq(employees.id, e.id));
    else if (e.deviceId !== input.device.id) reasons.push('other_device');
  }
  const checkStatus = reasons.length ? 'suspicious' : 'ok';
  await tx.insert(attendanceEvents).values({ ...base, kind: input.action, checkStatus, reasons, faceScore: input.face?.score ?? null, livenessScore: input.face?.liveness ?? null });
  const r = await rebuildDay(tx, { tenantId: input.tenantId, employeeId: e.id, workDate: wd.date, tz });
  if (input.action === 'check_in' && r.lateMinutes > 0) {
    await queueNotifyMembers(tx, input.tenantId, `⏰ <b>${esc(e.fullName)}</b> kechikdi: ${r.lateMinutes} daqiqa (keldi ${formatTime(r.firstIn, tz)}, Mini App).`, e.departmentId, 'late', '/tg');
  }
  if (checkStatus === 'suspicious') {
    await queueSuspicious(tx, input.tenantId, `🔎 <b>${esc(e.fullName)}</b> — ${input.action === 'check_in' ? 'kelish' : 'ketish'} shubhali (${reasons.join(', ')}). Mini App → Qarorlar yoki Panel → Davomat → «Shubhali».`, e.departmentId);
  }
  return {
    ok: true, time: formatTime(new Date(), tz), lateMinutes: input.action === 'check_in' ? r.lateMinutes : 0, workedMinutes: r.workedMinutes, overtimeMinutes: r.overtimeMinutes, distanceM: g.distanceM, branchName: b.name,
    status: checkStatus, reasons, facePercent: facePercent(input.face?.score),
  };
}

/** Tanaffus: faqat ishda bo'lganda; boshlangan bo'lsa — tugatadi. */
export async function toggleBreak(tx: Tx, tenantId: string, employeeId: string): Promise<{ ok: boolean; onBreak?: boolean; message?: string }> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  await tx.select({ id: employees.id }).from(employees).where(eq(employees.id, employeeId)).for('update'); // ikki bosish — ketma-ket
  const wd = await currentWorkday(tx, employeeId, new Date(), t!.tz);
  const evs = wd.events;
  if (!wd.open) return { ok: false, message: 'Avval «Keldim» qiling.' };
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

