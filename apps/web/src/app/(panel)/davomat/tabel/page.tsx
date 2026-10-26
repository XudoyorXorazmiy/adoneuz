import type { Metadata } from 'next';
import Link from 'next/link';
import { DAY_STATUS_LABELS, isoWeekday, monthDays, MONTHS, WEEKDAY_SHORT, type DayStatus, isUuid } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { monthGrid, monthTotals, today } from '@/server/attendance';
import { employeeOptions } from '@/server/employees';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = { title: 'Oylik tabel' };

const CELL: Record<DayStatus, string> = {
  present: 'bg-success-tint text-success-text',
  late: 'bg-warning-tint text-warning-text',
  absent: 'bg-danger-tint text-danger-text',
  leave: 'bg-info-tint text-info-text',
  holiday: 'bg-subtle text-muted',
  off: 'text-placeholder',
};
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default async function TimesheetPage({ searchParams }: PageProps<'/davomat/tabel'>) {
  const user = await requireArea('attendance');
  const sp = await searchParams;
  const cur = today(user).slice(0, 7);
  const month = typeof sp.oy === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.oy) && sp.oy <= cur ? sp.oy : cur;
  const departmentId = isUuid(sp.bolim) ? sp.bolim : undefined;
  const [{ emps, cells }, options] = await Promise.all([monthGrid(user, month, departmentId), employeeOptions(user.tenantId)]);
  const dates = monthDays(month);
  const t = today(user);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const q = (o: string) => `/davomat/tabel?oy=${o}${departmentId ? `&bolim=${departmentId}` : ''}`;

  return (
    <>
      <PageHeader title="Oylik tabel" subtitle={`${MONTHS[m - 1]} ${y}`}>
        <div className="flex items-center gap-1">
          <Link href={q(shiftMonth(month, -1))} className="btn-secondary btn-sm px-2"><Icon name="chevron_left" size={16}/></Link>
          {month < cur && <Link href={q(shiftMonth(month, 1))} className="btn-secondary btn-sm px-2"><Icon name="chevron_right" size={16}/></Link>}
        </div>
        <form action="/davomat/tabel" className="flex gap-1">
          <input type="hidden" name="oy" value={month} />
          <select name="bolim" defaultValue={departmentId ?? ''} className="input h-8 w-[170px] text-[13px]"><option value="">Barcha bo&apos;limlar</option>{options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <button className="btn-secondary btn-sm">Filtr</button>
        </form>
        <a href={`/api/eksport/tabel?oy=${month}${departmentId ? `&bolim=${departmentId}` : ''}`} className="btn-primary btn-sm"><Icon name="download" size={15}/> Excel</a>
      </PageHeader>

      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {(['present', 'late', 'absent', 'leave', 'off'] as DayStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`inline-block size-3 rounded ${CELL[s]} border border-line`} />{DAY_STATUS_LABELS[s]}</span>
        ))}
        <span>Katakda — ishlagan soat; burchakdagi raqam — kechikish (daq).</span>
      </div>

      <div className="card overflow-hidden">
        {emps.length === 0 ? <EmptyState text="Bu oyda xodim yo'q." /> : (
          <div className="overflow-x-auto">
            <table className="border-collapse text-[12px]">
              <thead>
                <tr className="bg-page text-muted">
                  <th className="sticky left-0 z-10 min-w-[200px] bg-page px-3 py-2 text-left font-medium">Xodim</th>
                  {dates.map((d) => {
                    const w = isoWeekday(d);
                    return <th key={d} className={`min-w-[40px] px-0.5 py-1 text-center font-medium ${w === 7 ? 'text-danger-text' : ''} ${d === t ? 'bg-primary-tint text-primary' : ''}`}><div>{Number(d.slice(8))}</div><div className="text-[10px] font-normal">{WEEKDAY_SHORT[w - 1]}</div></th>;
                  })}
                  <th className="px-2 py-2 text-right font-medium">Kun</th>
                  <th className="px-2 py-2 text-right font-medium">Soat</th>
                  <th className="px-2 py-2 text-right font-medium">Kech.</th>
                  <th className="px-2 py-2 text-right font-medium">Kelm.</th>
                </tr>
              </thead>
              <tbody>
                {emps.map((e) => {
                  const tot = monthTotals(e.id, dates, cells);
                  return (
                    <tr key={e.id} className="border-t border-line">
                      <td className="sticky left-0 z-10 bg-card px-3 py-1.5"><Link href={`/xodimlar/${e.id}?oy=${month}`} className="block truncate font-bold hover:text-primary">{e.fullName}</Link><div className="truncate text-[11px] text-muted">{e.position ?? e.departmentName ?? ''}</div></td>
                      {dates.map((d) => {
                        const c = cells.get(`${e.id}:${d}`);
                        if (!c || d > t) return <td key={d} className="p-0.5"><div className="h-9" /></td>;
                        return (
                          <td key={d} className="p-0.5" title={`${DAY_STATUS_LABELS[c.status]}${c.lateMinutes ? `, kechikish ${c.lateMinutes} daq` : ''}`}>
                            <Link href={`/davomat?sana=${d}`} className={`relative flex h-9 items-center justify-center rounded tnum ${CELL[c.status]} ${c.suspicious ? 'ring-1 ring-warning' : ''}`}>
                              {c.workedMinutes > 0 ? hm(c.workedMinutes) : c.status === 'absent' ? '✕' : c.status === 'leave' ? 'R' : ''}
                              {c.lateMinutes > 0 && <span className="absolute top-0 right-0.5 text-[9px] font-semibold">{c.lateMinutes}</span>}
                            </Link>
                          </td>
                        );
                      })}
                      <td className="tnum px-2 text-right font-medium">{tot.presentDays}</td>
                      <td className="tnum px-2 text-right">{hm(tot.worked)}</td>
                      <td className="tnum px-2 text-right text-warning-text">{tot.lateDays || ''}</td>
                      <td className="tnum px-2 text-right text-danger-text">{tot.absentDays || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
