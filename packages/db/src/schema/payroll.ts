import { bigint, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns';
import { payTypeEnum, payrollStatusEnum } from './enums';
import { tenants, users } from './platform';
import { employees } from './tenant';

/** 4-bosqich: ish haqi (CLAUDE.md §1.7). Qoidalar — ishxona ma'lumoti, natija snapshot. RLS — migrations/0011. */
const tenantId = () => uuid().notNull().references(() => tenants.id, { onDelete: 'cascade' });

/** Ishxonaga bitta qator: `@adone/core` PayRules (normalizePayRules bilan o'qiladi). */
export const payRules = pgTable(
  'pay_rules',
  {
    id: id(),
    tenantId: tenantId(),
    rules: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    updatedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('pay_rules_tenant_uq').on(t.tenantId)],
);

/** Hisob davri — oy (`YYYY-MM`). `closed` — qatorlar o'zgarmaydi. */
export const payrollPeriods = pgTable(
  'payroll_periods',
  {
    id: id(),
    tenantId: tenantId(),
    month: text().notNull(),
    status: payrollStatusEnum().notNull().default('draft'),
    /** Hisoblashda ishlatilgan qoidalar nusxasi. */
    rules: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    computedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    closedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('payroll_periods_uq').on(t.tenantId, t.month)],
);

/** Xodim × davr: hisoblangan qiymatlar snapshot'i + qo'lda tuzatish (sabab bilan, audit_log). */
export const payrollLines = pgTable(
  'payroll_lines',
  {
    id: id(),
    tenantId: tenantId(),
    periodId: uuid().notNull().references(() => payrollPeriods.id, { onDelete: 'cascade' }),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    payType: payTypeEnum().notNull(),
    rate: bigint({ mode: 'number' }).notNull().default(0),
    base: bigint({ mode: 'number' }).notNull().default(0),
    penaltyTotal: bigint({ mode: 'number' }).notNull().default(0),
    bonusTotal: bigint({ mode: 'number' }).notNull().default(0),
    /** Qo'lda tuzatish (manfiy bo'lishi mumkin). */
    adjustment: bigint({ mode: 'number' }).notNull().default(0),
    adjustmentReason: text(),
    total: bigint({ mode: 'number' }).notNull().default(0),
    breakdown: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('payroll_lines_uq').on(t.tenantId, t.periodId, t.employeeId), index('payroll_lines_emp_idx').on(t.tenantId, t.employeeId)],
);
