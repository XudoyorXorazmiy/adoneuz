import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDay, retimePlan, describeSchedule, isWorkday, localDate, monthDays, nextAction, shiftFor, workdayFor, zonedTime, type DayEvent, type ScheduleRule } from '../src/index';

const TZ = 'Asia/Tashkent';
const base: ScheduleRule = { kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6], cycleOn: 0, cycleOff: 0, cycleStart: null, startTime: '09:00', endTime: '21:00', breakMinutes: 60, graceMinutes: 10 };
const at = (d: string, t: string) => zonedTime(d, t, TZ);
let n = 0;
const ev = (kind: DayEvent['kind'], d: Date, extra: Partial<DayEvent> = {}): DayEvent => ({ id: `e${++n}`, kind, at: d, checkStatus: 'ok', ...extra });

test('vaqt mintaqasi', () => {
  assert.equal(at('2026-10-20', '09:00').toISOString(), '2026-10-20T04:00:00.000Z');
  assert.equal(localDate(new Date('2026-10-19T20:30:00Z'), TZ), '2026-10-20');
  assert.equal(monthDays('2026-02').length, 28);
});

test('jadval: haftalik, 2/2, tungi smena', () => {
  assert.equal(isWorkday(base, '2026-10-20'), true); // seshanba
  assert.equal(isWorkday(base, '2026-10-25'), false); // yakshanba
  const cyc: ScheduleRule = { ...base, kind: 'cycle', cycleOn: 2, cycleOff: 2, cycleStart: '2026-10-01' };
  assert.deepEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map((d) => isWorkday(cyc, d)), [true, true, false, false, true]);
  const night: ScheduleRule = { ...base, weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '20:00', endTime: '08:00' };
  const s = shiftFor(night, '2026-10-20', TZ)!;
  assert.equal(s.end.toISOString(), at('2026-10-21', '08:00').toISOString());
  // 21-oktabr 07:50 dagi chiqish — 20-oktabr ish kuniga
  assert.equal(workdayFor(night, at('2026-10-21', '07:50'), TZ).date, '2026-10-20');
  // 21-oktabr 19:45 dagi kirish — 21-oktabr smenasi
  assert.equal(workdayFor(night, at('2026-10-21', '19:45'), TZ).date, '2026-10-21');
  assert.equal(describeSchedule(base), '6/1 · 09:00–21:00');
  assert.equal(describeSchedule(cyc), '2/2 · 09:00–21:00');
});

test('kunlik hisob: kechikish, ishlagan vaqt, erta ketish', () => {
  const d = '2026-10-20';
  const shift = shiftFor(base, d, TZ)!;
  const events = [ev('check_in', at(d, '09:07')), ev('check_out', at(d, '21:00'))];
  const r = computeDay({ events, shift, now: at(d, '22:00') });
  assert.equal(r.lateMinutes, 0, 'chegara ichida (10 daq)');
  assert.equal(r.status, 'present');
  assert.equal(r.workedMinutes, 11 * 60 + 53 - 60);

  const late = computeDay({ events: [ev('check_in', at(d, '09:24')), ev('check_out', at(d, '18:00'))], shift, now: at(d, '22:00') });
  assert.equal(late.lateMinutes, 24);
  assert.equal(late.status, 'late');
  assert.equal(late.earlyLeaveMinutes, 180);

  const absent = computeDay({ events: [], shift, now: at(d, '12:00') });
  assert.equal(absent.status, 'absent');
  assert.equal(computeDay({ events: [], shift, now: at(d, '08:00') }).status, 'off', 'smena boshlanmagan');
  assert.equal(computeDay({ events: [], shift: null, now: at(d, '12:00') }).status, 'off');
  assert.equal(computeDay({ events: [], shift, now: at(d, '12:00'), onLeave: true }).status, 'leave');
});

test('tanaffus, ochiq kun, avto-yopish', () => {
  const d = '2026-10-20';
  const shift = shiftFor(base, d, TZ)!;
  const r = computeDay({ events: [ev('check_in', at(d, '09:00')), ev('break_start', at(d, '13:00')), ev('break_end', at(d, '13:30')), ev('check_out', at(d, '18:00'))], shift, now: at(d, '22:00') });
  assert.equal(r.workedMinutes, 8 * 60 + 30);
  const open = computeDay({ events: [ev('check_in', at(d, '09:00'))], shift, now: at(d, '11:00') });
  assert.equal(open.open, true);
  assert.equal(open.workedMinutes, 120);
  const auto = computeDay({ events: [ev('check_in', at(d, '09:00')), ev('auto_close', at(d, '21:00'))], shift, now: at(d, '23:30') });
  assert.equal(auto.earlyLeaveMinutes, 0);
  assert.equal(auto.open, false);
});

