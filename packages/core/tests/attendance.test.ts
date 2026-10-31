import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDay, retimePlan, describeSchedule, isAltWeek, isWorkday, timesFor, localDate, monthDays, nextAction, normalizeTime, openWorkday, shiftFor, workdayFor, zonedTime, type DayEvent, type ScheduleRule } from '../src/index';

const TZ = 'Asia/Tashkent';
const base: ScheduleRule = { kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6], cycleOn: 0, cycleOff: 0, cycleStart: null, startTime: '09:00', endTime: '21:00', dayTimes: [], alt: null, breakMinutes: 60, graceMinutes: 10 };
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


test('yarim tundan keyin «Ketdim» — kechagi kun (2026-10-31)', () => {
  const d = '2026-10-20';
  const evs = [ev('check_in', at(d, '09:00'))];
  // 00:40 da ochiq kun kecha — joriy kun (21.10) bo'sh
  const now = at('2026-10-21', '00:40');
  assert.equal(openWorkday(now, [{ date: '2026-10-21', events: [] }, { date: d, events: evs }]), d);
  // Ketdim shu kunga yozilsa — bitta kun, 15:40 (jadvalsiz)
  const r = computeDay({ events: [...evs, ev('check_out', now)], shift: null, now });
  assert.equal(r.workedMinutes, 15 * 60 + 40);
  assert.equal(r.status, 'present');
  assert.equal(r.open, false);
  // Jadval bilan: 09:00–21:00, tanaffus 60 — qo'shimcha soat hisoblanadi, erta ketish yo'q
  const shift = shiftFor(base, d, TZ)!;
  const rs = computeDay({ events: [...evs, ev('check_out', now)], shift, now });
  assert.equal(rs.workedMinutes, 15 * 60 + 40 - 60);
  assert.equal(rs.earlyLeaveMinutes, 0);
  assert.equal(rs.overtimeMinutes, 15 * 60 + 40 - 60 - (12 * 60 - 60));
  // Yopilgan kun — ochiq emas
  assert.equal(openWorkday(now, [{ date: d, events: [...evs, ev('check_out', at(d, '20:00'))] }]), null);
  // Avto-yopilgan kun — ochiq emas
  assert.equal(openWorkday(now, [{ date: d, events: [...evs, ev('auto_close', at(d, '23:00'))] }]), null);
  // 24 soatdan eski kirish — e'tiborsiz
  assert.equal(openWorkday(at('2026-10-21', '09:30'), [{ date: d, events: evs }]), null);
});

test('vaqt normallashtirish (forma)', () => {
  assert.equal(normalizeTime('18:30'), '18:30');
  assert.equal(normalizeTime('18.30'), '18:30');
  assert.equal(normalizeTime('1830'), '18:30');
  assert.equal(normalizeTime('9:05'), '09:05');
  assert.equal(normalizeTime('24:00'), null);
  assert.equal(normalizeTime('abc'), null);
});

test('kunlar bo\'yicha vaqt va haftalik almashinuv', () => {
  // Umidjon: Du/Ch/Ju 08–20, qolgan kunlar 11–23
  const r: ScheduleRule = { ...base, weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '11:00', endTime: '23:00', dayTimes: [{ weekdays: [1, 3, 5], startTime: '08:00', endTime: '20:00' }] };
  assert.deepEqual(timesFor(r, '2026-10-26'), { startTime: '08:00', endTime: '20:00' }); // dushanba
  assert.deepEqual(timesFor(r, '2026-10-27'), { startTime: '11:00', endTime: '23:00' }); // seshanba
  assert.equal(shiftFor(r, '2026-10-26', TZ)!.start.toISOString(), '2026-10-26T03:00:00.000Z');
  // Almashinuv: anchor haftasi (26.10) 11–23, keyingi hafta (2.11) 08–20, undan keyin yana 11–23
  const a: ScheduleRule = { ...base, weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '11:00', endTime: '23:00', alt: { startTime: '08:00', endTime: '20:00', anchor: '2026-10-26' } };
  assert.equal(isAltWeek(a, '2026-10-28'), false);
  assert.equal(isAltWeek(a, '2026-11-01'), false); // yakshanba hali anchor haftasi
  assert.equal(isAltWeek(a, '2026-11-02'), true);
  assert.equal(isAltWeek(a, '2026-11-09'), false);
  assert.equal(isAltWeek(a, '2026-10-19'), true); // orqaga ham to'g'ri
  assert.deepEqual(timesFor(a, '2026-11-03'), { startTime: '08:00', endTime: '20:00' });
  assert.equal(describeSchedule(a), '7/0 · 11:00–23:00 ⇄ 08:00–20:00');
  assert.equal(describeSchedule(r), '7/0 · 11:00–23:00 (Du,Ch,Ju 08:00–20:00)');
});
