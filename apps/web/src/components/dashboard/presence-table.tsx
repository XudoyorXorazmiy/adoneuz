'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

export interface PresenceRow {
  id: string;
  name: string;
  position: string;
  branch: string;
  inAt: string;
  worked: string;
  late: number;
  suspicious: boolean;
  locOk: boolean;
  hasVideo: boolean;
  face: number | null;
}

/** «Hozir ishda» jadvali (dizayn: Bosh sahifa). Qidiruv — shu ro'yxat ichida. */
export function PresenceTable({ rows, total }: { rows: PresenceRow[]; total: number }) {
  const [q, setQ] = useState('');
  const shown = rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const cols = 'grid-cols-[minmax(160px,1.6fr)_0.9fr_0.9fr_0.6fr_0.6fr_1fr_1.1fr]';
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-[38px] w-[220px] items-center gap-2 rounded-xl border border-line px-3 text-[13px] text-placeholder">
          <Icon name="search" size={18} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Xodimni qidirish…" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-placeholder" />
        </label>
        <Link href="/davomat?holat=inside" className="btn-secondary h-[38px] px-3.5"><Icon name="tune" size={18} />Filtrlar</Link>
      </div>
      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <div className="min-w-[760px]">
          <div className={`grid ${cols} gap-3 border-b border-line-soft px-1 pb-2.5 text-xs font-medium text-placeholder`}>
            <span>Xodim</span><span>Lavozim</span><span>Filial</span><span>Keldi</span><span>Ishladi</span><span>Isbot</span><span>Holat</span>
          </div>
          {shown.length === 0 ? (
            <p className="m-0 py-8 text-center text-[13px] text-muted">{rows.length === 0 ? 'Hozircha hech kim kirmagan.' : 'Topilmadi.'}</p>
          ) : (
            shown.map((r) => (
              <div key={r.id} className={`grid ${cols} items-center gap-3 border-b border-[#F4F5F7] px-1 py-3 text-[13px]`}>
                <span className="flex min-w-0 items-center gap-2.5"><Avatar name={r.name} /><b className="truncate font-bold">{r.name}</b></span>
                <span className="truncate text-muted">{r.position}</span>
                <span className="truncate text-muted">{r.branch}</span>
                <span className={`tnum font-semibold ${r.late ? 'text-warning' : ''}`}>{r.inAt}</span>
                <span className="tnum font-semibold">{r.worked}</span>
                <span className="flex items-center gap-2">
                  <Icon name="location_on" fill size={17} className={r.locOk ? 'text-success' : 'text-warning'} />
                  <Icon name="videocam" fill size={17} className={r.hasVideo ? 'text-success' : 'text-line-strong'} />
                  <span className={`flex items-center gap-0.5 text-xs font-bold ${r.face == null ? 'text-placeholder' : r.face >= 80 ? 'text-success' : 'text-warning'}`}>
                    <Icon name="face" size={17} />{r.face == null ? '—' : `${r.face}%`}
                  </span>
                </span>
                <span>
                  {r.suspicious ? (
                    <span className="badge border-[1.5px] border-warning pl-1.5 text-warning-text"><Icon name="warning" size={15} />Shubhali</span>
                  ) : r.late ? (
                    <span className="badge bg-warning-tint pl-1.5 text-warning"><Icon name="hourglass_top" fill size={15} />Kechikdi · {r.late} daq</span>
                  ) : (
                    <span className="badge bg-success-tint pl-1.5 text-success"><Icon name="check_circle" fill size={15} />Ishda</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-1 py-3.5 text-[13px] text-muted">
        <span className="tnum">{shown.length} / {total} ko&apos;rsatilmoqda</span>
        <Link href="/davomat?holat=inside" className="flex items-center gap-1 font-bold text-primary hover:text-primary-hover">Hammasini ko&apos;rish<Icon name="arrow_outward" size={16} /></Link>
      </div>
    </>
  );
}
