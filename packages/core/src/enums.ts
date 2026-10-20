/** Barcha enum qiymatlari — bitta joyda. DB pgEnum'lari (packages/db/src/schema/enums.ts) shulardan quriladi. */

export const TENANT_STATUSES = ['trial', 'active', 'past_due', 'blocked', 'archived'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Ishxona ichidagi rollar (CLAUDE.md §4). Super admin — rol emas, users.is_platform_admin. */
export const MEMBER_ROLES = ['owner', 'admin', 'manager', 'employee'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  trial: 'Sinov',
  active: 'Faol',
  past_due: "To'lov kutilmoqda",
  blocked: 'Bloklangan',
  archived: 'Arxivda',
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Egasi',
  admin: 'Administrator',
  manager: "Bo'lim boshlig'i",
  employee: 'Xodim',
};
