/**
 * Izometrik (30°) chizmalar — design/landing/iso.js ning 1:1 ko'chirmasi. Sof funksiya (hook yo'q):
 * server komponentda ham, client komponentda ham (bosiladigan katak — `on`) ishlatiladi.
 */
import type { ReactNode } from 'react';

const C = {
  white: ['#FFFFFF', '#F0F0EE', '#DFDFDB', '#0B0B0D'],
  gray: ['#F0F0EE', '#DFDFDB', '#CFCFCA', '#0B0B0D'],
  accent: ['#4353FF', '#2443F5', '#1322C4', '#0B0B0D'],
  dark: ['#1C1C20', '#0B0B0D', '#141417', 'rgba(243,243,241,.45)'],
  ghost: ['rgba(255,255,255,.6)', 'rgba(240,240,238,.6)', 'rgba(223,223,219,.6)', 'rgba(11,11,13,.25)'],
} as const;
type Tone = keyof typeof C;
const K = 0.8660254;

export interface IsoBox { x: number; y: number; z?: number; w: number; d: number; h: number; c?: Tone; stroke?: string | null; sw?: number; top?: string | null; left?: string; right?: string; topStroke?: string; dash?: string; op?: number; dz?: number; on?: (() => void) | null }
export interface IsoFloor { x: number; y: number; z?: number; w: number; d: number; h?: number; top?: string; stroke?: string; on?: (() => void) | null; c?: Tone; dz?: number }
export interface IsoCyl { cx: number; cy: number; z?: number; r: number; h: number; c?: Tone; dz?: number }
export interface IsoRing { cx: number; cy: number; z?: number; r: number; color?: string; sw?: number; fill?: string; dash?: string | false }
export interface IsoLine { pts: Array<[number, number, number]>; color?: string; sw?: number; dash?: string }
export interface IsoLabel { x: number; y: number; z?: number; t: string; dx?: number; dy?: number; color?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number }
export interface IsoScene {
  w: number; h: number; s?: number; ox?: number; oy?: number;
  floor?: IsoFloor[]; rings?: IsoRing[]; lines?: IsoLine[]; boxes?: IsoBox[]; cyls?: IsoCyl[]; labels?: IsoLabel[];
  className?: string;
}

