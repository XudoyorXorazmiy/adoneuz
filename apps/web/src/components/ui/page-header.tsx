import type { ReactNode } from 'react';
import Link from 'next/link';
import { TopControls } from '@/components/shell/top-controls';
import { Icon } from './icon';

/**
 * Sahifa sarlavhasi (dizayn): yuqorida to'liq kenglikdagi header — chapda sarlavha (yoki «Salom, …» + katta salom),
 * o'ngda boshqaruv tugmalari; pastda ixtiyoriy qator: chapda `notice`, o'ngda amallar (`children`).
 */
export async function PageHeader({
  title, count, badge, subtitle, eyebrow, notice, alert, back, actions, children,
}: {
  title: string; count?: number; badge?: ReactNode; subtitle?: ReactNode; eyebrow?: string; notice?: ReactNode; alert?: boolean;
  /** Ichki sahifa (dizayn: Xodim profili): ← tugmasi + «Bo'lim › Sarlavha» non-crumb, katta sarlavha o'rniga. */
  back?: { href: string; label: string };
  /** Sarlavha qatoridagi asosiy tugmalar (dizayn: Davomat — Excel, «Qo'lda belgilash»); TopControls'dan keyin. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <header className={`-mx-4 -mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 md:-mx-7 md:px-7 ${back ? 'py-[18px]' : 'pt-[22px] pb-5'}`}>
        {back ? (
          <nav className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted">
            <Link href={back.href} className="btn-icon size-9 text-ink" title="Orqaga"><Icon name="arrow_back" /></Link>
            <Link href={back.href} className="hover:text-ink">{back.label}</Link>
            <Icon name="chevron_right" size={16} />
            <span className="truncate font-bold text-ink">{title}</span>
          </nav>
        ) : (
          <div className="min-w-0">
            {eyebrow && <div className="text-sm font-medium text-muted">{eyebrow}</div>}
            <h1 className="page-title mt-0.5 flex flex-wrap items-center gap-2.5">
              {title} {count != null && <span className="tnum text-placeholder">{count}</span>}
              {badge && <span className="rounded-full bg-primary-tint px-2.5 py-[3px] text-[13px] font-bold tracking-normal whitespace-nowrap text-primary">{badge}</span>}
            </h1>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <TopControls alert={alert} compact={!!actions} />
          {actions && <div className="ml-1.5 flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
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

/** KPI kartochkasi (dizayn: Davomat) — rangli ikonka, nom, ↗ havola; katta raqam + belgi; izoh. */
export function StatCard({ icon, tone, label, value, badge, caption, href }: {
  icon: string; tone: 'success' | 'warning' | 'danger' | 'primary'; label: string; value: ReactNode; badge?: ReactNode; caption?: ReactNode; href?: string;
}) {
  const t = { success: 'bg-success-tint text-success', warning: 'bg-warning-tint text-warning', danger: 'bg-danger-tint text-danger', primary: 'bg-primary-tint text-primary' }[tone];
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-[10px] ${t}`}><Icon name={icon} size={18} fill /></span>
        <span className="flex-1 text-sm font-semibold text-ink-2">{label}</span>
        {href && <Icon name="arrow_outward" size={18} className="text-placeholder transition group-hover:text-primary" />}
      </div>
      <div className="flex items-baseline gap-2.5"><span className="tnum text-[32px] leading-10 font-extrabold tracking-[-0.03em]">{value}</span>{badge}</div>
      {caption && <div className="text-xs text-muted">{caption}</div>}
    </>
  );
  const cls = 'card group flex flex-col gap-3 p-5';
  return href ? <Link href={href} className={`${cls} transition hover:shadow-[var(--shadow-frame)]`}>{body}</Link> : <div className={cls}>{body}</div>;
}
