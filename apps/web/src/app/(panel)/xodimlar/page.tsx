import type { Metadata } from 'next';
import Link from 'next/link';
import { can, EMPLOYEE_STATUSES, formatPhone, type EmployeeStatus, isUuid } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { employeeOptions, inviteLink, listEmployees } from '@/server/employees';
import { listDepartments, listPanelMembers } from '@/server/structure';
import { regenerateInviteAction, saveEmployeeAction, setEmployeeStatusAction } from '@/lib/actions/employees';
import { archiveDepartmentAction, saveDepartmentAction } from '@/lib/actions/structure';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Field, FormDrawer } from '@/components/ui/form-drawer';
import { CopyButton } from '@/components/ui/copy-button';
import { EmployeeFields } from '@/components/employees/employee-fields';
import { EmployeeStatusBadge } from '@/components/employees/status-badge';
import { FilterBar } from '@/components/attendance/filter-bar';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';

export const metadata: Metadata = { title: 'Xodimlar' };

const TABS: Array<[EmployeeStatus | 'all', string]> = [['all', 'Barchasi'], ['active', 'Faol'], ['pending', 'Tasdiq kutmoqda'], ['invited', 'Taklif yuborildi'], ['disabled', "O'chirilgan"]];
const COLS = 'grid-cols-[minmax(0,1.8fr)_minmax(0,1.5fr)_minmax(0,1fr)_136px_176px]';

type Row = Awaited<ReturnType<typeof listEmployees>>['rows'][number];

