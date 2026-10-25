/** Landing izometrik sahnalari — design/landing/*.dc.html dagi konfiguratsiyalar 1:1. */
import { isoSvg, type IsoBox, type IsoLabel } from './iso';

/** Hero: 4 plastina (tekshiruv qatlamlari) + do'kon; `open` — kursor yaqinida qatlamlar ajraladi. */
export function heroArt(open: boolean) {
  const names = ['01 GPS', '02 SELFI', '03 YUZ', '04 QURILMA'];
  const gap = open ? 1.9 : 0.75;
  const top = 3 * gap + 0.55;
  const plates: IsoBox[] = [0, 1, 2, 3].map((i) => ({ x: 0, y: 0, z: i * gap, w: 6, d: 6, h: 0.55, c: 'white' }));
  const labels: IsoLabel[] = open
    ? names.map((t, i) => ({ x: 6, y: 0, z: i * gap + 0.2, t, dx: 12, size: 10, color: i === 2 ? '#2443F5' : '#47474E' }))
    : [{ x: 9, y: 3, z: 0, t: 'GEOFENCE · 100 M', dx: 6, color: '#2443F5' }, { x: 6, y: 0, z: 2.2, t: '4 TEKSHIRUV', dx: 10 }];
  return isoSvg({
    w: 560, h: 440, s: 26, ox: 280, oy: open ? 230 : 170,
    rings: [{ cx: 3, cy: 3, z: 0, r: 5.6 }],
    boxes: [
      ...plates.map((p, i) => (open && i === 2 ? { ...p, stroke: '#2443F5', sw: 1.6, top: '#EEF0FF' } : p)),
      { x: 1.5, y: 1.5, z: top + 0.05, w: 3, d: 3, h: 1.8, c: 'white' },
      { x: 1.3, y: 1.3, z: top + 1.85, w: 3.4, d: 3.4, h: 0.3, c: 'gray' },
      { x: 2.6, y: 4.49, z: top + 0.05, w: 0.9, d: 0.01, h: 1.1, c: 'gray' },
    ],
    labels,
  });
}

/** 02 Tekshiruv: ajratilgan stek, `active` qatlam accent. */
export function stackArt(active: number) {
  const names = ['01 GPS', '02 SELFI', '03 YUZ', '04 QURILMA'];
  return isoSvg({
    w: 420, h: 470, s: 24, ox: 200, oy: 300,
    rings: [{ cx: 3, cy: 3, z: 0, r: 5, color: 'rgba(11,11,13,.35)' }],
    boxes: [0, 1, 2, 3].map((i) => ({ x: 0, y: 0, z: i * 2.3, w: 6, d: 6, h: 0.6, c: i === active ? 'accent' : 'white' })),
    labels: [0, 1, 2, 3].map((i) => ({ x: 6, y: 0, z: i * 2.3 + 0.3, t: names[i]!, dx: 14, size: 10, color: i === active ? '#2443F5' : '#47474E' })),
  });
}

