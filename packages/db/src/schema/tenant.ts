import { sql } from 'drizzle-orm';
import { bigint, boolean, date, doublePrecision, index, integer, jsonb, pgTable, real, smallint, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns';
import { leaveKindEnum, leaveStatusEnum, attendanceEventKindEnum, attendanceSourceEnum, checkStatusEnum, dayStatusEnum, employeeStatusEnum, mediaKindEnum, payTypeEnum, scheduleKindEnum } from './enums';
import { tenants, users } from './platform';

/** Ishxona ichki jadvallari: har birida tenant_id + RLS (migrations/0003_rls_tenant.sql). */
const tenantId = () => uuid().notNull().references(() => tenants.id, { onDelete: 'cascade' });

export const branches = pgTable(
  'branches',
  {
    id: id(),
    tenantId: tenantId(),
    name: text().notNull(),
    address: text(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    radiusM: integer().notNull().default(100),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('branches_tenant_idx').on(t.tenantId)],
);

export const departments = pgTable(
  'departments',
  {
    id: id(),
    tenantId: tenantId(),
    name: text().notNull(),
    /** Bo'lim boshlig'i (panel foydalanuvchisi). */
    managerUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /**
     * «Nazorat» javobgari — tekshiruvda ✗ chiqsa avtomatik vazifa shu xodimga (2026-10-31). Boshliqdan farqi: rahbar huquqi
     * bermaydi (oddiy sotuvchi ham bo'lishi mumkin). Bo'sh bo'lsa — boshliq xodim bo'lsa, u (server/inspections.ts).
     */
    responsibleEmployeeId: uuid().references((): AnyPgColumn => employees.id, { onDelete: 'set null' }),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('departments_tenant_idx').on(t.tenantId)],
);

/**
 * «Nazorat» tekshiruvi (2026-10-31): admin bo'limni mezonlar bo'yicha tekshirdi. Append-only (UPDATE/DELETE yo'q — RLS 0018);
 * `items` — [{ criterion, ok, note, mediaId }] (core InspectionItem); `responsibleEmployeeId` — o'sha paytdagi javobgar (snapshot);
 * `workDate` — ishxona vaqtidagi sana (kunlik jadval uchun); `failCount` — ✗ soni (hisobotlar tez).
 */
export const inspections = pgTable(
  'inspections',
  {
    id: id(),
    tenantId: tenantId(),
    /** Bo'lim tekshiruvi — tekshirilgan bo'lim; xodim tekshiruvida — xodimning bo'limi (snapshot, bo'lishi shart emas). */
    departmentId: uuid().references(() => departments.id, { onDelete: 'cascade' }),
    /** Xodim tekshiruvi (2026-10-31): tekshirilgan xodim; ✗ → vazifa shu xodimga, `responsibleEmployeeId` ham u. */
    employeeId: uuid().references((): AnyPgColumn => employees.id, { onDelete: 'cascade' }),
    inspectorUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    responsibleEmployeeId: uuid().references((): AnyPgColumn => employees.id, { onDelete: 'set null' }),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    workDate: date().notNull(),
    items: jsonb().$type<Array<{ criterion: string; ok: boolean; note: string | null; mediaId: string | null }>>().notNull().default([]),
    okCount: integer().notNull().default(0),
    failCount: integer().notNull().default(0),
    /** ✗ bo'yicha ochilgan vazifalar (tasks.id) */
    taskIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: createdAt(),
  },
  (t) => [index('inspections_day_idx').on(t.tenantId, t.workDate), index('inspections_dep_idx').on(t.tenantId, t.departmentId, t.at), index('inspections_emp_idx').on(t.tenantId, t.employeeId, t.at)],
);

export const schedules = pgTable(
  'schedules',
  {
    id: id(),
    tenantId: tenantId(),
    name: text().notNull(),
    kind: scheduleKindEnum().notNull().default('weekly'),
    weekdays: smallint().array().notNull().default(sql`'{1,2,3,4,5}'::smallint[]`),
    cycleOn: smallint().notNull().default(0),
    cycleOff: smallint().notNull().default(0),
    cycleStart: date({ mode: 'string' }),
    startTime: text().notNull().default('09:00'),
    endTime: text().notNull().default('18:00'),
    /** Ayrim kunlarda boshqa vaqt (weekly): [{weekdays:[2,4,6,7], startTime:'11:00', endTime:'23:00'}] — bazaviy vaqt ustidan */
    dayTimes: jsonb().$type<Array<{ weekdays: number[]; startTime: string; endTime: string }>>().notNull().default([]),
    /** Haftalik almashinuv: altAnchor haftasida bazaviy vaqt, keyingi haftada alt vaqt, va hokazo (ikki xodim smena almashadi) */
    altStartTime: text(),
    altEndTime: text(),
    altAnchor: date({ mode: 'string' }),
    breakMinutes: smallint().notNull().default(60),
    graceMinutes: smallint().notNull().default(10),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('schedules_tenant_idx').on(t.tenantId)],
);

export const employees = pgTable(
  'employees',
  {
    id: id(),
    tenantId: tenantId(),
    fullName: text().notNull(),
    phone: text(), // 998XXXXXXXXX; botda kontakt orqali tasdiqlanadi
    position: text(),
    departmentId: uuid().references(() => departments.id, { onDelete: 'set null' }),
    branchId: uuid().references(() => branches.id, { onDelete: 'set null' }),
    scheduleId: uuid().references(() => schedules.id, { onDelete: 'set null' }),
    /** Panel foydalanuvchisi ham bo'lsa (menejer o'zi ham keldi/ketdi qiladi). */
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    telegramUserId: bigint({ mode: 'number' }),
    telegramUsername: text(),
    status: employeeStatusEnum().notNull().default('invited'),
    payType: payTypeEnum().notNull().default('monthly'),
    payRate: bigint({ mode: 'number' }).notNull().default(0), // so'm
    joinedAt: timestamp({ withTimezone: true }),
    /** Mini App qurilmasi (birinchi Keldim'da bog'lanadi). Boshqa qurilmadan — check-in «shubhali». */
    deviceId: text(),
    deviceLabel: text(),
    deviceBoundAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('employees_tenant_idx').on(t.tenantId, t.status),
    uniqueIndex('employees_tg_uq').on(t.tenantId, t.telegramUserId).where(sql`telegram_user_id is not null`),
  ],
);

/** Biometrika roziligi (CLAUDE.md §1.4). Matn versiyasi bilan, append-only. */
export const consents = pgTable(
  'consents',
  {
    id: id(),
    tenantId: tenantId(),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    kind: text().notNull(), // 'biometric'
    version: text().notNull(),
    acceptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('consents_employee_idx').on(t.tenantId, t.employeeId)],
);

export const media = pgTable(
  'media',
  {
    id: id(),
    tenantId: tenantId(),
    employeeId: uuid().references(() => employees.id, { onDelete: 'cascade' }),
    kind: mediaKindEnum().notNull(),
    path: text().notNull(), // MEDIA_DIR ga nisbatan
    mime: text().notNull(),
    sizeBytes: integer().notNull(),
    sha256: text().notNull(),
    durationSec: smallint(),
    createdAt: createdAt(),
  },
  (t) => [index('media_tenant_idx').on(t.tenantId, t.employeeId)],
);

/** Davomat jurnali — APPEND-ONLY (UPDATE/DELETE ilova rolidan olib tashlangan). Vaqt — server vaqti. */
export const attendanceEvents = pgTable(
  'attendance_events',
  {
    id: id(),
    tenantId: tenantId(),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    workDate: date({ mode: 'string' }).notNull(),
    kind: attendanceEventKindEnum().notNull(),
    serverAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    branchId: uuid().references(() => branches.id, { onDelete: 'set null' }),
    lat: doublePrecision(),
    lng: doublePrecision(),
    accuracyM: integer(),
    distanceM: integer(),
    isLiveLocation: boolean(),
    mediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    faceScore: doublePrecision(),
    livenessScore: doublePrecision(),
    checkStatus: checkStatusEnum().notNull().default('ok'),
    /** Rad/shubha sabablari: ['outside', 'no_live_location', 'face_pending', …] */
    reasons: text().array().notNull().default(sql`'{}'::text[]`),
    source: attendanceSourceEnum().notNull(),
    /** correction: { action, at | target, reason } (core CorrectionMeta) */
    meta: jsonb().$type<Record<string, unknown>>(),
    createdByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('att_events_day_idx').on(t.tenantId, t.employeeId, t.workDate), index('att_events_date_idx').on(t.tenantId, t.workDate)],
);

/** Kunlik yig'ma — faqat core computeDay() natijasi (server/attendance.ts rebuildDay). */
export const attendanceDays = pgTable(
  'attendance_days',
  {
    id: id(),
    tenantId: tenantId(),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    workDate: date({ mode: 'string' }).notNull(),
    shiftStart: timestamp({ withTimezone: true }),
    shiftEnd: timestamp({ withTimezone: true }),
    firstIn: timestamp({ withTimezone: true }),
    lastOut: timestamp({ withTimezone: true }),
    workedMinutes: integer().notNull().default(0),
    lateMinutes: integer().notNull().default(0),
    earlyLeaveMinutes: integer().notNull().default(0),
    overtimeMinutes: integer().notNull().default(0),
    status: dayStatusEnum().notNull(),
    isOpen: boolean().notNull().default(false),
    suspicious: boolean().notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('att_days_uq').on(t.tenantId, t.employeeId, t.workDate), index('att_days_date_idx').on(t.tenantId, t.workDate)],
);

/**
 * Yuz namunasi vektorlari (CLAUDE.md §1.4): faqat rozilik bilan, services/face /embed natijasi (512, normallangan).
 * pgvector shart emas — xodimda 1–3 ta namuna, solishtirish servisda (1:1). Xodim o'chirilsa — o'chiriladi.
 */
export const faceTemplates = pgTable(
  'face_templates',
  {
    id: id(),
    tenantId: tenantId(),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    embedding: real().array().notNull(),
    quality: jsonb().$type<{ det_score: number; face_px: number; sharpness: number }>(),
    mediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('face_templates_emp_idx').on(t.tenantId, t.employeeId)],
);

/** Ruxsat so'rovlari (kasal, ta'til, shaxsiy, masofadan). Tasdiqlangan davr — davomatda «Ruxsatda». */
export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: id(),
    tenantId: tenantId(),
    employeeId: uuid().notNull().references(() => employees.id, { onDelete: 'cascade' }),
    kind: leaveKindEnum().notNull(),
    dateFrom: date({ mode: 'string' }).notNull(),
    dateTo: date({ mode: 'string' }).notNull(),
    reason: text(),
    mediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    status: leaveStatusEnum().notNull().default('pending'),
    decidedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp({ withTimezone: true }),
    decisionComment: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('leave_requests_emp_idx').on(t.tenantId, t.employeeId, t.dateFrom), index('leave_requests_status_idx').on(t.tenantId, t.status)],
);
