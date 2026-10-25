/**
 * Sozlamalar kartochka va qatorlari (design/panel/Sozlamalar.dc.html): server komponent, holatsiz.
 * Boshqaruv elementlari formaga oddiy input sifatida tushadi (toggle — checkbox, chip — checkbox, segment — radio),
 * shuning uchun `SettingsForm` o'zgarishni FormData bilan solishtirib topadi.
 */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { formatDateTime } from '@adone/core';
import { Icon } from '@/components/ui/icon';

export function SettingsCard({
  icon, title, desc, tone = 'primary', chip, danger, audit, tz, children,
}: {
  icon: string; title: string; desc?: ReactNode; tone?: 'primary' | 'telegram' | 'gray' | 'danger';
  chip?: ReactNode; danger?: boolean; audit?: { name: string; at: Date } | null; tz?: string; children: ReactNode;
}) {
  const tint = { primary: 'bg-primary-tint text-primary', telegram: 'bg-[#E3F2FB] text-[#229ED9]', gray: 'bg-subtle text-muted', danger: 'bg-danger-tint text-danger' }[tone];
  return (
    <div className="flex flex-col gap-2">
      <section className={`card border-[1.5px] px-6 pt-5 pb-1.5 max-md:px-4 ${danger ? 'border-[#F5B5B7]' : 'border-transparent'}`}>
        <div className="flex items-center gap-3 border-b border-line-soft pb-3.5">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${tint}`}><Icon name={icon} fill /></span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold">{title}</div>
            {desc && <div className="text-[13px] text-muted">{desc}</div>}
          </div>
          {chip}
        </div>
        <div className="flex flex-col [&>*:last-child]:border-b-0">{children}</div>
      </section>
      {audit !== undefined && (
        <div className="pl-2 text-xs text-placeholder">Oxirgi o&apos;zgarish: {audit ? `${audit.name} · ${formatDateTime(audit.at, tz)}` : '—'}</div>
      )}
    </div>
  );
}

/** Sozlama qatori: chapda nom + izoh, o'ngda boshqaruv. */
export function Row({ label, hint, icon, children, stack }: { label?: ReactNode; hint?: ReactNode; icon?: string; children?: ReactNode; stack?: boolean }) {
  return (
    <div className={`flex gap-6 border-b border-line-soft py-3.5 ${stack ? 'flex-col items-stretch gap-3' : 'items-center max-md:flex-col max-md:items-stretch max-md:gap-3'}`}>
      {icon && <span className="-mr-2.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-page text-ink-2"><Icon name={icon} size={22} /></span>}
      {(label || hint) && (
        <div className="min-w-0 flex-1">
          {label && <div className="text-sm font-semibold">{label}</div>}
          {hint && <div className="mt-0.5 text-xs leading-[1.45] text-pretty text-muted">{hint}</div>}
        </div>
      )}
      <div className={`flex shrink-0 flex-wrap items-center gap-2.5 ${label || hint ? 'justify-end max-md:justify-start' : 'ml-auto'}`}>{children}</div>
    </div>
  );
}

/** Toggle — checkbox (Tailwind `peer`), holatsiz. `locked` — o'chirib bo'lmaydi. */
export function Toggle({ name, defaultChecked, locked }: { name?: string; defaultChecked?: boolean; locked?: boolean }) {
  return (
    <label className={`flex items-center gap-2 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      {locked && <Icon name="lock" size={18} className="text-placeholder" />}
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={locked} className="peer sr-only" />
      <span className={`relative h-[26px] w-11 shrink-0 rounded-full transition peer-focus-visible:ring-[3px] peer-focus-visible:ring-primary-tint ${locked ? 'bg-[#93A3F9]' : 'bg-[#E5E7EB] peer-checked:bg-primary'} after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-white after:shadow-[0_1px_2px_rgba(16,24,40,.2)] after:transition-all peer-checked:after:left-[21px]`} />
    </label>
  );
}

/** Chip-checkbox (ko'p tanlov): tanlangani — ko'k, ✓ bilan. */
export function ChipCheck({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-line bg-card px-3 text-[13px] font-semibold whitespace-nowrap text-ink-2 transition peer-checked:border-primary peer-checked:bg-primary-tint peer-checked:text-primary peer-focus-visible:ring-[3px] peer-focus-visible:ring-primary-tint [&>.icon]:hidden peer-checked:[&>.icon]:inline">
        <Icon name="check" size={15} />
        {label}
      </span>
    </label>
  );
}

/** Segment (bitta tanlov, radio). `soon` — tanlab bo'lmaydi, «tez orada». */
export function Segmented({ name, options, defaultValue, full }: { name: string; options: Array<{ value: string; label: string; soon?: boolean }>; defaultValue?: string; full?: boolean }) {
  return (
    <div className={`flex gap-1 rounded-full bg-subtle p-1 ${full ? 'w-full' : ''}`}>
      {options.map((o) => (
        <label key={o.value} className={`${full ? 'flex-1' : ''} ${o.soon ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} disabled={o.soon} className="peer sr-only" />
          <span className={`flex items-center justify-center gap-1.5 rounded-full px-3.5 py-[7px] text-[13px] font-semibold whitespace-nowrap transition peer-checked:bg-card peer-checked:text-ink peer-checked:shadow-[0_1px_2px_rgba(16,24,40,.08)] ${o.soon ? 'text-[#B0B5BF]' : 'text-muted'}`}>
            {o.label}
            {o.soon && <span className="text-[10px] font-bold text-placeholder">tez orada</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Kirish maydoni (dizayn: 44px, chapda ikonka, o'ngda qo'shimcha matn). */
export function Field({ icon, suffix, width = 280, readOnly, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: string; suffix?: string; width?: number }) {
  return (
    <span className="flex items-center gap-2 max-md:w-full">
      <span className={`flex h-11 items-center gap-2 rounded-xl border border-line px-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint max-md:w-full max-md:flex-1 ${readOnly ? 'bg-page text-muted' : 'bg-card'}`} style={{ width }}>
        {(icon || readOnly) && <Icon name={icon ?? 'lock'} size={18} className="text-placeholder" />}
        <input {...props} readOnly={readOnly} className="tnum min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-placeholder" />
      </span>
      {suffix && <span className="text-[13px] whitespace-nowrap text-muted">{suffix}</span>}
    </span>
  );
}

export function SelectField({ icon, width = 280, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { icon?: string; width?: number }) {
  return (
    <span className="relative flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint max-md:w-full" style={{ width }}>
      {icon && <Icon name={icon} size={18} className="text-placeholder" />}
      <select {...props} className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-sm font-medium outline-none">{children}</select>
      <Icon name="expand_more" className="pointer-events-none absolute right-3 text-muted" />
    </span>
  );
}

export function StatusChip({ icon, children, tone }: { icon?: string; children: ReactNode; tone: 'success' | 'warning' | 'info' | 'gray' | 'danger' }) {
  const c = { success: 'bg-success-tint text-success', warning: 'bg-warning-tint text-warning', info: 'bg-primary-tint text-primary', gray: 'bg-subtle text-muted', danger: 'bg-danger-tint text-danger' }[tone];
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-xs font-bold whitespace-nowrap ${c}`}>
      {icon && <Icon name={icon} size={16} fill />}
      {children}
    </span>
  );
}

export function Value({ children, tone }: { children: ReactNode; tone?: 'danger' | 'success' | 'muted' }) {
  return <span className={`text-sm font-bold whitespace-nowrap ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-muted' : ''}`}>{children}</span>;
}