test('tuzatish va rad etilgan hodisa', () => {
  const d = '2026-10-20';
  const shift = shiftFor(base, d, TZ)!;
  const bad = ev('check_in', at(d, '09:40'));
  const events = [
    ev('check_in', at(d, '08:50'), { checkStatus: 'rejected' }),
    bad,
    ev('correction', at(d, '12:00'), { meta: { action: 'void', target: bad.id } }),
    ev('correction', at(d, '12:01'), { meta: { action: 'add_in', at: at(d, '09:05').toISOString() } }),
    ev('check_out', at(d, '21:00')),
  ];
  const r = computeDay({ events, shift, now: at(d, '22:00') });
  assert.equal(r.firstIn?.toISOString(), at(d, '09:05').toISOString());
  assert.equal(r.status, 'present');
  assert.equal(nextAction(events), 'check_in');
  assert.equal(nextAction(events.slice(0, 2)), 'check_out');
});

test('shubhali belgisi', () => {
  const d = '2026-10-20';
  const r = computeDay({ events: [ev('check_in', at(d, '09:00'), { checkStatus: 'suspicious' })], shift: shiftFor(base, d, TZ), now: at(d, '10:00') });
  assert.equal(r.suspicious, true);
  const sus = ev('check_in', at(d, '09:00'), { checkStatus: 'suspicious' });
  const ok = computeDay({ events: [sus, ev('correction', at(d, '10:00'), { meta: { action: 'approve', target: sus.id } })], shift: shiftFor(base, d, TZ), now: at(d, '10:00') });
  assert.equal(ok.suspicious, false, 'tasdiqlangach shubha yo‘q');
});

test('vaqtni qayta belgilash (retimePlan) va tuzatishni bekor qilish', () => {
  const d = '2026-10-20';
  const shift = shiftFor(base, d, TZ)!;
  const inn = ev('check_in', at(d, '09:30'));
  const auto = ev('auto_close', at(d, '23:59'));
  let events: DayEvent[] = [inn, auto];
  const plan = retimePlan(events, { in: at(d, '09:00'), out: at(d, '18:00') });
  assert.deepEqual(plan.map((p) => p.action), ['void', 'add_in', 'void', 'add_out']);
  let k = 0;
  const apply = (list: typeof plan) => list.map((m) => ev('correction', at(d, '22:00'), { id: `c${++k}`, meta: m }));
  events = [...events, ...apply(plan)];
  let r = computeDay({ events, shift, now: at(d, '23:00') });
  assert.equal(r.firstIn?.toISOString(), at(d, '09:00').toISOString());
  assert.equal(r.lastOut?.toISOString(), at(d, '18:00').toISOString());
  assert.equal(r.lateMinutes, 0);
  // Yana o'zgartirish: endi bekor qilinadigani — avvalgi tuzatish (add_out)
  const again = retimePlan(events, { out: at(d, '19:00') });
  assert.equal(again[0]?.action, 'void');
  assert.equal((again[0] as { target?: string }).target, 'c4');
  events = [...events, ...apply(again)];
  r = computeDay({ events, shift, now: at(d, '23:00') });
  assert.equal(r.lastOut?.toISOString(), at(d, '19:00').toISOString());
  assert.deepEqual(retimePlan(events, { in: at(d, '09:00') }), [], "o'zgarmasa — bo'sh");
});

test('ruxsatda: kelmagan kun «Ruxsatda», kelgan bo‘lsa — Ishda', () => {
  const d = '2026-10-20';
  const shift = shiftFor(base, d, TZ)!;
  assert.equal(computeDay({ events: [], shift, now: at(d, '15:00'), onLeave: true }).status, 'leave');
  assert.equal(computeDay({ events: [], shift, now: at(d, '15:00') }).status, 'absent');
  assert.equal(computeDay({ events: [ev('check_in', at(d, '09:00'))], shift, now: at(d, '15:00'), onLeave: true }).status, 'present');
});
