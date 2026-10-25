'use client';
import { useEffect, useRef, useState } from 'react';
import { LAYERS } from '@/lib/landing/content';
import { stackArt } from './art';
import { Chip } from './ui';

/**
 * 02 Tekshiruv (Tessel «Stack»): chapda 4 qatlam, o'ngda sticky stek. Ekran o'rtasidagi qatlam faol — accent, qolganlari 30%.
 * Telefonda chizma tepada, qatlamlar ostida (Landing F).
 */
export function StackScroll() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="mt-7 grid grid-cols-1 lg:mt-24 lg:grid-cols-[553fr_593fr] lg:gap-20">
      <div className="order-2 lg:order-1">
        {LAYERS.map((l, i) => (
          <div key={l.k} data-i={i} ref={(el) => { refs.current[i] = el; }}
            className={`border-t border-l-line py-6 transition-opacity duration-500 first:mt-6 lg:pt-9 lg:pb-11 lg:first:mt-0 xl:min-h-[300px] ${i === active ? 'opacity-100' : 'opacity-30'}`}>
            <div className={`l-label-sm lg:l-label ${i === active ? 'text-l-accent' : 'text-l-body'}`}>{l.k}</div>
            <h3 className="m-0 mt-2.5 font-l-serif text-2xl leading-[29px] font-[380] tracking-[-0.48px] lg:mt-4">{l.h}</h3>
            <p className="m-0 mt-2 max-w-[480px] text-base leading-6 text-l-body lg:mt-3">{l.p}</p>
            <div className="mt-5 hidden flex-wrap gap-2 lg:flex">{l.chips.map((c) => <Chip key={c}>{c}</Chip>)}</div>
          </div>
        ))}
      </div>
      <div className="relative order-1 lg:order-2">
        <div className="l-iso-grid flex flex-col items-center gap-5 border border-l-line p-4 lg:sticky lg:top-24 lg:p-7">
          <div className="l-label-sm hidden self-stretch justify-between text-l-muted lg:flex"><span>QATLAMLAR · AJRATILGAN</span><span className="text-l-accent">0{active + 1} / 04 FAOL</span></div>
          <div className="w-full max-w-[420px]">{stackArt(active)}</div>
          <div className="hidden items-center gap-3.5 self-stretch border border-l-ink bg-white px-4 py-3.5 lg:flex">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#16A34A] text-[15px] font-semibold text-white">✓</span>
            <span className="text-base font-medium">Keldingiz 08:57</span>
            <span className="l-label text-l-body">· 35 M · YUZ MOS 94%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
