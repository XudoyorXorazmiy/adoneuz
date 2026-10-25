import { can, type Area } from '@adone/core';
import { requireUser } from '@/lib/auth/session';
import { NavLink } from '@/components/shell/nav-link';
import { UserBox } from '@/components/shell/user-box';
import { Logo } from '@/components/ui/logo';
import { Icon } from '@/components/ui/icon';
import { shellInfo } from '@/server/shell';

/** Menyu tartibi dizayn bo'yicha (design/panel/Sidebar.dc.html). `ready: false` — keyingi bosqich. */
const NAV: Array<{ href: string; label: string; area: Area; icon: string; ready: boolean; count?: 'pending' | 'review' | 'leaves' }> = [
  { href: '/', label: 'Bosh sahifa', area: 'dashboard', icon: 'dashboard', ready: true },
  { href: '/davomat', label: 'Davomat', area: 'attendance', icon: 'how_to_reg', ready: true },
  { href: '/vazifalar', label: 'Vazifalar', area: 'tasks', icon: 'task_alt', ready: true, count: 'review' },
  { href: '/sorovlar', label: "So'rovlar", area: 'requests', icon: 'inbox', ready: true, count: 'leaves' },
  { href: '/xodimlar', label: 'Xodimlar', area: 'employees', icon: 'group', ready: true, count: 'pending' },
  { href: '/jadvallar', label: 'Jadvallar', area: 'schedules', icon: 'calendar_month', ready: true },
  { href: '/filiallar', label: 'Filiallar', area: 'branches', icon: 'location_on', ready: true },
  { href: '/hisobotlar', label: 'Hisobotlar', area: 'reports', icon: 'bar_chart', ready: false },
  { href: '/ish-haqi', label: 'Ish haqi', area: 'payroll', icon: 'payments', ready: true },
  { href: '/sozlamalar', label: 'Sozlamalar', area: 'settings', icon: 'settings', ready: false },
];

export default async function PanelLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();
  const info = await shellInfo(user.tenantId);
  const pct = info.maxEmployees ? Math.min(100, Math.round((info.active / info.maxEmployees) * 100)) : 0;
  return (
    <div className="min-h-screen bg-canvas p-0 lg:p-4">
      <div className="flex min-h-[calc(100vh-2rem)] overflow-hidden bg-card lg:rounded-3xl lg:shadow-[var(--shadow-frame)]">
        <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-5 bg-card px-4 pt-6 pb-4 max-lg:hidden lg:h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between px-1.5">
            <Logo />
            <span className="flex size-8 items-center justify-center rounded-full text-muted"><Icon name="left_panel_close" /></span>
          </div>
          <div className="flex items-center gap-2.5 rounded-[14px] bg-[#F5F6F8] px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-navy text-[15px] font-extrabold text-white">{user.tenantName.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-placeholder">Ishxona</span>
              <span className="block truncate text-sm font-bold">{user.tenantName}</span>
            </span>
            <Icon name="unfold_more" size={18} className="text-muted" />
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            <div className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-placeholder">MENYU</div>
            {NAV.filter((n) => can(user.role, n.area)).map((n) => (
              <NavLink key={n.href} href={n.href} icon={n.icon} disabled={!n.ready} count={n.count === 'pending' ? info.pending : n.count === 'review' && user.role !== 'manager' ? info.review : n.count === 'leaves' && user.role !== 'manager' ? info.leaves : undefined}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-2xl bg-primary-soft p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-muted">Tarif · {info.planName}</span>
                <span className="tnum text-[13px] font-bold">{info.active} / {info.maxEmployees} xodim</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary-line"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
            </div>
            <UserBox name={user.name} phone={user.phone} />
          </div>
        </aside>
        <main className="m-0 flex min-w-0 flex-1 flex-col bg-page lg:my-2 lg:mr-2 lg:rounded-[20px]">
          <div className="flex h-14 items-center justify-between border-b border-line bg-card px-4 lg:hidden">
            <Logo size={24} text={18} />
            <span className="truncate text-[13px] font-semibold text-muted">{user.tenantName}</span>
          </div>
          <div className="flex flex-col gap-5 px-4 pt-5 pb-7 md:px-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
