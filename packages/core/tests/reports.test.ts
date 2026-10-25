import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arrivalHistogram, arrivalText, attendanceStats, attentionReason, averageCame, dailySeries, hhmm, journalHeading, periodLabel, placeChange,
  ppDelta, rankBy, ratingScore, reportPeriod, shortDuration, shortRange, taskStats, weekBuckets, weeklySeries,
  type ReportDay, type ReportTask,
} from '../src/index';

const day = (status: ReportDay['status'], extra: Partial<ReportDay> = {}): ReportDay => ({
  employeeId: 'e1', workDate: '2026-10-01', status, planned: status !== 'off', workedMinutes: status === 'present' || status === 'late' ? 600 : 0,
  lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, arrival: null, ...extra,
});

test('davr: bu oy / o‘tgan oy / haftalar / tanlash', () => {
  const t = '2026-10-26'; // dushanba
  assert.deepEqual(reportPeriod('oy', t), { preset: 'oy', from: '2026-10-01', to: '2026-10-26', prevFrom: '2026-09-01', prevTo: '2026-09-26' });
  assert.deepEqual(reportPeriod('otgan-oy', t), { preset: 'otgan-oy', from: '2026-09-01', to: '2026-09-30', prevFrom: '2026-08-01', prevTo: '2026-08-31' });
  assert.deepEqual(reportPeriod('hafta', t), { preset: 'hafta', from: '2026-10-26', to: '2026-10-26', prevFrom: '2026-10-19', prevTo: '2026-10-19' });
  assert.deepEqual(reportPeriod('otgan-hafta', t), { preset: 'otgan-hafta', from: '2026-10-19', to: '2026-10-25', prevFrom: '2026-10-12', prevTo: '2026-10-18' });
  // 30-mart → fevralning oxiri; butun oy → butun oldingi oy
  assert.equal(reportPeriod('oy', '2027-03-30').prevTo, '2027-02-28');
  assert.equal(reportPeriod('otgan-oy', '2027-04-10').prevTo, '2027-02-28');
  // Tanlash: teskari tartib, kelajak kesiladi, oldingi davr — shu uzunlik
  assert.deepEqual(reportPeriod('tanlash', t, { from: '2026-10-30', to: '2026-10-20' }), { preset: 'tanlash', from: '2026-10-20', to: '2026-10-26', prevFrom: '2026-10-13', prevTo: '2026-10-19' });
  assert.equal(reportPeriod('tanlash', t, { from: '2026-01-01', to: '2026-10-26' }).from, '2026-07-26'); // ≤ 93 kun
  assert.equal(reportPeriod('tanlash', t, { from: 'x' }).preset, 'oy');
  assert.deepEqual(reportPeriod('tanlash', t, { from: '2026-09-01', to: '2026-09-30' }).prevFrom, '2026-08-01');
  assert.deepEqual(reportPeriod('tanlash', t, { from: '2026-09-01', to: '2026-09-30' }).prevTo, '2026-08-31');
  assert.equal(reportPeriod('nimadir', t).preset, 'oy');
});

test('davr yorlig‘i va haftalar', () => {
  assert.equal(periodLabel('2026-10-01', '2026-10-26', '2026-10-26'), 'Oktabr 2026');
  assert.equal(periodLabel('2026-09-01', '2026-09-30'), 'Sentabr 2026');
  assert.equal(periodLabel('2026-10-19', '2026-10-25'), '19–25.10.2026');
  assert.equal(shortRange('2026-09-28', '2026-10-04'), '28.09 – 04.10');
  const w = weekBuckets('2026-10-01', '2026-10-25');
  assert.equal(w.length, 4);
  assert.deepEqual(w[0], { from: '2026-10-01', to: '2026-10-04', label: '1-hafta', range: '01–04.10' });
  assert.deepEqual(w[3], { from: '2026-10-19', to: '2026-10-25', label: '4-hafta', range: '19–25.10' });
});

test('format: soat:daqiqa va qisqa davomiylik', () => {
  assert.equal(hhmm(10600), '176:40');
  assert.equal(shortDuration(24), '24 daq');
  assert.equal(shortDuration(90), '1 soat 30 daq');
  assert.equal(shortDuration(120), '2 soat');
  assert.equal(ppDelta(94, 92.2), 1.8);
  assert.equal(ppDelta(null, 90), null);
});

test('davomat: foiz kelgan / (kelgan + kelmagan), ruxsat kirmaydi', () => {
  const s = attendanceStats([
    ...Array(18).fill(day('present')), day('late', { lateMinutes: 7 }), day('absent'), day('leave'),
    day('present', { earlyLeaveMinutes: 15, overtimeMinutes: 30 }), day('off'),
  ]);
  assert.equal(s.planned, 22);
  assert.equal(s.came, 20);
  assert.equal(s.late, 1);
  assert.equal(s.lateMinutes, 7);
  assert.equal(s.early, 1);
  assert.equal(s.absent, 1);
  assert.equal(s.leave, 1);
  assert.equal(s.overtimeMinutes, 30);
  assert.equal(s.pct, 95); // 20 / 21
  assert.equal(attendanceStats([day('leave'), day('off')]).pct, null);
});

