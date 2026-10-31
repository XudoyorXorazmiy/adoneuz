import type { Metadata } from 'next';
import Link from 'next/link';
import { addDays, formatDate, formatTime, isUuid, MONTHS, monthDays } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { today as todayOf } from '@/server/attendance';
import { inspectionOverview } from '@/server/inspections';
import { getSettings } from '@/server/settings';
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page-header';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';

export const metadata: Metadata = { title: 'Nazorat' };

/**
 * «Nazorat» (egasi, admin): bo'limlar tekshiruvi hisoboti — oy bo'yicha: KPI, kun × bo'lim jadvali, javobgarlar ✓/✗ ulushi,
 * bo'limlar reytingi, oxirgi tekshiruvlar. Tekshiruvning o'zi — rahbar Mini App'ida («Nazorat» tabi).
 */
export default async function InspectionsPage({ searchParams }: PageProps<'/nazorat'>) {
  const user = await requireArea('inspections');
  const sp = await searchParams;
  const t = todayOf(user);
  const month = typeof sp.oy === 'string' && /^\d{4}-\d{2}$/.test(sp.oy) ? sp.oy : t.slice(0, 7);
  const days = monthDays(month);
  const departmentId = isUuid(sp.bolim) ? sp.bolim : undefined;
  const [o, settings] = await Promise.all([inspectionOverview(user, { from: days[0]!, to: days.at(-1)!, departmentId }), getSettings(user.tenantId)]);
  const labels = new Map(settings.inspection.criteria.map((c) => [c.id, c.label]));
  const tz = user.tenantTimezone;
  const prev = addDays(`${month}-01`, -1).slice(0, 7);
  const next = addDays(days.at(-1)!, 1).slice(0, 7);
  const href = (q: { oy?: string; bolim?: string }) => { const p = new URLSearchParams(); const oy = q.oy ?? month; if (oy !== t.slice(0, 7)) p.set('oy', oy); const b = 'bolim' in q ? q.bolim : departmentId; if (b) p.set('bolim', b); const s = p.toString(); return `/nazorat${s ? `?${s}` : ''}`; };
  const pct = (n: number | null) => (n == null ? '—' : `${n}%`);
  const tone = (n: number | null) => (n == null ? 'text-muted' : n >= 90 ? 'text-success' : n >= 70 ? 'text-warning' : 'text-danger');
  const card = 'rounded-[20px] bg-card p-5 shadow-[var(--shadow-card)]';
  const monthLabel = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const shownDays = o.days;

  return (
    <>
      <PageHeader title="Nazorat" subtitle="Bo'limlar tekshiruvi — mezonlar bo'yicha ✓ / ✗, javobgarlar"
        actions={
          <div className="flex items-center gap-2">
            <Link href={href({ oy: prev })} className="btn-icon" title="Oldingi oy"><Icon name="chevron_left" /></Link>
            <span className="min-w-36 text-center text-sm font-bold">{monthLabel}</span>
            <Link href={href({ oy: next })} className={`btn-icon ${next > t.slice(0, 7) ? 'pointer-events-none opacity-40' : ''}`} title="Keyingi oy"><Icon name="chevron_right" /></Link>
          </div>
        } />
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ bolim: undefined })} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${!departmentId ? 'bg-ink text-white' : 'bg-card text-muted hover:text-ink'}`}>Barcha bo&apos;limlar</Link>
        {o.departments.map((d) => departmentId && d.id !== departmentId ? null : (
          <Link key={d.id} href={href({ bolim: d.id === departmentId ? undefined : d.id })} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${d.id === departmentId ? 'bg-ink text-white' : 'bg-card text-muted hover:text-ink'}`}>{d.name}</Link>
        ))}
        <span className="ml-auto text-xs text-muted">Tekshirish — rahbar Mini App&apos;ida, «Nazorat» tabi</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="checklist" tone="primary" label="Tekshiruvlar" value={o.stats.checks} caption={`${monthLabel} · ${o.stats.items} ta belgi`} />
        <StatCard icon="check_circle" tone="success" label="Joyida" value={pct(o.stats.pct)} caption={`${o.stats.ok} ta ✓`} />
        <StatCard icon="report" tone="danger" label="Kamchilik" value={o.stats.fail} caption="✗ belgilar" />
        <StatCard icon="pending_actions" tone="warning" label="Ochiq vazifalar" value={o.openTasks} caption="✗ bo'yicha hali bajarilmagan" href="/vazifalar?kor=berilgan" />
      </div>

      {o.stats.checks === 0 ? (
        <EmptyState text={`${monthLabel} uchun tekshiruv yo'q`} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <section className={card}>
              <h2 className="m-0 mb-3 text-base font-bold">Kunlar × bo&apos;limlar</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-[13px]">
                  <thead><tr className="text-left text-xs text-muted">
                    <th className="pb-2 pr-3 font-semibold">Kun</th>
                    {o.departments.map((d) => <th key={d.id} className="pb-2 pr-3 font-semibold whitespace-nowrap">{d.name}</th>)}
                    <th className="pb-2 text-right font-semibold">Jami</th>
                  </tr></thead>
                  <tbody>
                    {shownDays.map((day) => (
                      <tr key={day.date} className="border-t border-line-soft">
                        <td className="tnum py-2 pr-3 font-semibold whitespace-nowrap">{formatDate(`${day.date}T12:00:00Z`).slice(0, 5)}</td>
                        {o.departments.map((d) => { const s = day.byDepartment.get(d.id); return <td key={d.id} className="tnum py-2 pr-3 whitespace-nowrap">{s ? <span><span className="text-success">{s.ok}✓</span> <span className={s.fail ? 'font-bold text-danger' : 'text-placeholder'}>{s.fail}✗</span></span> : <span className="text-placeholder">—</span>}</td>; })}
                        <td className={`tnum py-2 text-right font-bold ${tone(day.stats.pct)}`}>{pct(day.stats.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={card}>
              <h2 className="m-0 mb-3 text-base font-bold">Oxirgi tekshiruvlar</h2>
              <div className="flex flex-col divide-y divide-line-soft">
                {o.rows.slice(0, 40).map((r) => (
                  <div key={r.id} className="flex flex-col gap-1.5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold">{r.departmentName}</span>
                      <span className="tnum text-xs text-muted">{formatDate(`${r.workDate}T12:00:00Z`)} {formatTime(r.at, tz)}</span>
                      <span className="text-xs text-muted">{r.inspectorName ?? '—'}{r.responsibleName ? ` → ${r.responsibleName}` : ''}</span>
                      <span className="tnum ml-auto font-bold">{r.okCount} ✓ <span className={r.failCount ? 'text-danger' : 'text-placeholder'}>{r.failCount} ✗</span></span>
                    </div>
                    {r.items.some((i) => !i.ok) && (
                      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {r.items.filter((i) => !i.ok).map((i) => (
                          <li key={i.criterion} className="flex items-center gap-1 rounded-full bg-danger-tint px-2.5 py-1 text-xs font-semibold text-danger-text">
                            <Icon name="close" size={14} />{labels.get(i.criterion) ?? i.criterion}{i.note ? ` — ${i.note}` : ''}
                            {i.mediaId && <a href={`/api/media/${i.mediaId}?w=320`} target="_blank" rel="noreferrer" className="ml-1 underline">rasm</a>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className={card}>
              <h2 className="m-0 mb-3 text-base font-bold">Bo&apos;limlar reytingi</h2>
              <div className="flex flex-col divide-y divide-line-soft">
                {o.departments.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="tnum w-5 text-muted">{d.stats.checks ? i + 1 : '·'}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{d.name}</div><div className="truncate text-xs text-muted">{d.responsible ? `Javobgar: ${d.responsible}` : 'Javobgar yo‘q'} · {d.stats.checks} ta tekshiruv</div></div>
                    <span className={`tnum font-bold ${tone(d.stats.pct)}`}>{pct(d.stats.pct)}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className={card}>
              <h2 className="m-0 mb-3 text-base font-bold">Javobgarlar</h2>
              <div className="flex flex-col divide-y divide-line-soft">
                {o.responsible.map((r) => (
                  <Link key={r.id} href={`/xodimlar/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                    <Avatar name={r.name} size={32} />
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{r.name}</div><div className="tnum text-xs text-muted">{r.stats.ok} ✓ · {r.stats.fail} ✗ · {r.stats.checks} tekshiruv</div></div>
                    <span className={`tnum font-bold ${tone(r.stats.pct)}`}>{pct(r.stats.pct)}</span>
                  </Link>
                ))}
                {o.responsible.length === 0 && <p className="m-0 py-2 text-sm text-muted">Javobgar biriktirilgan bo&apos;lim tekshirilmagan.</p>}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
