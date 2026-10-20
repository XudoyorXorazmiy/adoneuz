import { Building2, ListChecks } from 'lucide-react';
import { requirePlatformUser } from '@/lib/auth/session';
import { Logo } from '@/components/ui/logo';
import { NavLink } from '@/components/shell/nav-link';
import { UserBox } from '@/components/shell/user-box';

export default async function PlatformLayout({ children }: LayoutProps<'/platforma'>) {
  const user = await requirePlatformUser();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col gap-6 bg-[#0B2E2B] px-3 py-5 max-md:hidden">
        <div className="flex items-center gap-2 px-2">
          <Logo size={28} text={0} label={false} />
          <span className="text-[17px] font-bold text-white">adone</span>
          <span className="rounded bg-white/12 px-1.5 py-0.5 text-[11px] font-medium text-white/80">admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {/* Platforma hostida yo'llar /platforma prefiksisiz (proxy qayta yozadi) */}
          <NavLink href="/" icon={<Building2 size={18} />}>Ishxonalar</NavLink>
          <NavLink href="/navbat" icon={<ListChecks size={18} />}>Navbat</NavLink>
        </nav>
        <UserBox name={user.name} subtitle="Super admin" />
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}
