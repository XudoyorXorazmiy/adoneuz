'use client';
import { useState } from 'react';
import { FAQ } from '@/lib/landing/content';

/** 09 Savollar: akkordeon, birinchisi ochiq; +/− kvadrat, ochig'i accent. */
export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="border-t border-l-line">
      {FAQ.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className="border-b border-l-line">
            <button type="button" onClick={() => setOpen(on ? -1 : i)} aria-expanded={on}
              className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-3 bg-transparent py-3 text-left text-[17px] font-medium text-l-ink lg:min-h-[70px] lg:gap-6 lg:text-lg lg:leading-[25px] lg:tracking-[-0.18px]">
              {q}
              <span className={`flex size-7 shrink-0 items-center justify-center border border-l-line-strong font-l-mono text-sm ${on ? 'text-l-accent' : 'text-l-ink'}`}>{on ? '−' : '+'}</span>
            </button>
            {on && <p className="m-0 pb-5 text-base leading-6 text-l-body lg:pr-[60px] lg:pb-7">{a}</p>}
          </div>
        );
      })}
    </div>
  );
}
