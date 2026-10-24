import { CHECK_STATUS_LABELS, DAY_STATUS_LABELS, type CheckStatus, type DayStatus } from '@adone/core';
import { Icon } from '@/components/ui/icon';

const DAY_TONE: Record<DayStatus, string> = {
  present: 'bg-success-tint text-success',
  late: 'bg-warning-tint text-warning',
  absent: 'bg-danger-tint text-danger',
  leave: 'bg-primary-tint text-primary',
  holiday: 'bg-subtle text-muted',
  off: 'bg-subtle text-muted',
};
export const DAY_DOT: Record<DayStatus, string> = {
  present: 'bg-success', late: 'bg-warning', absent: 'bg-danger', leave: 'bg-primary', holiday: 'bg-placeholder', off: 'bg-placeholder',
};

/** Kun holati (dizayn: nuqtali pill). `open` — hozir ishda; `early` — erta ketdi. */
export function DayStatusBadge({ status, open, early, waiting }: { status: DayStatus; open?: boolean; early?: boolean; waiting?: boolean }) {
  if (waiting && status === 'off') return <span className="badge bg-subtle text-muted"><span className="badge-dot" />Kutilmoqda</span>;
  if (early && status === 'present' && !open) return <span className="badge bg-warning-tint text-warning"><span className="badge-dot" />Erta ketdi</span>;
  if (open && status !== 'late') return <span className="badge bg-success-tint text-success"><span className="badge-dot" />Ishda</span>;
  return <span className={`badge ${DAY_TONE[status]}`}><span className="badge-dot" />{DAY_STATUS_LABELS[status]}</span>;
}

const CHECK: Record<CheckStatus, [string, string]> = {
  ok: ['verified', 'border-transparent bg-success-tint text-success'],
  suspicious: ['warning', 'border-warning bg-card text-warning'],
  rejected: ['block', 'border-transparent bg-danger-tint text-danger'],
};
/** Tekshiruv natijasi (dizayn: ikonkali pill; shubhali — to'q sariq chegarali). `null` — hodisa yo'q. */
export function CheckBadge({ status }: { status: CheckStatus | null }) {
  if (!status) return <span className="badge bg-subtle pl-1.5 text-muted"><Icon name="remove" size={15} />—</span>;
  const [icon, tone] = CHECK[status];
  return <span className={`badge gap-1 border-[1.5px] pl-1.5 ${tone}`}><Icon name={icon} size={15} fill={status === 'ok'} />{CHECK_STATUS_LABELS[status]}</span>;
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
