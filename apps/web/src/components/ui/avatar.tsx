import { initials } from '@adone/core';

/** Dizayndagi avatar ranglari (fon, matn) — ismga qarab barqaror tanlanadi. */
const PALETTE: Array<[string, string]> = [
  ['#EEF1FF', '#2443F5'], ['#E8F7EE', '#15803D'], ['#FCE7F3', '#9D174D'], ['#FEF3C7', '#92400E'],
  ['#E0F2FE', '#0369A1'], ['#EDE9FE', '#6D28D9'], ['#FDE7D3', '#9A4B12'],
];

export function avatarColors(name: string): [string, string] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function Avatar({ name, size = 32, online, className = '' }: { name: string; size?: number; online?: boolean; className?: string }) {
  const [bg, fg] = avatarColors(name);
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-full font-bold ${className}`} style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}>
      {initials(name)}
      {online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-white bg-success" />}
    </span>
  );
}
