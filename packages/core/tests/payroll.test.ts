import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePay, DEFAULT_PAY_RULES, normalizePayRules, type PayDay } from '../src/index';

const day = (status: PayDay['status'], extra: Partial<PayDay> = {}): PayDay => ({ status, planned: true, workedMinutes: status === 'present' || status === 'late' ? 600 : 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, ...extra });

test('oylik: ishlangan kunlarga mutanosib, ruxsat to‘lanadi, butun so‘m', () => {
  const days = [...Array(20).fill(day('present')), day('leave'), day('absent'), day('absent'), day('present', { planned: false })];
  const r = computePay({ payType: 'monthly', rate: 4_500_000, days, tasks: [] }, DEFAULT_PAY_RULES);
  // reja 23 kun, to'langan 21 + 1 ruxsat (dam olish kuni ishlagani reja ustidan — min bilan cheklanadi)
  assert.equal(r.base, Math.round((4_500_000 * 22) / 23));
  assert.ok(Number.isInteger(r.base) && Number.isInteger(r.total));
  const noPro = computePay({ payType: 'monthly', rate: 4_500_000, days, tasks: [] }, { ...DEFAULT_PAY_RULES, monthlyProration: false });
  assert.equal(noPro.base, 4_500_000);
});

test('kunbay va soatbay', () => {
  assert.equal(computePay({ payType: 'daily', rate: 150_000, days: [day('present'), day('present'), day('leave')], tasks: [] }, { ...DEFAULT_PAY_RULES, paidLeave: false }).base, 300_000);
  assert.equal(computePay({ payType: 'hourly', rate: 20_000, days: [day('present', { workedMinutes: 90 })], tasks: [] }, DEFAULT_PAY_RULES).base, 30_000);
});

test('jarima va bonus qoidalari, jarima cheklovi', () => {
  const rules = normalizePayRules({ late: { mode: 'per_minute', amount: 1000 }, absentPenalty: 100_000, overtimePerHour: 25_000, task: { onTimeBonus: 20_000, latePenalty: 10_000, fiveStarBonus: 5000 }, maxPenaltyPercent: 0 });
  const days = [day('late', { lateMinutes: 15 }), day('late', { lateMinutes: 10 }), day('absent'), day('present', { overtimeMinutes: 130 })];
  const tasks = [{ onTime: true, rating: 5, self: false }, { onTime: false, rating: 3, self: false }, { onTime: true, rating: null, self: true }];
  const r = computePay({ payType: 'daily', rate: 200_000, days, tasks }, rules);
  assert.equal(r.base, 600_000);
  assert.deepEqual(r.penalties.map((p) => [p.kind, p.amount]), [['late', 25_000], ['absent', 100_000], ['task_late', 10_000]]);
  assert.deepEqual(r.bonuses.map((b) => [b.kind, b.amount]), [['overtime', 50_000], ['task_on_time', 20_000], ['task_five', 5000]], "o'zi qo'shgan ish hisoblanmaydi (standart)");
  assert.equal(r.total, 600_000 - 135_000 + 75_000);
  const capped = computePay({ payType: 'daily', rate: 200_000, days, tasks }, { ...rules, maxPenaltyPercent: 10 });
  assert.equal(capped.penaltyTotal, 60_000);
  assert.equal(capped.penaltyCapped, 75_000);
  assert.equal(computePay({ payType: 'daily', rate: 10, days: [day('absent')], tasks: [] }, rules).total, 0, 'manfiy bo‘lmaydi');
});

test('qoidalar tekshiruvi', () => {
  const r = normalizePayRules({ late: { mode: 'xx', amount: -5 }, absentPenalty: 1.6, maxPenaltyPercent: 300 });
  assert.equal(r.late.mode, 'off');
  assert.equal(r.late.amount, 0);
  assert.equal(r.absentPenalty, 2);
  assert.equal(r.maxPenaltyPercent, 100);
});

test('nazorat ✗ jarimasi (2026-10-31): 0 — o‘chiq, so‘m × marta, chegaraga kiradi', () => {
  const days = Array(20).fill(day('present'));
  const off = computePay({ payType: 'monthly', rate: 3_000_000, days, tasks: [], inspectionFails: 4 }, DEFAULT_PAY_RULES);
  assert.equal(off.penaltyTotal, 0, 'standart 0 — jarima yo‘q');
  const rules = normalizePayRules({ inspectionFailPenalty: 50_000, maxPenaltyPercent: 0 });
  const r = computePay({ payType: 'monthly', rate: 3_000_000, days, tasks: [], inspectionFails: 4 }, rules);
  assert.deepEqual(r.penalties.map((p) => [p.kind, p.count, p.amount]), [['inspection_fail', 4, 200_000]]);
  assert.equal(r.total, 3_000_000 - 200_000);
  // Chegara: 30% dan oshmaydi
  const capped = computePay({ payType: 'monthly', rate: 1_000_000, days, tasks: [], inspectionFails: 10 }, normalizePayRules({ inspectionFailPenalty: 50_000 }));
  assert.equal(capped.penaltyTotal, 300_000);
  assert.equal(normalizePayRules({ inspectionFailPenalty: -5 }).inspectionFailPenalty, 0);
});
