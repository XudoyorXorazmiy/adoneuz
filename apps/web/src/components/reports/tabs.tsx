/** Hisobotlar tablari (server): design/panel/Hisobotlar.dc.html 1:1. Ma'lumot — server/reports.ts (buildReport, loadJournal). */
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  arrivalText, formatDate, formatNumber, formatTime, hhmm, journalHeading, ppDelta, RATING_WEIGHTS, shortDuration, TASK_STATUS_LABELS,
  type TaskStatus,
} from '@adone/core';
import type { Report, loadJournal } from '@/server/reports';
import { deltaPct } from '@/server/dashboard';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Delta } from '@/components/dashboard/delta';
import { DaysChart } from './charts';
import { AttendanceTable, TasksTable, type AttRow, type TaskRowData } from './tables';

type Journal = Awaited<ReturnType<typeof loadJournal>>;

const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <section className={`card ${className}`}>{children}</section>;

function Head({ icon, title, tone = 'primary', children }: { icon: string; title: string; tone?: 'primary' | 'warning'; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`card-icon ${tone === 'warning' ? 'bg-warning-tint text-warning' : ''}`}><Icon name={icon} size={18} fill /></span>
      <h2 className="m-0 flex-1 text-base font-bold">{title}</h2>
      {children}
    </div>
  );
}

/** Farq belgisi (mutlaq): ↗ 12 / ↘ 3. `good` — o'sish yaxshimi. */
function Diff({ value, good = true, digits = 0, unit = '' }: { value: number | null; good?: boolean; digits?: number; unit?: string }) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value === 0) return <span className="delta bg-subtle text-muted">0{unit}</span>;
  const ok = value > 0 === good;
  return <span className={`delta ${ok ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning'}`}>{value > 0 ? '↗' : '↘'} {Math.abs(value).toFixed(digits).replace('.', ',')}{unit}</span>;
}

