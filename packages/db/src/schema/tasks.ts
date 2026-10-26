import { sql } from 'drizzle-orm';
import { boolean, date, doublePrecision, index, integer, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Recurrence } from '@adone/core';
import { createdAt, id, updatedAt } from './columns';
import { deadlineStatusEnum, taskPriorityEnum, taskSourceEnum, taskStatusEnum } from './enums';
import { tenants, users } from './platform';
import { employees } from './tenant';

/**
 * Vazifalar (CLAUDE.md §5, §7, §7a). Bitta vazifa N kishiga — task_batches + N ta tasks (har biri o'z holati, hisoboti, bahosi).
 * O'zi qo'shgan ish ham shu jadvallarda (`source`), alohida tizim emas. RLS — migrations/0005.
 */
const tenantId = () => uuid().notNull().references(() => tenants.id, { onDelete: 'cascade' });

export const taskTemplates = pgTable(
  'task_templates',
  {
    id: id(),
    tenantId: tenantId(),
    title: text().notNull(),
    description: text(),
    priority: taskPriorityEnum().notNull().default('medium'),
    proofs: text().array().notNull().default(sql`'{button}'::text[]`),
    checklist: jsonb().$type<string[]>().notNull().default([]),
    assigneeEmployeeIds: uuid().array().notNull(),
    recurrence: jsonb().$type<Recurrence>().notNull(),
    /** Har nusxaning muddati — o'sha kuni shu vaqtda (HH:MM, ishxona vaqt mintaqasida). */
    dueTime: text().notNull().default('18:00'),
    isActive: boolean().notNull().default(true),
    lastRunDate: date({ mode: 'string' }),
    createdByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('task_templates_tenant_idx').on(t.tenantId, t.isActive)],
);

export const taskBatches = pgTable(
  'task_batches',
  {
    id: id(),
    tenantId: tenantId(),
    source: taskSourceEnum().notNull().default('assigned'),
    title: text().notNull(),
    description: text(),
    priority: taskPriorityEnum().notNull().default('medium'),
    proofs: text().array().notNull().default(sql`'{button}'::text[]`),
    checklist: jsonb().$type<string[]>().notNull().default([]),
    dueAt: timestamp({ withTimezone: true }),
    templateId: uuid().references(() => taskTemplates.id, { onDelete: 'set null' }),
    createdByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdByEmployeeId: uuid().references(() => employees.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('task_batches_tenant_idx').on(t.tenantId, t.createdAt)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    tenantId: tenantId(),
    batchId: uuid().notNull().references(() => taskBatches.id, { onDelete: 'cascade' }),
    /** Ijrochi: xodim (bot) yoki panel foydalanuvchisi (rahbarning o'z ishi, xodim yozuvi bo'lmasa). Biri to'ldiriladi. */
    assigneeEmployeeId: uuid().references(() => employees.id, { onDelete: 'cascade' }),
    assigneeUserId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    status: taskStatusEnum().notNull().default('new'),
    dueAt: timestamp({ withTimezone: true }),
    acceptedAt: timestamp({ withTimezone: true }),
    startedAt: timestamp({ withTimezone: true }),
    submittedAt: timestamp({ withTimezone: true }),
    approvedAt: timestamp({ withTimezone: true }),
    reviewedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    rating: smallint(),
    revisionCount: integer().notNull().default(0),
    spentMinutes: integer(),
    checklistDone: jsonb().$type<boolean[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('tasks_tenant_status_idx').on(t.tenantId, t.status),
    index('tasks_tenant_emp_idx').on(t.tenantId, t.assigneeEmployeeId),
    index('tasks_tenant_user_idx').on(t.tenantId, t.assigneeUserId),
    index('tasks_batch_idx').on(t.tenantId, t.batchId),
  ],
);

/** Holat o'tishlari va izohlar — APPEND-ONLY. from == to — oddiy izoh (yozishma). */
export const taskEvents = pgTable(
  'task_events',
  {
    id: id(),
    tenantId: tenantId(),
    taskId: uuid().notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    actorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    actorEmployeeId: uuid().references(() => employees.id, { onDelete: 'set null' }),
    fromStatus: taskStatusEnum(),
    toStatus: taskStatusEnum().notNull(),
    comment: text(),
    createdAt: createdAt(),
  },
  (t) => [index('task_events_task_idx').on(t.tenantId, t.taskId, t.createdAt)],
);

/** Ijrochi hisoboti (har topshirish — yangi qator) — APPEND-ONLY. */
export const taskReports = pgTable(
  'task_reports',
  {
    id: id(),
    tenantId: tenantId(),
    taskId: uuid().notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    text: text(),
    mediaIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    lat: doublePrecision(),
    lng: doublePrecision(),
    spentMinutes: integer(),
    source: text().notNull().default('bot'), // bot | panel | miniapp
    createdAt: createdAt(),
  },
  (t) => [index('task_reports_task_idx').on(t.tenantId, t.taskId)],
);

/**
 * Muddatni uzaytirish so'rovi (§7): ijrochi so'raydi, rahbar hal qiladi; tasdiqlansa `tasks.due_at` yangilanadi va
 * `task_events` ga izoh tushadi. So'rov o'chirilmaydi — `cancelled`/`rejected`. RLS — migrations/0016.
 */
export const deadlineRequests = pgTable(
  'deadline_requests',
  {
    id: id(),
    tenantId: tenantId(),
    taskId: uuid().notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    currentDueAt: timestamp({ withTimezone: true }),
    requestedDueAt: timestamp({ withTimezone: true }).notNull(),
    reason: text(),
    status: deadlineStatusEnum().notNull().default('pending'),
    decidedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp({ withTimezone: true }),
    decisionComment: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('deadline_requests_task_idx').on(t.tenantId, t.taskId), index('deadline_requests_status_idx').on(t.tenantId, t.status)],
);
