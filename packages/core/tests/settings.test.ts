import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, describeDevice, notifyTargets, passwordProblem, passwordStrength, tenantSettings } from '../src/index';

test('sozlamalar: bo‘sh/yaroqsiz — standart, eski kalitlar saqlanadi', () => {
  assert.deepEqual(tenantSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(tenantSettings('x'), DEFAULT_SETTINGS);
  const s = tenantSettings({ autoApprove: true, absentDigestAt: '09:30', face: { threshold: 0.6 }, selfTasksNeedApproval: false });
  assert.equal(s.autoApprove, true);
  assert.equal(s.absentDigestAt, '09:30');
  assert.equal(s.face.threshold, 0.6);
  assert.equal(s.face.minYawRange, 15);
  assert.equal(s.selfTasksNeedApproval, false);
  assert.equal(tenantSettings({ absentDigestAt: '25:00' }).absentDigestAt, '10:00');
});

test('sozlamalar: chegaralar', () => {
  const s = tenantSettings({ autoCloseHours: 99, freeAutoCloseHours: 2.5, quietHours: { from: 8, to: 8 }, reminders: { notAcceptedMin: 45, dueSoon: false } });
  assert.equal(s.autoCloseHours, 3);
  assert.equal(s.freeAutoCloseHours, 16);
  assert.deepEqual(s.quietHours, { from: 22, to: 8 }, 'bir xil soat — standart');
  assert.equal(s.reminders.notAcceptedMin, 30, 'ruxsat etilmagan daqiqa');
  assert.equal(s.reminders.dueSoon, false);
  assert.equal(s.reminders.overdue, true);
  assert.deepEqual(tenantSettings({ quietHours: { from: 21, to: 7 } }).quietHours, { from: 21, to: 7 });
});

test('bildirishnoma: o‘chiq — hech kimga, ruxsat etilmagan rol tashlanadi', () => {
  assert.deepEqual(notifyTargets(DEFAULT_SETTINGS, 'late'), ['owner', 'admin', 'manager']);
  const s = tenantSettings({ notifications: { late: { on: false, to: ['admin'] }, absent: { on: true, to: ['creator', 'owner', 'zzz'] }, task_submitted: { to: ['creator'] } } });
  assert.deepEqual(notifyTargets(s, 'late'), []);
  assert.deepEqual(s.notifications.late.to, ['admin']);
  assert.deepEqual(notifyTargets(s, 'absent'), ['owner'], '«creator» faqat vazifa hodisalarida');
  assert.deepEqual(notifyTargets(s, 'task_submitted'), ['creator']);
});

test('qurilma nomi', () => {
  assert.deepEqual(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'), { label: 'Mac · Chrome', icon: 'laptop_mac' });
  assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1').label, 'iPhone · Safari');
  assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0').label, 'Windows · Edge');
  assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36').label, 'Android · Chrome');
  assert.equal(describeDevice(null).label, 'Qurilma');
});

test('parol talabi va kuchi', () => {
  assert.ok(passwordProblem('abc123'));
  assert.ok(passwordProblem('abcdefgh'), 'raqam yo‘q');
  assert.ok(passwordProblem('12345678'), 'harf yo‘q');
  assert.equal(passwordProblem('mudom2026'), null);
  assert.equal(passwordStrength('').score, 0);
  assert.ok(passwordStrength('Mudom-2026-bozor').score > passwordStrength('mudom2026').score);
});
