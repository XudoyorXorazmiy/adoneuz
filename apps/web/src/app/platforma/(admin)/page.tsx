import type { Metadata } from 'next';
import { formatDate, formatPhone } from '@adone/core';
import { listPlans, listTenants, platformStats } from '@/server/platform';
import { setTenantStatusAction } from '@/lib/actions/platform';
import { CreateTenant } from '@/components/platform/create-tenant';
import { TenantStatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Ishxonalar' };

const COLS = 'grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_70px_minmax(0,0.9fr)_220px]';

/** Super admin → Ishxonalar: panel uslubi (StatCard, grid jadval, telefonda kartochkalar). */
export default async function TenantsPage() {
  const [rows, plans, stats] = await Promise.all([listTenants(), listPlans(), platformStats()]);
  const soon = (d: Date | null) => !!d && d.getTime() - Date.now() < 7 * 86_400_000;
  const actions = (t: (typeof rows)[number]) => (
    <form action={setTenantStatusAction} className="flex justify-end gap-1.5">
      <input type="hidden" name="id" value={t.id} />
      {t.status === 'blocked' ? (
        <button name="status" value="active" className="btn-secondary btn-sm h-8 px-3">Blokdan chiqarish</button>
      ) : (
        <>
          {t.status !== 'active' && <button name="status" value="active" className="btn-secondary btn-sm h-8 px-3">Faollashtirish</button>}
          <button name="status" value="blocked" className="btn-ghost btn-sm h-8 px-3 text-danger-text">Bloklash</button>
        </>
      )}
    </form>
  );
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Ishxonalar <span className="tnum text-placeholder">{rows.length}</span></h1>
        <CreateTenant plans={plans} />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="storefront" tone="primary" label="Ishxonalar" value={stats.tenants} caption="jami ochilgan" />
        <StatCard icon="verified" tone="success" label="Faol (to'lovli)" value={stats.active} caption="obuna faol" />
        <StatCard icon="hourglass_top" tone="warning" label="Sinovda" value={stats.trial} caption="sinov muddatida" />
        <StatCard icon="group" tone="primary" label="Panel foydalanuvchilari" value={stats.members} caption="egasi, admin, menejer" />
      </div>
      <section className="card px-6 pt-2 pb-2 max-sm:px-4">
        {rows.length === 0 ? (
          <p className="m-0 p-10 text-center text-muted">Hali ishxona yo&apos;q. «Ishxona qo&apos;shish» bilan birinchisini oching.</p>
        ) : (
          <>
            <div className="overflow-x-auto max-md:hidden">
              <div className="min-w-[980px]">
                <div className={`grid ${COLS} gap-3 border-b border-line-soft px-1 pt-3.5 pb-2.5 text-xs font-medium text-placeholder`}>
                  <span>Ishxona</span><span>Egasi</span><span>Tarif</span><span>Muddat</span><span>A&apos;zolar</span><span>Holat</span><span />
                </div>
                {rows.map((t) => (
                  <div key={t.id} className={`grid ${COLS} items-center gap-3 border-b border-[#F4F5F7] px-1 py-[11px] text-[13px] last:border-b-0`}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-navy text-sm font-extrabold text-white">{t.name.slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0"><span className="block truncate font-bold">{t.name}</span><span className="block truncate text-xs text-muted">{t.slug} · {formatDate(t.createdAt)}</span></span>
                    </span>
                    <span className="min-w-0"><span className="block truncate">{t.ownerName ?? '—'}</span><span className="tnum block truncate text-xs text-muted">{formatPhone(t.ownerPhone)}</span></span>
                    <span className="font-semibold">{t.planName ?? '—'}</span>
                    <span className={`tnum ${soon(t.periodEnd) ? 'font-bold text-warning' : ''}`}>{t.periodEnd ? formatDate(t.periodEnd) : '—'}</span>
                    <span className="tnum">{t.members}</span>
                    <span><TenantStatusBadge status={t.status} /></span>
                    {actions(t)}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5 py-3 md:hidden">
              {rows.map((t) => (
                <div key={t.id} className="flex flex-col gap-2.5 rounded-[20px] border border-line p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-navy font-extrabold text-white">{t.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{t.name}</span><span className="block truncate text-xs text-muted">{t.ownerName ?? '—'} · {formatPhone(t.ownerPhone)}</span></span>
                    <TenantStatusBadge status={t.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-subtle px-2.5 py-1 font-semibold">{t.planName ?? '—'}</span>
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${soon(t.periodEnd) ? 'bg-warning-tint text-warning' : 'bg-subtle'}`}>{t.periodEnd ? `${formatDate(t.periodEnd)} gacha` : '—'}</span>
                    <span className="rounded-full bg-subtle px-2.5 py-1 font-semibold">{t.members} a&apos;zo</span>
                  </div>
                  {actions(t)}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
