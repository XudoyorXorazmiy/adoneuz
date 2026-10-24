import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { addDays, formatDate, formatTime, isValidDate, isoWeekday, WEEKDAY_LONG, type CheckStatus, type DayStatus } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listDay, summarize, today, type DayRow } from '@/server/attendance';
import { employeeOptions } from '@/server/employees';
import { deltaPct } from '@/server/dashboard';
import { correctAttendanceAction } from '@/lib/actions/attendance';
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Delta } from '@/components/dashboard/delta';
import { CheckBadge, DayStatusBadge } from '@/components/attendance/badges';
import { EventList } from '@/components/attendance/event-list';
import { CorrectFields } from '@/components/attendance/correct-fields';
import { FilterBar } from '@/components/attendance/filter-bar';
import { RowMenu } from '@/components/attendance/row-menu';

export const metadata: Metadata = { title: 'Davomat' };

/** 492 → «8:12» */
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const PER_PAGE = 20;
const COLS = 'grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_0.8fr_1.1fr_1.1fr_40px]';

type Tab = 'all' | DayStatus | 'inside' | 'suspicious';
const TAB_KEYS: Tab[] = ['all', 'inside', 'late', 'absent', 'leave', 'suspicious', 'off'];

/** Qatorning tekshiruv natijasi: hodisa yo'q → null; shubhali bor → suspicious; hammasi rad → rejected. */
function checkOf(r: DayRow): CheckStatus | null {
  const proofs = r.events.filter((e) => e.kind !== 'correction' && e.kind !== 'auto_close');
  if (r.result.suspicious) return 'suspicious';
  if (proofs.length === 0) return r.result.firstIn ? 'ok' : null;
  return proofs.every((e) => e.checkStatus === 'rejected') && !r.result.firstIn ? 'rejected' : 'ok';
}

