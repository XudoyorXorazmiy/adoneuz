import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addDays, can, formatDate, formatTime } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { managerPendingCount, managerShell } from '@/server/manager';
import { inspectionOverview, inspectionSubject } from '@/server/inspections';
import { getSettings } from '@/server/settings';
import { today } from '@/server/attendance';
import { TgPage } from '@/components/tg/tg-shell';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';

/** Rahbar Mini App'i — «Nazorat» (egasi, admin): bugungi holat bo'limlar va xodimlar bo'yicha, «Tekshirish», oxirgi 14 kun tarixi. */
export default async function TgInspectionsPage({ searchParams }: PageProps<'/tg/nazorat'>) {
  const sp = await searchParams;
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'inspections')) redirect('/tg');
  const tu = memberAsTenantUser(m);
  const t = today(tu);
  const [o, pending, settings] = await Promise.all([inspectionOverview(tu, { from: addDays(t, -13), to: t }), managerPendingCount(m), getSettings(m.tenantId)]);
  const labels = new Map(settings.inspection.criteria.map((c) => [c.id, c.label]));
  const todayRows = o.rows.filter((r) => r.workDate === t && !r.employeeId);
  const todayEmp = o.rows.filter((r) => r.workDate === t && r.employeeId);
  const showEmployees = sp.xodimlar === '1';
  const card = 'rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]';
  const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
  const tone = (n: number | null) => (n == null ? 'text-muted' : n >= 90 ? 'text-success' : n >= 70 ? 'text-warning' : 'text-danger');
  return (
    <TgPage manager={managerShell(m, pending)}>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div><h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Nazorat</h1><p className="m-0 text-[13px] text-muted">Bugun {formatDate(`${t}T12:00:00Z`)} · {todayRows.length} bo&apos;lim · {todayEmp.length} xodim</p></div>
          <Link href="/tg/nazorat/tekshirish" className="btn-primary h-11 px-4 text-sm shadow-none"><Icon name="add_task" size={18} />Tekshirish</Link>
        </div>

        <section className="flex flex-col gap-2.5">
          <h2 className="m-0 text-sm font-bold text-muted">Bo&apos;limlar · bugun</h2>
          {o.departments.length === 0 && <div className={`${card} text-sm text-muted`}>Bo&apos;limlar yo&apos;q — panelda Xodimlar → Bo&apos;limlar.</div>}
          {o.departments.map((d) => {
            const last = todayRows.find((r) => r.departmentId === d.id) ?? null;
            return (
              <Link key={d.id} href={`/tg/nazorat/tekshirish?bolim=${d.id}`} className={`${card} flex items-center gap-3`}>
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${!last ? 'bg-subtle text-placeholder' : last.failCount ? 'bg-danger-tint text-danger' : 'bg-success-tint text-success'}`}>
                  <Icon name={!last ? 'schedule' : last.failCount ? 'report' : 'check_circle'} size={24} fill={!!last} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{d.name}</div>
                  <div className="truncate text-xs text-muted">{d.responsible ? `Javobgar: ${d.responsible}` : 'Javobgar yo‘q'}{last ? ` · ${formatTime(last.at, m.tz)}` : ' · bugun tekshirilmagan'}</div>
                </div>
                <div className="text-right">
                  {last ? <div className="tnum text-sm font-bold">{last.okCount} ✓ <span className={last.failCount ? 'text-danger' : 'text-placeholder'}>{last.failCount} ✗</span></div> : <div className="text-xs font-semibold text-primary">Tekshirish</div>}
                  {d.openTasks > 0 && <div className="text-[11px] font-semibold text-warning">{d.openTasks} ochiq vazifa</div>}
                </div>
              </Link>
            );
          })}
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-sm font-bold text-muted">Xodimlar · bugun</h2>
            <Link href="/tg/nazorat/tekshirish?tur=xodim" className="text-[13px] font-semibold text-primary">Xodimni tekshirish</Link>
          </div>
          {(() => {
            const checked = o.employees.filter((e) => todayEmp.some((r) => r.employeeId === e.id));
            const unchecked = o.employees.filter((e) => !checked.includes(e));
            const shown = showEmployees ? [...checked, ...unchecked] : checked;
            return (
              <>
                {shown.map((e) => {
                  const last = todayEmp.find((r) => r.employeeId === e.id) ?? null;
                  return (
                    <Link key={e.id} href={`/tg/nazorat/tekshirish?xodim=${e.id}`} className={`${card} flex items-center gap-3`}>
                      <span className="relative shrink-0">
                        <Avatar name={e.name} size={44} />
                        {last && <span className={`absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full border-2 border-card ${last.failCount ? 'bg-danger text-white' : 'bg-success text-white'}`}><Icon name={last.failCount ? 'close' : 'check'} size={12} /></span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-bold">{e.name}</div>
                        <div className="truncate text-xs text-muted">{e.departmentName ?? "Bo'limsiz"}{last ? ` · ${formatTime(last.at, m.tz)}` : ' · bugun tekshirilmagan'}</div>
                      </div>
                      <div className="text-right">
                        {last ? <div className="tnum text-sm font-bold">{last.okCount} ✓ <span className={last.failCount ? 'text-danger' : 'text-placeholder'}>{last.failCount} ✗</span></div> : <div className="text-xs font-semibold text-primary">Tekshirish</div>}
                        {e.openTasks > 0 && <div className="text-[11px] font-semibold text-warning">{e.openTasks} ochiq vazifa</div>}
                      </div>
                    </Link>
                  );
                })}
                {!showEmployees && unchecked.length > 0 && (
                  <Link href="/tg/nazorat?xodimlar=1" className={`${card} flex items-center justify-center gap-2 text-sm font-semibold text-primary`}><Icon name="expand_more" size={18} />Yana {unchecked.length} ta xodim (bugun tekshirilmagan)</Link>
                )}
                {showEmployees && <Link href="/tg/nazorat" className={`${card} flex items-center justify-center gap-2 text-sm font-semibold text-muted`}><Icon name="expand_less" size={18} />Yig&apos;ish</Link>}
                {o.employees.length === 0 && <div className={`${card} text-sm text-muted`}>Faol xodimlar yo&apos;q.</div>}
              </>
            );
          })()}
        </section>

        <section className={card}>
          <div className="mb-3 flex items-center justify-between"><h2 className="m-0 text-sm font-bold text-muted">14 kun · reyting</h2><span className={`tnum text-sm font-bold ${tone(o.stats.pct)}`}>{pct(o.stats.pct)} ✓</span></div>
          <div className="flex flex-col divide-y divide-line-soft">
            {o.departments.filter((d) => d.stats.checks > 0).map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="tnum w-5 text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{d.name}</span>
                <span className="tnum text-xs text-muted">{d.stats.checks} ta</span>
                <span className={`tnum w-12 text-right font-bold ${tone(d.stats.pct)}`}>{pct(d.stats.pct)}</span>
              </div>
            ))}
            {o.stats.checks === 0 && <p className="m-0 py-2 text-sm text-muted">Hali bo&apos;lim tekshiruvi yo&apos;q.</p>}
          </div>
          {o.employeeStats.checks > 0 && (
            <>
              <div className="mt-4 mb-2 flex items-center justify-between"><h3 className="m-0 text-xs font-bold text-muted uppercase tracking-wide">Xodimlar</h3><span className={`tnum text-xs font-bold ${tone(o.employeeStats.pct)}`}>{pct(o.employeeStats.pct)} ✓</span></div>
              <div className="flex flex-col divide-y divide-line-soft">
                {o.employees.filter((e) => e.stats.checks > 0).map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="tnum w-5 text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
                    <span className="tnum text-xs text-muted">{e.stats.checks} ta</span>
                    <span className={`tnum w-12 text-right font-bold ${tone(e.stats.pct)}`}>{pct(e.stats.pct)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {o.rows.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 text-sm font-bold text-muted">Tarix</h2>
            {o.rows.slice(0, 30).map((r) => (
              <div key={r.id} className={`${card} flex flex-col gap-2`}>
                <div className="flex items-center gap-2 text-sm">
                  {r.employeeId && <Icon name="person" size={16} className="shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1 truncate font-bold">{inspectionSubject(r)}</span>
                  <span className="tnum text-xs text-muted">{formatDate(`${r.workDate}T12:00:00Z`)} {formatTime(r.at, m.tz)}</span>
                  <span className="tnum font-bold">{r.okCount} ✓ <span className={r.failCount ? 'text-danger' : 'text-placeholder'}>{r.failCount} ✗</span></span>
                </div>
                <div className="text-xs text-muted">{r.inspectorName ?? '—'}{r.employeeId ? (r.departmentName ? ` · ${r.departmentName}` : '') : r.responsibleName ? ` → ${r.responsibleName}` : ''}</div>
                {r.items.filter((i) => !i.ok).length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
                    {r.items.filter((i) => !i.ok).map((i) => (
                      <li key={i.criterion} className="flex items-start gap-2"><Icon name="close" size={16} className="mt-0.5 shrink-0 text-danger" /><span><b>{labels.get(i.criterion) ?? i.criterion}</b>{i.note ? ` — ${i.note}` : ''}{i.mediaId && <> · <Link href={`/api/media/${i.mediaId}`} target="_blank" className="font-semibold text-primary">rasm</Link></>}</span></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </TgPage>
  );
}
