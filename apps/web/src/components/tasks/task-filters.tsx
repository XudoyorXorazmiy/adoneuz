'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

type Opt = { value: string; label: string };
export type PillDef = { key: string; label: string; options: Opt[] };

/** Vazifalar filtrlari (dizayn): Ijrochi · Bo'lim · Muhimlik · Muddat pill'lari + «Qidirish…». Tanlov URL'ga yoziladi. */
export function TaskSearch({ params }: { params: Record<string, string | undefined> }) {
  const router = useRouter();
  const [q, setQ] = useState(params.q ?? '');
  const go = (v: string | undefined) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries({ ...params, q: v })) if (val) p.set(k, val);
    router.push(`/vazifalar${p.size ? `?${p}` : ''}`);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(q.trim() || undefined); }} className="ml-auto max-sm:w-full">
      <label className="flex h-10 w-[200px] items-center gap-2 rounded-xl border border-line px-3 text-[13px] focus-within:border-primary max-sm:w-full">
        <Icon name="search" size={18} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => (q.trim() || undefined) !== params.q && go(q.trim() || undefined)} placeholder="Qidirish…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder" />
      </label>
    </form>
  );
}

export function FilterPills({ params, pills }: { params: Record<string, string | undefined>; pills: PillDef[] }) {
  const router = useRouter();
  const go = (key: string, v: string) => {
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries({ ...params, [key]: v || undefined })) if (val) p.set(k, val);
    router.push(`/vazifalar${p.size ? `?${p}` : ''}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pl) => {
        const on = !!params[pl.key];
        return (
          <label key={pl.key} className={`relative flex h-9 items-center rounded-full border pr-8 pl-3.5 text-[13px] font-semibold ${on ? 'border-primary bg-primary-tint text-primary' : 'border-line'}`}>
            <select value={params[pl.key] ?? ''} onChange={(e) => go(pl.key, e.target.value)} className="cursor-pointer appearance-none bg-transparent outline-none">
              <option value="">{pl.label}</option>
              {pl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Icon name="expand_more" size={18} className="pointer-events-none absolute right-2.5 text-muted" />
          </label>
        );
      })}
    </div>
  );
}
