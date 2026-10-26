import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outsideQuietHours, zonedTime, canTransition, initialStatus, isOverdue, kanbanColumn, missingProofs, nextStatuses, occursOn, onTime } from '../src/index';

test('vazifa o‘tishlari: kim nima qila oladi', () => {
  assert.equal(canTransition('new', 'accepted', 'assignee'), true);
  assert.equal(canTransition('new', 'accepted', 'reviewer'), false, 'rahbar xodim o‘rniga qabul qilmaydi');
  assert.equal(canTransition('in_progress', 'approved', 'assignee'), false, 'o‘zini tasdiqlay olmaydi');
  assert.equal(canTransition('submitted', 'approved', 'reviewer'), true);
  assert.equal(canTransition('submitted', 'revision', 'reviewer'), true);
  assert.equal(canTransition('revision', 'submitted', 'assignee'), true);
  assert.equal(canTransition('approved', 'cancelled', 'reviewer'), false, 'yopilgan vazifa o‘zgarmaydi');
  assert.deepEqual(nextStatuses('submitted', 'assignee'), []);
  assert.deepEqual(nextStatuses('new', 'reviewer'), ['cancelled']);
});

test('boshlang‘ich holat (§7a), muddat, kanban, isbot', () => {
  assert.equal(initialStatus('assigned', true), 'new');
  assert.equal(initialStatus('self_plan', true), 'accepted');
  assert.equal(initialStatus('self_done', true), 'submitted');
  assert.equal(initialStatus('self_done', false), 'approved');
  const now = new Date('2026-10-20T10:00:00Z');
  const due = new Date('2026-10-20T09:00:00Z');
  assert.equal(isOverdue({ status: 'in_progress', dueAt: due }, now), true);
  assert.equal(isOverdue({ status: 'submitted', dueAt: due }, now), false, 'topshirilgan — kechikkan emas');
  assert.equal(onTime({ dueAt: due, submittedAt: now }), false);
  assert.equal(onTime({ dueAt: null, submittedAt: now }), true);
  assert.equal(kanbanColumn('revision'), 'progress');
  assert.equal(kanbanColumn('cancelled'), null);
  assert.deepEqual(missingProofs(['photo', 'location'], { photo: true, video: false, location: false }), ['location']);
  assert.deepEqual(missingProofs(['button'], { photo: false, video: false, location: false }), []);
});

test('takrorlanish', () => {
  assert.equal(occursOn({ kind: 'weekly', weekdays: [1, 3], monthDay: 1 }, '2026-10-19'), true); // dushanba
  assert.equal(occursOn({ kind: 'weekly', weekdays: [1, 3], monthDay: 1 }, '2026-10-20'), false);
  assert.equal(occursOn({ kind: 'monthly', weekdays: [], monthDay: 31 }, '2026-11-30'), true, 'oyda 31 yo‘q — oxirgi kun');
  assert.equal(occursOn({ kind: 'daily', weekdays: [], monthDay: 1 }, '2026-11-30'), true);
});

test('tungi tinchlik', () => {
  const tz = 'Asia/Tashkent';
  const day = zonedTime('2026-10-20', '15:00', tz);
  assert.equal(outsideQuietHours(day, tz).getTime(), day.getTime());
  assert.equal(outsideQuietHours(zonedTime('2026-10-20', '23:10', tz), tz).toISOString(), zonedTime('2026-10-21', '08:00', tz).toISOString());
  assert.equal(outsideQuietHours(zonedTime('2026-10-21', '03:00', tz), tz).toISOString(), zonedTime('2026-10-21', '08:00', tz).toISOString(), 'tungi — shu kuni ertalab');
  // Kun ichidagi oraliq (ishxona sozlamasi): 00→06 va 10→14
  assert.equal(outsideQuietHours(zonedTime('2026-10-21', '03:00', tz), tz, { from: 0, to: 6 }).toISOString(), zonedTime('2026-10-21', '06:00', tz).toISOString());
  assert.equal(outsideQuietHours(zonedTime('2026-10-21', '12:00', tz), tz, { from: 10, to: 14 }).toISOString(), zonedTime('2026-10-21', '14:00', tz).toISOString());
  assert.equal(outsideQuietHours(zonedTime('2026-10-21', '09:00', tz), tz, { from: 10, to: 14 }).toISOString(), zonedTime('2026-10-21', '09:00', tz).toISOString(), 'oraliqdan tashqari — o‘zgarmaydi');
  assert.equal(outsideQuietHours(zonedTime('2026-10-21', '15:00', tz), tz, { from: 10, to: 14 }).toISOString(), zonedTime('2026-10-21', '15:00', tz).toISOString());
  assert.equal(outsideQuietHours(zonedTime('2026-10-21', '03:00', tz), tz).toISOString(), zonedTime('2026-10-21', '08:00', tz).toISOString());
});
