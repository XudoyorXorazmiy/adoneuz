import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { can, MONTHS, periodLabel, REPORT_PRESET_LABELS, REPORT_PRESETS, reportPeriod, shortRange, isUuid } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import type { TenantUser } from '@/lib/auth/session';
import { today as todayOf } from '@/server/attendance';
import { buildReport, loadJournal, parseReportParams, reportOptions } from '@/server/reports';
import { inspectionOverview, type Overview } from '@/server/inspections';
import { PageHeader } from '@/components/ui/page-header';
import { Icon } from '@/components/ui/icon';
import { ExcelButton, JournalFilters, MoreMenu, ReportFilters } from '@/components/reports/controls';
import { reportUrl } from '@/lib/report-url';
import { AttendanceTab, JournalTab, NoData, RatingTab, ReportSkeleton, TasksTab } from '@/components/reports/tabs';

export const metadata: Metadata = { title: 'Hisobotlar' };

const TABS = [
  { id: 'davomat', label: 'Davomat', icon: 'how_to_reg' },
  { id: 'vazifalar', label: 'Vazifalar', icon: 'task_alt' },
  { id: 'reyting', label: 'Reyting', icon: 'military_tech' },
  { id: 'jurnal', label: 'Ish jurnali', icon: 'history_edu' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const uuid = (v: unknown) => (isUuid(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/**
 * Hisobotlar (design/panel/Hisobotlar.dc.html): davr bo'yicha davomat, vazifalar, reyting va ish jurnali — egasi va admin (`reports`).
 * Filtr va tab — URL'da; ma'lumot Suspense ichida (filtr o'zgarsa skeleton).
 */
export default async function ReportsPage({ searchParams }: PageProps<'/hisobotlar'>) {
  const user = await requireArea('reports');
  const sp = await searchParams;
  const t = todayOf(user);
  const f = parseReportParams(sp, t);
  const { from, to, prevFrom, prevTo } = f.period;
  const tab: TabId = TABS.some((x) => x.id === sp.tab) ? (sp.tab as TabId) : 'davomat';
  const options = await reportOptions(user);
  const label = periodLabel(from, to, t);

  // Joriy so'rov (bo'sh qiymatlarsiz): filtrlar + tab + tab ichidagi tanlovlar
  const query: Record<string, string | undefined> = {
    davr: f.period.preset === 'oy' ? undefined : f.period.preset,
    dan: f.period.preset === 'tanlash' ? from : undefined, gacha: f.period.preset === 'tanlash' ? to : undefined,
    filial: f.branchId, bolim: f.departmentId, solishtir: f.compare ? undefined : '0',
    tab: tab === 'davomat' ? undefined : tab,
    xodim: tab === 'jurnal' ? uuid(sp.xodim) : undefined,
    manba: tab === 'jurnal' && (sp.manba === 'berilgan' || sp.manba === 'ozi') ? sp.manba : undefined,
    tur: tab === 'reyting' && sp.tur === 'bolimlar' ? 'bolimlar' : undefined,
  };
  const presets = REPORT_PRESETS.map((id) => {
    const p = id === 'tanlash' ? null : reportPeriod(id, t);
    const hint = !p ? '' : id === 'oy' || id === 'otgan-oy' ? MONTHS[Number(p.from.slice(5, 7)) - 1]! : shortRange(p.from, p.to);
    return { id, label: REPORT_PRESET_LABELS[id], hint, active: f.period.preset === id };
  });
  const branchName = options.branches.find((b) => b.id === f.branchId)?.name ?? 'Barcha filiallar';
  const deptName = options.departments.find((d) => d.id === f.departmentId)?.name ?? "Barcha bo'limlar";

  return (
    <>
      <PageHeader title="Hisobotlar" subtitle="Davomat, vazifalar va reyting"
        actions={<><ExcelButton query={query} rangeText={shortRange(from, to, true)} scopeText={`${branchName} · ${deptName}`} /><MoreMenu /></>} />
      <ReportFilters query={query} label={label} presets={presets} from={from} to={to} today={t} branches={options.branches} departments={options.departments} />
      <nav className="-mt-1 flex gap-1 overflow-x-auto border-b border-[#E6E8EC] [scrollbar-width:none] max-sm:-mx-4 max-sm:px-3">
        {TABS.map((x) => {
          const on = x.id === tab;
          return (
            <Link key={x.id} href={reportUrl('/hisobotlar', { ...query, xodim: undefined, manba: undefined, tur: undefined }, { tab: x.id === 'davomat' ? undefined : x.id })}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 pt-2.5 pb-3 text-sm whitespace-nowrap max-sm:px-3 ${on ? 'border-primary font-bold text-ink' : 'border-transparent font-medium text-muted hover:text-ink'}`}>
              <Icon name={x.icon} size={19} className="max-sm:hidden" />{x.label}
            </Link>
          );
        })}
      </nav>
      <Suspense key={JSON.stringify(query)} fallback={<ReportSkeleton />}>
        <TabBody tab={tab} user={user} f={f} query={query} today={t} label={label}
          employees={options.employees} prevHref={reportUrl('/hisobotlar', { ...query, davr: 'tanlash', dan: prevFrom, gacha: prevTo })} prevLabel={periodLabel(prevFrom, prevTo)} />
      </Suspense>
    </>
  );
}

async function TabBody({ tab, user, f, query, today, label, employees, prevHref, prevLabel }: {
  tab: TabId; user: TenantUser; f: ReturnType<typeof parseReportParams>; query: Record<string, string | undefined>; today: string; label: string;
  employees: Array<{ id: string; name: string }>; prevHref: string; prevLabel: string;
}) {
  const tz = user.tenantTimezone;
  if (tab === 'jurnal') {
    const employeeId = str(query.xodim);
    const source = query.manba as 'berilgan' | 'ozi' | undefined;
    const j = await loadJournal(user, { ...f, employeeId, source });
    return <JournalTab j={j} today={today} tz={tz} label={label} filtered={!!(employeeId || source || f.branchId || f.departmentId)}
      filters={<JournalFilters query={query} employees={employees} />} />;
  }
  const r = await buildReport(user, f);
  if (!r.hasData) return <NoData label={label} prevHref={prevHref} prevLabel={prevLabel} />;
  if (tab === 'vazifalar') return <TasksTab r={r} compare={f.compare} tz={tz} />;
  if (tab === 'reyting') {
    return <RatingTab r={r} mode={query.tur === 'bolimlar' ? 'bolimlar' : 'xodimlar'} compare={f.compare}
      toggle={{ xodimlar: reportUrl('/hisobotlar', query, { tur: undefined }), bolimlar: reportUrl('/hisobotlar', query, { tur: 'bolimlar' }) }} />;
  }
  const tabelHref = `/davomat/tabel?oy=${f.period.to.slice(0, 7)}${f.departmentId ? `&bolim=${f.departmentId}` : ''}`;
  const insp = can(user.role, 'inspections') ? await inspectionOverview(user, { from: f.period.from, to: f.period.to, departmentId: f.departmentId }) : null;
  return (
    <>
      <AttendanceTab r={r} compare={f.compare} tabelHref={tabelHref} prevLabel={prevLabel} />
      {insp && insp.stats.checks > 0 && <InspectionBlock o={insp} month={f.period.to.slice(0, 7)} />}
    </>
  );
}

/** «Nazorat» qisqa bloki (davomat tabida): davrdagi tekshiruvlar, ✓ ulushi, eng past bo'limlar; to'liq hisobot — /nazorat. */
function InspectionBlock({ o, month }: { o: Overview; month: string }) {
  const tone = (n: number | null) => (n == null ? 'text-muted' : n >= 90 ? 'text-success' : n >= 70 ? 'text-warning' : 'text-danger');
  const low = [...o.departments].filter((d) => d.stats.checks > 0).sort((a, b) => (a.stats.pct ?? 101) - (b.stats.pct ?? 101)).slice(0, 3);
  return (
    <section className="rounded-[20px] bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-base font-bold"><Icon name="checklist" size={20} className="text-primary" />Nazorat</h2>
        <Link href={`/nazorat?oy=${month}`} className="flex items-center gap-1 text-sm font-semibold text-primary">To&apos;liq hisobot<Icon name="chevron_right" size={18} /></Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-page px-4 py-3"><div className="text-xs text-muted">Tekshiruvlar</div><div className="tnum text-xl font-bold">{o.stats.checks}</div></div>
        <div className="rounded-2xl bg-page px-4 py-3"><div className="text-xs text-muted">Joyida</div><div className={`tnum text-xl font-bold ${tone(o.stats.pct)}`}>{o.stats.pct == null ? '—' : `${o.stats.pct}%`}</div></div>
        <div className="rounded-2xl bg-page px-4 py-3"><div className="text-xs text-muted">Kamchilik · ochiq vazifa</div><div className="tnum text-xl font-bold">{o.stats.fail} <span className="text-sm font-semibold text-muted">· {o.openTasks}</span></div></div>
      </div>
      {low.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          <span className="text-muted">E&apos;tibor:</span>
          {low.map((d) => <span key={d.id} className="rounded-full bg-subtle px-2.5 py-1 font-semibold">{d.name} <span className={`tnum ${tone(d.stats.pct)}`}>{d.stats.pct}%</span></span>)}
        </div>
      )}
    </section>
  );
}
