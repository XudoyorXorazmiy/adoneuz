import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, isUuid } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { inspectionDepartments } from '@/server/inspections';
import { TgHeader } from '@/components/tg/tg-shell';
import { InspectionForm } from '@/components/tg/inspection-form';
import { Icon } from '@/components/ui/icon';

/** «Nazorat» → tekshirish: bo'lim tanlash (yoki ?bolim=) → mezonlar ✓/✗ → saqlash. */
export default async function TgInspectPage({ searchParams }: PageProps<'/tg/nazorat/tekshirish'>) {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'inspections')) redirect('/tg');
  const sp = await searchParams;
  const deps = await inspectionDepartments(memberAsTenantUser(m));
  const dep = isUuid(sp.bolim) ? deps.find((d) => d.id === sp.bolim) : undefined;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title={dep ? dep.name : 'Tekshirish'} sub={dep ? `${dep.criteria.length} ta mezon` : "Bo'limni tanlang"} back={dep ? '/tg/nazorat/tekshirish' : '/tg/nazorat'} />
      {dep ? (
        <InspectionForm department={{ id: dep.id, name: dep.name }} criteria={dep.criteria} responsible={dep.responsible?.name ?? null} />
      ) : (
        <div className="flex flex-col gap-2.5 px-4 pt-4">
          {deps.map((d) => (
            <Link key={d.id} href={`/tg/nazorat/tekshirish?bolim=${d.id}`} className="flex items-center gap-3 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-tint text-primary"><Icon name="storefront" size={22} /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold">{d.name}</div><div className="truncate text-xs text-muted">{d.responsible ? `Javobgar: ${d.responsible.name}` : 'Javobgar yo‘q'} · {d.criteria.length} mezon</div></div>
              <Icon name="chevron_right" className="text-placeholder" />
            </Link>
          ))}
          {deps.length === 0 && <p className="m-0 text-sm text-muted">Bo&apos;limlar yo&apos;q.</p>}
        </div>
      )}
    </div>
  );
}