export function isoSvg(o: IsoScene): ReactNode {
  const s = o.s ?? 20, ox = o.ox ?? 0, oy = o.oy ?? 0;
  const P = (x: number, y: number, z: number): [number, number] => [ox + (x - y) * K * s, oy + (x + y) * 0.5 * s - z * s];
  const pts = (a: Array<[number, number, number]>) => a.map((p) => P(p[0], p[1], p[2]).map((n) => n.toFixed(1)).join(',')).join(' ');
  const out: ReactNode[] = [];
  let k = 0;

  for (const b of [...(o.floor ?? [])].sort((a, c) => a.x + a.y - (c.x + c.y))) {
    const { x, y, w, d } = b, z = b.z ?? 0, H = b.h ?? 0, st = b.stroke ?? '#0B0B0D';
    out.push(
      <g key={k++} onClick={b.on ?? undefined} style={b.on ? { cursor: 'pointer' } : undefined}>
        <polygon points={pts([[x + w, y, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x + w, y, z]])} fill="#DFDFDB" stroke={st} strokeWidth={1} />
        <polygon points={pts([[x, y + d, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x, y + d, z]])} fill="#F0F0EE" stroke={st} strokeWidth={1} />
        <polygon points={pts([[x, y, z + H], [x + w, y, z + H], [x + w, y + d, z + H], [x, y + d, z + H]])} fill={b.top ?? '#FFFFFF'} stroke={st} strokeWidth={1} />
      </g>,
    );
  }
  for (const r of o.rings ?? []) {
    const c = P(r.cx, r.cy, r.z ?? 0);
    out.push(<ellipse key={k++} cx={c[0]} cy={c[1]} rx={r.r * s * 1.2247} ry={r.r * s * 0.7071} fill={r.fill ?? 'none'} stroke={r.color ?? '#2443F5'} strokeWidth={r.sw ?? 1.5} strokeDasharray={r.dash === false ? undefined : (r.dash ?? '5 4')} />);
  }
  for (const l of o.lines ?? []) out.push(<polyline key={k++} points={pts(l.pts)} fill="none" stroke={l.color ?? '#0B0B0D'} strokeWidth={l.sw ?? 1} strokeDasharray={l.dash} />);

  type Item = { t: 'b'; b: IsoBox; d: number } | { t: 'c'; c: IsoCyl; d: number };
  const items: Item[] = [
    ...(o.boxes ?? []).map((b): Item => ({ t: 'b', b, d: b.x + b.w / 2 + b.y + b.d / 2 + (b.z ?? 0) * 0.5 + (b.dz ?? 0) })),
    ...(o.cyls ?? []).map((c): Item => ({ t: 'c', c, d: c.cx + c.cy + (c.z ?? 0) * 0.5 + (c.dz ?? 0) })),
  ].sort((a, b) => a.d - b.d);
  for (const it of items) {
    if (it.t === 'b') {
      const { x, y, w, d, h: H } = it.b, z = it.b.z ?? 0, col = C[it.b.c ?? 'white'];
      const st = it.b.stroke ?? col[3], sw = it.b.sw ?? 1;
      out.push(
        <g key={k++} opacity={it.b.op ?? 1} onClick={it.b.on ?? undefined} style={it.b.on ? { cursor: 'pointer' } : undefined}>
          <polygon points={pts([[x + w, y, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x + w, y, z]])} fill={it.b.right ?? col[2]} stroke={st} strokeWidth={sw} strokeLinejoin="round" />
          <polygon points={pts([[x, y + d, z + H], [x + w, y + d, z + H], [x + w, y + d, z], [x, y + d, z]])} fill={it.b.left ?? col[1]} stroke={st} strokeWidth={sw} strokeLinejoin="round" />
          <polygon points={pts([[x, y, z + H], [x + w, y, z + H], [x + w, y + d, z + H], [x, y + d, z + H]])} fill={it.b.top ?? col[0]} stroke={it.b.topStroke ?? st} strokeWidth={sw} strokeLinejoin="round" strokeDasharray={it.b.dash} />
        </g>,
      );
    } else {
      const c = it.c, col = C[c.c ?? 'white'], z = c.z ?? 0;
      const b = P(c.cx, c.cy, z), t = P(c.cx, c.cy, z + c.h), rx = c.r * s * 1.2247, ry = c.r * s * 0.7071;
      out.push(
        <g key={k++}>
          <path d={`M${b[0] - rx},${t[1]} L${b[0] - rx},${b[1]} A${rx},${ry} 0 0 0 ${b[0] + rx},${b[1]} L${b[0] + rx},${t[1]} Z`} fill={col[1]} stroke={col[3]} strokeWidth={1} />
          <ellipse cx={t[0]} cy={t[1]} rx={rx} ry={ry} fill={col[0]} stroke={col[3]} strokeWidth={1} />
        </g>,
      );
    }
  }
  for (const l of o.labels ?? []) {
    const p = P(l.x, l.y, l.z ?? 0);
    out.push(
      <text key={k++} x={p[0] + (l.dx ?? 0)} y={p[1] + (l.dy ?? 0)} fill={l.color ?? '#47474E'} fontSize={l.size ?? 9} fontFamily="var(--font-martian), monospace" letterSpacing="0.04em" textAnchor={l.anchor ?? 'start'} fontWeight={l.weight ?? 400}>{l.t}</text>,
    );
  }
  return (
    <svg width={o.w} height={o.h} viewBox={`0 0 ${o.w} ${o.h}`} className={o.className} style={{ display: 'block', overflow: 'visible', maxWidth: '100%', height: 'auto' }} aria-hidden>
      {out}
    </svg>
  );
}

/** 5×5 piksel shrift «adone» uchun (footer so'z belgisi). */
const FONT: Record<string, string[]> = {
  a: ['01110', '00001', '01111', '10001', '01111'],
  d: ['00001', '00001', '01111', '10001', '01111'],
  o: ['00000', '01110', '10001', '10001', '01110'],
  n: ['00000', '11110', '10001', '10001', '10001'],
  e: ['01110', '10001', '11111', '10000', '01111'],
};

export interface WordCube { col: number; r: number; acc: boolean }
/** «adone» kublari (orqadan oldinga tartiblangan). Accent — «a» harfining o'ng o'rtasi. */
export function wordCubes(text = 'adone'): WordCube[] {
  const cubes: WordCube[] = [];
  text.split('').forEach((ch, ci) => FONT[ch]!.forEach((row, r) => row.split('').forEach((v, c) => {
    if (v === '1') cubes.push({ col: ci * 6 + c, r, acc: ci === 0 && r === 2 && c === 4 });
  })));
  return cubes.sort((a, b) => b.r - a.r || a.col - b.col);
}
