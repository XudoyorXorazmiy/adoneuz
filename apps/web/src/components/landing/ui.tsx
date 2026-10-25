/**
 * Landing primitivlari (design/landing). O'lchovlar: desktop 1440 — ramka chiziqlari x=64/1376, kontent 107px dan;
 * lg — 32/64; telefon — 16/32 (Landing F). Hammasi server komponent (hook yo'q).
 */
import type { ReactNode } from 'react';

/** Kontent gorizontal chekinishi — ramka ichida 16 / 32 / 43 px. */
export const PAD_X = 'px-8 lg:px-16 xl:px-[107px]';
/** Ramka chizig'i qayerda (bo'lim yorlig'i va romblar shu bilan hizalanadi). */
const FRAME_L = 'left-4 lg:left-8 xl:left-16';
const FRAME_R = 'right-4 lg:right-8 xl:right-16';

/** Butun sahifa bo'ylab vertikal ramka chiziqlari + tiklar (har 120px). */
export function Guides({ dark }: { dark?: boolean }) {
  const line = dark ? 'bg-l-line-dark' : 'bg-l-line';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className={`absolute inset-y-0 w-px ${line} ${FRAME_L}`} />
      <div className={`absolute inset-y-0 w-px ${line} ${FRAME_R}`} />
      {!dark && (
        <>
          <div className="l-ticks absolute inset-y-0 left-[17px] w-1.5 lg:left-[33px] xl:left-[65px] xl:w-2" />
          <div className="l-ticks absolute inset-y-0 right-[17px] w-1.5 lg:right-[33px] xl:right-[65px] xl:w-2" />
        </>
      )}
    </div>
  );
}

function Diamond({ className }: { className: string }) {
  return (
    <svg width="12" height="7" viewBox="0 0 12 7" className={`absolute -top-[3px] ${className}`} aria-hidden>
      <polygon points="6,.5 11.5,3.5 6,6.5 .5,3.5" fill="#fff" stroke="#0B0B0D" />
    </svg>
  );
}

/** To'liq kenglikdagi bo'lim ajratkichi; ramka chizig'i bilan kesishgan joyda — bo'sh romb. */
export function Divider() {
  return (
    <div className="l-bleed h-px bg-l-line">
      <div className="relative mx-auto h-px max-w-[1440px]">
        <Diamond className="left-[11px] lg:left-[27px] xl:left-[59px]" />
        <Diamond className="right-[11px] lg:right-[27px] xl:right-[59px]" />
      </div>
    </div>
  );
}

/** Ramkaning yuqori-o'ng burchagidagi bo'lim raqami: «■ 02 TEKSHIRUV». */
export function SectionTag({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={`l-label-sm absolute top-0 flex items-center gap-1.5 border-b border-l px-2 py-[5px] lg:gap-2 lg:px-2.5 lg:py-1.5 ${FRAME_R} ${dark ? 'border-l-line-dark text-l-on-dark-2' : 'border-l-line text-l-body'}`}>
      <span className="size-1.5 bg-l-accent" />{children}
    </div>
  );
}

export function CubeIcon({ size = 12, dark }: { size?: number; dark?: boolean }) {
  return (
    <svg width={size} height={(size * 13) / 12} viewBox="0 0 12 13" aria-hidden className="shrink-0">
      <path d="M6 .5 11.5 3.5 6 6.5 .5 3.5Z" fill={dark ? '#1C1C20' : '#fff'} stroke={dark ? '#F3F3F1' : '#0B0B0D'} />
      <path d="M.5 3.5V9.5L6 12.5V6.5ZM11.5 3.5V9.5L6 12.5V6.5Z" fill={dark ? '#0B0B0D' : '#DFDFDB'} stroke={dark ? '#F3F3F1' : '#0B0B0D'} />
    </svg>
  );
}

/** Eyebrow: kub belgisi + mono yorliq (telefonda belgisiz, 10px). */
export function Eyebrow({ children, dark, className = '' }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 l-label-sm lg:l-label ${dark ? 'text-l-on-dark-2' : 'text-l-body'} ${className}`}>
      <span className="hidden lg:inline-flex"><CubeIcon dark={dark} /></span>{children}
    </div>
  );
}

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 24) / 22} viewBox="0 0 22 24" aria-hidden className="shrink-0">
      <path d="M11 1 21 6.5 11 12 1 6.5Z" fill="#2443F5" stroke="#0B0B0D" />
      <path d="M1 6.5V17.5L11 23V12Z" fill="#F0F0EE" stroke="#0B0B0D" />
      <path d="M21 6.5V17.5L11 23V12Z" fill="#DFDFDB" stroke="#0B0B0D" />
    </svg>
  );
}
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-l-serif text-[22px] font-[380] tracking-[-0.72px] lg:text-2xl ${className}`}>adone</span>;
}

