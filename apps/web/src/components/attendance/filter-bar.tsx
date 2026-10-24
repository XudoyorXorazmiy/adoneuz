'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';

type Opt = { id: string; name: string };

/**
 * Davomat filtrlari (dizayn): sana pill'i, filial, bo'lim, «Ism yoki telefon» qidiruvi. URL parametrlari:
 * `sana`, `filial`, `bolim`, `q` — sahifa server tomonda filtrlaydi; tanlov o'zgarsa darhol o'tadi (1-sahifaga).
 */
export function FilterBar({ base, params, date, today, dateLabel, branches, departments }: {
  base: string; params: Record<string, string | undefined>; date: string; today: string; dateLabel: string; branches: Opt[]; departments: Opt[];
}) {
  const router = useRouter();
  const dateRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(params.q ?? '');
  const go = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, sahifa: undefined, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    router.push(s ? `${base}?${s}` : base);
  };
  const pill = 'relative flex h-10 items-center gap-2 rounded-full border border-line bg-card pr-3 pl-3.5 text-[13px] font-semibold whitespace-nowrap';
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className={`${pill} cursor-pointer pr-1.5`}>
        <Icon name="calendar_today" size={18} />
        {dateLabel}
        <span className="flex size-7 items-center justify-center rounded-full bg-subtle"><Icon name="expand_more" size={18} /></span>
        <input ref={dateRef} type="date" value={date} max={today} aria-label="Sana"
          onClick={() => dateRef.current?.showPicker?.()}
          onChange={(e) => e.target.value && go({ sana: e.target.value === today ? undefined : e.target.value })}
          className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      {branches.length > 1 && (
        <label className={pill}>
          <Icon name="location_on" size={18} className="text-primary" />
          <select value={params.filial ?? ''} onChange={(e) => go({ filial: e.target.value || undefined })} className="cursor-pointer appearance-none bg-transparent pr-5 outline-none">
            <option value="">Barcha filiallar</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Icon name="expand_more" size={18} className="pointer-events-none absolute right-3 text-muted" />
        </label>
      )}
      {departments.length > 0 && (
        <label className={pill}>
          <Icon name="workspaces" size={18} className="text-primary" />
          <select value={params.bolim ?? ''} onChange={(e) => go({ bolim: e.target.value || undefined })} className="cursor-pointer appearance-none bg-transparent pr-5 outline-none">
            <option value="">Barcha bo&apos;limlar</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Icon name="expand_more" size={18} className="pointer-events-none absolute right-3 text-muted" />
        </label>
      )}
      <form className="ml-auto max-sm:w-full" onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || undefined }); }}>
        <label className="flex h-10 w-[260px] items-center gap-2 rounded-xl border border-line px-3 text-[13px] focus-within:border-primary max-sm:w-full">
          <Icon name="search" size={18} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => (q.trim() || undefined) !== params.q && go({ q: q.trim() || undefined })}
            placeholder="Ism yoki telefon…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-placeholder" />
          {params.q && <button type="button" onClick={() => { setQ(''); go({ q: undefined }); }} title="Tozalash" className="text-muted"><Icon name="close" size={16} /></button>}
        </label>
      </form>
    </div>
  );
}
