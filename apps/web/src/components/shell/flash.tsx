'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';

/** Tugma bosilganda chiqqan xato (lib/flash.ts) — tepada, 8 s yoki yopilguncha. Ko'rsatilgach cookie o'chiriladi. */
export function Flash({ text }: { text: string | null }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    setShown(text);
    if (!text) return;
    document.cookie = 'adone_flash=; path=/; max-age=0';
    const t = setTimeout(() => setShown(null), 8000);
    return () => clearTimeout(t);
  }, [text]);
  if (!shown) return null;
  return (
    <div role="alert" className="fixed top-4 left-1/2 z-[60] flex w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-start gap-2.5 rounded-2xl bg-danger-tint px-4 py-3 text-sm font-semibold text-danger shadow-[0_8px_30px_rgba(16,24,40,.14)]">
      <Icon name="error" size={20} className="mt-px shrink-0" />
      <span className="flex-1">{shown}</span>
      <button onClick={() => setShown(null)} className="shrink-0 text-danger/70 hover:text-danger" aria-label="Yopish"><Icon name="close" size={18} /></button>
    </div>
  );
}
