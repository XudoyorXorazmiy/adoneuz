'use client';
import { useState } from 'react';
import { isoSvg, type IsoBox, type IsoFloor, type IsoLabel } from './iso';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 10 Sinab ko'ring: 8×8 izometrik maydon, o'rtada do'kon va filial radiusi (kesik accent doira). Katakni bosish — xodim
 * shu joydan «Keldim» bosdi: doira ichida accent ✓, tashqarida kulrang ✕. Telefonda 6×6 (Landing F).
 */
export function GeofenceBoard({ compact }: { compact?: boolean }) {
  const N = compact ? 6 : 8, R = compact ? 2.1 : 2.7, c = N / 2;
  const [placed, setPlaced] = useState<Array<[number, number]>>(compact ? [[1, 1], [4, 2], [5, 5]] : [[2, 2], [5, 3], [3, 5], [7, 1]]);
  const inside = (i: number, j: number) => Math.hypot(i + 0.5 - c, j + 0.5 - c) <= R;
  const shop = (i: number, j: number) => i >= c - 1 && i <= c && j >= c - 1 && j <= c;
  const toggle = (i: number, j: number) => setPlaced((p) => (p.some((q) => q[0] === i && q[1] === j) ? p.filter((q) => !(q[0] === i && q[1] === j)) : [...p, [i, j]]));
  const tiles: IsoFloor[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) tiles.push({ x: i, y: j, z: 0, w: 1, d: 1, h: 0.12, stroke: 'rgba(11,11,13,.35)', on: shop(i, j) ? null : () => toggle(i, j) });
  const people: IsoBox[] = placed.map(([i, j]) => ({ x: i + 0.28, y: j + 0.28, z: 0.12, w: 0.44, d: 0.44, h: 0.9, c: inside(i, j) ? 'accent' : 'gray', dz: 0.5, on: () => toggle(i, j) }));
  const marks: IsoLabel[] = placed.map(([i, j]) => ({ x: i + 0.5, y: j + 0.5, z: 1.4, t: inside(i, j) ? '✓' : '✕', anchor: 'middle', size: compact ? 12 : 14, color: inside(i, j) ? '#2443F5' : '#47474E', weight: 500 }));
  const sw = compact ? 1.4 : 1.6;
  const board = isoSvg({
    w: compact ? 310 : 600, h: compact ? 230 : 400, s: compact ? 25 : 36, ox: compact ? 155 : 300, oy: compact ? 40 : 60,
    floor: tiles,
    rings: [{ cx: c, cy: c, z: 0.12, r: R, sw: 2 }],
    boxes: [...people, { x: c - sw / 2, y: c - sw / 2, z: 0.12, w: sw, d: sw, h: compact ? 1.1 : 1.3, c: 'white', dz: 0.6 }, ...(compact ? [] : [{ x: c - 0.95, y: c - 0.95, z: 1.42, w: 1.9, d: 1.9, h: 0.22, c: 'gray' as const, dz: 0.7 }])],
    labels: marks,
  });
  const ok = placed.filter(([i, j]) => inside(i, j)).length;
  return (
    <div className="l-iso-grid flex flex-col border border-l-line lg:h-[507px]">
      <div className="l-label-sm lg:l-label flex items-center justify-between border-b border-l-line bg-white px-2.5 py-2 text-l-body lg:px-3.5 lg:py-3">
        <span aria-live="polite">QABUL <span className="text-l-accent">{pad(ok)}</span> · RAD <span className="text-l-accent">{pad(placed.length - ok)}</span></span>
        <button type="button" onClick={() => setPlaced([])} className="flex h-7 cursor-pointer items-center border border-l-line-strong bg-white px-2 text-l-ink hover:border-l-accent hover:text-l-accent lg:h-[26px] lg:px-2.5">TOZALASH</button>
      </div>
      <div className="flex flex-1 items-center justify-center py-2.5 select-none">{board}</div>
      <div className="l-label-sm hidden px-3.5 pb-3 text-l-muted lg:block">KATAKNI BOSING · DOIRA = FILIAL RADIUSI 100 M</div>
    </div>
  );
}
