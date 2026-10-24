import type { ReactNode } from 'react';
import { TopControls } from '@/components/shell/top-controls';

/**
 * Sahifa sarlavhasi (dizayn): yuqorida to'liq kenglikdagi header — chapda sarlavha (yoki «Salom, …» + katta salom),
 * o'ngda boshqaruv tugmalari; pastda ixtiyoriy qator: chapda `notice`, o'ngda amallar (`children`).
 */
export async function PageHeader({
  title, count, subtitle, eyebrow, notice, alert, children,
}: { title: string; count?: number; subtitle?: ReactNode; eyebrow?: string; notice?: ReactNode; alert?: boolean; children?: ReactNode }) {
  return (
    <>
      <header className="-mx-4 -mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 pt-[22px] pb-5 md:-mx-7 md:px-7">
        <div className="min-w-0">
          {eyebrow && <div className="text-sm font-medium text-muted">{eyebrow}</div>}
          <h1 className="page-title mt-0.5">
            {title} {count != null && <span className="tnum text-placeholder">{count}</span>}
          </h1>
          {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
        </div>
        <TopControls alert={alert} />
      </header>
      {(notice || children) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">{notice}</div>
          {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
        </div>
      )}
    </>
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
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : tone === 'info' ? 'text-primary' : '';
  return (
    <div className="card-pad flex flex-col gap-1">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className={`kpi-value tnum ${color}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

/** Kartochka sarlavhasi: rangli kvadrat ikonka + nom + o'ng tomon. */
export function CardHead({ icon, title, badge, tone = 'primary', children }: { icon: ReactNode; title: string; badge?: ReactNode; tone?: 'primary' | 'warning'; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className={`card-icon ${tone === 'warning' ? 'bg-warning-tint text-warning' : ''}`}>{icon}</span>
      <h2 className="m-0 text-base font-bold">{title}</h2>
      {badge}
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
