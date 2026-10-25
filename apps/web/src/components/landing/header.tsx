'use client';
import { useState } from 'react';
import { MENU, NAV } from '@/lib/landing/content';
import { Btn3d, LogoMark, Wordmark } from './ui';

/**
 * Header (design A / F): 65px, oq 82% + blur, sticky emas. Desktop — «Imkoniyatlar» ostida dropdown (hover/fokus,
 * accent yon tomonlar); telefon — 38px kvadrat tugma, menyu header ichida ochilib sahifani pastga suradi.
 */
export function LandingHeader({ loginHref, startHref }: { loginHref: string; startHref: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="l-bleed relative z-30 border-b border-l-line bg-white/82 backdrop-blur-[14px]">
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between px-8 lg:h-[65px] lg:px-16 xl:px-[107px]">
        <a href="#" className="flex items-center gap-2 lg:gap-2.5" aria-label="adone — bosh sahifa">
          <LogoMark size={20} /><Wordmark />
        </a>
        <nav className="hidden flex-1 justify-center gap-1 text-sm font-medium text-l-body lg:flex">
          {NAV.map((n) => 'menu' in n ? (
            <div key={n.href} className="group/m relative">
              <a href={n.href} className="flex h-[34px] items-center gap-1.5 px-3 transition-colors group-hover/m:bg-l-accent-tint group-hover/m:text-l-accent group-focus-within/m:bg-l-accent-tint group-focus-within/m:text-l-accent">
                {n.label}
                <svg width="9" height="6" viewBox="0 0 9 6" className="rotate-180 transition-transform group-hover/m:rotate-0" aria-hidden><path d="M1 5 4.5 1.5 8 5" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
              </a>
              <div className="invisible absolute top-[calc(100%-1px)] left-1/2 w-[360px] -translate-x-1/2 pt-2 opacity-0 transition-opacity group-focus-within/m:visible group-focus-within/m:opacity-100 group-hover/m:visible group-hover/m:opacity-100">
                <div className="relative border border-l-ink bg-white">
                  <div aria-hidden className="absolute -top-px left-full h-[calc(100%+2px)] w-2 origin-top-left skew-y-[45deg] bg-l-accent-side" />
                  <div aria-hidden className="absolute top-full -left-px h-2 w-[calc(100%+2px)] origin-top-left skew-x-[45deg] bg-l-accent" />
                  {MENU.map((m) => (
                    <a key={m.n} href={m.href} className="group/i relative flex items-center gap-3.5 border-b border-l-line px-4 py-3.5 last:border-b-0 hover:bg-l-accent-tint">
                      <span className="flex size-8 items-center justify-center border border-l-line-strong font-l-mono text-[10px] text-l-ink group-hover/i:border-l-accent group-hover/i:text-l-accent">{m.n}</span>
                      <span><span className="block text-[15px] font-medium text-l-ink group-hover/i:text-l-accent">{m.t}</span><span className="mt-0.5 block text-[13px] text-l-muted">{m.d}</span></span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <a key={n.href} href={n.href} className="flex h-[34px] items-center px-3 transition-colors hover:bg-l-accent-tint hover:text-l-accent">{n.label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-[22px] lg:flex">
          <a href={loginHref} className="text-sm font-medium text-l-body hover:text-l-accent">Kirish</a>
          <Btn3d href={startHref} className="mb-0">Bepul sinash ↗</Btn3d>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? 'Menyuni yopish' : 'Menyu'}
          className="flex size-[38px] cursor-pointer items-center justify-center border border-l-line-strong bg-white text-lg text-l-ink lg:hidden">
          {open ? '✕' : <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden><path d="M0 1h16M0 9h16" stroke="currentColor" strokeWidth="1.2" /></svg>}
        </button>
      </div>
      {open && (
        <div className="mx-auto max-w-[1440px] px-8 pb-6 lg:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex h-[60px] items-center justify-between border-t border-l-line font-l-serif text-[26px] font-[360] tracking-[-0.5px]">
              {n.label}<svg width="12" height="8" viewBox="0 0 12 8" className="-rotate-90" aria-hidden><path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="#0B0B0D" strokeWidth="1.3" /></svg>
            </a>
          ))}
          <a href={loginHref} className="flex h-[60px] items-center justify-between border-t border-l-line font-l-serif text-[26px] font-[360] tracking-[-0.5px]">Kirish</a>
          <div className="mt-4"><Btn3d href={startHref} full>Bepul sinash ↗</Btn3d></div>
        </div>
      )}
    </header>
  );
}
