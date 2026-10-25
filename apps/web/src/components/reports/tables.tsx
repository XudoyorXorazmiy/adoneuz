'use client';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { formatTime, hhmm, pct, type TaskStatus } from '@adone/core';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { StatusPill } from '@/components/tasks/task-card';

type Dir = 'asc' | 'desc';
type Col<R> = { key: string; label: string; get?: (r: R) => number | string | null };

/** Saralash: null — har doim oxirida; satr — alifbo. */
function useSorted<R>(rows: R[], cols: Array<Col<R>>, initial: string) {
  const [sort, setSort] = useState<{ key: string; dir: Dir }>({ key: initial, dir: 'desc' });
  const sorted = useMemo(() => {
    const get = cols.find((c) => c.key === sort.key)?.get;
    if (!get) return rows;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number);
      return sort.dir === 'asc' ? c : -c;
    });
  }, [rows, cols, sort]);
  const head = (c: Col<R>) => (
    <button key={c.key} type="button" disabled={!c.get}
      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
      className={`flex items-center gap-0.5 text-left ${sort.key === c.key ? 'font-bold text-ink' : 'font-medium'} ${c.get ? 'cursor-pointer hover:text-ink' : 'cursor-default'}`}>
      {c.label}{sort.key === c.key && <Icon name={sort.dir === 'desc' ? 'arrow_downward' : 'arrow_upward'} size={14} />}
    </button>
  );
  return { sorted, head };
}

const barTone = (v: number | null) => (v == null ? 'bg-line' : v < 90 ? 'bg-warning' : v >= 97 ? 'bg-success' : 'bg-primary');
const dash = <span className="text-[#C4C9D2]">—</span>;

function Bar({ value, tone, width = 'w-9' }: { value: number | null; tone?: string; width?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-line-soft"><div className={`h-full rounded-full ${tone ?? barTone(value)}`} style={{ width: `${value ?? 0}%` }} /></div>
      <b className={`tnum ${width} text-right font-bold`}>{value == null ? '—' : `${value}%`}</b>
    </div>
  );
}

function Search({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-9 w-[220px] items-center gap-2 rounded-xl border border-line px-3 text-[13px] focus-within:border-primary max-sm:w-full">
      <Icon name="search" size={18} className="text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Xodimni qidirish…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder" />
    </label>
  );
}

function TableCard({ title, search, children }: { title: string; search?: ReactNode; children: ReactNode }) {
  return (
    <section className="card px-6 pt-5 pb-2 max-sm:px-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="card-icon"><Icon name="group" size={18} fill /></span>
        <h2 className="m-0 flex-1 text-base font-bold">{title}</h2>
        {search}
      </div>
      {children}
    </section>
  );
}

// ---------- Davomat ----------

export interface AttRow {
  id: string; name: string; position: string | null; dept: string | null; planned: number; came: number; late: number; lateMinutes: number;
  early: number; earlyMinutes: number; absent: number; leave: number; worked: number; overtime: number; pct: number | null;
}

const ATT_GRID = 'grid-cols-[minmax(0,2fr)_0.9fr_0.7fr_0.9fr_0.9fr_0.65fr_0.65fr_0.75fr_0.75fr_1.1fr]';
/** «3 · 24 daq» / «3 · 1:29» — ustunga sig'adigan qisqa ko'rinish. */
const countMin = (n: number, m: number) => (n ? `${n} · ${m < 60 ? `${m} daq` : hhmm(m)}` : null);