/** Xodimlar (design/panel uslubi: Davomat jadvali, underline tablar, o'ng kartochka — bo'limlar). */
export default async function EmployeesPage({ searchParams }: PageProps<'/xodimlar'>) {
  const user = await requireArea('employees');
  const sp = await searchParams;
  const status = (EMPLOYEE_STATUSES as readonly string[]).includes(String(sp.holat)) ? (String(sp.holat) as EmployeeStatus) : 'all';
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const departmentId = isUuid(sp.bolim) ? sp.bolim : undefined;
  const [{ rows, counts, scope }, options, deps, members] = await Promise.all([
    listEmployees(user, { status, q, departmentId }),
    employeeOptions(user.tenantId),
    listDepartments(user.tenantId),
    listPanelMembers(user.tenantId),
  ]);
  const visibleDeps = scope ? deps.filter((d) => scope.includes(d.id)) : deps;
  const formOptions = { ...options, departments: scope ? options.departments.filter((d) => scope.includes(d.id)) : options.departments };
  const total = (counts.active ?? 0) + (counts.pending ?? 0) + (counts.invited ?? 0);
  const all = total + (counts.disabled ?? 0);
  const params = { holat: status === 'all' ? undefined : status, q: q || undefined, bolim: departmentId };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/xodimlar?${s}` : '/xodimlar';
  };
  const addDrawer = (cls: string) => (
    <FormDrawer trigger={<><Icon name="add" />Xodim qo&apos;shish</>} triggerClass={cls} title="Yangi xodim" subtitle="Saqlangach taklif havolasi chiqadi" action={saveEmployeeAction} submitLabel="Qo'shish">
      <EmployeeFields options={formOptions} showPay={can(user.role, 'payroll')} />
      <p className="m-0 flex gap-2 rounded-xl bg-primary-soft px-3.5 py-3 text-[13px] text-[#1F2A5C]">
        <Icon name="info" size={18} className="shrink-0 text-primary" />
        <span>Saqlangach taklif havolasi chiqadi — uni xodimga Telegram&apos;da yuboring. Xodim botda raqamini ulashadi, rozilik beradi va dumaloq video yuboradi.</span>
      </p>
    </FormDrawer>
  );

  /** Holatga qarab qatordagi amal (havola / tasdiqlash / qayta yoqish) + tahrirlash. */
  const actions = (e: Row) => (
    <div className="flex items-center justify-end gap-1.5">
      {e.status === 'invited' && (e.invite ? (
        <>
          <CopyButton text={inviteLink(e.invite)} label="Havola" className="btn-secondary btn-sm h-8 px-3" />
          <a href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink(e.invite))}&text=${encodeURIComponent(`${user.tenantName}: davomat botiga ulaning`)}`} target="_blank" rel="noreferrer"
            className="flex size-8 items-center justify-center rounded-full border border-line bg-card text-[#229ED9] hover:bg-page" title="Telegram orqali yuborish"><Icon name="send" size={16} /></a>
        </>
      ) : (
        <form action={regenerateInviteAction}><input type="hidden" name="id" value={e.id} /><button className="btn-secondary btn-sm h-8 px-3"><Icon name="refresh" size={16} />Yangi havola</button></form>
      ))}
      {e.status === 'pending' && (
        <form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="active" /><button className="btn-primary btn-sm h-8 px-3 shadow-none"><Icon name="how_to_reg" size={16} />Tasdiqlash</button></form>
      )}
      {e.status === 'disabled' ? (
        e.telegramUserId && <form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="active" /><button className="btn-ghost btn-sm h-8 px-3">Qayta yoqish</button></form>
      ) : (
        <FormDrawer trigger={<Icon name="edit" size={16} />} triggerClass="flex size-8 items-center justify-center rounded-full border border-line bg-card hover:bg-page" title="Xodimni tahrirlash" subtitle={e.fullName} action={saveEmployeeAction}
          danger={<form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="disabled" /><button className="btn-ghost text-danger-text">Ishdan bo&apos;shatish</button></form>}>
          <EmployeeFields e={e} options={formOptions} showPay={can(user.role, 'payroll')} />
        </FormDrawer>
      )}
    </div>
  );
  const telegram = (e: Row) => e.telegramUserId
    ? <span className="inline-flex items-center gap-1 text-xs font-bold text-success"><Icon name="check_circle" size={16} fill />{e.telegramUsername ? `@${e.telegramUsername}` : 'Ulangan'}</span>
    : <span className="inline-flex items-center gap-1 text-xs font-bold text-placeholder"><Icon name="link_off" size={16} />Ulanmagan</span>;

  return (
    <>
      <PageHeader title="Xodimlar" count={total} subtitle={scope ? "Faqat o'z bo'limingiz xodimlari" : 'Taklif havolasi orqali botga ulanadi, rahbar tasdiqlaydi'}
        actions={addDrawer('btn-primary h-11 pr-[22px] pl-[18px] text-sm max-md:hidden')} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="card min-w-0 px-6 pt-5 pb-2 max-sm:px-4">
          <FilterBar base="/xodimlar" params={params} branches={[]} departments={visibleDeps.map((d) => ({ id: d.id, name: d.name }))} placeholder="Ism, telefon yoki lavozim…" />
          <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line-soft">
            {TABS.map(([k, l]) => {
              const on = status === k;
              const n = k === 'all' ? all : (counts[k] ?? 0);
              return (
                <Link key={k} href={href({ holat: k === 'all' ? undefined : k })}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 pt-2.5 pb-3 text-[13px] whitespace-nowrap ${on ? 'border-primary font-bold text-ink' : 'border-transparent font-medium text-muted hover:text-ink'}`}>
                  {l}
                  <span className={`tnum rounded-full px-[7px] py-px text-[11px] font-bold ${on ? 'bg-primary text-white' : k === 'pending' && n ? 'bg-warning-tint text-warning' : 'bg-subtle text-muted'}`}>{n}</span>
                </Link>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <EmptyState text={q || departmentId || status !== 'all' ? "Bu filtr bo'yicha xodim topilmadi." : "Hali xodim yo'q. Birinchi xodimni qo'shing va unga taklif havolasini yuboring."}>
              {!q && status === 'all' && !departmentId && addDrawer('btn-primary h-11 px-[22px] text-sm')}
            </EmptyState>
          ) : (
            <>
              <div className="max-md:hidden">
                <div className={`grid ${COLS} gap-3 border-b border-line-soft px-1 pt-3.5 pb-2.5 text-xs font-medium text-placeholder`}>
                  <span>Xodim</span><span>Bo&apos;lim · jadval</span><span>Telegram</span><span>Holat</span><span />
                </div>
                {rows.map((e) => (
                  <div key={e.id} className={`grid ${COLS} items-center gap-3 border-b border-[#F4F5F7] px-1 py-[11px] text-[13px] last:border-b-0`}>
                    <Link href={`/xodimlar/${e.id}`} className="group flex min-w-0 items-center gap-2.5">
                      <Avatar name={e.fullName} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate font-bold group-hover:text-primary">{e.fullName}</span>
                        <span className="tnum block truncate text-xs text-muted">{[e.position, e.phone ? formatPhone(e.phone) : null].filter(Boolean).join(' · ') || '—'}</span>
                      </span>
                    </Link>
                    <span className="min-w-0">
                      <span className="block truncate">{e.departmentName ?? '—'}</span>
                      <span className="block truncate text-xs text-muted">{[e.branchName ?? 'filialsiz', e.scheduleName ?? 'jadvalsiz'].join(' · ')}</span>
                    </span>
                    {telegram(e)}
                    <span><EmployeeStatusBadge status={e.status} /></span>
                    {actions(e)}
                  </div>
                ))}
              </div>
              {/* Telefon: kartochkalar */}
              <div className="flex flex-col gap-2.5 py-3 md:hidden">
                {rows.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2.5 rounded-[20px] border border-line p-3.5">
                    <Link href={`/xodimlar/${e.id}`} className="flex items-center gap-2.5">
                      <Avatar name={e.fullName} size={40} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{e.fullName}</span><span className="block truncate text-xs text-muted">{[e.position, e.departmentName].filter(Boolean).join(' · ') || '—'}</span></span>
                      <EmployeeStatusBadge status={e.status} />
                    </Link>
                    <div className="flex items-center justify-between gap-2">{telegram(e)}{actions(e)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="px-1 py-3.5 text-[13px] text-muted"><span className="tnum">{rows.length}</span> ta ko&apos;rsatilmoqda</div>
        </section>

        <aside className="card flex flex-col px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5 border-b border-line-soft pb-3.5">
            <span className="card-icon"><Icon name="workspaces" size={18} fill /></span>
            <h2 className="m-0 flex-1 text-base font-bold">Bo&apos;limlar <span className="tnum text-placeholder">{visibleDeps.length}</span></h2>
            {user.role !== 'manager' && (
              <FormDrawer trigger={<><Icon name="add" size={16} />Qo&apos;shish</>} triggerClass="btn-ghost btn-sm h-8 px-3 text-primary" title="Yangi bo'lim" action={saveDepartmentAction}>
                <Field label="Nomi"><input name="name" placeholder="Sotuv zali" className="input" required /></Field>
                <Field label="Bo'lim boshlig'i" hint="Shu bo'lim xodimlarini ko'radi, vazifa beradi, so'rovlarni hal qiladi.">
                  <select name="managerUserId" className="input"><option value="">— yo&apos;q —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                </Field>
              </FormDrawer>
            )}
          </div>
          {visibleDeps.length === 0 ? <p className="m-0 py-4 text-[13px] text-muted">Bo&apos;lim yo&apos;q.</p> : visibleDeps.map((d) => (
            <div key={d.id} className={`flex items-center gap-2 border-b border-[#F4F5F7] py-3 text-[13px] last:border-b-0 ${departmentId === d.id ? '-mx-2 rounded-xl bg-primary-soft px-2' : ''}`}>
              <Link href={href({ bolim: departmentId === d.id ? undefined : d.id })} className="min-w-0 flex-1">
                <span className={`block truncate font-bold ${departmentId === d.id ? 'text-primary' : ''}`}>{d.name}</span>
                <span className="block truncate text-xs text-muted">{d.managerName ?? 'boshliqsiz'} · {d.employees} xodim</span>
              </Link>
              {user.role !== 'manager' && (
                <FormDrawer trigger={<Icon name="edit" size={15} />} triggerClass="flex size-8 items-center justify-center rounded-full text-muted hover:bg-page hover:text-ink" title="Bo'limni tahrirlash" subtitle={d.name} action={saveDepartmentAction}
                  danger={d.employees === 0 ? <form action={archiveDepartmentAction}><input type="hidden" name="id" value={d.id} /><button className="btn-ghost text-danger-text">O&apos;chirish</button></form> : undefined}>
                  <input type="hidden" name="id" value={d.id} />
                  <Field label="Nomi"><input name="name" defaultValue={d.name} className="input" required /></Field>
                  <Field label="Bo'lim boshlig'i">
                    <select name="managerUserId" defaultValue={d.managerUserId ?? ''} className="input"><option value="">— yo&apos;q —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                  </Field>
                </FormDrawer>
              )}
            </div>
          ))}
        </aside>
      </div>

      {/* Telefon: pastda yopishgan asosiy tugma */}
      <div className="sticky bottom-3 z-10 md:hidden">{addDrawer('btn-primary h-[52px] w-full text-base shadow-[var(--shadow-primary)]')}</div>
    </>
  );
}
