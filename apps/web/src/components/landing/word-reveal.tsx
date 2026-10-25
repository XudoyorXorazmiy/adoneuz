'use client';
import { useEffect, useRef, useState } from 'react';

/** 04 Nega adone: so'zlar skroll bilan birma-bir kulrangdan qoraga o'tadi (reduced motion — hammasi qora). */
export function WordReveal({ text }: { text: string }) {
  const words = text.split(' ');
  const ref = useRef<HTMLParagraphElement>(null);
  const [n, setN] = useState(words.length);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onScroll = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vh = window.innerHeight;
      // Paragraf ekranning 85% chizig'idan 35% chizig'igacha o'tganda 0 → 100%
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.5 + r.height * 0.6)));
      setN(Math.round(p * words.length));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [words.length]);
  return (
    <p ref={ref} className="m-0 font-l-serif text-[30px] leading-9 font-[360] tracking-[-0.6px] text-pretty lg:ml-[29%] lg:text-[44px] lg:leading-[52px] xl:text-[52px] xl:leading-[60px] xl:tracking-[-1.3px]">
      {words.map((w, i) => <span key={i} className={`transition-colors duration-400 ${i < n ? 'text-l-ink' : 'text-l-faint'}`}>{w} </span>)}
    </p>
  );
}
