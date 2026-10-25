/**
 * Ish haqi (4-bosqich) — lokal bazada (seed'dan keyin): qoralama hisob, qo'lda tuzatish + audit, yopish (snapshot), qayta ochish, Mini App ko'rinishi.
 *   cd apps/web && node --conditions=react-server --import tsx scripts/test-payroll.ts
 * Joriy oy davri qoralama holatida qoladi (seed qayta yozadi).
 */
import '@adone/db/load-env';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { auditLog, employees, memberships, payrollLines, payrollPeriods, pool, tenants, withPlatform, withTenant } from '@adone/db';
import { computePay, localDate, normalizePayRules } from '@adone/core';
import { adjustLine, employeePay, loadPayRules, ownPay, payrollView, savePayRules, setPeriodStatus } from '../src/server/payroll';

async function main() {
  const mudom = (await withPlatform((tx) => tx.select().from(tenants).where(eq(tenants.slug, 'mudom-bozor'))))[0]!;
  const T = mudom.id;
  const month = localDate(new Date(), mudom.timezone).slice(0, 7);
  const owner = (await withPlatform((tx) => tx.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.tenantId, T), eq(memberships.role, 'owner'))).limit(1)))[0]!.id;

  // 1) Qoralama: har tasdiqlangan xodimga qator, jami = asosiy − jarima + bonus
  const v1 = await payrollView(T, month);
  const activeCount = (await withTenant(T, (tx) => tx.select().from(employees).where(eq(employees.status, 'active')))).length;
  assert.equal(v1.period?.status, 'draft');
  assert.ok(v1.rows.length >= activeCount, `qatorlar: ${v1.rows.length}`);
  for (const r of v1.rows) assert.equal(r.total, Math.max(0, r.base - r.penaltyTotal + r.bonusTotal + r.adjustment), r.name);
  const daily = v1.rows.find((r) => r.payType === 'daily')!;
  assert.equal(daily.base, daily.rate * (daily.breakdown.stats.workedDays + daily.breakdown.stats.leaveDays), 'kunbay = stavka × kun');
  const late = v1.rows.find((r) => r.breakdown.stats.lateDays > 0);
  if (late) assert.ok(late.breakdown.penalties.some((p) => p.kind === 'late'), 'kechikish jarimasi (seed qoidasi: har holat 20 000)');

  // 2) Qo'lda tuzatish: sababsiz — rad; sabab bilan — jami o'zgaradi, audit yoziladi
  const row = v1.rows[0]!;
  assert.deepEqual(await withTenant(T, (tx) => adjustLine(tx, { tenantId: T, userId: owner, lineId: row.lineId, amount: -50_000, reason: ' ' })), { error: 'Sabab majburiy' });
  assert.deepEqual(await withTenant(T, (tx) => adjustLine(tx, { tenantId: T, userId: owner, lineId: row.lineId, amount: -50_000, reason: 'Avans' })), { ok: true });
  const v2 = await payrollView(T, month); // qayta hisoblanganda tuzatish saqlanadi
  const row2 = v2.rows.find((r) => r.lineId === row.lineId)!;
  assert.equal(row2.adjustment, -50_000);
  assert.equal(row2.total, Math.max(0, row.base - row.penaltyTotal + row.bonusTotal - 50_000));
  const audits = await withTenant(T, (tx) => tx.select().from(auditLog).where(and(eq(auditLog.action, 'payroll.adjust'), eq(auditLog.entityId, row.lineId))));
  assert.equal(audits.length, 1);

  // 3) Yopish: snapshot o'zgarmaydi — qoida o'zgarsa ham, tuzatish rad etiladi
  assert.deepEqual(await withTenant(T, (tx) => setPeriodStatus(tx, { tenantId: T, userId: owner, month, to: 'closed' })), { ok: true });
  assert.deepEqual(await withTenant(T, (tx) => setPeriodStatus(tx, { tenantId: T, userId: owner, month, to: 'closed' })), { error: 'Davr allaqachon yopilgan' });
  const before = await withTenant(T, loadPayRules);
  await withTenant(T, (tx) => savePayRules(tx, T, owner, { ...before, absentPenalty: 999_000, overtimePerHour: 1_000_000 }));
  const v3 = await payrollView(T, month);
  assert.equal(v3.period?.status, 'closed');
  assert.deepEqual(v3.rows.map((r) => r.total), v2.rows.map((r) => r.total), 'yopilgan oy qoida o‘zgarishidan keyin ham o‘zgarmaydi');
  assert.ok('error' in (await withTenant(T, (tx) => adjustLine(tx, { tenantId: T, userId: owner, lineId: row.lineId, amount: 1, reason: 'x' }))));
  const closedPay = await withTenant(T, (tx) => employeePay(tx, row.employeeId, month));
  assert.equal(closedPay?.status, 'closed');
  assert.equal(closedPay?.total, row2.total);

  // 4) Qayta ochish → qoralama, yangi qoidalar bilan qayta hisob
  assert.deepEqual(await withTenant(T, (tx) => setPeriodStatus(tx, { tenantId: T, userId: owner, month, to: 'draft' })), { ok: true });
  await withTenant(T, (tx) => savePayRules(tx, T, owner, before));
  const v4 = await payrollView(T, month);
  assert.equal(v4.period?.status, 'draft');
  await withTenant(T, (tx) => adjustLine(tx, { tenantId: T, userId: owner, lineId: row.lineId, amount: 0, reason: '' }));

  // 5) Mini App: showToEmployee o'chiq — null
  await withTenant(T, (tx) => savePayRules(tx, T, owner, { ...before, showToEmployee: false }));
  assert.equal(await ownPay(T, row.employeeId, month), null, 'ruxsatsiz xodim o‘z ish haqini ko‘rmaydi');
  await withTenant(T, (tx) => savePayRules(tx, T, owner, before));
  assert.ok(await ownPay(T, row.employeeId, month));

  // 6) Core: normalizePayRules begona/manfiy qiymatni tozalaydi; hisob butun son
  const n = normalizePayRules({ late: { mode: 'x', amount: -5 }, absentPenalty: 1.7, maxPenaltyPercent: 500 });
  assert.deepEqual([n.late.mode, n.late.amount, n.absentPenalty, n.maxPenaltyPercent], ['off', 0, 2, 100]);
  const r = computePay({ payType: 'hourly', rate: 33_333, days: [{ status: 'present', planned: true, workedMinutes: 97, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 }], tasks: [] }, n);
  assert.ok(Number.isInteger(r.base));

  // Boshqa ishxona bu davrni ko'rmaydi
  const other = (await withPlatform((tx) => tx.select().from(tenants).where(eq(tenants.slug, 'test-dokon'))))[0];
  if (other) assert.equal((await withTenant(other.id, (tx) => tx.select().from(payrollPeriods))).length, 0);
  assert.ok((await withTenant(T, (tx) => tx.select().from(payrollLines))).length > 0);
  console.log(`Ish haqi: hammasi joyida ✓ (${v1.rows.length} xodim, jami ${v4.rows.reduce((a, x) => a + x.total, 0).toLocaleString('ru')} so'm)`);
  await pool.end();
}
main().catch(async (e) => { console.error('XATO:', e); await pool.end(); process.exit(1); });
