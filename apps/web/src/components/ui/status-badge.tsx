import { TENANT_STATUS_LABELS, type TenantStatus } from '@adone/core';

const TONE: Record<TenantStatus, string> = {
  trial: 'bg-info-tint text-info-text',
  active: 'bg-success-tint text-success-text',
  past_due: 'bg-warning-tint text-warning-text',
  blocked: 'bg-danger-tint text-danger-text',
  archived: 'bg-subtle text-muted',
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <span className={`badge ${TONE[status]}`}><span className="badge-dot" />{TENANT_STATUS_LABELS[status]}</span>;
}
