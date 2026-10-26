import 'server-only';
/**
 * Rejali ishlar (cron → har 10 daqiqada har ishxonaga bitta `attendance_tick`):
 *   - bugungi va kechagi kunlik yig'ma qayta quriladi (kelmaganlar tabelga «Kelmadi» bo'lib tushadi);
 *   - «Ketdim» unutilgan kun avto-yopiladi (smena tugagandan `settings.autoCloseHours` keyin, Sozlamalar → Davomat) + xodim va rahbarga xabar;
 *   - kunlik «Kelmaganlar» ro'yxati rahbarlarga (standart 10:00, `tenants.settings.absentDigestAt`).
 */
import { and, eq, inArray } from 'drizzle-orm';
import { attendanceEvents, employees, onLeave, rebuildDay, tenants, withPlatform, withTenant, dayEvents, employeeRule } from '@adone/db';
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
    return list.length;
  });
}

export async function attendanceTick(tenantId: string, now = new Date()): Promise<JobOutcome> {
  let closed = 0;
  await withTenant(tenantId, async (tx) => {
    const [t] = await tx.select({ tz: tenants.timezone, settings: tenants.settings }).from(tenants).limit(1);
    const tz = t!.tz;
    const settings = tenantSettings(t!.settings);
    const today = localDate(now, tz);
    const emps = await tx.select({ id: employees.id, fullName: employees.fullName, departmentId: employees.departmentId }).from(employees).where(eq(employees.status, 'active'));
    for (const e of emps) {
      const rule = await employeeRule(tx, e.id);
      for (const date of [addDays(today, -1), today]) {
        const shift = rule ? shiftFor(rule, date, tz) : null;
        const evs = await dayEvents(tx, e.id, date);
        const r = computeDay({ events: evs, shift, now });
        if (r.open) {
          const lastIn = [...evs].reverse().find((x) => x.kind === 'check_in' && x.checkStatus !== 'rejected');
          const closeAt = shift ? new Date(shift.end.getTime() + settings.autoCloseHours * 3600_000) : lastIn ? new Date(lastIn.at.getTime() + settings.freeAutoCloseHours * 3600_000) : null;
          if (closeAt && now >= closeAt) {
            const at = shift ? shift.end : closeAt;
            await tx.insert(attendanceEvents).values({ tenantId, employeeId: e.id, workDate: date, kind: 'auto_close', serverAt: at, source: 'admin', checkStatus: 'ok', reasons: ['forgot_checkout'] });
            await queueNotifyEmployee(tx, tenantId, e.id, `ℹ️ ${date.split('-').reverse().join('.')} kuni «Ketdim» bosilmadi — tizim ${formatTime(at, tz)} da avtomatik yopdi. Xato bo'lsa rahbaringizga ayting.`);
            await queueNotifyMembers(tx, tenantId, `ℹ️ <b>${esc(e.fullName)}</b> «Ketdim» bosmagan — ${formatTime(at, tz)} da avto-yopildi.`, e.departmentId, undefined, '/tg');
            closed++;
          }
        }
        await rebuildDay(tx, { tenantId, employeeId: e.id, workDate: date, tz, now });
      }
    }
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
    const absent: string[] = [];
    const late: string[] = [];
    for (const e of emps) {
      const rule = await employeeRule(tx, e.id);
      const shift = rule ? shiftFor(rule, date, t!.tz) : null;
      if (!shift) continue;
      const r = computeDay({ events: await dayEvents(tx, e.id, date), shift, now: new Date(), onLeave: await onLeave(tx, e.id, date) });
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
