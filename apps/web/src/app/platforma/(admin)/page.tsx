import type { Metadata } from 'next';
import { formatDate, formatPhone } from '@adone/core';
import { listPlans, listTenants, platformStats } from '@/server/platform';
import { setTenantStatusAction } from '@/lib/actions/platform';
import { CreateTenant } from '@/components/platform/create-tenant';
import { TenantStatusBadge } from '@/components/ui/status-badge';

export const metadata: Metadata = { title: 'Ishxonalar' };

export default async function TenantsPage() {
  const [rows, plans, stats] = await Promise.all([listTenants(), listPlans(), platformStats()]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Ishxonalar <span className="tnum text-muted">{rows.length}</span></h1>
        <CreateTenant plans={plans} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ishxonalar" value={stats.tenants} />
        <Kpi label="Faol (to'lovli)" value={stats.active} />
        <Kpi label="Sinovda" value={stats.trial} />
        <Kpi label="Panel foydalanuvchilari" value={stats.members} />
      </div>
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="m-0 p-10 text-center text-muted">Hali ishxona yo&apos;q. «Ishxona qo&apos;shish» bilan birinchisini oching.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead className="bg-page text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Ishxona</th>
                  <th className="px-4 py-2.5 font-medium">Egasi</th>
                  <th className="px-4 py-2.5 font-medium">Tarif</th>
                  <th className="px-4 py-2.5 font-medium">Muddat</th>
                  <th className="px-4 py-2.5 font-medium">A&apos;zolar</th>
                  <th className="px-4 py-2.5 font-medium">Holat</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="px-4 py-3"><div className="font-medium">{t.name}</div><div className="text-xs text-muted">{t.slug} · {formatDate(t.createdAt)}</div></td>
                    <td className="px-4 py-3"><div>{t.ownerName ?? '—'}</div><div className="tnum text-xs text-muted">{formatPhone(t.ownerPhone)}</div></td>
                    <td className="px-4 py-3">{t.planName ?? '—'}</td>
                    <td className="tnum px-4 py-3">{t.periodEnd ? formatDate(t.periodEnd) : '—'}</td>
                    <td className="tnum px-4 py-3">{t.members}</td>
                    <td className="px-4 py-3"><TenantStatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <form action={setTenantStatusAction} className="inline-flex gap-1">
                        <input type="hidden" name="id" value={t.id} />
                        {t.status === 'blocked' ? (
                          <button name="status" value="active" className="btn-secondary btn-sm">Blokdan chiqarish</button>
                        ) : (
                          <>
                            {t.status !== 'active' && <button name="status" value="active" className="btn-secondary btn-sm">Faollashtirish</button>}
                            <button name="status" value="blocked" className="btn-ghost btn-sm text-danger-text">Bloklash</button>
                          </>
                        )}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-pad flex flex-col gap-1">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="kpi-value tnum">{value}</span>
    </div>
  );
}
