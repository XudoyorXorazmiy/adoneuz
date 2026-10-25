'use client';
import { useEffect, useRef, useState } from 'react';
import { heroArt } from './art';

/** Hero stek: kursor chizmaga yaqinlashsa qatlamlar ajraladi va nomlari chiqadi (Tessel «cube opens»). Teginishda — bosib almashtiriladi. */
export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      setOpen(Math.hypot(dx, dy) < 40 && e.clientX > r.left + r.width * 0.15);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return (
    <div ref={ref} onClick={() => setOpen((v) => !v)} className="relative transition-opacity duration-300" title="Qatlamlarni ochish">
      {heroArt(open)}
    </div>
  );
}
