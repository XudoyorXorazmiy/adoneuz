import { BarChart3, Building, CalendarClock, ClipboardCheck, Home, Inbox, MapPin, Settings, UserCheck, Users, Wallet } from 'lucide-react';
import { can, MEMBER_ROLE_LABELS, type Area } from '@adone/core';
import { requireUser } from '@/lib/auth/session';
import { NavLink } from '@/components/shell/nav-link';
import { UserBox } from '@/components/shell/user-box';

/** Menyu tartibi dizayn bo'yicha (docs/DIZAYN-PROMPT.md «Layout»). `ready: false` — keyingi bosqich. */
const NAV: Array<{ href: string; label: string; area: Area; icon: React.ReactNode; ready: boolean }> = [
  { href: '/', label: 'Bosh sahifa', area: 'dashboard', icon: <Home size={18} />, ready: true },
  { href: '/davomat', label: 'Davomat', area: 'attendance', icon: <UserCheck size={18} />, ready: false },
  { href: '/vazifalar', label: 'Vazifalar', area: 'tasks', icon: <ClipboardCheck size={18} />, ready: false },
  { href: '/sorovlar', label: "So'rovlar", area: 'requests', icon: <Inbox size={18} />, ready: false },
  { href: '/xodimlar', label: 'Xodimlar', area: 'employees', icon: <Users size={18} />, ready: false },
  { href: '/jadvallar', label: 'Jadvallar', area: 'schedules', icon: <CalendarClock size={18} />, ready: false },
  { href: '/filiallar', label: 'Filiallar', area: 'branches', icon: <MapPin size={18} />, ready: false },
  { href: '/hisobotlar', label: 'Hisobotlar', area: 'reports', icon: <BarChart3 size={18} />, ready: false },
  { href: '/ish-haqi', label: 'Ish haqi', area: 'payroll', icon: <Wallet size={18} />, ready: false },
  { href: '/sozlamalar', label: 'Sozlamalar', area: 'settings', icon: <Settings size={18} />, ready: false },
];

export default async function PanelLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col gap-5 bg-[#0B2E2B] px-3 py-5 max-md:hidden">
        <div className="flex items-center gap-2 px-2">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="9" fill="#14B8A6" />
            <path d="M16 6.5c-4.4 0-8 3.4-8 7.7 0 5.6 8 11.3 8 11.3s8-5.7 8-11.3c0-4.3-3.6-7.7-8-7.7Z" fill="#fff" />
            <path d="m12.6 14.2 2.4 2.4 4.4-4.6" fill="none" stroke="#0F766E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[17px] font-bold text-white">adone</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/8 px-3 py-2 text-[13px] text-white">
          <Building size={16} className="text-white/60" />
          <span className="truncate">{user.tenantName}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.filter((n) => can(user.role, n.area)).map((n) => (
            <NavLink key={n.href} href={n.href} icon={n.icon} disabled={!n.ready}>{n.label}</NavLink>
          ))}
        </nav>
        <UserBox name={user.name} subtitle={MEMBER_ROLE_LABELS[user.role]} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-line bg-card px-4 md:hidden">
          <span className="font-bold">adone</span>
          <span className="truncate text-[13px] text-muted">{user.tenantName}</span>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
