import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { arrivalText, hhmm, periodLabel, ppDelta, REPORT_PRESET_LABELS, shortDuration, type ReportPreset } from '@adone/core';
import type { TgMember } from '@/lib/tg/session';
import { managerDecisions, managerReport, managerShell } from '@/server/manager';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { TgPage } from './tg-shell';

const PRESETS: ReportPreset[] = ['hafta', 'otgan-hafta', 'oy', 'otgan-oy'];
const card = 'flex flex-col gap-3 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]';

/** Rahbar Mini App'i — «Hisobot» (egasi, admin): davr tanlovi, davomat va vazifalar yig'masi, reyting. Hisob — panel /hisobotlar bilan bir xil. */
export async function ManagerReport({ m, preset }: { m: TgMember; preset?: string }) {
  const [r, d] = await Promise.all([managerReport(m, preset), managerDecisions(m)]);
  if (!r) redirect('/tg');
  const shell = managerShell(m, d.total);
  const { period, report, today } = r;
  const a = report.attendance.total;
  const ap = report.attendance.prev;
  const tk = report.tasks.total;
  const tp = report.tasks.prev;
  const avgArrival = report.attendance.histogram.avg;
  const top = report.rating.rows.slice(0, 5);
  return (
    <TgPage manager={shell}>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Hisobot</h1>
          <div className="text-[13px] text-muted">{periodLabel(period.from, period.to, today)} · {report.emps.length} xodim</div>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-full bg-subtle p-1 text-[12px] font-semibold">
          {PRESETS.map((p) => (
            <Link key={p} href={p === 'oy' ? '/tg/hisobot' : `/tg/hisobot?davr=${p}`} className={`rounded-full py-2 text-center ${period.preset === p ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>{REPORT_PRESET_LABELS[p]}</Link>
          ))}
        </div>

        {!report.hasData ? (
          <div className={`${card} items-center py-8 text-center`}>
            <span className="flex size-12 items-center justify-center rounded-full bg-subtle text-muted"><Icon name="bar_chart" size={26} /></span>
            <p className="m-0 text-sm font-semibold">Bu davrda ma&apos;lumot yo&apos;q</p>
            <p className="m-0 text-[13px] text-muted">Xodimlar keldi-ketdi qilgach va vazifalar berilgach hisobot shu yerda chiqadi.</p>
          </div>
        ) : (
          <>
            <section className={card}>
              <Head icon="how_to_reg" title="Davomat" />
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Kelgan" value={a.pct != null ? `${a.pct}%` : '—'} delta={ppDelta(a.pct, ap.pct)} unit=" p.p." tone="text-success" sub={`${a.came} / ${a.came + a.absent} kun`} />
                <Tile label="Kechikish" value={a.late} delta={ap.planned ? a.late - ap.late : null} goodWhenUp={false} tone="text-warning" sub={a.lateMinutes ? `jami ${shortDuration(a.lateMinutes)}` : 'holat'} />
                <Tile label="Sababsiz kelmagan" value={a.absent} delta={ap.planned ? a.absent - ap.absent : null} goodWhenUp={false} tone="text-danger" sub={`${report.attendance.absentEmployees} xodim`} />
                <Tile label="Ruxsatda" value={a.leave} tone="text-primary" sub="kun" />
              </div>
              <p className="m-0 text-[13px] text-muted">
                Ishlagan vaqt <b className="tnum text-ink">{hhmm(a.workedMinutes)}</b>
                {a.overtimeMinutes ? <> · qo&apos;shimcha <b className="tnum text-ink">{shortDuration(a.overtimeMinutes)}</b></> : null}
                {avgArrival != null ? <> · o&apos;rtacha kelish — {arrivalText(avgArrival)}</> : null}
              </p>
              {report.attendance.departments.length > 1 && (
                <div className="flex flex-col gap-2">
                  {report.attendance.departments.map((dep) => (
                    <div key={dep.name} className="flex items-center gap-2 text-[13px]">
                      <span className="w-28 truncate text-muted">{dep.name}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-primary" style={{ width: `${dep.pct}%` }} /></span>
                      <b className="tnum w-10 text-right">{dep.pct}%</b>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={card}>
              <Head icon="task_alt" title="Vazifalar" />
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Berilgan" value={tk.given} delta={tp.given ? tk.given - tp.given : null} tone="text-primary" />
                <Tile label="Bajarilgan" value={tk.done} tone="text-success" sub={tk.donePct != null ? `${tk.donePct}%` : undefined} />
                <Tile label="O'z vaqtida" value={tk.onTimePct != null ? `${tk.onTimePct}%` : '—'} delta={ppDelta(tk.onTimePct, tp.onTimePct)} unit=" p.p." tone="text-success" sub={tk.submitted ? `${tk.onTime} / ${tk.submitted}` : undefined} />
                <Tile label="O'rtacha baho" value={tk.avgRating != null ? `${tk.avgRating}★` : '—'} tone="text-warning" sub={tk.ratingCount ? `${tk.ratingCount} baho` : undefined} />
              </div>
              <p className="m-0 text-[13px] text-muted">
                Qaytarilgan <b className="tnum text-ink">{tk.returned}</b> · kech <b className="tnum text-ink">{tk.late}</b>
                {tk.selfDone + tk.selfPlan > 0 ? <> · o&apos;zi qo&apos;shgan ishlar <b className="tnum text-ink">{tk.selfDone + tk.selfPlan}</b>{tk.selfMinutes ? ` (${shortDuration(tk.selfMinutes)})` : ''}</> : null}
              </p>
            </section>

            {top.length > 0 && (
              <section className={card}>
                <Head icon="military_tech" title="Reyting" />
                <div className="flex flex-col divide-y divide-line-soft">
                  {top.map((row) => (
                    <div key={row.emp.id} className="flex items-center gap-2.5 py-2">
                      <span className={`tnum flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${row.place === 1 ? 'bg-warning-tint text-warning' : 'bg-subtle text-muted'}`}>{row.place}</span>
                      <Avatar name={row.emp.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{row.emp.name}</div>
                        <div className="truncate text-xs text-muted">{[row.attendance != null ? `davomat ${row.attendance}%` : null, row.onTime != null ? `o'z vaqtida ${row.onTime}%` : null, row.rating != null ? `${row.rating}★` : null].filter(Boolean).join(' · ') || row.emp.departmentName || '—'}</div>
                      </div>
                      <div className="flex flex-col items-end">
                        <b className="tnum text-base">{Math.round(row.score)}</b>
                        {row.change != null && row.change !== 0 && <span className={`tnum text-[11px] font-bold ${row.change > 0 ? 'text-success' : 'text-danger'}`}>{row.change > 0 ? '↑' : '↓'}{Math.abs(row.change)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {report.rating.attention.length > 0 && (
                  <div className="flex flex-col gap-1.5 rounded-2xl bg-warning-tint p-3">
                    <span className="flex items-center gap-1.5 text-[13px] font-bold text-warning-text"><Icon name="priority_high" size={16} />E&apos;tibor talab qiladi</span>
                    {report.rating.attention.map((row) => <div key={row.emp.id} className="text-[13px] text-warning-text"><b>{row.emp.name}</b> — {row.reason}</div>)}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <a href={`${shell.panelUrl}/hisobotlar?davr=${period.preset}`} target="_blank" rel="noreferrer" className="btn-secondary h-12 w-full text-sm"><Icon name="open_in_new" size={18} className="text-primary" />To&apos;liq hisobot va Excel — panelda</a>
      </div>
    </TgPage>
  );
}

function Head({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="card-icon"><Icon name={icon} size={18} fill /></span>
      <h2 className="m-0 flex-1 text-base font-bold">{title}</h2>
    </div>
  );
}

/** Kichik ko'rsatkich: nom, katta raqam, oldingi davrga farq (↗/↘), izoh. */
function Tile({ label, value, delta, unit = '', goodWhenUp = true, tone, sub }: { label: string; value: ReactNode; delta?: number | null; unit?: string; goodWhenUp?: boolean; tone: string; sub?: string }) {
  const good = delta != null && delta !== 0 ? delta > 0 === goodWhenUp : null;
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-page px-3.5 py-3">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className={`tnum text-2xl font-extrabold tracking-[-0.02em] ${tone}`}>{value}</span>
        {delta != null && delta !== 0 && <span className={`delta ${good ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning'}`}>{delta > 0 ? '↗' : '↘'} {Math.abs(delta).toString().replace('.', ',')}{unit}</span>}
      </div>
      {sub && <span className="tnum text-[11px] text-muted">{sub}</span>}
    </div>
  );
}