/** «Xodimlar bo'yicha» (davomat): saralanadigan ustunlar, qator → xodim profili, oxirida «Jami». Telefonda — kartochkalar. */
export function AttendanceTable({ rows }: { rows: AttRow[] }) {
  const [q, setQ] = useState('');
  const cols: Array<Col<AttRow>> = [
    { key: 'name', label: 'Xodim', get: (r) => r.name }, { key: 'dept', label: "Bo'lim", get: (r) => r.dept ?? '' },
    { key: 'came', label: 'Ish kuni', get: (r) => r.came }, { key: 'late', label: 'Kechikish', get: (r) => r.lateMinutes },
    { key: 'early', label: 'Erta ketish', get: (r) => r.earlyMinutes }, { key: 'absent', label: 'Kelmagan', get: (r) => r.absent },
    { key: 'leave', label: 'Ruxsatda', get: (r) => r.leave }, { key: 'worked', label: 'Ishladi', get: (r) => r.worked },
    { key: 'overtime', label: "Qo'shimcha", get: (r) => r.overtime }, { key: 'pct', label: 'Davomat', get: (r) => r.pct },
  ];
  const shown = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const { sorted, head } = useSorted(shown, cols, 'pct');
  const sum = (k: keyof AttRow) => shown.reduce((a, r) => a + (r[k] as number), 0);
  const total = pct(sum('came'), sum('came') + sum('absent'));

  return (
    <TableCard title="Xodimlar bo'yicha" search={<Search value={q} onChange={setQ} />}>
      {sorted.length === 0 ? <p className="m-0 py-10 text-center text-muted">Xodim topilmadi.</p> : (
        <>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0 sm:hidden">
            {sorted.map((r) => (
              <li key={r.id}>
                <Link href={`/xodimlar/${r.id}`} className="flex flex-col gap-2.5 rounded-[18px] border border-line-soft px-3.5 py-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.name} size={36} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{r.name}</span><span className="block truncate text-xs text-muted">{r.position ?? r.dept ?? ''}</span></span>
                    <b className="tnum text-base font-extrabold">{r.pct == null ? '—' : `${r.pct}%`}</b>
                  </span>
                  <span className="h-1.5 rounded-full bg-line-soft"><span className={`block h-full rounded-full ${barTone(r.pct)}`} style={{ width: `${r.pct ?? 0}%` }} /></span>
                  <span className="flex flex-wrap gap-1.5">
                    <span className="badge bg-warning-tint text-warning-text">Kechikish {r.late}</span>
                    <span className="badge bg-danger-tint text-danger">Kelmagan {r.absent}</span>
                    {r.leave > 0 && <span className="badge bg-primary-tint text-primary">Ruxsatda {r.leave}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto max-sm:hidden">
            <div className="min-w-[1040px]">
              <div className={`mt-3.5 grid ${ATT_GRID} gap-2.5 rounded-[10px] bg-[#FAFBFC] px-2 pt-3.5 pb-2.5 text-xs text-placeholder`}>{cols.map(head)}</div>
              {sorted.map((r) => (
                <Link key={r.id} href={`/xodimlar/${r.id}`} className={`grid ${ATT_GRID} items-center gap-2.5 rounded-[10px] border-b border-[#F4F5F7] px-2 py-[11px] text-[13px] hover:bg-page`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={r.name} size={32} />
                    <span className="min-w-0"><span className="block truncate font-bold">{r.name}</span><span className="block truncate text-xs text-muted">{r.position ?? ''}</span></span>
                  </span>
                  <span className="truncate text-ink-2">{r.dept ?? '—'}</span>
                  <span className="tnum font-semibold">{r.came} / {r.planned}</span>
                  <span className="tnum font-bold whitespace-nowrap text-warning">{countMin(r.late, r.lateMinutes) ?? dash}</span>
                  <span className="tnum font-semibold whitespace-nowrap">{countMin(r.early, r.earlyMinutes) ?? dash}</span>
                  <span className="tnum font-bold text-danger">{r.absent || dash}</span>
                  <span className="tnum text-ink-2">{r.leave || dash}</span>
                  <span className="tnum font-semibold">{hhmm(r.worked)}</span>
                  <span className="tnum font-semibold text-success">{r.overtime ? `+${hhmm(r.overtime)}` : dash}</span>
                  <Bar value={r.pct} />
                </Link>
              ))}
              <div className={`tnum grid ${ATT_GRID} items-center gap-2.5 px-2 py-3.5 text-[13px] font-bold`}>
                <span>Jami · {shown.length} xodim</span><span />
                <span>{sum('came')} / {sum('planned')}</span>
                <span className="whitespace-nowrap text-warning">{countMin(sum('late'), sum('lateMinutes')) ?? '—'}</span>
                <span className="whitespace-nowrap">{countMin(sum('early'), sum('earlyMinutes')) ?? '—'}</span>
                <span className="text-danger">{sum('absent')}</span><span>{sum('leave')}</span>
                <span>{hhmm(sum('worked'))}</span><span className="text-success">{sum('overtime') ? `+${hhmm(sum('overtime'))}` : '—'}</span>
                <span>{total == null ? '—' : `${total}%`}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </TableCard>
  );
}

// ---------- Vazifalar ----------

export interface TaskRowData {
  id: string; name: string; dept: string | null; given: number; done: number; onTimePct: number | null; late: number; returned: number;
  avgRating: number | null; selfCount: number; selfMinutes: number;
  last: Array<{ id: string; title: string; at: Date; rating: number | null; status: TaskStatus }>;
}

const TASK_GRID = 'grid-cols-[minmax(0,2fr)_0.9fr_0.7fr_0.7fr_1.1fr_0.7fr_0.8fr_0.7fr_1.1fr]';
const selfText = (r: TaskRowData) => (r.selfCount ? `${r.selfCount} ish${r.selfMinutes ? ` · ${Math.round(r.selfMinutes / 60)} soat` : ''}` : null);
const dm = (d: Date, tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit' }).format(d).replace('/', '.');

/** «Xodimlar bo'yicha» (vazifalar): qator ochilsa — oxirgi 5 vazifa holati bilan. */
export function TasksTable({ rows, tz }: { rows: TaskRowData[]; tz: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const cols: Array<Col<TaskRowData>> = [
    { key: 'name', label: 'Xodim', get: (r) => r.name }, { key: 'dept', label: "Bo'lim", get: (r) => r.dept ?? '' },
    { key: 'given', label: 'Berilgan', get: (r) => r.given }, { key: 'done', label: 'Bajarildi', get: (r) => r.done },
    { key: 'onTime', label: "O'z vaqtida", get: (r) => r.onTimePct }, { key: 'late', label: 'Kechikdi', get: (r) => r.late },
    { key: 'returned', label: 'Qaytarildi', get: (r) => r.returned }, { key: 'rating', label: 'Baho', get: (r) => r.avgRating },
    { key: 'self', label: "O'zi qo'shgan", get: (r) => r.selfCount },
  ];
  const { sorted, head } = useSorted(rows, cols, 'onTime');
  const flip = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const star = (v: number | null, sz = 15) => (v == null ? dash : <span className="flex items-center gap-[3px] font-bold">{v.toFixed(1)}<Icon name="star" size={sz} fill className="text-[#F5B300]" /></span>);

  return (
    <TableCard title="Xodimlar bo'yicha">
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0 sm:hidden">
        {sorted.map((r) => (
          <li key={r.id}>
            <Link href={`/xodimlar/${r.id}?tab=vazifalar`} className="flex flex-col gap-2.5 rounded-[18px] border border-line-soft px-3.5 py-3">
              <span className="flex items-center gap-2.5">
                <Avatar name={r.name} size={36} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{r.name}</span><span className="block truncate text-xs text-muted">{r.dept ?? ''}</span></span>
                {star(r.avgRating)}
              </span>
              <Bar value={r.onTimePct} tone={r.onTimePct != null && r.onTimePct < 80 ? 'bg-warning' : 'bg-primary'} />
              <span className="flex flex-wrap gap-1.5">
                <span className="badge bg-subtle text-ink-2">Berilgan {r.given}</span>
                <span className="badge bg-warning-tint text-warning-text">Kechikdi {r.late}</span>
                {selfText(r) && <span className="badge bg-primary-tint text-primary">{selfText(r)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto max-sm:hidden">
        <div className="min-w-[980px] pb-1.5">
          <div className={`mt-3.5 grid ${TASK_GRID} gap-2.5 rounded-[10px] bg-[#FAFBFC] px-2 pt-3.5 pb-2.5 text-xs text-placeholder`}>{cols.map(head)}</div>
          {sorted.map((r) => {
            const on = open.has(r.id);
            return (
              <Fragment key={r.id}>
                <div className={`rounded-xl border-b border-[#F4F5F7] ${on ? 'bg-page' : ''}`}>
                  <button type="button" onClick={() => flip(r.id)} className={`grid w-full ${TASK_GRID} items-center gap-2.5 px-2 py-[11px] text-left text-[13px] hover:bg-page`} aria-expanded={on}>
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon name={on ? 'expand_more' : 'chevron_right'} size={18} className="text-placeholder" />
                      <Avatar name={r.name} size={32} /><b className="truncate font-bold">{r.name}</b>
                    </span>
                    <span className="truncate text-ink-2">{r.dept ?? '—'}</span>
                    <span className="tnum font-semibold">{r.given}</span>
                    <span className="tnum font-semibold">{r.done}</span>
                    <Bar value={r.onTimePct} width="w-[34px]" tone={r.onTimePct != null && r.onTimePct < 80 ? 'bg-warning' : 'bg-primary'} />
                    <span className="tnum font-bold text-warning">{r.late || dash}</span>
                    <span className="tnum font-bold text-danger">{r.returned || dash}</span>
                    {star(r.avgRating)}
                    <span className="text-ink-2">{selfText(r) ?? dash}</span>
                  </button>
                  {on && (
                    <div className="flex flex-col gap-1.5 pt-0.5 pr-2 pb-3.5 pl-[50px]">
                      {r.last.length === 0 && <span className="text-[13px] text-muted">Bu davrda berilgan vazifa yo&apos;q.</span>}
                      {r.last.map((t) => (
                        <Link key={t.id} href={`/vazifalar/${t.id}`} className="grid grid-cols-[minmax(0,1fr)_140px_110px_120px] items-center gap-3 rounded-xl border border-line bg-card px-3 py-[9px] text-[13px] hover:border-primary-line">
                          <span className="truncate font-semibold">{t.title}</span>
                          <span className="tnum text-muted">{dm(t.at, tz)} · {formatTime(t.at, tz)}</span>
                          <span className="flex items-center gap-[3px] font-bold">{t.rating ? `${t.rating}.0` : '—'}<Icon name="star" size={14} fill className={t.rating ? 'text-[#F5B300]' : 'text-[#E5E7EB]'} /></span>
                          <span className="justify-self-start"><StatusPill status={t.status} /></span>
                        </Link>
                      ))}
                      <Link href={`/xodimlar/${r.id}?tab=vazifalar`} className="mt-1 text-xs font-semibold text-primary">Ish jurnali →</Link>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </TableCard>
  );
}
