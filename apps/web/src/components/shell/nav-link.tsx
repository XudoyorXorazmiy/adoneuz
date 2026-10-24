'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

/** Yon menyu bandi (dizayn: faol — kulrang pill + ko'k ikonka + «›»). `disabled` — keyingi bosqich. */
export function NavLink({ href, icon, children, count, disabled }: { href: string; icon: string; children: ReactNode; count?: number; disabled?: boolean }) {
  const path = usePathname();
  const active = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  if (disabled) {
    return (
      <span className="flex h-10 cursor-default items-center gap-3 rounded-full px-3 text-placeholder" title="Tez orada">
        <Icon name={icon} />
        <span className="flex-1 truncate font-medium">{children}</span>
        <span className="text-[10px] font-semibold">tez orada</span>
      </span>
    );
  }
  if (active) {
    return (
      <Link href={href} className="flex h-[42px] items-center gap-3 rounded-full bg-subtle px-3 shadow-[0_1px_2px_rgba(16,24,40,.05)]">
        <Icon name={icon} className="text-primary" />
        <span className="flex-1 truncate font-bold text-primary">{children}</span>
        {!!count && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">{count}</span>}
        <Icon name="chevron_right" size={18} />
      </Link>
    );
  }
  return (
    <Link href={href} className="flex h-10 items-center gap-3 rounded-full px-3 text-ink-2 transition hover:bg-page">
      <Icon name={icon} className="text-muted" />
      <span className="flex-1 truncate font-medium">{children}</span>
      {!!count && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-tint px-1.5 text-[11px] font-bold text-primary">{count}</span>}
    </Link>
  );
}
