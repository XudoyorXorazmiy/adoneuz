'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Yon menyu bandi. `disabled` — keyingi bosqichdagi bo'lim (joyi ko'rinadi, bosilmaydi). */
export function NavLink({ href, icon, children, disabled }: { href: string; icon: ReactNode; children: ReactNode; disabled?: boolean }) {
  const path = usePathname();
  const active = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
  if (disabled) {
    return (
      <span className="flex h-9 cursor-default items-center gap-3 rounded-lg px-3 text-white/35" title="Tez orada">
        {icon}
        <span className="flex-1 truncate">{children}</span>
        <span className="text-[11px] text-white/30">tez orada</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`flex h-9 items-center gap-3 rounded-lg px-3 transition ${active ? 'bg-white/12 font-medium text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