export default async function AttendancePage({ searchParams }: PageProps<'/davomat'>) {
  const user = await requireArea('attendance');
  const sp = await searchParams;
  const t = today(user);
  const date = typeof sp.sana === 'string' && isValidDate(sp.sana) && sp.sana <= t ? sp.sana : t;
  const isToday = date === t;
  const tab = (TAB_KEYS as string[]).includes(String(sp.holat)) ? (String(sp.holat) as Tab) : 'all';
  const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);
  const branchId = uuid(sp.filial);
  const departmentId = uuid(sp.bolim);
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const [rows, prevRows, options] = await Promise.all([
    listDay(user, { date, branchId, departmentId }),
    listDay(user, { date: addDays(date, -1), branchId, departmentId }),
    employeeOptions(user.tenantId),
  ]);
  const tz = user.tenantTimezone;
  const ql = q.toLowerCase();
  const qd = q.replace(/\D/g, '');
  const found = q ? rows.filter((r) => r.fullName.toLowerCase().includes(ql) || (qd.length >= 3 && (r.phone ?? '').includes(qd))) : rows;
  const c = summarize(found);
  const p = summarize(prevRows);
  const came = (s: typeof c) => s.present + s.late;
  const inside = (r: DayRow) => (isToday ? r.result.open : !!r.result.firstIn);
  const match = (r: DayRow, k: Tab) => k === 'all' || (k === 'inside' ? inside(r) : k === 'suspicious' ? r.result.suspicious : r.result.status === k);
  const count = (k: Tab) => found.filter((r) => match(r, k)).length;
  const shown = found.filter((r) => match(r, tab));
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.sahifa) || 1));
  const pageRows = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const lateMinutes = found.reduce((s, r) => s + (r.result.status === 'late' ? r.result.lateMinutes : 0), 0);

  const params = { sana: isToday ? undefined : date, holat: tab === 'all' ? undefined : tab, filial: branchId, bolim: departmentId, q: q || undefined };
  const href = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/davomat?${s}` : '/davomat';
  };
  const dayLabel = `${formatDate(`${date}T12:00:00Z`)}, ${WEEKDAY_LONG[isoWeekday(date) - 1]}`;
  const insideNow = isToday ? c.inside : came(c);
  const pct = c.all ? Math.round((came(c) / c.all) * 100) : 0;
  const absentDiff = c.absent - p.absent;
  const tabLabel: Record<Tab, string> = { all: 'Barchasi', inside: isToday ? 'Ishda' : 'Keldi', late: 'Kechikdi', absent: 'Kelmadi', leave: 'Ruxsatda', suspicious: 'Shubhali', off: 'Dam olish', present: '', holiday: '' };
  const evLabel = (e: DayRow['events'][number]) => {
    if (e.kind === 'correction') {
      const m = e.meta as { action?: string; at?: string } | null;
      return `${m?.at ? formatTime(m.at, tz) : ''} — tuzatish (${m?.action === 'add_in' ? 'kirish' : 'chiqish'})`;
    }
    return `${formatTime(e.at, tz)} — ${e.kind === 'check_in' ? 'Keldi' : e.kind === 'check_out' ? 'Ketdi' : e.kind === 'auto_close' ? 'Avto-yopildi' : 'Tanaffus'}${e.checkStatus === 'suspicious' ? ' (shubhali)' : e.checkStatus === 'rejected' ? ' (rad etilgan)' : ''}`;
  };

  return (
    <>
      <PageHeader title="Davomat" badge={`${c.all} xodim`} subtitle={`${dayLabel} · ${user.tenantName}`} alert={c.suspicious > 0}
        actions={
          <>
            <Link href={`/davomat/tabel?oy=${date.slice(0, 7)}`} className="btn-secondary h-11 text-sm"><Icon name="calendar_month" className="text-primary" />Oylik tabel</Link>
            <a href={`/api/eksport/tabel?oy=${date.slice(0, 7)}${departmentId ? `&bolim=${departmentId}` : ''}`} className="btn-secondary h-11 text-sm"><Icon name="table_view" className="text-success" />Excel</a>
            <FormDrawer trigger={<><Icon name="edit_calendar" />Qo&apos;lda belgilash</>} triggerClass="btn-primary h-11 pr-[22px] pl-[18px] text-sm"
              title="Qo'lda belgilash" subtitle={dayLabel} action={correctAttendanceAction}>
              <CorrectFields workDate={date} employees={rows.map((r) => ({ id: r.id, name: r.fullName }))} />
            </FormDrawer>
          </>
        } />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="how_to_reg" tone="success" label={isToday ? 'Ishda' : 'Keldi'} value={insideNow} href={href({ holat: 'inside', sahifa: undefined })}
          badge={<Delta value={deltaPct(came(c), came(p))} />} caption={`${c.all} xodimdan · ${pct}%${isToday && came(c) !== c.inside ? ` · kelgan ${came(c)}` : ''}`} />
        <StatCard icon="schedule" tone="warning" label="Kechikdi" value={c.late} href={href({ holat: 'late', sahifa: undefined })}
          badge={<Delta value={deltaPct(c.late, p.late)} goodWhenUp={false} />} caption={lateMinutes ? `Jami ${lateMinutes} daqiqa` : 'Kechikish yo‘q'} />
        <StatCard icon="person_off" tone="danger" label="Kelmadi" value={c.absent} href={href({ holat: 'absent', sahifa: undefined })}
          badge={absentDiff !== 0 ? <span className={`delta ${absentDiff > 0 ? 'bg-danger-tint text-danger' : 'bg-success-tint text-success'}`}>{absentDiff > 0 ? '↗' : '↘'} {Math.abs(absentDiff)}</span> : undefined}
          caption={c.leave ? `Ruxsatda ${c.leave}` : 'Kechagiga nisbatan'} />
        <StatCard icon="gpp_maybe" tone="warning" label="Shubhali" value={c.suspicious} href={href({ holat: 'suspicious', sahifa: undefined })}
          badge={c.suspicious ? <span className="delta bg-warning-tint text-warning">Tekshiring</span> : undefined} caption={c.suspicious ? 'Rahbar qarori kerak' : 'Hammasi tekshirilgan'} />
      </div>

      <section className="card px-6 pt-5 pb-2 max-sm:px-4">
        <FilterBar base="/davomat" params={params} date={date} today={t} dateLabel={`${isToday ? 'Bugun · ' : ''}${formatDate(`${date}T12:00:00Z`)}`}
          branches={options.branches} departments={options.departments} />

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line-soft">
          {TAB_KEYS.filter((k) => k !== 'off' || c.off > 0).map((k) => {
            const on = tab === k;
            return (
              <Link key={k} href={href({ holat: k === 'all' ? undefined : k, sahifa: undefined })}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 pt-2.5 pb-3 text-[13px] whitespace-nowrap ${on ? 'border-primary font-bold text-ink' : 'border-transparent font-medium text-muted hover:text-ink'}`}>
                {tabLabel[k]}
                <span className={`tnum rounded-full px-[7px] py-px text-[11px] font-bold ${on ? 'bg-primary text-white' : k === 'suspicious' && count(k) ? 'bg-warning-tint text-warning' : 'bg-subtle text-muted'}`}>{count(k)}</span>
              </Link>
            );
          })}
        </div>

        {pageRows.length === 0 ? (
          <EmptyState text={rows.length === 0 ? "Faol xodim yo'q. Xodimlar botda ro'yxatdan o'tib tasdiqlangach shu yerda ko'rinadi." : "Bu filtr bo'yicha hech kim yo'q."} />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[940px]">
              <div className={`grid ${COLS} gap-3 border-b border-line-soft px-1 pt-3.5 pb-2.5 text-xs font-medium text-placeholder`}>
                <span>Xodim</span><span>Smena</span><span>Keldi</span><span>Ketdi</span><span>Ishladi</span><span>Holat</span><span>Tekshiruv</span><span />
              </div>
              {pageRows.map((r) => {
                const res = r.result;
                const sub = [r.position, r.departmentName].filter(Boolean).join(' · ') || r.branchName || '';
                const voidable = r.events.filter((e) => (e.kind !== 'correction' || ['add_in', 'add_out'].includes(String((e.meta as { action?: string } | null)?.action))));
                return (
                  <details key={r.id} className="group -mx-2 my-0.5 rounded-[14px] px-2 open:bg-page">
                    <summary className={`grid ${COLS} cursor-pointer list-none items-center gap-3 border-b border-[#F4F5F7] px-1 py-[11px] text-[13px] [&::-webkit-details-marker]:hidden`}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon name="chevron_right" size={18} className="text-placeholder transition group-open:rotate-90" />
                        <Avatar name={r.fullName} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{r.fullName}</span>
                          <span className="block truncate text-xs text-muted">{sub}</span>
                        </span>
                      </span>
                      <span className="tnum text-muted">{r.shift ? `${formatTime(r.shift.start, tz)}–${formatTime(r.shift.end, tz)}` : r.scheduleName ? 'dam olish' : 'erkin'}</span>
                      <span className={`tnum flex items-center gap-1.5 font-bold ${res.lateMinutes > 0 ? 'text-warning' : res.firstIn ? '' : 'text-placeholder'}`}>
                        {res.firstIn ? formatTime(res.firstIn, tz) : '—'}
                        {res.lateMinutes > 0 && <span className="text-[11px]">+{res.lateMinutes >= 60 ? hm(res.lateMinutes) : `${res.lateMinutes} daq`}</span>}
                      </span>
                      <span className={`tnum font-semibold ${res.open ? 'text-success' : res.lastOut ? '' : 'text-placeholder'}`}>
                        {res.open ? 'Ishda' : res.lastOut ? formatTime(res.lastOut, tz) : '—'}
                        {!res.open && res.earlyLeaveMinutes > 0 && <span className="ml-1.5 text-[11px] font-bold text-warning">−{res.earlyLeaveMinutes >= 60 ? hm(res.earlyLeaveMinutes) : `${res.earlyLeaveMinutes} daq`}</span>}
                      </span>
                      <span className="tnum font-semibold">{res.workedMinutes ? hm(res.workedMinutes) : res.status === 'absent' ? '0:00' : '—'}</span>
                      <span><DayStatusBadge status={res.status} open={res.open} early={res.earlyLeaveMinutes > 0} waiting={isToday && !!r.shift && !res.firstIn} /></span>
                      <span><CheckBadge status={checkOf(r)} /></span>
                      <RowMenu employeeId={r.id} name={r.fullName} subtitle={dayLabel} telegram={r.telegramUsername}
                        fields={{
                          employeeId: r.id, workDate: date,
                          inTime: res.firstIn ? formatTime(res.firstIn, tz) : '', outTime: res.lastOut && !res.open ? formatTime(res.lastOut, tz) : '',
                          events: voidable.map((e) => ({ id: e.id, suspicious: e.checkStatus === 'suspicious', label: evLabel(e) })),
                        }} />
                    </summary>
                    <div className="pt-3.5 pr-1 pb-[18px] pl-12 max-sm:pl-1">
                      <EventList events={r.events} tz={tz} radiusM={r.branchRadiusM} branchName={r.branchName} />
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1 py-3.5 text-[13px] text-muted">
          <span className="tnum">{shown.length ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, shown.length)} / ${shown.length}` : '0'}</span>
          {pages > 1 && (
            <div className="flex gap-1.5">
              <PageLink href={page > 1 ? href({ sahifa: page - 1 === 1 ? undefined : String(page - 1) }) : null}><Icon name="chevron_left" size={18} /></PageLink>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link key={n} href={href({ sahifa: n === 1 ? undefined : String(n) })}
                  className={`flex size-8 items-center justify-center rounded-full ${n === page ? 'bg-navy font-bold text-white' : 'hover:bg-subtle'}`}>{n}</Link>
              ))}
              <PageLink href={page < pages ? href({ sahifa: String(page + 1) }) : null}><Icon name="chevron_right" size={18} /></PageLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function PageLink({ href, children }: { href: string | null; children: ReactNode }) {
  const cls = 'flex size-8 items-center justify-center rounded-full border border-line';
  return href ? <Link href={href} className={`${cls} hover:bg-subtle`}>{children}</Link> : <span className={`${cls} text-placeholder`}>{children}</span>;
}
