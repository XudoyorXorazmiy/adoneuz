import { requirePlatformUser } from '@/lib/auth/session';
import { Logo } from '@/components/ui/logo';
import { NavLink } from '@/components/shell/nav-link';
import { UserBox } from '@/components/shell/user-box';
import { MobileNav } from '@/components/shell/mobile-nav';

/** Platforma hostida yo'llar /platforma prefiksisiz (proxy qayta yozadi). */
const NAV = [
  { href: '/', label: 'Ishxonalar', icon: 'storefront' },
  { href: '/arizalar', label: 'Arizalar', icon: 'inbox' },
  { href: '/navbat', label: 'Navbat', icon: 'checklist' },
];

export default async function PlatformLayout({ children }: LayoutProps<'/platforma'>) {
  const user = await requirePlatformUser();
  const brand = (
    <span className="flex items-center gap-2">
      <Logo />
      <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">admin</span>
    </span>
  );
  return (
    <div className="min-h-screen bg-canvas p-0 lg:p-4">
      <div className="flex min-h-[calc(100vh-2rem)] overflow-hidden bg-card lg:rounded-3xl lg:shadow-[var(--shadow-frame)]">
        <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-5 bg-card px-4 pt-6 pb-4 max-md:hidden lg:h-[calc(100vh-2rem)]">
          <div className="px-1.5">{brand}</div>
          <nav className="flex flex-1 flex-col gap-1">
            <div className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-placeholder">PLATFORMA</div>
            {NAV.map((n) => <NavLink key={n.href} href={n.href} icon={n.icon}>{n.label}</NavLink>)}
          </nav>
          <UserBox name={user.name} phone={user.phone} profileHref={null} />
        </aside>
        <main className="m-0 min-w-0 flex-1 bg-page p-4 md:p-7 lg:my-2 lg:mr-2 lg:rounded-[20px]">
          <div className="-mx-4 -mt-4 mb-4 flex h-14 items-center gap-2 border-b border-line bg-card px-2 md:hidden">
            <MobileNav items={NAV} title={brand} footer={<UserBox name={user.name} phone={user.phone} profileHref={null} />} />
            {brand}
          </div>
          <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
