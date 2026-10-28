import 'server-only';
/**
 * Ish haqi (CLAUDE.md §1.7): YAGONA yozish nuqtasi. Hisob — core computePay() (butun so'm), qoidalar — `pay_rules` (ishxona ma'lumoti),
 * natija — `payroll_lines` snapshot. Qoralama davr ko'rilganda qayta hisoblanadi (qo'lda tuzatish saqlanadi), yopilgan davr o'zgarmaydi.
 * Har qoida o'zgarishi, tuzatish, yopish / qayta ochish — audit_log.
 */
import { and, asc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import {
  attendanceDays, auditLog, departments, employees, payRules, payrollLines, payrollPeriods, schedules, taskBatches, tasks, tenants, toRule, users,
  withTenant, type Tx,
} from '@adone/db';
import {
  addDays, computePay, localDate, monthDays, normalizePayRules, onTime, shiftFor, zonedTime,
  type PayDay, type PayResult, type PayRules, type PayType, type PayrollStatus,
} from '@adone/core';

export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export async function loadPayRules(tx: Tx): Promise<PayRules> {
  const [r] = await tx.select({ rules: payRules.rules }).from(payRules).limit(1);
  return normalizePayRules(r?.rules);
}

export async function savePayRules(tx: Tx, tenantId: string, userId: string, raw: unknown): Promise<PayRules> {
  const before = await loadPayRules(tx);
  const rules = normalizePayRules(raw);
  await tx.insert(payRules).values({ tenantId, rules: rules as unknown as Record<string, unknown>, updatedByUserId: userId })
    .onConflictDoUpdate({ target: payRules.tenantId, set: { rules: rules as unknown as Record<string, unknown>, updatedByUserId: userId, updatedAt: new Date() } });
  await tx.insert(auditLog).values({ tenantId, userId, action: 'payroll.rules', entity: 'pay_rules', meta: { before, after: rules } });
  return rules;
}

interface Calc { employeeId: string; payType: PayType; rate: number; result: PayResult }

/** Oy ma'lumotini yig'ib, har xodim uchun hisob (yozmaydi). `employeeIds` — faqat shular (Mini App). */
async function calculate(tx: Tx, month: string, tz: string, rules: PayRules, employeeIds?: string[]): Promise<Calc[]> {
  const emps = await tx
    .select({ id: employees.id, payType: employees.payType, rate: employees.payRate, s: schedules })
    .from(employees).leftJoin(schedules, eq(schedules.id, employees.scheduleId))
    .where(and(ne(employees.status, 'invited'), ne(employees.status, 'pending'), employeeIds ? inArray(employees.id, employeeIds) : undefined));
  if (emps.length === 0) return [];
  const ids = emps.map((e) => e.id);
  const dates = monthDays(month);
  const from = dates[0]!;
  const next = addDays(dates.at(-1)!, 1);
  const cells = await tx.select().from(attendanceDays).where(and(inArray(attendanceDays.employeeId, ids), gte(attendanceDays.workDate, from), lt(attendanceDays.workDate, next)));
  const byDay = new Map(cells.map((c) => [`${c.employeeId}:${c.workDate}`, c]));
  // Vazifa — tasdiqlangan oyiga tegishli (`submitted` da emas, §7)
  const done = await tx
    .select({ emp: tasks.assigneeEmployeeId, dueAt: tasks.dueAt, submittedAt: tasks.submittedAt, rating: tasks.rating, source: taskBatches.source })
    .from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
    .where(and(eq(tasks.status, 'approved'), inArray(tasks.assigneeEmployeeId, ids), gte(tasks.approvedAt, zonedTime(from, '00:00', tz)), lt(tasks.approvedAt, zonedTime(next, '00:00', tz))));

  return emps.map((e) => {
    const rule = e.s ? toRule(e.s) : null;
    const days: PayDay[] = [];
    for (const d of dates) {
      const planned = !!rule && rule.kind !== 'free' && !!shiftFor(rule, d, tz);
      const c = byDay.get(`${e.id}:${d}`);
      if (!c && !planned) continue;
      days.push(c
        ? { status: c.status, planned, workedMinutes: c.workedMinutes, lateMinutes: c.lateMinutes, earlyLeaveMinutes: c.earlyLeaveMinutes, overtimeMinutes: c.overtimeMinutes }
        : { status: 'off', planned, workedMinutes: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 });
    }
    const mine = done.filter((t) => t.emp === e.id).map((t) => ({ onTime: onTime(t), rating: t.rating, self: t.source !== 'assigned' }));
    return { employeeId: e.id, payType: e.payType, rate: e.rate, result: computePay({ payType: e.payType, rate: e.rate, days, tasks: mine }, rules) };
  });
}

const tzOf = async (tx: Tx) => (await tx.select({ tz: tenants.timezone }).from(tenants).limit(1))[0]!.tz;

/** Qoralama davrni (bo'lmasa yaratib) qayta hisoblaydi. Yopilgan davrga tegmaydi. */
/**
 * Qoralama eskirganmi (2-bosqich 2.3): oldin `/ish-haqi` har ochilganda butun oy qayta hisoblanardi (xodim × kun, vazifalar).
 * Endi faqat hisobdan keyin manba o'zgargan bo'lsa: qoidalar, shu oyning davomat yig'masi (tick ham yangilaydi — joriy oy ko'pi
 * bilan ~10 daqiqada bir), vazifalar, xodim (stavka, holat, jadval), jadvallar, ruxsatlar; yoki hisob 6 soatdan eski.
 */
async function isStale(tx: Tx, p: typeof payrollPeriods.$inferSelect, month: string): Promise<boolean> {
  if (!p.computedAt) return true;
  const at = p.computedAt.toISOString();
  const from = `${month}-01`;
  const { rows } = await tx.execute<{ stale: boolean }>(sql`
    select (${at}::timestamptz < now() - interval '6 hours')
      or exists (select 1 from pay_rules where updated_at > ${at}::timestamptz)
      or exists (select 1 from attendance_days where work_date >= ${from}::date and work_date < (${from}::date + interval '1 month') and updated_at > ${at}::timestamptz)
      or exists (select 1 from tasks where updated_at > ${at}::timestamptz)
      or exists (select 1 from employees where updated_at > ${at}::timestamptz)
      or exists (select 1 from schedules where updated_at > ${at}::timestamptz)
      or exists (select 1 from leave_requests where updated_at > ${at}::timestamptz)
      or exists (select 1 from tenants where updated_at > ${at}::timestamptz) as stale`);
  return rows[0]?.stale !== false;
}

export async function recomputePeriod(tx: Tx, tenantId: string, month: string, opts: { force?: boolean } = {}) {
  const rules = await loadPayRules(tx);
  await tx.insert(payrollPeriods).values({ tenantId, month }).onConflictDoNothing();
  const [p] = await tx.select().from(payrollPeriods).where(eq(payrollPeriods.month, month)).for('update').limit(1);
  if (!p || p.status === 'closed') return p!;
  if (!opts.force && !(await isStale(tx, p, month))) return p;
  const calc = await calculate(tx, month, await tzOf(tx), rules);
  const existing = await tx.select({ id: payrollLines.id, emp: payrollLines.employeeId, adj: payrollLines.adjustment }).from(payrollLines).where(eq(payrollLines.periodId, p.id));
  const adj = new Map(existing.map((x) => [x.emp, x.adj]));
  for (const c of calc) {
    const r = c.result;
    const values = {
      payType: c.payType, rate: c.rate, base: r.base, penaltyTotal: r.penaltyTotal, bonusTotal: r.bonusTotal,
      total: Math.max(0, r.total + (adj.get(c.employeeId) ?? 0)), breakdown: r as unknown as Record<string, unknown>, updatedAt: new Date(),
    };
    await tx.insert(payrollLines).values({ tenantId, periodId: p.id, employeeId: c.employeeId, ...values })
      .onConflictDoUpdate({ target: [payrollLines.tenantId, payrollLines.periodId, payrollLines.employeeId], set: values });
  }
  // Ro'yxatdan chiqqan xodim (tasdiqlanmagan holatga qaytgan) qatori — tuzatishsiz bo'lsa olib tashlanadi
  const keep = new Set(calc.map((c) => c.employeeId));
  const stale = existing.filter((x) => !keep.has(x.emp) && x.adj === 0).map((x) => x.id);
  if (stale.length) await tx.delete(payrollLines).where(inArray(payrollLines.id, stale));
  const [upd] = await tx.update(payrollPeriods).set({ rules: rules as unknown as Record<string, unknown>, computedAt: new Date(), updatedAt: new Date() }).where(eq(payrollPeriods.id, p.id)).returning();
  return upd!;
}

export interface PayrollRow {
  lineId: string; employeeId: string; name: string; position: string | null; departmentName: string | null; payType: PayType; rate: number;
  base: number; penaltyTotal: number; bonusTotal: number; adjustment: number; adjustmentReason: string | null; total: number; breakdown: PayResult;
}

/** Panel: davr + qatorlar. Qoralama bo'lsa avval qayta hisoblanadi. */
export async function payrollView(tenantId: string, month: string, departmentId?: string) {
  return withTenant(tenantId, async (tx) => {
    const tz = await tzOf(tx);
    const current = localDate(new Date(), tz).slice(0, 7);
    // Kelajak oy hisoblanmaydi; o'tgan yoki joriy oy — qoralama avtomatik ochiladi
    let period: typeof payrollPeriods.$inferSelect | null = null;
    if (month <= current) period = await recomputePeriod(tx, tenantId, month);
    const rows = period
      ? await tx
        .select({ l: payrollLines, name: employees.fullName, position: employees.position, departmentName: departments.name })
        .from(payrollLines).innerJoin(employees, eq(employees.id, payrollLines.employeeId)).leftJoin(departments, eq(departments.id, employees.departmentId))
        .where(and(eq(payrollLines.periodId, period.id), departmentId ? eq(employees.departmentId, departmentId) : undefined))
        .orderBy(asc(employees.fullName))
      : [];
    let closedBy: string | null = null;
    if (period?.closedByUserId) closedBy = (await tx.select({ n: users.name }).from(users).where(eq(users.id, period.closedByUserId)).limit(1))[0]?.n ?? null;
    return {
      tz, current, period: period ? { id: period.id, status: period.status as PayrollStatus, computedAt: period.computedAt, closedAt: period.closedAt, closedBy } : null,
      rows: rows.map((r): PayrollRow => ({
        lineId: r.l.id, employeeId: r.l.employeeId, name: r.name, position: r.position, departmentName: r.departmentName, payType: r.l.payType, rate: r.l.rate,
        base: r.l.base, penaltyTotal: r.l.penaltyTotal, bonusTotal: r.l.bonusTotal, adjustment: r.l.adjustment, adjustmentReason: r.l.adjustmentReason,
        total: r.l.total, breakdown: r.l.breakdown as unknown as PayResult,
      })),
    };
  });
}

/** Qo'lda tuzatish (manfiy — ushlab qolish): faqat qoralamada, sabab majburiy, audit_log. */
export async function adjustLine(tx: Tx, input: { tenantId: string; userId: string; lineId: string; amount: number; reason: string }): Promise<{ ok: true } | { error: string }> {
  const reason = input.reason.trim().slice(0, 300);
  if (!Number.isInteger(input.amount) || Math.abs(input.amount) > 1_000_000_000) return { error: "Summa noto'g'ri" };
  if (input.amount !== 0 && !reason) return { error: 'Sabab majburiy' };
  const [r] = await tx.select({ l: payrollLines, status: payrollPeriods.status }).from(payrollLines).innerJoin(payrollPeriods, eq(payrollPeriods.id, payrollLines.periodId))
    .where(eq(payrollLines.id, input.lineId)).for('update').limit(1);
  if (!r) return { error: 'Qator topilmadi' };
  if (r.status === 'closed') return { error: 'Davr yopilgan — tuzatib bo‘lmaydi' };
  const calculated = r.l.base - r.l.penaltyTotal + r.l.bonusTotal;
  await tx.update(payrollLines).set({ adjustment: input.amount, adjustmentReason: input.amount ? reason : null, total: Math.max(0, calculated + input.amount), updatedAt: new Date() }).where(eq(payrollLines.id, input.lineId));
  await tx.insert(auditLog).values({ tenantId: input.tenantId, userId: input.userId, action: 'payroll.adjust', entity: 'payroll_line', entityId: input.lineId, meta: { employeeId: r.l.employeeId, before: r.l.adjustment, after: input.amount, reason } });
  return { ok: true };
}

/** Yopish (yakuniy hisob bilan) yoki qayta ochish (faqat egasi). CAS — holat bo'yicha. */
export async function setPeriodStatus(tx: Tx, input: { tenantId: string; userId: string; month: string; to: PayrollStatus }): Promise<{ ok: true } | { error: string }> {
  const [p] = await tx.select().from(payrollPeriods).where(eq(payrollPeriods.month, input.month)).limit(1);
  if (!p) return { error: 'Davr topilmadi' };
  if (input.to === 'closed') {
    if (p.status === 'closed') return { error: 'Davr allaqachon yopilgan' };
    await recomputePeriod(tx, input.tenantId, input.month, { force: true });
  }
  const from: PayrollStatus = input.to === 'closed' ? 'draft' : 'closed';
  const upd = await tx.update(payrollPeriods)
    .set(input.to === 'closed' ? { status: 'closed', closedAt: new Date(), closedByUserId: input.userId, updatedAt: new Date() } : { status: 'draft', closedAt: null, closedByUserId: null, updatedAt: new Date() })
    .where(and(eq(payrollPeriods.id, p.id), eq(payrollPeriods.status, from))).returning({ id: payrollPeriods.id });
  if (!upd.length) return { error: 'Holat o‘zgargan — sahifani yangilang' };
  await tx.insert(auditLog).values({ tenantId: input.tenantId, userId: input.userId, action: input.to === 'closed' ? 'payroll.close' : 'payroll.reopen', entity: 'payroll_period', entityId: p.id, meta: { month: input.month } });
  return { ok: true };
}

/** Xodim profili / Mini App: bitta xodimning oyi. Yopilgan davr — snapshot, aks holda jonli hisob (yozmaydi). */
export async function employeePay(tx: Tx, employeeId: string, month: string): Promise<{ status: PayrollStatus | null; result: PayResult; adjustment: number; adjustmentReason: string | null; total: number; payType: PayType; rate: number } | null> {
  const [line] = await tx.select({ l: payrollLines, status: payrollPeriods.status }).from(payrollLines).innerJoin(payrollPeriods, eq(payrollPeriods.id, payrollLines.periodId))
    .where(and(eq(payrollPeriods.month, month), eq(payrollLines.employeeId, employeeId))).limit(1);
  if (line?.status === 'closed') {
    return { status: 'closed', result: line.l.breakdown as unknown as PayResult, adjustment: line.l.adjustment, adjustmentReason: line.l.adjustmentReason, total: line.l.total, payType: line.l.payType, rate: line.l.rate };
  }
  const [c] = await calculate(tx, month, await tzOf(tx), await loadPayRules(tx), [employeeId]);
  if (!c) return null;
  const adjustment = line?.l.adjustment ?? 0;
  return { status: line ? 'draft' : null, result: c.result, adjustment, adjustmentReason: line?.l.adjustmentReason ?? null, total: Math.max(0, c.result.total + adjustment), payType: c.payType, rate: c.rate };
}

/** Mini App: xodim o'z ish haqini faqat ishxona ruxsat bersa ko'radi (`showToEmployee`, standart — yo'q). */
export async function ownPay(tenantId: string, employeeId: string, month: string) {
  return withTenant(tenantId, async (tx) => ((await loadPayRules(tx)).showToEmployee ? employeePay(tx, employeeId, month) : null));
}