/** Sarlavha: birinchi gap — ink, qolgani — kulrang (Tessel usuli). */
export function H2({ lead, rest, dark, className = '' }: { lead: string; rest: string; dark?: boolean; className?: string }) {
  return (
    <h2 className={`m-0 font-l-serif text-[36px] leading-[36px] font-[360] tracking-[-0.03em] lg:text-[56px] lg:leading-[56px] xl:text-[66px] xl:leading-[66px] ${dark ? 'text-l-on-dark' : ''} ${className}`}>
      {lead} <span className="text-l-muted">{rest}</span>
    </h2>
  );
}

/** Bo'lim sarlavhasi: chapda eyebrow, o'ngda H2 (511 / 715). */
export function SectionHead({ eyebrow, lead, rest, dark, children }: { eyebrow: string; lead: string; rest: string; dark?: boolean; children?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[511fr_715fr] lg:gap-0">
      <Eyebrow dark={dark} className="self-start lg:pt-3.5">{eyebrow}</Eyebrow>
      <div className="flex flex-col gap-7">
        <H2 lead={lead} rest={rest} dark={dark} />
        {children}
      </div>
    </div>
  );
}

/**
 * 3D blok tugma: o'ng (skewY 45°) va past (skewX 45°) 7px tomonlar; hover — «bosiladi» (5px siljiydi).
 * `full` — telefondagi kabi to'liq kenglik.
 */
export function Btn3d({ href, children, variant = 'primary', full, type, className = '' }: {
  href?: string; children: ReactNode; variant?: 'primary' | 'secondary'; full?: boolean; type?: 'submit' | 'button'; className?: string;
}) {
  const p = variant === 'primary';
  const inner = (
    <>
      <span aria-hidden className={`absolute top-0 left-full h-full w-[7px] origin-top-left skew-y-[45deg] ${p ? 'bg-l-accent-side' : 'bg-l-side-2'}`} />
      <span aria-hidden className={`absolute top-full left-0 h-[7px] w-full origin-top-left skew-x-[45deg] ${p ? 'bg-l-accent' : 'bg-l-side'}`} />
      <span className={`relative flex h-11 flex-1 items-center justify-center gap-2 border border-l-ink px-[18px] text-[15px] font-medium tracking-[-0.15px] whitespace-nowrap transition-transform duration-300 ease-[cubic-bezier(.2,.7,.1,1)] group-hover:translate-x-[5px] group-hover:translate-y-[5px] group-active:translate-x-[6px] group-active:translate-y-[6px] ${p ? 'bg-l-ink text-white' : 'bg-white text-l-ink'}`}>{children}</span>
    </>
  );
  const cls = `group relative ${full ? 'flex w-[calc(100%-7px)]' : 'inline-flex'} h-11 mr-[7px] mb-[7px] font-l-sans hover:text-inherit ${className}`;
  if (href) return <a href={href} className={cls}>{inner}</a>;
  return <button type={type ?? 'button'} className={`${cls} cursor-pointer border-0 bg-transparent p-0 disabled:opacity-60`}>{inner}</button>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="l-label flex h-[26px] items-center border border-l-line px-2 whitespace-nowrap text-l-body">{children}</span>;
}

/** Bo'lim konteyneri: ajratkich + yorliq + ichki chekinish. */
export function Section({ id, tag, children, dark, className = '', divider = true }: { id?: string; tag?: string; children: ReactNode; dark?: boolean; className?: string; divider?: boolean }) {
  const body = (
    <section id={id} className={`relative scroll-mt-4 ${PAD_X} ${dark ? 'text-l-on-dark' : ''} ${className}`}>
      {dark && <Guides dark />}
      {tag && <SectionTag dark={dark}>{tag}</SectionTag>}
      {children}
    </section>
  );
  // Qora band chetdan chetga, ramka va kontent — 1440 markazda
  if (dark) return <div className="l-bleed bg-l-ink"><div className="mx-auto max-w-[1440px]">{body}</div></div>;
  return <>{divider && <Divider />}{body}</>;
}
