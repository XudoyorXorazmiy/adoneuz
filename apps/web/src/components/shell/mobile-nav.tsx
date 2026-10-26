'use client';
/** Telefon menyusi (dizayn: chap yuqorida «menu» tugmasi): yon menyu bandlari ochiladigan varaqda. Sahifa almashsa yopiladi. */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

export interface MobileNavItem { href: string; label: string; icon: string; count?: number; disabled?: boolean }

export function MobileNav({ items, title, footer }: { items: MobileNavItem[]; title: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => { const p = href.split('?')[0]!; return p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex size-10 items-center justify-center rounded-full text-ink" title="Menyu" aria-label="Menyu"><Icon name="menu" size={24} /></button>
      {open && (
        <div className="fixed inset-0 z-50 bg-navy/30" onClick={() => setOpen(false)}>
          <nav onClick={(e) => e.stopPropagation()} className="flex h-full w-[280px] flex-col gap-1 rounded-r-3xl bg-card px-4 pt-5 pb-4 shadow-[0_24px_80px_rgba(11,27,79,.3)]">
            <div className="mb-3 flex items-center justify-between px-1">{title}<button type="button" onClick={() => setOpen(false)} className="btn-icon size-9" title="Yopish"><Icon name="close" size={20} /></button></div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {items.map((n) => n.disabled ? (
                <span key={n.href} className="flex h-11 items-center gap-3 rounded-full px-3 text-placeholder"><Icon name={n.icon} /><span className="flex-1 font-medium">{n.label}</span><span className="text-[10px] font-semibold">tez orada</span></span>
              ) : (
                <Link key={n.href} href={n.href} className={`flex h-11 items-center gap-3 rounded-full px-3 ${active(n.href) ? 'bg-subtle font-bold text-primary' : 'font-medium text-ink-2'}`}>
                  <Icon name={n.icon} className={active(n.href) ? 'text-primary' : 'text-muted'} />
                  <span className="flex-1">{n.label}</span>
                  {!!n.count && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">{n.count}</span>}
                </Link>
              ))}
            </div>
            {footer}
          </nav>
        </div>
      )}
    </>
  );
}
