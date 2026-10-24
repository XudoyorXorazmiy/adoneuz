import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ATTENDANCE_EVENT_KINDS, ATTENDANCE_SOURCES, CHECK_STATUSES, DAY_STATUSES, EMPLOYEE_STATUSES, JOB_STATUSES, MEDIA_KINDS, MEMBER_ROLES,
  PAY_TYPES, SCHEDULE_KINDS, SUBSCRIPTION_STATUSES, TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES, TENANT_STATUSES,
} from '@adone/core';

// pgEnum'ga massiv to'g'ridan-to'g'ri beriladi (cast qilinmaydi) — aks holda tiplar string bo'lib qoladi.
export const tenantStatusEnum = pgEnum('tenant_status', TENANT_STATUSES);
export const memberRoleEnum = pgEnum('member_role', MEMBER_ROLES);
export const jobStatusEnum = pgEnum('job_status', JOB_STATUSES);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const employeeStatusEnum = pgEnum('employee_status', EMPLOYEE_STATUSES);
export const payTypeEnum = pgEnum('pay_type', PAY_TYPES);
export const scheduleKindEnum = pgEnum('schedule_kind', SCHEDULE_KINDS);
export const attendanceEventKindEnum = pgEnum('attendance_event_kind', ATTENDANCE_EVENT_KINDS);
export const checkStatusEnum = pgEnum('check_status', CHECK_STATUSES);
export const attendanceSourceEnum = pgEnum('attendance_source', ATTENDANCE_SOURCES);
export const dayStatusEnum = pgEnum('day_status', DAY_STATUSES);
export const mediaKindEnum = pgEnum('media_kind', MEDIA_KINDS);
export const taskStatusEnum = pgEnum('task_status', TASK_STATUSES);
export const taskSourceEnum = pgEnum('task_source', TASK_SOURCES);
export const taskPriorityEnum = pgEnum('task_priority', TASK_PRIORITIES);