/** 03 Imkoniyatlar — 6 katak chizmasi. */
export function featureArts() {
  const sv = (o: Omit<Parameters<typeof isoSvg>[0], 'w' | 'h'>) => isoSvg({ w: 380, h: 250, ...o });
  return [
    sv({
      s: 22, ox: 110, oy: 120,
      boxes: [0, 1, 2, 3, 4, 5].flatMap((i): IsoBox[] => [
        { x: i * 1.7, y: 0, z: 0, w: 1, d: 1, h: 1.6, c: i === 3 ? 'accent' : 'white' },
        { x: i * 1.7 + 0.2, y: 0.2, z: 1.6, w: 0.6, d: 0.6, h: 0.6, c: i === 3 ? 'accent' : 'white' },
      ]),
      labels: [{ x: 5.1, y: 0, z: 2.6, t: 'KECHIKDI · 7 DAQ', dx: -6, dy: -8, color: '#2443F5', size: 9 }],
    }),
    sv({
      s: 27, ox: 160, oy: 60,
      boxes: [{ x: 0, y: 0, z: 0, w: 6, d: 4.5, h: 0.4, c: 'white' }, ...[0, 1, 2].flatMap((r): IsoBox[] => [
        { x: 0.6, y: 0.6 + r * 1.3, z: 0.4, w: 0.7, d: 0.7, h: 0.3, c: r === 0 ? 'accent' : 'gray' },
        { x: 1.7, y: 0.75 + r * 1.3, z: 0.4, w: 3.6, d: 0.4, h: 0.1, c: 'gray' },
      ])],
      labels: [{ x: 6, y: 0, z: 0.4, t: 'ISBOT · RASM', dx: 8 }],
    }),
    sv({
      s: 25, ox: 140, oy: 110,
      boxes: [0, 1, 2, 3].map((i) => ({ x: i * 0.5, y: 0, z: i * 0.7, w: 5, d: 3, h: 0.35, c: i === 3 ? 'accent' : 'white' })),
      labels: [{ x: 6.5, y: 0, z: 2.3, t: '1 SOAT 30 DAQ', dx: 8, color: '#2443F5' }, { x: 5, y: 0, z: 0.2, t: '10:15', dx: 8 }],
    }),
    sv({
      s: 25, ox: 185, oy: 40,
      boxes: [
        { x: 0, y: 0, z: 0, w: 5.4, d: 5.4, h: 0.6, c: 'white' }, { x: 0, y: 0, z: 0.6, w: 5.4, d: 1, h: 0.6, c: 'gray' },
        ...Array.from({ length: 16 }, (_, k): IsoBox => ({ x: 0.3 + (k % 4) * 1.25, y: 1.3 + Math.floor(k / 4), z: 0.6, w: 0.95, d: 0.75, h: 0.15, c: k === 9 ? 'accent' : 'white' })),
      ],
      labels: [{ x: 5.4, y: 3, z: 0.8, t: "21.10 · TA'TIL", dx: 10, color: '#2443F5' }],
    }),
    sv({
      s: 22, ox: 165, oy: 40,
      boxes: Array.from({ length: 35 }, (_, k): IsoBox => {
        const x = k % 7, y = Math.floor(k / 7);
        return { x: x * 1.05, y: y * 1.05, z: 0, w: 0.85, d: 0.85, h: k === 19 ? 1.1 : x === 6 ? 0.1 : 0.3 + ((k * 7) % 4) * 0.08, c: k === 19 ? 'accent' : x === 6 ? 'gray' : 'white' };
      }),
      labels: [{ x: 7.4, y: 0, z: 0, t: 'EXCEL ↗', dx: 6 }],
    }),
    sv({
      s: 25, ox: 160, oy: 100,
      cyls: [
        ...[0, 1, 2, 3, 4].map((i) => ({ cx: 0, cy: 2, z: i * 0.35, r: 1, h: 0.3 })),
        ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ cx: 2.6, cy: 2, z: i * 0.35, r: 1, h: 0.3, c: i === 6 ? ('accent' as const) : ('white' as const) })),
        ...[0, 1, 2].map((i) => ({ cx: 1.3, cy: 4.4, z: i * 0.35, r: 1, h: 0.3 })),
      ],
      labels: [{ x: 3.6, y: 1.4, z: 2.6, t: '+20 000 BONUS', dx: 8, color: '#2443F5' }, { x: 2.3, y: 5, z: 0.4, t: '−10 000', dx: 10 }],
    }),
  ];
}

/** 05 Bir kun — ertalabki kelganlar (namuna). */
export function arrivalsChart() {
  const v = [1, 1, 2, 3, 4, 6, 9, 14, 27, 5, 2, 1];
  const times = ['07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45'];
  return isoSvg({
    w: 640, h: 420, s: 24, ox: 120, oy: 170,
    boxes: v.map((n, i) => ({ x: i * 1.35, y: 0, z: 0, w: 0.9, d: 0.9, h: Math.max(0.15, n * 0.24), c: i === 8 ? 'accent' : 'dark', stroke: i === 8 ? '#F3F3F1' : null })),
    lines: [{ pts: [[-0.4, 1.3, 0], [16.2, 1.3, 0]], color: 'rgba(243,243,241,.25)' }],
    labels: [
      ...v.flatMap((_, i): IsoLabel[] => (i % 2 === 0 || i === 8 ? [{ x: i * 1.35 + 0.45, y: 1.6, z: 0, t: times[i]!, dx: -14, dy: 14, size: 8, color: i === 8 ? '#4353FF' : '#8D8D95' }] : [])),
      { x: 8 * 1.35 + 0.45, y: 0.45, z: 27 * 0.24 + 0.4, t: '27', dx: -8, dy: -6, size: 13, color: '#4353FF', weight: 500 },
    ],
  });
}

/** 06 Tayyor sozlamalar — «blok shaharcha». */
export function townArt(acc: number, hs: number[]) {
  return isoSvg({
    w: 280, h: 270, s: 22, ox: 140, oy: 70,
    boxes: [{ x: 0, y: 0, z: 0, w: 6, d: 6, h: 0.3, c: 'white' }, ...hs.map((h, k): IsoBox => ({ x: 0.4 + (k % 3) * 1.9, y: 0.4 + Math.floor(k / 3) * 1.9, z: 0.3, w: 1.4, d: 1.4, h, c: k === acc ? 'accent' : 'white' }))],
  });
}
export const TOWNS: Array<[number, number[]]> = [
  [4, [1, 2.2, 0.8, 1.4, 3, 1.2, 0.6, 1.6, 1]],
  [2, [1.2, 1.2, 2.4, 0.8, 1.6, 1.6, 1, 0.6, 1.2]],
  [6, [0.8, 1.8, 1, 2.6, 1.2, 0.8, 2, 1, 1.4]],
  [1, [0.6, 2.8, 0.8, 1, 1.2, 1.8, 0.9, 1.4, 0.7]],
];
