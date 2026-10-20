import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns';
import { jobStatusEnum, memberRoleEnum, subscriptionStatusEnum, tenantStatusEnum } from './enums';

/** Platforma darajasi: ishxonalar (tenant), foydalanuvchilar, tariflar, navbat. RLS — migrations/0001_rls.sql. */

export const tenants = pgTable('tenants', {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  status: tenantStatusEnum().notNull().default('trial'),
  timezone: text().notNull().default('Asia/Tashkent'),
  settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable('users', {
  id: id(),
  phone: text().notNull().unique(), // 998XXXXXXXXX — butun platformada yagona
  name: text().notNull(),
  passwordHash: text().notNull(),
  isPlatformAdmin: boolean().notNull().default(false),
  isActive: boolean().notNull().default(true),
  failedLogins: integer().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true }),
  /** Parol almashtirilganda suriladi — eski sessiyalar bekor bo'ladi. */
  passwordChangedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid().notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    role: memberRoleEnum().notNull(),
    /** Bo'sh = hammasi. manager uchun cheklov (1-bosqichdan: filial va bo'limlar). */
    branchIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    departmentIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('memberships_user_tenant_uq').on(t.userId, t.tenantId), index('memberships_tenant_idx').on(t.tenantId)],
);

export const plans = pgTable('plans', {
  id: id(),
  code: text().notNull().unique(), // sinov | start | biznes | pro
  name: text().notNull(),
  priceSom: bigint({ mode: 'number' }).notNull(),
  /** Faol xodimlar chegarasi. */
  maxEmployees: integer().notNull(),
  maxBranches: integer().notNull(),
  faceControl: boolean().notNull().default(true),
  isActive: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
});

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  tenantId: uuid().notNull().unique().references(() => tenants.id, { onDelete: 'cascade' }),
  planId: uuid().notNull().references(() => plans.id),
  status: subscriptionStatusEnum().notNull().default('trial'),
  currentPeriodEnd: timestamp({ withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    tenantId: uuid(),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    status: jobStatusEnum().notNull().default('queued'),
    attempts: integer().notNull().default(0),
    maxAttempts: integer().notNull().default(5),
    runAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp({ withTimezone: true }),
    lastError: text(),
    /** Bir martalik ishlar (kunlik hisobot, takrorlanuvchi vazifa): `on conflict do nothing`. */
    dedupeKey: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('jobs_queue_idx').on(t.status, t.runAt),
    uniqueIndex('jobs_dedupe_uq').on(t.dedupeKey).where(sql`dedupe_key is not null`),
  ],
);

export const authThrottle = pgTable('auth_throttle', {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  resetAt: timestamp({ withTimezone: true }).notNull(),
});

/** Append-only (UPDATE/DELETE ilova rollaridan olib tashlangan). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    tenantId: uuid(),
    userId: uuid(),
    action: text().notNull(),
    entity: text(),
    entityId: text(),
    meta: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_tenant_idx').on(t.tenantId, t.createdAt)],
);
