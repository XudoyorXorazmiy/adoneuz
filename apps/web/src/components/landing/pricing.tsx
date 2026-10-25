'use client';
import { useState, type ReactNode } from 'react';
import { formatNumber } from '@adone/core';
import { PLANS } from '@/lib/landing/content';
import { Btn3d } from './ui';

/** 08 Tariflar: oylik/yillik almashtirgich + 3 karta («Biznes» — ko'tarilgan, accent yon tomonlar). Telefonda «Biznes» birinchi. */
export function Pricing({ startHref, contactHref, eyebrow, title }: { startHref: string; contactHref: string; eyebrow: ReactNode; title: ReactNode }) {
  const [yearly, setYearly] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[511fr_715fr] lg:gap-0">
      {eyebrow}
      <div className="flex flex-col gap-5 lg:gap-7">
      {title}
      <div className="l-label-sm lg:l-label flex w-max border border-l-line-strong" role="group" aria-label="To'lov davri">
        {[false, true].map((y) => (
          <button key={String(y)} type="button" onClick={() => setYearly(y)} aria-pressed={yearly === y}
            className={`flex h-8 cursor-pointer items-center px-3 lg:px-3.5 ${yearly === y ? 'bg-l-ink text-white' : 'bg-white text-l-body hover:text-l-ink'}`}>
            {y ? <>YILLIK <span className={`ml-1.5 ${yearly ? 'text-[#8EA0FF]' : 'text-l-accent'}`}>−20%</span></> : 'OYLIK'}
          </button>
        ))}
      </div>
      </div>
      <div className="col-span-full mt-8 grid grid-cols-1 items-start gap-6 pr-2 lg:mt-[88px] lg:grid-cols-3 lg:gap-4 lg:pr-2">
        {PLANS.map((p) => {
          const price = yearly ? p.yearly : p.monthly;
          return (
            <div key={p.id} className={`relative ${p.primary ? 'order-first lg:order-none lg:-translate-y-2' : ''}`}>
              {p.primary && (
                <>
                  <div aria-hidden className="absolute -top-px left-full h-[calc(100%+2px)] w-2 origin-top-left skew-y-[45deg] bg-l-accent-side" />
                  <div aria-hidden className="absolute top-full -left-px h-2 w-[calc(100%+2px)] origin-top-left skew-x-[45deg] bg-l-accent" />
                </>
              )}
              <div className={`relative flex flex-col border bg-white p-6 lg:min-h-[453px] lg:p-8 ${p.primary ? 'border-l-ink' : 'border-l-line'}`}>
                <div className="flex items-center justify-between"><span className="text-[17px] font-medium tracking-[-0.17px]">{p.n}</span>{p.badge && <span className="l-label-sm text-l-accent">{p.badge}</span>}</div>
                <div className="mt-4 flex items-baseline gap-2.5 lg:mt-7">
                  <span className="font-l-serif text-[48px] leading-[48px] font-normal tracking-[-1.4px] lg:text-[44px] lg:leading-[44px] xl:text-[56px] xl:leading-[56px] xl:tracking-[-1.7px]">{price == null ? 'Kelishiladi' : formatNumber(price)}</span>
                  {price != null && <span className="l-label-sm lg:l-label text-l-body">SO&apos;M / OY</span>}
                </div>
                <div className="l-label-sm mt-2 hidden h-3.5 text-l-muted lg:block">{yearly && price != null ? "YILIGA TO'LANSA" : ''}</div>
                <div className="mt-1.5 text-[15px] leading-6 text-l-body lg:mt-3 lg:text-base">{p.lim}</div>
                <div className="mt-[18px] lg:mt-6">
                  <Btn3d href={p.monthly == null ? contactHref : startHref} variant={p.primary ? 'primary' : 'secondary'} full>{p.btn}</Btn3d>
                </div>
                <div className="mt-6 flex flex-col gap-3 border-t border-l-line pt-5 lg:mt-8">
                  {p.feat.map((f) => (
                    <div key={f} className="flex gap-2.5 text-[15px] leading-[22px] text-l-body">
                      <span className={`font-l-mono text-xs ${p.primary ? 'text-l-accent' : 'text-l-muted'}`}>→</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
