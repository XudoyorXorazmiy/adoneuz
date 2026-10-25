'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tgBreakAction } from '@/lib/actions/miniapp';
import { Icon } from '@/components/ui/icon';
import { haptic } from './webapp';

const dur = (m: number) => `${Math.floor(m / 60)} soat ${m % 60} daqiqa`;

/**
 * Bosh sahifadagi asosiy karta (dizayn): kelmagan — katta «Keldim» doirasi; ishda — o'tgan vaqt (har daqiqa yangilanadi),
 * smena tugashigacha qolgan vaqt, «Tanaffus» va «Ketdim».
 */
export function PresenceCard(p: {
  state: 'out' | 'in' | 'done'; since: string | null; worked: number; renderedAt: number; shiftStart: number | null; shiftEnd: number | null; onBreak: boolean; restDay: boolean; leaveToday?: boolean; doneText?: string;
}) {
  const [now, setNow] = useState(p.renderedAt);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (p.state !== 'in') {
    return (
      <div className="flex flex-col items-center gap-4 pt-2 pb-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-muted">
          <span className="size-1.5 rounded-full bg-placeholder" />
          {p.state === 'done' ? p.doneText : p.leaveToday ? 'Bugun ruxsatdasiz' : p.restDay ? 'Bugun dam olish kuningiz' : 'Hali kelmadingiz'}
        </span>
        <Link href="/tg/keldim" onClick={() => haptic('success')}
          className="flex size-[176px] items-center justify-center rounded-full bg-primary/10 transition active:scale-95">
          <span className="flex size-[148px] flex-col items-center justify-center gap-1 rounded-full bg-primary text-white shadow-[0_12px_32px_rgba(36,67,245,.35)]">
            <Icon name="where_to_vote" size={38} />
            <span className="text-[22px] font-extrabold">Keldim</span>
          </span>
        </Link>
        <span className="text-xs text-placeholder">Lokatsiya va selfi orqali tasdiqlanadi</span>
      </div>
    );
  }
  const live = p.onBreak ? p.worked : p.worked + Math.max(0, Math.floor((now - p.renderedAt) / 60_000));
  const total = p.shiftStart && p.shiftEnd ? p.shiftEnd - p.shiftStart : null;
  const left = p.shiftEnd ? Math.max(0, Math.round((p.shiftEnd - now) / 60_000)) : null;
  const pct = total ? Math.min(100, Math.max(3, ((now - p.shiftStart!) / total) * 100)) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 text-sm">
        <span className={`badge ${p.onBreak ? 'bg-warning-tint text-warning' : 'bg-success-tint text-success'}`}><span className="badge-dot" />{p.onBreak ? 'Tanaffusda' : 'Ishdasiz'}</span>
        {p.since && <span className="text-muted">{p.since} dan beri</span>}
      </div>
      <div className="tnum text-[34px] leading-10 font-extrabold tracking-[-0.03em]">{dur(live)}</div>
      {left != null && <div className="-mt-2 text-[13px] text-muted">{left > 0 ? `Smena tugashiga ${dur(left)}` : 'Smena vaqti tugadi — ketayotganda «Ketdim» bosing'}</div>}
      {pct != null && <div className="h-1.5 overflow-hidden rounded-full bg-primary-tint"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>}
      <div className="mt-1 grid grid-cols-2 gap-2.5">
        <button disabled={pending} onClick={() => start(async () => { const r = await tgBreakAction(); if (!r.ok) setErr(r.message ?? 'Xato'); else { haptic('success'); router.refresh(); } })}
          className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-subtle text-[15px] font-bold disabled:opacity-60">
          <Icon name={p.onBreak ? 'play_arrow' : 'coffee'} />{p.onBreak ? 'Davom etish' : 'Tanaffus'}
        </button>
        <Link href="/tg/keldim?ketdi=1" className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-navy text-[15px] font-bold text-white"><Icon name="logout" />Ketdim</Link>
      </div>
      {err && <p className="m-0 text-xs font-semibold text-danger">{err}</p>}
    </div>
  );
}
