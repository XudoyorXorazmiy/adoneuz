import { pgEnum } from 'drizzle-orm/pg-core';
import { JOB_STATUSES, MEMBER_ROLES, SUBSCRIPTION_STATUSES, TENANT_STATUSES } from '@adone/core';

// pgEnum'ga massiv to'g'ridan-to'g'ri beriladi (cast qilinmaydi) — aks holda tiplar string bo'lib qoladi.
export const tenantStatusEnum = pgEnum('tenant_status', TENANT_STATUSES);
export const memberRoleEnum = pgEnum('member_role', MEMBER_ROLES);
export const jobStatusEnum = pgEnum('job_status', JOB_STATUSES);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
