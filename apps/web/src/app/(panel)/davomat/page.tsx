import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pencil, Table2 } from 'lucide-react';
import { addDays, formatDate, formatTime, isValidDate, isoWeekday, WEEKDAY_LONG, type DayStatus } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listDay, summarize, today } from '@/server/attendance';
import { employeeOptions } from '@/server/employees';
import { correctAttendanceAction } from '@/lib/actions/attendance';
import { EmptyState, Kpi, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { DayStatusBadge } from '@/components/attendance/badges';
import { EventList } from '@/components/attendance/event-list';
import { CorrectFields } from '@/components/attendance/correct-fields';

export const metadata: Metadata = { title: 'Davomat' };

/** 492 → «8:12» */
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

type Tab = 'all' | DayStatus | 'inside' | 'suspicious';
const TABS: Array<[Tab, string]> = [['all', 'Barchasi'], ['inside', 'Hozir ishda'], ['late', 'Kechikdi'], ['absent', 'Kelmadi'], ['leave', 'Ruxsatda'], ['suspicious', 'Shubhali'], ['off', 'Dam olish']];

export default async function AttendancePage({ searchParams }: PageProps<'/davomat'>) {
  const user = await requireArea('attendance');
  const sp = await searchParams;
  const t = today(user);
  const date = typeof sp.sana === 'string' && isValidDate(sp.sana) && sp.sana <= t ? sp.sana : t;
  const tab = (TABS.map((x) => x[0]) as string[]).includes(String(sp.holat)) ? (String(sp.holat) as Tab) : 'all';
  const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : undefined);
  const branchId = uuid(sp.filial);
  const departmentId = uuid(sp.bolim);
  const [rows, options] = await Promise.all([listDay(user, { date, branchId, departmentId }), employeeOptions(user.tenantId)]);
  const c = summarize(rows);
  const shown = rows.filter((r) => tab === 'all' || (tab === 'inside' ? r.result.open : tab === 'suspicious' ? r.result.suspicious : r.result.status === tab));
  const tz = user.tenantTimezone;
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { sana: date === t ? undefined : date, holat: tab === 'all' ? undefined : tab, filial: branchId, bolim: departmentId, ...patch };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/davomat?${s}` : '/davomat';
  };
  const count = (k: Tab) => (k === 'all' ? c.all : k === 'inside' ? c.inside : k === 'suspicious' ? c.suspicious : c[k as DayStatus]);

  return (
    <>
      <PageHeader title="Davomat" subtitle={`${formatDate(`${date}T12:00:00Z`)} · ${WEEKDAY_LONG[isoWeekday(date) - 1]}${date === t ? ' (bugun)' : ''}`}>
        <div className="flex items-center gap-1">
          <Link href={href({ sana: addDays(date, -1) })} className="btn-secondary btn-sm px-2" title="Oldingi kun"><ChevronLeft size={16} /></Link>
          <form action="/davomat" className="flex">
            <input type="date" name="sana" defaultValue={date} max={t} className="input h-8 w-[150px] text-[13px]" />
            <button className="btn-secondary btn-sm ml-1">Ochish</button>
          </form>
          {date < t && <Link href={href({ sana: addDays(date, 1) === t ? undefined : addDays(date, 1) })} className="btn-secondary btn-sm px-2" title="Keyingi kun"><ChevronRight size={16} /></Link>}
        </div>
        <Link href="/davomat/tabel" className="btn-secondary btn-sm"><Table2 size={15} /> Oylik tabel</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label={date === t ? 'Hozir ishda' : 'Kelgan'} value={<>{date === t ? c.inside : c.present + c.late} <span className="text-base text-muted">/ {c.all}</span></>} tone="success" />
        <Kpi label="Kechikdi" value={c.late} tone="warning" />
        <Kpi label="Kelmadi" value={c.absent} tone="danger" />
        <Kpi label="Shubhali" value={c.suspicious} tone="warning" hint="Yuz yoki lokatsiya tekshiruvi" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map(([k, l]) => (
            <Link key={k} href={href({ holat: k === 'all' ? undefined : k })} className={`btn btn-sm ${tab === k ? 'bg-primary-tint text-primary' : 'text-ink-2 hover:bg-subtle'}`}>
              {l} <span className="tnum text-xs opacity-70">{count(k)}</span>
            </Link>
          ))}
        </div>
        <form action="/davomat" className="ml-auto flex gap-2">
          {date !== t && <input type="hidden" name="sana" value={date} />}
          <select name="filial" defaultValue={branchId ?? ''} className="input h-8 w-[170px] text-[13px]"><option value="">Barcha filiallar</option>{options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select name="bolim" defaultValue={departmentId ?? ''} className="input h-8 w-[160px] text-[13px]"><option value="">Barcha bo&apos;limlar</option>{options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <button className="btn-secondary btn-sm">Filtr</button>
        </form>
      </div>

      <div className="card overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState text={rows.length === 0 ? "Faol xodim yo'q. Xodimlar botda ro'yxatdan o'tib tasdiqlangach shu yerda ko'rinadi." : "Bu filtr bo'yicha hech kim yo'q."} />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[minmax(220px,1.6fr)_110px_110px_110px_100px_150px_90px] gap-3 bg-page px-4 py-2.5 text-xs text-muted">
                <span>Xodim</span><span>Smena</span><span>Keldi</span><span>Ketdi</span><span>Ishladi</span><span>Holat</span><span />
              </div>
              {shown.map((r) => (
                <details key={r.id} className="group border-t border-line">
                  <summary className="grid cursor-pointer list-none grid-cols-[minmax(220px,1.6fr)_110px_110px_110px_100px_150px_90px] items-center gap-3 px-4 py-3 text-[13px] hover:bg-page">
                    <span className="min-w-0"><span className="block truncate font-medium">{r.fullName}</span><span className="block truncate text-xs text-muted">{[r.position, r.departmentName, r.branchName].filter(Boolean).join(' · ')}</span></span>
                    <span className="tnum">{r.shift ? `${formatTime(r.shift.start, tz)}–${formatTime(r.shift.end, tz)}` : <span className="text-muted">{r.scheduleName ? 'dam' : 'erkin'}</span>}</span>
                    <span className="tnum">{r.result.firstIn ? <>{formatTime(r.result.firstIn, tz)}{r.result.lateMinutes > 0 && <span className="ml-1 text-warning-text">+{r.result.lateMinutes} daq</span>}</> : '—'}</span>
                    <span className="tnum">{r.result.lastOut && !r.result.open ? <>{formatTime(r.result.lastOut, tz)}{r.result.earlyLeaveMinutes > 0 && <span className="ml-1 text-warning-text">−{r.result.earlyLeaveMinutes}</span>}</> : r.result.open ? <span className="text-success-text">ishda</span> : '—'}</span>
                    <span className="tnum">{r.result.workedMinutes ? hm(r.result.workedMinutes) : '—'}</span>
                    <span className="flex flex-wrap gap-1"><DayStatusBadge status={r.result.status} open={r.result.open} />{r.result.suspicious && <span className="badge bg-warning-tint text-warning-text ring-1 ring-warning/40">Shubhali</span>}</span>
                    <span className="text-right text-xs text-primary group-open:hidden">Batafsil</span>
                  </summary>
                  <div className="flex flex-col gap-3 bg-page px-4 pt-1 pb-4">
                    <EventList events={r.events} tz={tz} />
                    <div>
                      <FormDrawer trigger={<><Pencil size={14} /> Tuzatish</>} triggerClass="btn-secondary btn-sm" title={`Tuzatish — ${r.fullName}, ${formatDate(`${date}T12:00:00Z`)}`} action={correctAttendanceAction}>
                        <CorrectFields employeeId={r.id} workDate={date}
                          events={r.events.filter((e) => e.kind !== 'correction').map((e) => ({ id: e.id, suspicious: e.checkStatus === 'suspicious', label: `${formatTime(e.at, tz)} — ${e.kind === 'check_in' ? 'Keldi' : e.kind === 'check_out' ? 'Ketdi' : e.kind}${e.checkStatus === 'suspicious' ? ' (shubhali)' : ''}` }))} />
                      </FormDrawer>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
