import 'server-only';
/**
 * Rejali ishlar (cron → har 10 daqiqada har ishxonaga bitta `attendance_tick`):
 *   - bugungi va kechagi kunlik yig'ma qayta quriladi (kelmaganlar tabelga «Kelmadi» bo'lib tushadi);
 *   - «Ketdim» unutilgan kun avto-yopiladi (smena tugagandan `settings.autoCloseHours` keyin, Sozlamalar → Davomat) + xodim va rahbarga xabar;
 *   - kunlik «Kelmaganlar» ro'yxati rahbarlarga (standart 10:00, `tenants.settings.absentDigestAt`).
 */
import { and, eq, inArray } from 'drizzle-orm';
import { attendanceEvents, employees, eventsFor, leavesFor, rebuildDays, rulesFor, tenants, withPlatform, withTenant } from '@adone/db';
import { addDays, computeDay, formatTime, localDate, shiftFor, tenantSettings, zonedParts } from '@adone/core';
import { esc } from '@/server/telegram/api';
import { enqueue } from '@/server/jobs/enqueue';
import { miniAppKeyboard, notifyMembers, queueNotifyEmployee, queueNotifyMembers } from '@/server/notify';
import type { JobOutcome } from '@/server/jobs/types';
import { runTaskTemplates } from '@/server/tasks';

/** Cron'dan (har daqiqa): har ishxonaga 10 daqiqalik bo'lakda bitta tick. */
export async function scheduleTicks(now = new Date()): Promise<number> {
  const bucket = new Date(Math.floor(now.getTime() / 600_000) * 600_000).toISOString().slice(0, 16);
  return withPlatform(async (tx) => {
    const list = await tx.select({ id: tenants.id }).from(tenants).where(inArray(tenants.status, ['trial', 'active', 'past_due']));
    for (const t of list) await enqueue(tx, t.id, 'attendance_tick', {}, { dedupeKey: `tick:${t.id}:${bucket}`, maxAttempts: 2 });
    // Platforma ishlari (Toshkent vaqti): 03:00 dan keyin tozalash, 09:00 dan keyin egasiga kunlik xulosa — kuniga bir marta
    const day = localDate(now, 'Asia/Tashkent');
    const hour = zonedParts(now, 'Asia/Tashkent').h;
    if (hour >= 3) await enqueue(tx, null, 'cleanup', {}, { dedupeKey: `cleanup:${day}`, maxAttempts: 3 });
    if (hour >= 9) await enqueue(tx, null, 'daily_report', {}, { dedupeKey: `report:${day}`, maxAttempts: 3 });
    return list.length;
  });
}

/**
 * Tick to'plam bilan (2-bosqich 2.2): oldin har xodim × kun uchun ~11 so'rov edi (60 xodim ≈ 700, bitta uzun tranzaksiya —
 * «Keldim» shuni kutardi). Endi: xodimlar + qoidalar + hodisalar + ruxsatlar (4 o'qish), hisob xotirada, avto-yopish yozuvlari,
 * bitta upsert — xodim soniga bog'liq emas.
 */