/** KPI kartochkasi (dizayn: ikonka, nom, ↗; katta raqam + farq; izoh). Telefonda — 2×2, ixcham. */
function Kpi({ icon, tone, label, value, delta, caption, href }: {
  icon: string; tone: 'success' | 'warning' | 'danger' | 'primary'; label: string; value: ReactNode; delta?: ReactNode; caption?: ReactNode; href?: string;
}) {
  const t = { success: 'bg-success-tint text-success', warning: 'bg-warning-tint text-warning', danger: 'bg-danger-tint text-danger', primary: 'bg-primary-tint text-primary' }[tone];
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-[10px] max-sm:hidden ${t}`}><Icon name={icon} size={18} fill /></span>
        <span className="flex-1 text-sm font-semibold text-ink-2 max-sm:text-xs max-sm:text-muted">{label}</span>
        {href && <Icon name="arrow_outward" size={18} className="text-placeholder transition group-hover:text-primary max-sm:hidden" />}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 max-sm:flex-col max-sm:items-start">
        <span className="tnum text-[30px] leading-9 font-extrabold tracking-[-0.03em] max-sm:text-[22px] max-sm:leading-7">{value}</span>{delta}
      </div>
      {caption && <span className="text-xs text-muted max-sm:hidden">{caption}</span>}
    </>
  );
  const cls = 'card group flex flex-col gap-2 px-5 py-[18px] max-sm:gap-1 max-sm:rounded-[18px] max-sm:px-3.5 max-sm:py-3';
  return href ? <Link href={href} className={`${cls} transition hover:shadow-[var(--shadow-frame)]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

function ProgressRow({ label, value, text, tone, h = 'h-2.5' }: { label: string; value: number; text: string; tone: string; h?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-3 text-[13px]"><span className="truncate font-semibold">{label}</span><b className="tnum font-bold">{text}</b></div>
      <div className={`${h} rounded-full bg-line-soft`}><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

// ---------- Bo'sh holat va skeleton ----------

export function NoData({ label, prevHref, prevLabel }: { label: string; prevHref: string; prevLabel: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-tint text-primary"><Icon name="event_busy" size={30} /></span>
      <div className="text-[17px] font-bold">{label} uchun ma&apos;lumot yo&apos;q</div>
      <p className="m-0 max-w-[360px] text-sm leading-normal text-muted">Davomat bot orqali yig&apos;iladi. Xodimlar «Keldim» bosgach, hisobot shu yerda paydo bo&apos;ladi.</p>
      <div className="mt-1 flex flex-wrap justify-center gap-2.5">
        <Link href="/xodimlar" className="btn-primary">Xodimlarni taklif qilish</Link>
        <Link href={prevHref} className="btn-secondary">{prevLabel}</Link>
      </div>
    </Card>
  );
}

export function ReportSkeleton() {
  const bar = 'rounded-full bg-[#EEF0F3]';
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy aria-label="Yuklanmoqda">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card flex flex-col gap-3 p-[18px]"><span className={`h-2.5 w-3/5 ${bar}`} /><span className="h-6 w-[45%] rounded-lg bg-[#EEF0F3]" /><span className="h-2 w-[70%] rounded-full bg-subtle" /></div>
        ))}
      </div>
      <div className="card flex flex-col gap-3.5 p-[18px]">
        {['38%', '52%', '30%', '46%', '40%'].map((w) => (
          <div key={w} className="flex items-center gap-3">
            <span className="size-8 rounded-full bg-[#EEF0F3]" /><span className={`h-2.5 ${bar}`} style={{ width: w }} /><span className="flex-1" />
            <span className="h-2.5 w-[60px] rounded-full bg-subtle max-sm:hidden" /><span className="h-1.5 w-[90px] rounded-full bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Davomat ----------

export function AttendanceTab({ r, compare, tabelHref, prevLabel }: { r: Report; compare: boolean; tabelHref: string; prevLabel: string }) {
  const a = r.attendance;
  const t = a.total;
  const p = a.prev;
  // O'tgan davrda davomat yozuvi bo'lmasa (masalan, tizim endi ishga tushgan) — farq ko'rsatilmaydi
  const cmp = compare && p.came + p.absent > 0;
  const hours = Math.round(t.workedMinutes / 60);
  const deps = a.departments;
  const lowest = deps.length > 1 ? Math.min(...deps.map((d) => d.pct)) : null;
  const h = a.histogram;
  const hMax = Math.max(1, ...h.bins.map((b) => b.n));
  const rows: AttRow[] = a.rows.map(({ emp, stats: s }) => ({
    id: emp.id, name: emp.name, position: emp.position, dept: emp.departmentName, planned: s.planned, came: s.came, late: s.late, lateMinutes: s.lateMinutes,
    early: s.early, earlyMinutes: s.earlyMinutes, absent: s.absent, leave: s.leave, worked: s.workedMinutes, overtime: s.overtimeMinutes, pct: s.pct,
  }));
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <Kpi icon="how_to_reg" tone="success" label="Davomat" value={t.pct == null ? '—' : `${t.pct}%`} href={tabelHref}
          delta={cmp && <Diff value={ppDelta(t.rate, p.rate)} digits={1} unit="%" />} caption={cmp && p.rate != null ? `${prevLabel}: ${(Math.round(p.rate * 10) / 10).toString().replace('.', ',')}%` : `${t.came} kun kelgan`} />
        <Kpi icon="schedule" tone="warning" label="Kechikishlar" value={t.late} href={tabelHref}
          delta={cmp && <Delta value={deltaPct(t.late, p.late)} goodWhenUp={false} />} caption={t.lateMinutes ? `jami ${shortDuration(t.lateMinutes)}` : 'Kechikish yo‘q'} />
        <Kpi icon="person_off" tone="danger" label="Sababsiz kelmagan" value={`${t.absent} kun`} href={tabelHref}
          delta={cmp && <Diff value={t.absent - p.absent} good={false} />} caption={`${a.absentEmployees} xodim`} />
        <Kpi icon="timer" tone="primary" label="Ishlangan soat" value={formatNumber(hours)} href={tabelHref}
          delta={cmp && <Delta value={deltaPct(t.workedMinutes, p.workedMinutes)} />} caption={t.came ? `o'rtacha ${hhmm(t.workedMinutes / t.came)} / kun` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DaysChart series={a.series} headcount={r.emps.length} avgCame={r.avgCame} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-1 max-sm:hidden">
          <Card className="flex flex-col gap-3.5 p-5">
            <Head icon="workspaces" title="Bo'limlar" />
            {deps.length === 0 && <p className="m-0 text-[13px] text-muted">Bo&apos;limlar bo&apos;yicha ma&apos;lumot yo&apos;q.</p>}
            {deps.map((d) => {
              const low = d.pct === lowest || d.pct < 90;
              return <ProgressRow key={d.name} label={d.name} value={d.pct} text={`${d.pct}%`} tone={low ? 'bg-warning' : 'bg-primary'} />;
            })}
          </Card>
          <Card className="flex flex-col gap-3 p-5">
            <Head icon="schedule" title="Kelish vaqti" />
            <div className="flex h-[110px] items-end gap-[5px]">
              {h.bins.map((b) => (
                <div key={b.label} title={`${b.n} marta`} className={`min-h-[3px] flex-1 rounded-full ${b.onTime ? 'bg-success' : 'bg-warning'}`} style={{ height: `${(b.n / hMax) * 100}%` }} />
              ))}
            </div>
            <div className="flex gap-[5px]">{h.bins.map((b) => <span key={b.label} className="tnum flex-1 text-center text-[9px] text-placeholder">{b.label > 0 ? `+${b.label}` : b.label < 0 ? `−${-b.label}` : '0'}</span>)}</div>
            <div className="border-t border-line-soft pt-2.5 text-xs text-ink-2">
              {h.avg == null ? 'Smenali kelishlar yo‘q' : <>O&apos;rtacha: <b className="font-bold">{arrivalText(h.avg)}</b> · daqiqa, smena boshiga nisbatan</>}
            </div>
          </Card>
        </div>
      </div>

      <AttendanceTable rows={rows} />
    </>
  );
}

// ---------- Vazifalar ----------

export function TasksTab({ r, compare, tz }: { r: Report; compare: boolean; tz: string }) {
  const t = r.tasks.total;
  const p = r.tasks.prev;
  const b = r.tasks.buckets;
  const bMax = Math.max(1, ...b.map((x) => Math.max(x.given, x.onTime, x.late)));
  const rated = b.filter((x) => x.avgRating != null).map((x) => x.avgRating!);
  const lo = rated.length ? Math.max(0, Math.min(...rated) - 0.3) : 0;
  const hi = rated.length ? Math.min(5, Math.max(...rated) + 0.3) : 5;
  const ry = (v: number) => 10 + (1 - (v - lo) / Math.max(0.1, hi - lo)) * 18; // %, yuqoridan — ustunlardan yuqorida
  const pts = b.map((x, i) => (x.avgRating == null ? null : { x: ((i + 0.5) / b.length) * 100, y: ry(x.avgRating), v: x.avgRating })).filter((x) => x != null);
  const selfAll = t.selfDone + t.selfPlan;
  const all = t.given + selfAll;
  const seg = (n: number) => (all ? (n / all) * 100 : 0);
  const rows: TaskRowData[] = r.tasks.rows.filter((x) => x.stats.given + x.stats.selfDone + x.stats.selfPlan > 0).map(({ emp, stats: s, last }) => ({
    id: emp.id, name: emp.name, dept: emp.departmentName, given: s.given, done: s.done, onTimePct: s.onTimePct, late: s.late, returned: s.returned,
    avgRating: s.avgRating, selfCount: s.selfDone + s.selfPlan, selfMinutes: s.selfMinutes, last,
  }));
  const pill = (good: boolean | null, children: ReactNode) => <span className={`delta self-start ${good == null ? 'bg-primary-tint text-primary' : good ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning'}`}>{children}</span>;
  const cmp = compare && p.given + p.selfDone + p.selfPlan > 0;
  const diff = (cur: number | null, prev: number | null, goodUp = true, digits = 0, unit = '') => {
    if (!cmp || cur == null || prev == null) return null;
    const d = Math.round((cur - prev) * 10 ** digits) / 10 ** digits;
    if (d === 0) return <span className="delta self-start bg-subtle text-muted">0{unit}</span>;
    return pill(d > 0 === goodUp, `${d > 0 ? '↗' : '↘'} ${Math.abs(d).toFixed(digits).replace('.', ',')}${unit}`);
  };
  const kpi = (label: string, value: ReactNode, sub: ReactNode, delta: ReactNode, href?: string) => {
    const body = (
      <>
        <span className="text-[13px] font-semibold text-ink-2 max-sm:text-xs max-sm:text-muted">{label}</span>
        <div className="flex items-baseline gap-2"><span className="tnum text-[30px] leading-9 font-extrabold tracking-[-0.03em] max-sm:text-[22px] max-sm:leading-7">{value}</span>{sub}</div>
        {delta}
      </>
    );
    const cls = 'card flex flex-col gap-2 px-5 py-[18px] max-sm:gap-1 max-sm:rounded-[18px] max-sm:px-3.5 max-sm:py-3';
    return href ? <Link href={href} className={`${cls} transition hover:shadow-[var(--shadow-frame)]`}>{body}</Link> : <div className={cls}>{body}</div>;
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-5">
        {kpi('Berilgan', t.given, null, diff(t.given, p.given, true), '/vazifalar?kor=berilgan')}
        {kpi('Bajarildi', t.done, t.donePct != null && <span className="text-sm font-bold text-muted">· {t.donePct}%</span>, diff(t.donePct, p.donePct, true, 0, '%'), '/vazifalar?kor=berilgan&holat=done')}
        {kpi("O'z vaqtida", t.onTimePct == null ? '—' : `${t.onTimePct}%`, null, diff(t.onTimePct, p.onTimePct, true, 0, '%'))}
        {kpi("O'rtacha baho", t.avgRating == null ? '—' : t.avgRating.toFixed(1), t.avgRating != null && <Icon name="star" size={18} fill className="text-[#F5B300]" />, diff(t.avgRating, p.avgRating, true, 1))}
        {kpi('Qaytarilgan', t.returned, null, diff(t.returned, p.returned, false))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_300px_300px]">
        <Card className="px-6 py-5 max-sm:px-4 lg:col-span-2 xl:col-span-1">
          <Head icon="bar_chart" title={r.tasks.bucketKind === 'day' ? "Kunlar bo'yicha" : "Haftalar bo'yicha"} />
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-ink-2">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#DDE1E8]" />Berilgan</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />O&apos;z vaqtida</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" />Kechikib</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-navy" />O&apos;rtacha baho</span>
          </div>
          <div className="relative mt-[18px] h-[220px] bg-[linear-gradient(#F1F2F5_1px,transparent_1px)] bg-[length:100%_25%]">
            <div className="absolute inset-0 grid items-end" style={{ gridTemplateColumns: `repeat(${b.length}, minmax(0, 1fr))` }}>
              {b.map((x) => (
                <div key={x.label + x.range} className="flex h-full items-end justify-center gap-1.5 max-sm:gap-0.5">
                  {([[x.given, 'bg-[#DDE1E8]', 'text-ink-2'], [x.onTime, 'bg-primary', 'text-primary'], [x.late, 'bg-warning', 'text-warning']] as const).map(([v, bg, tc], i) => (
                    <div key={i} className={`flex w-full max-w-[22px] justify-center rounded-full ${bg}`} style={{ height: `${Math.max(v ? 4 : 2, (v / bMax) * 66)}%` }}>
                      <span className={`tnum -mt-4 text-[10px] font-bold ${tc}`}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {pts.length > 1 && (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
                <polyline points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#0B1B4F" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
            )}
            {pts.map((q) => (
              <div key={q.x} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5" style={{ left: `${q.x}%`, top: `${q.y}%` }}>
                <span className="-mt-[22px] rounded-md bg-card px-[5px] py-px text-[10px] font-extrabold text-navy">{q.v.toFixed(1)} ★</span>
                <span className="size-2.5 rounded-full border-[2.5px] border-navy bg-card" />
              </div>
            ))}
          </div>
          <div className="mt-2.5 grid" style={{ gridTemplateColumns: `repeat(${b.length}, minmax(0, 1fr))` }}>
            {b.map((x) => (
              <div key={x.label + x.range} className="text-center">
                <div className="text-xs font-bold max-sm:text-[10px]">{x.label}</div>
                {r.tasks.bucketKind === 'week' && <div className="text-[11px] text-placeholder max-sm:hidden">{x.range}</div>}
              </div>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col gap-4 p-5">
          <Head icon="donut_large" title="Manba" />
          <div className="flex size-[170px] items-center justify-center self-center rounded-full"
            style={{ background: all ? `conic-gradient(#2443F5 0 ${seg(t.given)}%, #A5B4FC ${seg(t.given)}% ${seg(t.given + t.selfDone)}%, #0B1B4F ${seg(t.given + t.selfDone)}% 100%)` : '#F1F2F5' }}>
            <div className="flex size-28 flex-col items-center justify-center rounded-full bg-card"><span className="tnum text-[26px] font-extrabold tracking-[-0.03em]">{all}</span><span className="text-[11px] text-muted">jami ish</span></div>
          </div>
          <div className="flex flex-col gap-2 text-[13px]">
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" /><span className="flex-1">Berilgan</span><b className="tnum font-bold">{t.given}</b></div>
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#A5B4FC]" /><span className="flex-1">O&apos;zi qo&apos;shgan · bajarilgan</span><b className="tnum font-bold">{t.selfDone}</b></div>
            <div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-navy" /><span className="flex-1">O&apos;zi qo&apos;shgan · rejalashtirilgan</span><b className="tnum font-bold">{t.selfPlan}</b></div>
          </div>
        </Card>
        <Card className="flex flex-col gap-3.5 p-5">
          <Head icon="category" title="Ish turlari" />
          <span className="-mt-1.5 text-xs text-muted">O&apos;zi qo&apos;shgan ishlar · sarflangan vaqt</span>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-page px-4 py-6 text-center">
            <Icon name="category" size={26} className="text-placeholder" />
            <span className="text-[13px] leading-normal text-muted">Ish turlari hali qo&apos;shilmagan. Turlar kiritilgach, sarflangan vaqt shu yerda turlar bo&apos;yicha ko&apos;rinadi.</span>
          </div>
          <div className="border-t border-line-soft pt-2.5 text-xs text-ink-2">Jami <b className="font-bold">{shortDuration(t.selfMinutes)}</b> · {t.selfDone} ta bajarilgan ish</div>
        </Card>
      </div>

      {rows.length === 0
        ? <Card className="px-6 py-12 text-center text-muted">Bu davrda vazifa yoki o&apos;zi qo&apos;shgan ish yo&apos;q.</Card>
        : <TasksTable rows={rows} tz={tz} />}
    </>
  );
}

// ---------- Reyting ----------

const MEDAL = [
  { ring: '#F6E7B0', text: '#7A5A00', tint: '#FBF4DA' },
  { ring: '#E3E6EC', text: '#4B5563', tint: '#F2F4F7' },
  { ring: '#EBCFB4', text: '#7A4A1E', tint: '#F8EEE4' },
];

function Change({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs font-bold text-placeholder">yangi</span>;
  if (v === 0) return <span className="text-xs font-bold text-placeholder">—</span>;
  return <span className={`text-xs font-bold ${v > 0 ? 'text-success' : 'text-danger'}`}>{v > 0 ? '↑' : '↓'} {Math.abs(v)}</span>;
}

const pctText = (v: number | null) => (v == null ? '—' : `${v}%`);
const rateText = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)} ★`);

export function RatingTab({ r, mode, compare, toggle }: { r: Report; mode: 'xodimlar' | 'bolimlar'; compare: boolean; toggle: { xodimlar: string; bolimlar: string } }) {
  const rows = r.rating.rows;
  const podium = [rows[1], rows[0], rows[2]].filter((x) => x != null);
  const W = RATING_WEIGHTS;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted">
        <Icon name="info" size={18} />Ball =
        <span className="flex h-[26px] items-center rounded-full bg-success-tint px-2.5 font-bold text-success">davomat {W.attendance}%</span>+
        <span className="flex h-[26px] items-center rounded-full bg-primary-tint px-2.5 font-bold text-primary">vazifalar o&apos;z vaqtida {W.onTime}%</span>+
        <span className="flex h-[26px] items-center rounded-full bg-[#FEF3C7] px-2.5 font-bold text-[#92400E]">o&apos;rtacha baho {W.rating}%</span>
        <span className="flex-1" />
        <div className="flex gap-1 rounded-full border border-line bg-card p-1 text-[13px] font-semibold">
          <Link href={toggle.xodimlar} className={`rounded-full px-4 py-1.5 ${mode === 'xodimlar' ? 'bg-navy text-white' : 'text-ink-2'}`}>Xodimlar</Link>
          <Link href={toggle.bolimlar} className={`rounded-full px-4 py-1.5 ${mode === 'bolimlar' ? 'bg-navy text-white' : 'text-ink-2'}`}>Bo&apos;limlar</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {mode === 'bolimlar' ? (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="m-0 text-base font-bold">Bo&apos;limlar reytingi</h2>
              {r.rating.departments.length === 0 && <p className="m-0 text-[13px] text-muted">Reyting uchun ma&apos;lumot yo&apos;q.</p>}
              {r.rating.departments.map((d) => (
                <div key={d.name} className="flex items-center gap-2.5">
                  <span className="tnum w-[22px] text-[13px] font-extrabold text-muted">{d.place}</span>
                  <div className="flex-1"><ProgressRow label={d.name} value={d.score} text={String(d.score)} tone={d.score < 85 ? 'bg-warning' : 'bg-primary'} h="h-2" /></div>
                </div>
              ))}
            </Card>
          ) : rows.length === 0 ? (
            <Card className="px-6 py-12 text-center text-muted">Reyting uchun ma&apos;lumot yo&apos;q — davomat yoki vazifalar bo&apos;lishi kerak.</Card>
          ) : (
            <>
              <Card className="grid grid-cols-3 items-end gap-4 px-6 pt-6 max-sm:gap-2 max-sm:px-3">
                {podium.map((x) => {
                  const m = MEDAL[x.place - 1]!;
                  const first = x.place === 1;
                  const comp: Array<[string, number | null, string, string]> = [
                    ['Davomat', x.attendance, 'bg-success', pctText(x.attendance)], ["O'z vaqtida", x.onTime, 'bg-primary', pctText(x.onTime)],
                    ['Baho', x.rating == null ? null : (x.rating / 5) * 100, 'bg-[#F5B300]', x.rating == null ? '—' : x.rating.toFixed(1)],
                  ];
                  return (
                    <Link key={x.emp.id} href={`/xodimlar/${x.emp.id}`} className="flex min-w-0 flex-col items-center gap-2.5">
                      <div className="relative">
                        <span className="block rounded-full border-[3px]" style={{ borderColor: m.ring }}><Avatar name={x.emp.name} size={first ? 78 : 62} /></span>
                        <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full border-[3px] border-white text-[13px] font-extrabold" style={{ background: m.ring, color: m.text }}>{x.place}</span>
                      </div>
                      <div className="min-w-0 text-center"><div className="truncate text-[15px] font-bold max-sm:text-[13px]">{x.emp.name}</div><div className="truncate text-xs text-muted">{x.emp.departmentName ?? '—'}</div></div>
                      <div className="flex w-full flex-col items-center gap-2.5 rounded-t-[18px] px-4 py-3.5 max-sm:px-2" style={{ background: m.tint, height: first ? 190 : x.place === 2 ? 160 : 140 }}>
                        <span className="tnum text-[34px] leading-10 font-extrabold tracking-[-0.03em]">{x.score}</span>
                        <div className="flex w-full flex-col gap-[5px] max-sm:hidden">
                          {comp.map(([l, v, tone, txt]) => (
                            <div key={l} className="flex items-center gap-1.5 text-[10px] text-ink-2">
                              <span className="w-[58px] shrink-0">{l}</span>
                              <div className="h-[5px] flex-1 rounded-full bg-white/80"><div className={`h-full rounded-full ${tone}`} style={{ width: `${v ?? 0}%` }} /></div>
                              <b className="tnum w-7 text-right font-bold">{txt}</b>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </Card>
              {rows.length > 3 && (
                <Card className="overflow-x-auto px-6 py-3 max-sm:px-4">
                  <div className="min-w-0 sm:min-w-[640px]">
                    <div className="grid grid-cols-[40px_minmax(0,1.6fr)_70px_70px_1fr_1fr_1fr] gap-3 border-b border-line-soft pt-2 pb-2.5 text-xs font-medium text-placeholder max-sm:grid-cols-[28px_minmax(0,1fr)_44px_44px]">
                      <span>#</span><span>Xodim</span><span>Ball</span><span>O&apos;zgarish</span><span className="max-sm:hidden">Davomat</span><span className="max-sm:hidden">O&apos;z vaqtida</span><span className="max-sm:hidden">Baho</span>
                    </div>
                    {rows.slice(3).map((x) => (
                      <Link key={x.emp.id} href={`/xodimlar/${x.emp.id}`} className="grid grid-cols-[40px_minmax(0,1.6fr)_70px_70px_1fr_1fr_1fr] items-center gap-3 border-b border-[#F4F5F7] py-[11px] text-[13px] last:border-0 hover:bg-page max-sm:grid-cols-[28px_minmax(0,1fr)_44px_44px]">
                        <span className="tnum font-extrabold text-muted">{x.place}</span>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={x.emp.name} size={32} />
                          <span className="min-w-0"><span className="block truncate font-bold">{x.emp.name}</span><span className="block truncate text-xs text-muted">{x.emp.departmentName ?? '—'}</span></span>
                        </span>
                        <span className="tnum text-base font-extrabold">{x.score}</span>
                        {compare && r.rating.hasPrev ? <Change v={x.change} /> : <span className="text-placeholder">—</span>}
                        <span className="tnum font-semibold max-sm:hidden">{pctText(x.attendance)}</span>
                        <span className="tnum font-semibold max-sm:hidden">{pctText(x.onTime)}</span>
                        <span className="tnum font-semibold max-sm:hidden">{rateText(x.rating)}</span>
                      </Link>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
        <Card className="flex flex-col gap-3 p-5">
          <Head icon="priority_high" title="E'tibor talab qiladi" tone="warning" />
          {r.rating.attention.length === 0 && <p className="m-0 text-[13px] text-muted">Hammasi yaxshi — 90 balldan past xodim yo&apos;q.</p>}
          {r.rating.attention.map((x) => (
            <div key={x.emp.id} className="flex flex-col gap-2.5 rounded-[14px] border border-line p-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={x.emp.name} size={36} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{x.emp.name}</div><div className="truncate text-xs text-muted">{[x.emp.position, x.emp.departmentName].filter(Boolean).join(' · ') || '—'}</div></div>
                <span className="tnum text-lg font-extrabold text-warning">{x.score}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-6 items-center truncate rounded-full bg-warning-tint px-2.5 text-xs font-bold text-warning-text">{x.reason}</span>
                <Link href={`/xodimlar/${x.emp.id}`} className="flex shrink-0 items-center gap-0.5 text-xs font-bold whitespace-nowrap text-primary">Profilga o&apos;tish<Icon name="arrow_outward" size={15} /></Link>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

// ---------- Ish jurnali ----------

const JOURNAL_TONE: Record<TaskStatus, { badge: string; dot: string; halo: string }> = {
  approved: { badge: 'bg-success-tint text-success', dot: '#16A34A', halo: '#E8F7EE' },
  submitted: { badge: 'bg-warning-tint text-warning', dot: '#F07A1A', halo: '#FFF1E6' },
  revision: { badge: 'bg-danger-tint text-danger', dot: '#E5484D', halo: '#FDECEC' },
  new: { badge: 'bg-primary-tint text-primary', dot: '#2443F5', halo: '#EEF1FF' },
  accepted: { badge: 'bg-primary-tint text-primary', dot: '#2443F5', halo: '#EEF1FF' },
  in_progress: { badge: 'bg-primary-tint text-primary', dot: '#2443F5', halo: '#EEF1FF' },
  cancelled: { badge: 'bg-subtle text-muted', dot: '#9CA3AF', halo: '#F2F4F7' },
};

export function JournalTab({ j, today, tz, label, filtered, filters }: { j: Journal; today: string; tz: string; label: string; filtered: boolean; filters: ReactNode }) {
  const groups: Array<{ day: string; items: Journal['entries'] }> = [];
  for (const e of j.entries) {
    const g = groups.at(-1);
    if (g?.day === e.day) g.items.push(e);
    else groups.push({ day: e.day, items: [e] });
  }
  const topMax = Math.max(1, ...j.top.map((x) => x.minutes));
  return (
    <>
      {filters}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          {groups.length === 0 && (
            <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary"><Icon name="history_edu" size={28} /></span>
              <div className="text-base font-bold">Bu davrda yozuv yo&apos;q</div>
              <p className="m-0 max-w-[360px] text-sm text-muted">Xodimlar botda «➕ Ish qo&apos;shish» yoki vazifa hisobotini topshirganda ish jurnali to&apos;ladi.</p>
            </Card>
          )}
          {groups.map((g) => {
            const mins = g.items.reduce((a, e) => a + (e.spentMinutes ?? 0), 0);
            return (
              <Card key={g.day} className="px-6 pt-[18px] pb-1.5 max-sm:px-4">
                <div className="flex items-center gap-2.5 pb-1.5">
                  <span className="text-[15px] font-bold">{journalHeading(g.day, today)}</span>
                  <span className="tnum text-[13px] text-muted">{formatDate(`${g.day}T12:00:00Z`)}</span>
                  <span className="flex-1" />
                  <span className="text-xs text-muted">{g.items.length} ish{mins ? ` · ${shortDuration(mins)}` : ''}</span>
                </div>
                {g.items.map((e) => {
                  const tone = JOURNAL_TONE[e.status];
                  return (
                    <div key={e.id} className="grid grid-cols-[56px_20px_minmax(0,1fr)_auto] gap-3 border-t border-[#F4F5F7] py-3.5 max-sm:grid-cols-[44px_14px_minmax(0,1fr)] max-sm:gap-2">
                      <span className="tnum pt-1.5 text-sm font-bold">{formatTime(e.at, tz)}</span>
                      <div className="flex flex-col items-center pt-2.5">
                        <span className="size-2.5 rounded-full" style={{ background: tone.dot, boxShadow: `0 0 0 4px ${tone.halo}` }} />
                        <span className="mt-1.5 w-0.5 flex-1 bg-line-soft" />
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex items-center gap-2"><Avatar name={e.name} size={26} /><span className="truncate text-[13px] font-semibold text-ink-2">{e.name}</span></div>
                        <Link href={`/vazifalar/${e.id}`} className="text-[15px] font-bold hover:text-primary">{e.title}</Link>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`flex h-6 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${e.source === 'assigned' ? 'bg-primary-tint text-primary' : 'bg-subtle text-[#374151]'}`}>
                            {e.source === 'assigned' ? 'Berilgan' : e.source === 'self_plan' ? "O'zi rejalashtirdi" : "O'zi qo'shdi"}
                          </span>
                          {e.spentMinutes != null && e.spentMinutes > 0 && <span className="flex items-center gap-1 text-xs font-semibold text-ink-2"><Icon name="timer" size={15} />{shortDuration(e.spentMinutes)}</span>}
                          <span className={`flex h-6 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap sm:hidden ${tone.badge}`}>{TASK_STATUS_LABELS[e.status]}</span>
                        </div>
                        {e.photos.length > 0 && (
                          <div className="flex gap-1.5">
                            {e.photos.map((ph) => (
                              <a key={ph.id} href={`/api/media/${ph.id}`} target="_blank" rel="noreferrer" className="flex size-14 items-center justify-center overflow-hidden rounded-[10px] bg-[linear-gradient(150deg,#E3E7EE,#CDD3DD)] text-[#A9B2C2]">
                                {ph.video ? <Icon name="play_circle" size={22} /> : <img src={`/api/media/${ph.id}`} alt="" loading="lazy" className="size-full object-cover" />}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`mt-1 flex h-6 items-center self-start rounded-full px-2.5 text-xs font-bold whitespace-nowrap max-sm:hidden ${tone.badge}`}>{TASK_STATUS_LABELS[e.status]}</span>
                    </div>
                  );
                })}
              </Card>
            );
          })}
          {j.truncated && <p className="m-0 text-center text-xs text-muted">Oxirgi 300 ta yozuv ko&apos;rsatildi — davrni qisqartiring yoki xodimni tanlang.</p>}
        </div>
        <Card className="flex flex-col gap-4 p-5 xl:sticky xl:top-5">
          <span className="text-base font-bold">Jami · {label}</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] bg-page p-3.5"><div className="tnum text-[26px] font-extrabold tracking-[-0.03em]">{j.entries.length}</div><div className="text-xs text-muted">Ishlar</div></div>
            <div className="rounded-[14px] bg-page p-3.5"><div className="tnum text-[26px] font-extrabold tracking-[-0.03em]">{j.minutes >= 60 ? `${String(Math.round(j.minutes / 6) / 10).replace('.', ',')} soat` : `${j.minutes} daq`}</div><div className="text-xs text-muted">Sarflangan vaqt</div></div>
          </div>
          {j.top.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold tracking-[0.04em] text-placeholder">TOP XODIMLAR</span>
              {j.top.map((x, i) => <ProgressRow key={x.name} label={x.name} value={(x.minutes / topMax) * 100} text={x.minutes ? shortDuration(x.minutes) : `${x.count} ish`} tone={i === 0 ? 'bg-primary' : 'bg-[#A5B4FC]'} h="h-2" />)}
            </div>
          )}
          <div className="border-t border-line-soft pt-3 text-xs leading-normal text-muted">
            {filtered ? 'Filtr qo‘llangan.' : 'Filtr: Barcha xodimlar · barcha manbalar.'} Bitta xodimni tanlasangiz — faqat uning ishlari.
          </div>
        </Card>
      </div>
    </>
  );
}
