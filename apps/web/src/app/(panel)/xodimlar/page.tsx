import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil, Plus, RefreshCw, Send, UserCheck } from 'lucide-react';
import { EMPLOYEE_STATUSES, formatPhone, initials, type EmployeeStatus } from '@adone/core';
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

export const metadata: Metadata = { title: 'Xodimlar' };

const TABS: Array<[EmployeeStatus | 'all', string]> = [['all', 'Barchasi'], ['active', 'Faol'], ['pending', 'Tasdiq kutmoqda'], ['invited', 'Taklif yuborildi'], ['disabled', "O'chirilgan"]];

export default async function EmployeesPage({ searchParams }: PageProps<'/xodimlar'>) {
  const user = await requireArea('employees');
  const sp = await searchParams;
  const status = (EMPLOYEE_STATUSES as readonly string[]).includes(String(sp.holat)) ? (String(sp.holat) as EmployeeStatus) : 'all';
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const departmentId = typeof sp.bolim === 'string' && /^[0-9a-f-]{36}$/.test(sp.bolim) ? sp.bolim : undefined;
  const [{ rows, counts, scope }, options, deps, members] = await Promise.all([
    listEmployees(user, { status, q, departmentId }),
    employeeOptions(user.tenantId),
    listDepartments(user.tenantId),
    listPanelMembers(user.tenantId),
  ]);
  const visibleDeps = scope ? deps.filter((d) => scope.includes(d.id)) : deps;
  const formOptions = { ...options, departments: scope ? options.departments.filter((d) => scope.includes(d.id)) : options.departments };
  const total = (counts.active ?? 0) + (counts.pending ?? 0) + (counts.invited ?? 0);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { holat: status === 'all' ? undefined : status, q: q || undefined, bolim: departmentId, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/xodimlar?${s}` : '/xodimlar';
  };
  const add = (
    <FormDrawer trigger={<><Plus size={16} /> Xodim qo&apos;shish</>} title="Yangi xodim" action={saveEmployeeAction} submitLabel="Qo'shish">
      <EmployeeFields options={formOptions} />
      <p className="m-0 rounded-lg bg-primary-tint px-3 py-2 text-[13px] text-primary">Saqlangach taklif havolasi chiqadi — uni xodimga Telegram&apos;da yuboring. Xodim botda raqamini ulashadi, rozilik beradi va dumaloq video yuboradi.</p>
    </FormDrawer>
  );

  return (
    <>
      <PageHeader title="Xodimlar" count={total} subtitle={scope ? "Faqat o'z bo'limingiz xodimlari" : undefined}>{add}</PageHeader>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {TABS.map(([k, l]) => {
                const n = k === 'all' ? total : (counts[k] ?? 0);
                return (
                  <Link key={k} href={href({ holat: k === 'all' ? undefined : k })} className={`btn-sm btn ${status === k ? 'bg-primary-tint text-primary' : 'text-ink-2 hover:bg-subtle'}`}>
                    {l} <span className="tnum text-xs opacity-70">{n}</span>
                  </Link>
                );
              })}
            </div>
            <form className="ml-auto flex gap-2" action="/xodimlar">
              {status !== 'all' && <input type="hidden" name="holat" value={status} />}
              <select name="bolim" defaultValue={departmentId ?? ''} className="input h-8 w-[160px] text-[13px]">
                <option value="">Barcha bo&apos;limlar</option>
                {visibleDeps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input name="q" defaultValue={q} placeholder="Qidirish…" className="input h-8 w-[180px] text-[13px]" />
              <button className="btn-secondary btn-sm">Izlash</button>
            </form>
          </div>

          <div className="card overflow-hidden">
            {rows.length === 0 ? (
              <EmptyState text={q || departmentId || status !== 'all' ? "Bu filtr bo'yicha xodim topilmadi." : "Hali xodim yo'q. Birinchi xodimni qo'shing va unga taklif havolasini yuboring."}>{!q && status === 'all' && add}</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-[13px]">
                  <thead className="bg-page text-left text-xs text-muted">
                    <tr><th className="px-4 py-2.5 font-medium">Xodim</th><th className="px-4 py-2.5 font-medium">Bo&apos;lim · filial</th><th className="px-4 py-2.5 font-medium">Jadval</th><th className="px-4 py-2.5 font-medium">Telegram</th><th className="px-4 py-2.5 font-medium">Holat</th><th className="px-4 py-2.5" /></tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-t border-line align-middle">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">{initials(e.fullName)}</span>
                            <div className="min-w-0">
                              <div className="font-medium">{e.fullName}</div>
                              <div className="tnum text-xs text-muted">{e.position ?? '—'}{e.phone ? ` · ${formatPhone(e.phone)}` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><div>{e.departmentName ?? '—'}</div><div className="text-xs text-muted">{e.branchName ?? '—'}</div></td>
                        <td className="px-4 py-3">{e.scheduleName ?? <span className="text-muted">jadvalsiz</span>}</td>
                        <td className="px-4 py-3">{e.telegramUserId ? <span className="text-success-text">{e.telegramUsername ? `@${e.telegramUsername}` : 'ulangan'}</span> : <span className="text-muted">ulanmagan</span>}</td>
                        <td className="px-4 py-3"><EmployeeStatusBadge status={e.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {e.status === 'invited' && (e.invite ? (
                              <>
                                <CopyButton text={inviteLink(e.invite)} label="Havola" />
                                <a href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink(e.invite))}&text=${encodeURIComponent(`${user.tenantName}: davomat botiga ulaning`)}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Telegram orqali yuborish"><Send size={14} /></a>
                              </>
                            ) : (
                              <form action={regenerateInviteAction}><input type="hidden" name="id" value={e.id} /><button className="btn-secondary btn-sm"><RefreshCw size={14} /> Yangi havola</button></form>
                            ))}
                            {e.status === 'pending' && (
                              <form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="active" /><button className="btn-primary btn-sm"><UserCheck size={14} /> Tasdiqlash</button></form>
                            )}
                            {e.status === 'disabled' ? (
                              e.telegramUserId && <form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="active" /><button className="btn-ghost btn-sm">Qayta yoqish</button></form>
                            ) : (
                              <FormDrawer trigger={<Pencil size={14} />} triggerClass="btn-ghost btn-sm" title="Xodimni tahrirlash" action={saveEmployeeAction}
                                danger={<form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="disabled" /><button className="btn-ghost text-danger-text">Ishdan bo&apos;shatish</button></form>}>
                                <EmployeeFields e={e} options={formOptions} />
                              </FormDrawer>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="card flex h-fit flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-sm font-semibold">Bo&apos;limlar</h2>
            {user.role !== 'manager' && (
              <FormDrawer trigger={<><Plus size={14} /> Qo&apos;shish</>} triggerClass="btn-ghost btn-sm" title="Yangi bo'lim" action={saveDepartmentAction}>
                <Field label="Nomi"><input name="name" placeholder="Sotuv zali" className="input" required /></Field>
                <Field label="Bo'lim boshlig'i" hint="Shu bo'lim xodimlarini ko'radi, vazifa beradi, so'rovlarni hal qiladi.">
                  <select name="managerUserId" className="input"><option value="">— yo&apos;q —</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                </Field>
              </FormDrawer>
            )}
          </div>
          {visibleDeps.length === 0 ? <p className="m-0 text-[13px] text-muted">Bo&apos;lim yo&apos;q.</p> : visibleDeps.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 border-t border-line pt-3 text-[13px]">
              <Link href={href({ bolim: d.id })} className="min-w-0">
                <div className="truncate font-medium">{d.name}</div>
                <div className="text-xs text-muted">{d.managerName ?? 'boshliqsiz'} · {d.employees} xodim</div>
              </Link>
              {user.role !== 'manager' && (
                <FormDrawer trigger={<Pencil size={13} />} triggerClass="btn-ghost btn-sm px-2" title="Bo'limni tahrirlash" action={saveDepartmentAction}
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
    </>
  );
}
