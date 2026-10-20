import type { ReactNode } from 'react';

export function PageHeader({ title, count, subtitle, children }: { title: string; count?: number; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="page-title">
          {title} {count != null && <span className="tnum text-muted">{count}</span>}
        </h1>
        {subtitle && <span className="text-[13px] text-muted">{subtitle}</span>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="m-0 max-w-[420px] text-muted">{text}</p>
      {children}
    </div>
  );
}

export function Kpi({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'info'; hint?: ReactNode }) {
  const color = tone === 'success' ? 'text-success-text' : tone === 'warning' ? 'text-warning-text' : tone === 'danger' ? 'text-danger-text' : tone === 'info' ? 'text-info-text' : '';
  return (
    <div className="card-pad flex flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`kpi-value tnum ${color}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
