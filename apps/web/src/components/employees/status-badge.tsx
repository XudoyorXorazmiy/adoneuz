import { EMPLOYEE_STATUS_LABELS, type EmployeeStatus } from '@adone/core';

const TONE: Record<EmployeeStatus, string> = {
  invited: 'bg-subtle text-muted',
  pending: 'bg-warning-tint text-warning-text',
  active: 'bg-success-tint text-success-text',
  disabled: 'bg-subtle text-muted',
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <span className={`badge ${TONE[status]}`}><span className="badge-dot" />{EMPLOYEE_STATUS_LABELS[status]}</span>;
}