test('kunlar seriyasi: qolgani dam olish, haftalar va o‘rtacha', () => {
  const dates = ['2026-10-01', '2026-10-02', '2026-10-04'];
  const days = [
    day('present'), day('late', { employeeId: 'e2' }), day('absent', { employeeId: 'e3' }),
    day('present', { workDate: '2026-10-02' }), day('leave', { employeeId: 'e2', workDate: '2026-10-02' }),
  ];
  const s = dailySeries(days, dates, 4);
  assert.deepEqual(s[0], { date: '2026-10-01', present: 1, late: 1, absent: 1, leave: 0, off: 1 });
  assert.deepEqual(s[2], { date: '2026-10-04', present: 0, late: 0, absent: 0, leave: 0, off: 4 });
  assert.equal(averageCame(s), 2); // (2 + 1) / 2 ish kuni → 1.5 → 2
  const w = weeklySeries(s);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.present, 2);
  assert.equal(w[0]!.off, 7);
});

test('kelish gistogrammasi: 5 daqiqalik qutilar, chetlar', () => {
  const h = arrivalHistogram([day('present', { arrival: -20 }), day('present', { arrival: -3 }), day('present', { arrival: 0 }), day('late', { arrival: 4 }), day('late', { arrival: 90 }), day('absent')]);
  assert.deepEqual(h.bins.map((b) => b.n), [1, 0, 0, 2, 1, 0, 0, 0, 0, 1]);
  assert.equal(h.bins[3]!.onTime, true);
  assert.equal(h.bins[4]!.onTime, false);
  assert.equal(h.count, 5);
  assert.equal(h.avg, 14);
  assert.equal(arrivalText(-4), 'smenadan 4 daqiqa oldin');
  assert.equal(arrivalText(3), 'smenadan 3 daqiqa keyin');
});

test('vazifalar: berilgan, bajarildi, o‘z vaqtida, kechikdi, qaytarilgan, o‘zi qo‘shgan', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const due = new Date('2026-10-20T12:00:00Z');
  const t = (x: Partial<ReportTask>): ReportTask => ({ id: 'x', employeeId: 'e1', source: 'assigned', status: 'approved', createdAt: due, dueAt: due, submittedAt: null, rating: null, revisionCount: 0, spentMinutes: null, ...x });
  const s = taskStats([
    t({ submittedAt: new Date('2026-10-20T10:00:00Z'), rating: 5 }),
    t({ submittedAt: new Date('2026-10-21T10:00:00Z'), rating: 4, revisionCount: 1 }),
    t({ status: 'in_progress' }), // muddati o'tgan, ochiq
    t({ status: 'new', dueAt: null }),
    t({ status: 'cancelled', submittedAt: due }),
    t({ source: 'self_done', status: 'submitted', spentMinutes: 90, submittedAt: due }),
    t({ source: 'self_plan', status: 'accepted', spentMinutes: null }),
  ], now);
  assert.equal(s.given, 4);
  assert.equal(s.done, 2);
  assert.equal(s.donePct, 50);
  assert.equal(s.submitted, 2);
  assert.equal(s.onTimePct, 50);
  assert.equal(s.late, 2);
  assert.equal(s.returned, 1);
  assert.equal(s.avgRating, 4.5);
  assert.equal(s.selfDone, 1);
  assert.equal(s.selfPlan, 1);
  assert.equal(s.selfMinutes, 90);
});

test('reyting: 40/40/20, yo‘q qism qayta taqsimlanadi', () => {
  assert.equal(ratingScore({ attendance: 100, onTime: 97, rating: 4.9 }), 98); // 40 + 38.8 + 19.6
  assert.equal(ratingScore({ attendance: 90, onTime: null, rating: null }), 90);
  assert.equal(ratingScore({ attendance: 80, onTime: 60, rating: null }), 70);
  assert.equal(ratingScore({ attendance: null, onTime: null, rating: null }), null);
  const r = rankBy([{ n: 'B', s: 90 }, { n: 'A', s: 90 }, { n: 'C', s: 95 }, { n: 'D', s: null }], (x) => x.s, (x) => x.n);
  assert.deepEqual(r.map((x) => [x.item.n, x.place]), [['C', 1], ['A', 2], ['B', 3]]);
  assert.equal(placeChange(2, 4), 2);
  assert.equal(placeChange(3, 1), -2);
  assert.equal(placeChange(1, undefined), null);
});

test('e‘tibor sababi: eng ko‘p ball yo‘qotgan qism', () => {
  assert.equal(attentionReason({ attendance: 98, onTime: 70, rating: 4.5, late: 1, absent: 0, tasksLate: 4, avgRating: 4.5 })?.text, 'Vazifalar kechikmoqda: 4');
  assert.equal(attentionReason({ attendance: 80, onTime: 95, rating: 4.8, late: 7, absent: 1, tasksLate: 0, avgRating: 4.8 })?.text, "Ko'p kechikadi: 7 marta");
  assert.equal(attentionReason({ attendance: 80, onTime: null, rating: null, late: 1, absent: 3, tasksLate: 0, avgRating: null })?.text, 'Kelmagan: 3 kun');
  assert.equal(attentionReason({ attendance: 99, onTime: 96, rating: 3.1, late: 0, absent: 0, tasksLate: 0, avgRating: 3.1 })?.text, 'Past baho: 3.1');
  assert.equal(attentionReason({ attendance: 100, onTime: 100, rating: 5, late: 0, absent: 0, tasksLate: 0, avgRating: 5 }), null);
});

test('jurnal sarlavhasi', () => {
  assert.equal(journalHeading('2026-10-26', '2026-10-26'), 'Bugun');
  assert.equal(journalHeading('2026-10-25', '2026-10-26'), 'Kecha');
  assert.equal(journalHeading('2026-10-21', '2026-10-26'), 'Chorshanba');
});
