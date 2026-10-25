'use client';
import { useEffect, useState } from 'react';
import { wordCubes } from './iso';

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

/** «TOSHKENT 09:12:44» — jonli soat (SSR'da bo'sh, gidratatsiyadan keyin to'ladi). */
export function TashkentClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>TOSHKENT {now ? clock.format(now) : '--:--:--'}</span>;
}

/** «TIZIM ISHLAYAPTI» — haqiqiy holat: /api/health javob vaqti (30 s da bir), javob bo'lmasa qizil. */
export function SystemStatus({ compact }: { compact?: boolean }) {
  const [ms, setMs] = useState<number | null>(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const t0 = performance.now();
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (!alive) return;
        setDown(!r.ok);
        setMs(Math.round(performance.now() - t0));
      } catch {
        if (alive) setDown(true);
      }
    };
    ping();
    const t = setInterval(ping, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const status = (
    <span className="flex items-center gap-2 l-label-sm lg:l-label text-l-ink">
      <span className={`size-1.5 ${down ? 'bg-l-danger' : 'bg-[#16A34A]'}`} />{down ? 'TIZIM JAVOB BERMAYAPTI' : 'TIZIM ISHLAYAPTI'}
    </span>
  );
  if (compact) return <>{status}<span className="flex-1" /><span className="l-label-sm text-l-body">TOSHKENT {ms ?? '—'} MS</span></>;
  return (
    <>
      {status}
      <div className="l-label-sm flex items-center gap-3 text-l-body">
        TOSHKENT
        <span className="relative h-1.5 w-[180px] bg-l-side"><span className="absolute inset-y-0 left-0 bg-l-ink transition-[width] duration-500" style={{ width: `${Math.min(100, Math.round(((ms ?? 0) / 300) * 100))}%` }} /></span>
        {ms ?? '—'} MS
      </div>
    </>
  );
}

/** Footer'dagi katta «adone» — izometrik kublardan; sichqoncha ostidagi ustun kublari ko'tariladi. */
export function CubeWordmark({ unit = 36 }: { unit?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const cubes = wordCubes();
  const u = unit, dx = u * 0.55, dy = u * 0.32, lift = u * 0.35;
  const W = 29 * u + dx + 2, H = 5 * u + dy + 2 + lift;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} onPointerLeave={() => setHover(null)} aria-label="adone">
      {cubes.map((q, k) => {
        const near = hover != null && Math.abs(q.col - hover) <= 1;
        const x = q.col * u + 1, y = q.r * u + dy + 1 + lift - (near ? lift * (hover === q.col ? 1 : 0.5) : 0);
        const f = q.acc || (hover === q.col) ? ['#2443F5', '#4353FF', '#1322C4'] : ['#FFFFFF', '#F0F0EE', '#DFDFDB'];
        return (
          <g key={k} stroke="#0B0B0D" strokeWidth={u < 20 ? 0.75 : 1} strokeLinejoin="round" onPointerEnter={() => setHover(q.col)} style={{ transition: 'transform .25s' }}>
            <polygon points={`${x},${y} ${x + dx},${y - dy} ${x + u + dx},${y - dy} ${x + u},${y}`} fill={f[1]} />
            <polygon points={`${x + u},${y} ${x + u + dx},${y - dy} ${x + u + dx},${y + u - dy} ${x + u},${y + u}`} fill={f[2]} />
            <rect x={x} y={y} width={u} height={u} fill={f[0]} />
          </g>
        );
      })}
    </svg>
  );
}
