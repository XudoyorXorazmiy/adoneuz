'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { STALE_APP, STALE_EVENT, webApp } from './webapp';

type NavItem = { href: string; label: string; icon: string; count?: number; external?: boolean };
const NAV: NavItem[] = [
  { href: '/tg', label: 'Bosh', icon: 'home' },
  { href: '/tg/vazifalar', label: 'Vazifalar', icon: 'task_alt' },
  { href: '/tg/tarix', label: 'Tarix', icon: 'history' },
  { href: '/tg/profil', label: 'Profil', icon: 'person' },
];
export type ManagerShell = { panelUrl: string; pending: number; reports: boolean; inspections?: boolean };
/** Rahbar (egasi, admin, bo'lim boshlig'i): Bugun · Vazifalar · Nazorat (faqat `inspections` — egasi, admin) · Qarorlar · Hisobot (faqat `reports`) · Panel (tashqi havola). */
export const managerNav = ({ panelUrl, pending, reports, inspections }: ManagerShell): NavItem[] => [
  { href: '/tg', label: 'Bugun', icon: 'how_to_reg' },
  { href: '/tg/vazifalar', label: 'Vazifalar', icon: 'task_alt' },
  ...(inspections ? [{ href: '/tg/nazorat', label: 'Nazorat', icon: 'checklist' }] : []),
  { href: '/tg/qarorlar', label: 'Qarorlar', icon: 'fact_check', count: pending },
  ...(reports ? [{ href: '/tg/hisobot', label: 'Hisobot', icon: 'bar_chart' }] : []),
  { href: panelUrl, label: 'Panel', icon: 'open_in_new', external: true },
];

/**
 * Telegram'ga tayyorlik: ready + to'liq balandlik + rangi. telegram-web-app.js `afterInteractive` — hali yuklanmagan bo'lishi
 * mumkin, shuning uchun paydo bo'lguncha (≤ 10 s) kutiladi. Eski ochiq ilova (deploy'dan keyin) — tepada «Yangilash» banneri.
 */
export function TgReady() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      const w = webApp();
      if (!w && ++n < 100) return;
      clearInterval(t);
      if (!w) return;
      w.ready();
      w.expand();
      w.setHeaderColor?.('#FFFFFF');
      w.setBackgroundColor?.('#F7F8FA');
    }, 100);
    const on = () => setStale(true);
    window.addEventListener(STALE_EVENT, on);
    return () => { clearInterval(t); window.removeEventListener(STALE_EVENT, on); };
  }, []);
  if (!stale) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 bg-ink px-4 py-3 text-sm font-semibold text-white">
      <span className="flex-1">{STALE_APP}</span>
      <button onClick={() => window.location.reload()} className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-ink">Yangilash</button>
    </div>
  );
}

/** Pastki menyu (dizayn): Bosh · Vazifalar · Tarix · Profil (xodim) yoki rahbar menyusi. */
export function TgNav({ items = NAV }: { items?: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur">
      <div className="mx-auto grid max-w-[520px]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((n) => {
          const on = !n.external && (n.href === '/tg' ? path === '/tg' : path.startsWith(n.href));
          const cls = `flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold ${on ? 'text-primary' : 'text-placeholder'}`;
          const inner = (
            <>
              <span className="relative"><Icon name={n.icon} size={24} fill={on} />{!!n.count && <span className="tnum absolute -top-1 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{n.count}</span>}</span>
              {n.label}
            </>
          );
          return n.external
            ? <a key={n.href} href={n.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
            : <Link key={n.href} href={n.href} className={cls}>{inner}</Link>;
        })}
      </div>
    </nav>
  );
}

/**
 * Ichki sahifa sarlavhasi (dizayn: «← Orqaga · Sarlavha · qadam»). Telegram ichida tizim BackButton ham yoqiladi.
 */
export function TgHeader({ title, sub, back = '/tg', dark }: { title: string; sub?: string; back?: string; dark?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const b = webApp()?.BackButton;
    if (!b) return;
    const go = () => router.push(back);
    b.show();
    b.onClick(go);
    return () => { b.offClick(go); b.hide(); };
  }, [back, router]);
  return (
    <header className={`sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 ${dark ? 'bg-[#0F1218] text-white' : 'border-b border-line bg-card'}`}>
      <Link href={back} className={`flex h-9 items-center gap-1 rounded-full pr-3.5 pl-2.5 text-sm font-semibold ${dark ? 'bg-white/10' : 'bg-subtle'}`}><Icon name="arrow_back" size={18} />Orqaga</Link>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate text-[15px] font-bold">{title}</div>
        {sub && <div className={`text-[11px] ${dark ? 'text-white/60' : 'text-muted'}`}>{sub}</div>}
      </div>
      <span className="w-[86px]" />
    </header>
  );
}

export function TgPage({ children, nav = true, manager }: { children: ReactNode; nav?: boolean; manager?: ManagerShell }) {
  return (
    <div className={`mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page ${nav ? 'pb-24' : ''}`}>
      {children}
      {nav && <TgNav items={manager ? managerNav(manager) : undefined} />}
    </div>
  );
}
