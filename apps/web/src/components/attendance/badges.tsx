import { CHECK_STATUS_LABELS, DAY_STATUS_LABELS, type CheckStatus, type DayStatus } from '@adone/core';

const DAY_TONE: Record<DayStatus, string> = {
  present: 'bg-success-tint text-success-text',
  late: 'bg-warning-tint text-warning-text',
  absent: 'bg-danger-tint text-danger-text',
  leave: 'bg-info-tint text-info-text',
  holiday: 'bg-subtle text-muted',
  off: 'bg-subtle text-muted',
};
export const DAY_DOT: Record<DayStatus, string> = {
  present: 'bg-success', late: 'bg-warning', absent: 'bg-danger', leave: 'bg-info', holiday: 'bg-line-strong', off: 'bg-line',
};

export function DayStatusBadge({ status, open }: { status: DayStatus; open?: boolean }) {
  if (open && status !== 'late') return <span className="badge bg-success-tint text-success-text"><span className="badge-dot" />Ishda</span>;
  return <span className={`badge ${DAY_TONE[status]}`}><span className="badge-dot" />{DAY_STATUS_LABELS[status]}{open && status === 'late' ? ' · ishda' : ''}</span>;
}

const CHECK_TONE: Record<CheckStatus, string> = {
  ok: 'bg-success-tint text-success-text',
  suspicious: 'bg-warning-tint text-warning-text ring-1 ring-warning/40',
  rejected: 'bg-danger-tint text-danger-text',
};
export function CheckBadge({ status }: { status: CheckStatus }) {
  return <span className={`badge ${CHECK_TONE[status]}`}>{CHECK_STATUS_LABELS[status]}</span>;
}

/** Rad/shubha sabablari — o'zbekcha. */
export const REASON_LABELS: Record<string, string> = {
  outside: 'Zonadan tashqarida',
  low_accuracy: 'GPS aniqligi past',
  no_live_location: 'Jonli lokatsiya emas',
  forwarded: 'Forward qilingan',
  stale_location: 'Eskirgan lokatsiya',
  no_video: "Video yo'q",
  face_pending: 'Yuz tekshiruvi kutilmoqda',
  face_mismatch: 'Yuz mos kelmadi',
  no_branch: 'Filial biriktirilmagan',
  forgot_checkout: '«Ketdim» bosilmagan — avto-yopildi',
};
