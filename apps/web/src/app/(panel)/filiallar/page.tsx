import type { Metadata } from 'next';
import { formatDistance } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listBranches } from '@/server/structure';
import { saveBranchAction, toggleBranchAction } from '@/lib/actions/structure';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { BranchFields } from '@/components/structure/branch-fields';
import { BranchMap } from '@/components/structure/branch-map';
import { mapsLink } from '@/components/structure/maps-link';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = { title: 'Filiallar' };

/** Filiallar: xaritadagi nuqta + radius (geofence). Kartochka uslubi — Sozlamalar/Davomat bilan bir xil. */
export default async function BranchesPage() {
  const user = await requireArea('branches');
  const rows = await listBranches(user.tenantId);
  const active = rows.filter((b) => b.isActive);
  const archived = rows.filter((b) => !b.isActive);
  const add = (cls: string) => (
    <FormDrawer trigger={<><Icon name="add" />Filial qo&apos;shish</>} triggerClass={cls} title="Yangi filial" subtitle="Xaritadagi nuqta va «Keldim» radiusi" action={saveBranchAction}>
      <BranchFields />
    </FormDrawer>
  );
  return (
    <>
      <PageHeader title="Filiallar" count={active.length} subtitle="Xodim faqat filial zonasida «Keldim» qila oladi."
        actions={add('btn-primary h-11 pr-[22px] pl-[18px] text-sm max-md:hidden')} />
      {active.length === 0 ? (
        <div className="card"><EmptyState text="Hali filial yo'q. Birinchi filialni qo'shing — xaritadagi nuqta va radius.">{add('btn-primary h-11 px-[22px] text-sm')}</EmptyState></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {active.map((b) => (
            <section key={b.id} className="card flex flex-col gap-4 p-5 max-sm:p-4">
              <div className="flex items-start gap-3">
                <span className="card-icon size-9"><Icon name="location_on" size={20} fill /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 truncate text-base font-bold">{b.name}</h2>
                  <div className="text-[13px] text-muted">{[b.address, `radius ${formatDistance(b.radiusM)}`, `${b.employees} xodim`].filter(Boolean).join(' · ')}</div>
                </div>
                <a href={mapsLink(b.lat, b.lng)} target="_blank" rel="noreferrer" className="btn-icon size-9" title="Google xaritada"><Icon name="open_in_new" size={18} /></a>
                <FormDrawer trigger={<Icon name="edit" size={18} />} triggerClass="btn-icon size-9" title="Filialni tahrirlash" subtitle={b.name} action={saveBranchAction}
                  danger={<form action={toggleBranchAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="active" value="0" /><button className="btn-ghost text-danger-text">Arxivlash</button></form>}>
                  <BranchFields b={b} />
                </FormDrawer>
              </div>
              <BranchMap lat={b.lat} lng={b.lng} radiusM={b.radiusM} height={220} />
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span className="tnum font-mono">{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full border-[1.5px] border-primary bg-primary/15" />{formatDistance(b.radiusM)} zona</span>
              </div>
            </section>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <section className="card px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5 border-b border-line-soft pb-3.5">
            <span className="card-icon bg-subtle text-muted"><Icon name="inventory_2" size={18} /></span>
            <h2 className="m-0 text-base font-bold">Arxiv <span className="tnum text-placeholder">{archived.length}</span></h2>
          </div>
          {archived.map((b) => (
            <form key={b.id} action={toggleBranchAction} className="flex items-center justify-between gap-3 border-b border-[#F4F5F7] py-3 text-[13px] last:border-b-0">
              <span className="min-w-0"><span className="block truncate font-semibold">{b.name}</span><span className="block truncate text-xs text-muted">{b.address ?? '—'}</span></span>
              <input type="hidden" name="id" value={b.id} /><input type="hidden" name="active" value="1" />
              <button className="btn-secondary btn-sm h-8 px-3"><Icon name="unarchive" size={16} />Qaytarish</button>
            </form>
          ))}
        </section>
      )}
      <div className="sticky bottom-3 z-10 md:hidden">{add('btn-primary h-[52px] w-full text-base shadow-[var(--shadow-primary)]')}</div>
    </>
  );
}