export async function attendanceTick(tenantId: string, now = new Date()): Promise<JobOutcome> {
  let closed = 0;
  await withTenant(tenantId, async (tx) => {
    const [t] = await tx.select({ tz: tenants.timezone, settings: tenants.settings }).from(tenants).limit(1);
    const tz = t!.tz;
    const settings = tenantSettings(t!.settings);
    const today = localDate(now, tz);
    const dates = [addDays(today, -1), today];
    const emps = await tx.select({ id: employees.id, fullName: employees.fullName, departmentId: employees.departmentId }).from(employees).where(eq(employees.status, 'active'));
    const ids = emps.map((e) => e.id);
    const [rules, events, leaves] = [await rulesFor(tx, ids), await eventsFor(tx, ids, dates), await leavesFor(tx, ids, dates)];
    for (const e of emps) {
      const rule = rules.get(e.id) ?? null;
      for (const date of dates) {
        const shift = rule ? shiftFor(rule, date, tz) : null;
        const evs = events.get(`${e.id}|${date}`) ?? [];
        const r = computeDay({ events: evs, shift, now });
        if (!r.open) continue;
        const lastIn = [...evs].reverse().find((x) => x.kind === 'check_in' && x.checkStatus !== 'rejected');
        const closeAt = shift ? new Date(shift.end.getTime() + settings.autoCloseHours * 3600_000) : lastIn ? new Date(lastIn.at.getTime() + settings.freeAutoCloseHours * 3600_000) : null;
        if (!closeAt || now < closeAt) continue;
        const at = shift ? shift.end : closeAt;
        const [ev] = await tx.insert(attendanceEvents).values({ tenantId, employeeId: e.id, workDate: date, kind: 'auto_close', serverAt: at, source: 'admin', checkStatus: 'ok', reasons: ['forgot_checkout'] })
          .returning({ id: attendanceEvents.id });
        // Yig'ma xotiradagi ro'yxatdan quriladi — yangi hodisa ham unda bo'lsin
        events.set(`${e.id}|${date}`, [...evs, { id: ev!.id, kind: 'auto_close' as const, at, checkStatus: 'ok' as const, meta: null }].sort((a, b) => a.at.getTime() - b.at.getTime()));
        await queueNotifyEmployee(tx, tenantId, e.id, `ℹ️ ${date.split('-').reverse().join('.')} kuni «Ketdim» bosilmadi — tizim ${formatTime(at, tz)} da avtomatik yopdi. Xato bo'lsa rahbaringizga ayting.`);
        await queueNotifyMembers(tx, tenantId, `ℹ️ <b>${esc(e.fullName)}</b> «Ketdim» bosmagan — ${formatTime(at, tz)} da avto-yopildi.`, e.departmentId, undefined, '/tg');
        closed++;
      }
    }
    await rebuildDays(tx, { tenantId, tz, now, items: emps.flatMap((e) => dates.map((workDate) => ({ employeeId: e.id, workDate }))), preloaded: { rules, events, leaves } });
    // Takrorlanuvchi vazifalar (kuniga bir marta, last_run_date bilan)
    await runTaskTemplates(tx, tenantId, now);
    // Kelmaganlar ro'yxati — kuniga bir marta, belgilangan vaqtdan keyin
    const p = zonedParts(now, tz);
    const hhmm = `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
    if (settings.notifications.absent.on && hhmm >= settings.absentDigestAt) await enqueue(tx, tenantId, 'absent_digest', { date: today }, { dedupeKey: `absent:${tenantId}:${today}`, maxAttempts: 3 });
  });
  return closed ? {} : { skip: 'yopiladigan kun yo‘q' };
}

export async function absentDigest(tenantId: string, date: string): Promise<JobOutcome> {
  const text = await withTenant(tenantId, async (tx) => {
    const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
    const emps = await tx.select({ id: employees.id, fullName: employees.fullName, phone: employees.phone }).from(employees).where(and(eq(employees.status, 'active')));
    const ids = emps.map((e) => e.id);
    // To'plam: 3 ta so'rov (xodim soniga bog'liq emas)
    const [rules, events, leaves] = [await rulesFor(tx, ids), await eventsFor(tx, ids, [date]), await leavesFor(tx, ids, [date])];
    const absent: string[] = [];
    const late: string[] = [];
    for (const e of emps) {
      const rule = rules.get(e.id) ?? null;
      const shift = rule ? shiftFor(rule, date, t!.tz) : null;
      if (!shift) continue;
      const r = computeDay({ events: events.get(`${e.id}|${date}`) ?? [], shift, now: new Date(), onLeave: leaves.has(`${e.id}|${date}`) });
      if (r.status === 'absent') absent.push(`• ${esc(e.fullName)}${e.phone ? ` — +${e.phone}` : ''} (smena ${formatTime(shift.start, t!.tz)})`);
      else if (r.lateMinutes > 0) late.push(`• ${esc(e.fullName)} — ${r.lateMinutes} daq`);
    }
    if (absent.length === 0 && late.length === 0) return null;
    return [
      `📋 <b>Bugun, ${date.split('-').reverse().join('.')}</b>`,
      absent.length ? `\n❌ Kelmaganlar (${absent.length}):\n${absent.join('\n')}` : '\n✅ Kelmagan yo‘q',
      late.length ? `\n⏰ Kechikkanlar (${late.length}):\n${late.join('\n')}` : '',
    ].join('\n');
  });
  if (!text) return { skip: 'hamma joyida' };
  return notifyMembers(tenantId, text, null, 'absent', miniAppKeyboard('/tg'));
}
