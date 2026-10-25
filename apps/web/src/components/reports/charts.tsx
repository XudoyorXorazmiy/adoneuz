'use client';
import { useState } from 'react';
import { isoWeekday, WEEKDAY_LONG, weeklySeries, type DaySeries } from '@adone/core';
import { Icon } from '@/components/ui/icon';
import { Segmented } from './controls';

const SEGS = [
  { key: 'present', label: 'Ishda', color: 'bg-success', dot: '#16A34A' },
  { key: 'late', label: 'Kechikdi', color: 'bg-warning', dot: '#F07A1A' },
  { key: 'absent', label: 'Kelmadi', color: 'bg-danger', dot: '#E5484D' },
  { key: 'leave', label: 'Ruxsatda', color: 'bg-primary', dot: '#2443F5' },
  { key: 'off', label: 'Dam olish', color: 'bg-[#D5D9E0]', dot: '#D5D9E0' },
] as const;

const dm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;

/**
 * «Kunlar bo'yicha» (dizayn): har kun — yumaloq ustun, qatlamlar Ishda / Kechikdi / Kelmadi / Ruxsatda / Dam olish,
 * o'rtacha kelganlar chizig'i, ustun ustida tooltip. «Hafta» — haftalik jami (o'rtacha chiziqsiz).
 */
export function DaysChart({ series, headcount, avgCame }: { series: DaySeries[]; headcount: number; avgCame: number }) {
  const [mode, setMode] = useState<'kun' | 'hafta'>('kun');
  const [hover, setHover] = useState<number | null>(null);
  const weeks = mode === 'hafta' ? weeklySeries(series) : [];
  const bars = mode === 'hafta'
    ? weeks.map((w) => ({ ...w, title: `${w.label} · ${w.range}`, muted: false }))
    : series.map((s) => ({ ...s, label: String(Number(s.date.slice(8))), title: `${dm(s.date)} · ${WEEKDAY_LONG[isoWeekday(s.date) - 1]}`, muted: isoWeekday(s.date) === 7 }));
  const max = Math.max(1, ...bars.map((b) => b.present + b.late + b.absent + b.leave + b.off));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((k) => Math.round(max * k));
  const total = (k: (typeof SEGS)[number]['key']) => series.reduce((a, s) => a + s[k], 0);
  const avgPct = (avgCame / max) * 100;

  return (
    <section className="card px-6 py-5 max-sm:p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="card-icon max-sm:hidden"><Icon name="bar_chart" size={18} fill /></span>
        <h2 className="m-0 flex-1 text-base font-bold max-sm:text-sm">Kunlar bo&apos;yicha</h2>
        <span className="max-sm:hidden"><Segmented value={mode} onChange={(v) => setMode(v as 'kun' | 'hafta')} options={[['kun', 'Kun'], ['hafta', 'Hafta']]} /></span>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-3 max-sm:hidden">
        {SEGS.map((g) => (
          <span key={g.key} className="flex h-[26px] items-center gap-1.5 rounded-full bg-page px-2.5 text-xs font-semibold text-ink-2">
            <span className="size-2 rounded-full" style={{ background: g.dot }} />{g.label}
            {g.key !== 'present' && g.key !== 'off' && <b className="tnum font-bold text-ink">{total(g.key)}</b>}
          </span>
        ))}
      </div>
      <div className="mt-5 flex gap-2.5 max-sm:mt-2.5">
        <div className="tnum flex h-[230px] w-6 shrink-0 flex-col justify-between text-right text-[11px] text-placeholder max-sm:hidden">
          {ticks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-[230px] bg-[linear-gradient(#F1F2F5_1px,transparent_1px)] bg-[length:100%_25%] max-sm:h-[100px] max-sm:bg-none">
            {mode === 'kun' && avgCame > 0 && (
              <>
                <div className="absolute inset-x-0 z-[1] border-t-[1.5px] border-dashed border-navy opacity-50 max-sm:hidden" style={{ bottom: `${avgPct}%` }} />
                <div className="absolute right-0 z-[2] translate-y-[-4px] rounded-md bg-navy px-[7px] py-[3px] text-[10px] font-bold text-white max-sm:hidden" style={{ bottom: `${avgPct}%` }}>O&apos;rtacha {avgCame} kelgan</div>
              </>
            )}
            <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-2" onMouseLeave={() => setHover(null)}>
              {bars.map((b, i) => (
                <div key={b.date} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
                  <div className={`flex h-full w-full max-w-4 flex-col-reverse overflow-hidden rounded-full ${hover === i ? 'shadow-[0_0_0_3px_rgba(36,67,245,.25)]' : ''}`}>
                    {SEGS.map((g) => <div key={g.key} className={`shrink-0 ${g.color}`} style={{ height: `${(b[g.key] / max) * 100}%` }} />)}
                  </div>
                  {hover === i && (
                    <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-[3] flex -translate-x-1/2 flex-col gap-1 rounded-xl bg-navy px-3 py-2.5 text-xs whitespace-nowrap text-white shadow-[0_8px_20px_rgba(11,27,79,.25)] max-sm:hidden">
                      <b className="font-bold">{b.title}</b>
                      <span>Ishda {b.present} · Kechikdi {b.late} · Kelmadi {b.absent}</span>
                      {b.leave > 0 && <span className="text-[#A5B4FC]">Ruxsatda {b.leave}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-[3px] sm:gap-2 max-sm:hidden">
            {bars.map((b, i) => (
              <span key={b.date} className={`tnum flex-1 text-center text-[10px] ${hover === i ? 'font-extrabold text-primary' : b.muted ? 'text-[#C4C9D2]' : 'text-placeholder'}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
