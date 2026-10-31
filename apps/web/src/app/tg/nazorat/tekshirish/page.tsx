import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, isUuid } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { inspectionDepartments, inspectionEmployees } from '@/server/inspections';
import { TgHeader } from '@/components/tg/tg-shell';
import { InspectionForm } from '@/components/tg/inspection-form';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

/**
 * «Nazorat» → tekshirish: bo'lim (?bolim=) yoki xodim (?xodim=) → mezonlar ✓/✗ → saqlash.
 * Tanlov ekrani: «Bo'limlar» / «Xodimlar» (?tur=xodim), xodimlar bo'lim bo'yicha guruhlangan.
 */
export default async function TgInspectPage({ searchParams }: PageProps<'/tg/nazorat/tekshirish'>) {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'inspections')) redirect('/tg');
  const sp = await searchParams;
  const tu = memberAsTenantUser(m);
  const [deps, emps] = await Promise.all([inspectionDepartments(tu), inspectionEmployees(tu)]);
  const candidates = emps.map((e) => ({ id: e.id, name: e.name, departmentId: e.departmentId }));
  const dep = isUuid(sp.bolim) ? deps.find((d) => d.id === sp.bolim) : undefined;
  const emp = !dep && isUuid(sp.xodim) ? emps.find((e) => e.id === sp.xodim) : undefined;
  const tab = sp.tur === 'xodim' ? 'employee' : 'department';
  const seg = (on: boolean) => `flex-1 rounded-full py-2 text-[13px] font-semibold transition ${on ? 'bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`;
  const row = 'flex items-center gap-3 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]';

  if (dep) return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title={dep.name} sub={`${dep.criteria.length} ta mezon`} back="/tg/nazorat/tekshirish" />
      <InspectionForm subject={{ kind: 'department', id: dep.id, name: dep.name, responsible: dep.responsible ? { id: dep.responsible.id, name: dep.responsible.name } : null }} criteria={dep.criteria} candidates={candidates} />
    </div>
  );
  if (emp) return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title={emp.name} sub={`${emp.departmentName ?? "Bo'limsiz"} · ${emp.criteria.length} ta mezon`} back="/tg/nazorat/tekshirish?tur=xodim" />
      <InspectionForm subject={{ kind: 'employee', id: emp.id, name: emp.name, departmentName: emp.departmentName }} criteria={emp.criteria} candidates={[]} />
    </div>
  );

  // Xodimlar — bo'lim bo'yicha guruh
  const groups = new Map<string, typeof emps>();
  for (const e of emps) { const k = e.departmentName ?? "Bo'limsiz"; groups.set(k, [...(groups.get(k) ?? []), e]); }
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title="Tekshirish" sub={tab === 'employee' ? 'Xodimni tanlang' : "Bo'limni tanlang"} back="/tg/nazorat" />
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-6">
        <div className="flex gap-1 rounded-full bg-subtle p-1">
          <Link href="/tg/nazorat/tekshirish" className={`${seg(tab === 'department')} text-center`}>Bo&apos;limlar</Link>
          <Link href="/tg/nazorat/tekshirish?tur=xodim" className={`${seg(tab === 'employee')} text-center`}>Xodimlar</Link>
        </div>
        {tab === 'department' ? (
          <>
            {deps.map((d) => (
              <Link key={d.id} href={`/tg/nazorat/tekshirish?bolim=${d.id}`} className={row}>
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-tint text-primary"><Icon name="storefront" size={22} /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold">{d.name}</div><div className="truncate text-xs text-muted">{d.responsible ? `Javobgar: ${d.responsible.name}` : 'Javobgar yo‘q — shu yerda biriktiriladi'} · {d.criteria.length} mezon</div></div>
                <Icon name="chevron_right" className="text-placeholder" />
              </Link>
            ))}
            {deps.length === 0 && <p className="m-0 text-sm text-muted">Bo&apos;limlar yo&apos;q.</p>}
          </>
        ) : (
          <>
            {[...groups].map(([name, list]) => (
              <section key={name} className="flex flex-col gap-2">
                <h2 className="m-0 mt-1 px-1 text-xs font-bold text-muted uppercase tracking-wide">{name}</h2>
                {list.map((e) => (
                  <Link key={e.id} href={`/tg/nazorat/tekshirish?xodim=${e.id}`} className={row}>
                    <Avatar name={e.name} size={40} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold">{e.name}</div><div className="truncate text-xs text-muted">{e.position ?? name} · {e.criteria.length} mezon</div></div>
                    <Icon name="chevron_right" className="text-placeholder" />
                  </Link>
                ))}
              </section>
            ))}
            {emps.length === 0 && <p className="m-0 text-sm text-muted">Faol xodimlar yo&apos;q.</p>}
          </>
        )}
      </div>
    </div>
  );
}
