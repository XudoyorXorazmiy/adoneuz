import type { Metadata } from 'next';
import { ExternalLink, MapPin, Pencil, Plus } from 'lucide-react';
import { formatDistance } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listBranches } from '@/server/structure';
import { saveBranchAction, toggleBranchAction } from '@/lib/actions/structure';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { BranchFields } from '@/components/structure/branch-fields';
import { BranchMap, mapsLink } from '@/components/structure/branch-map';

export const metadata: Metadata = { title: 'Filiallar' };

export default async function BranchesPage() {
  const user = await requireArea('branches');
  const rows = await listBranches(user.tenantId);
  const active = rows.filter((b) => b.isActive);
  const archived = rows.filter((b) => !b.isActive);
  const add = (
    <FormDrawer trigger={<><Plus size={16} /> Filial qo&apos;shish</>} title="Yangi filial" action={saveBranchAction}>
      <BranchFields />
    </FormDrawer>
  );
  return (
    <>
      <PageHeader title="Filiallar" count={active.length} subtitle="Xodim faqat filial zonasida «Keldim» qila oladi.">{add}</PageHeader>
      {active.length === 0 ? (
        <div className="card"><EmptyState text="Hali filial yo'q. Birinchi filialni qo'shing — xaritadagi nuqta va radius.">{add}</EmptyState></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {active.map((b) => (
            <div key={b.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 font-semibold"><MapPin size={16} className="text-primary" /> {b.name}</span>
                  <span className="text-[13px] text-muted">{b.address ?? '—'} · radius {formatDistance(b.radiusM)} · {b.employees} xodim</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a href={mapsLink(b.lat, b.lng)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Google xaritada"><ExternalLink size={15} /></a>
                  <FormDrawer trigger={<Pencil size={15} />} triggerClass="btn-ghost btn-sm" title="Filialni tahrirlash" action={saveBranchAction}
                    danger={<form action={toggleBranchAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="active" value="0" /><button className="btn-ghost text-danger-text">Arxivlash</button></form>}>
                    <BranchFields b={b} />
                  </FormDrawer>
                </div>
              </div>
              <BranchMap lat={b.lat} lng={b.lng} radiusM={b.radiusM} />
              <span className="tnum text-xs text-muted">{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</span>
            </div>
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <div className="card p-4">
          <h2 className="m-0 mb-2 text-sm font-semibold text-muted">Arxiv</h2>
          {archived.map((b) => (
            <form key={b.id} action={toggleBranchAction} className="flex items-center justify-between border-t border-line py-2 first:border-0">
              <span>{b.name}</span>
              <input type="hidden" name="id" value={b.id} /><input type="hidden" name="active" value="1" />
              <button className="btn-ghost btn-sm">Qaytarish</button>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
