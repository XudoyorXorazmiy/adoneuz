'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { reportUrl } from '@/lib/report-url';

type Opt = { id: string; name: string };
type Query = Record<string, string | undefined>;


function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

const PILL = 'relative flex h-10 shrink-0 items-center gap-2 rounded-full border bg-card pr-3 pl-3.5 text-[13px] font-semibold whitespace-nowrap';
const MENU = 'rounded-2xl bg-card p-1.5 shadow-[0_2px_6px_rgba(16,24,40,.06),0_16px_40px_rgba(16,24,40,.14)]';

/**
 * Filtr qatori (dizayn): davr pill'i (Bu hafta · O'tgan hafta · Bu oy · O'tgan oy · Tanlash…), filial, bo'lim,
 * «O'tgan davr bilan solishtirish». Tanlov URL'ga yoziladi — sahifa serverda qayta hisoblaydi.
 */
export function ReportFilters({ query, label, presets, from, to, today, branches, departments }: {
  query: Query; label: string; presets: Array<{ id: string; label: string; hint: string; active: boolean }>;
  from: string; to: string; today: string; branches: Opt[]; departments: Opt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(query.davr === 'tanlash');
  const [range, setRange] = useState({ from, to });
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const pillRef = useRef<HTMLButtonElement>(null);
  const ref = useOutside(open, () => setOpen(false));
  const go = (patch: Query) => { setOpen(false); router.push(reportUrl('/hisobotlar', query, patch)); };
  const compare = query.solishtir !== '0';
  // Mobil qatorda gorizontal aylantirish bor — menyu `fixed` (kesilib qolmasin)
  const toggle = () => {
    const r = pillRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, left: Math.max(16, Math.min(r.left, window.innerWidth - 276)) });
    setOpen((v) => !v);
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [open]);

  return (
    <div className="-mx-4 flex items-center gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      <div ref={ref}>
        <button ref={pillRef} type="button" onClick={toggle} className={`${PILL} pr-1.5 font-bold ${open ? 'border-primary' : 'border-line'} max-md:border-navy max-md:bg-navy max-md:text-white`}>
          <Icon name="calendar_today" size={18} className="max-md:hidden" />
          {label}
          <span className="flex size-7 items-center justify-center rounded-full bg-subtle max-md:size-5 max-md:bg-transparent"><Icon name="expand_more" size={18} /></span>
        </button>
        {open && (
          <div className={`fixed z-30 w-[260px] ${MENU}`} style={{ top: pos.top, left: pos.left }}>
            {presets.map((p) => (
              <button key={p.id} type="button" onClick={() => (p.id === 'tanlash' ? setCustom(true) : go({ davr: p.id === 'oy' ? undefined : p.id, dan: undefined, gacha: undefined }))}
                className={`flex h-[38px] w-full items-center justify-between rounded-[10px] px-3 text-left text-[13px] font-semibold ${p.active ? 'bg-primary-tint text-primary' : 'hover:bg-page'}`}>
                {p.label}<span className="text-xs font-medium text-placeholder">{p.hint}</span>
              </button>
            ))}
            {custom && (
              <form className="mt-1 flex flex-col gap-2 border-t border-line-soft px-1.5 pt-2.5 pb-1"
                onSubmit={(e) => { e.preventDefault(); go({ davr: 'tanlash', dan: range.from, gacha: range.to }); }}>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={range.from} max={today} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="input h-9 px-2 text-xs" aria-label="Boshlanish" />
                  <input type="date" value={range.to} max={today} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="input h-9 px-2 text-xs" aria-label="Tugash" />
                </div>
                <button className="btn-primary btn-sm" disabled={!range.from || !range.to}>Qo&apos;llash</button>
                <span className="text-[11px] text-placeholder">Ko&apos;pi bilan 93 kun</span>
              </form>
            )}
          </div>
        )}
      </div>
      {branches.length > 1 && (
        <label className={`${PILL} border-line`}>
          <Icon name="location_on" size={18} className="text-primary max-md:hidden" />
          <select value={query.filial ?? ''} onChange={(e) => go({ filial: e.target.value || undefined })} className="cursor-pointer appearance-none bg-transparent pr-5 outline-none">
            <option value="">Barcha filiallar</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Icon name="expand_more" size={18} className="pointer-events-none absolute right-3 text-muted" />
        </label>
      )}
      {departments.length > 0 && (
        <label className={`${PILL} border-line`}>
          <Icon name="workspaces" size={18} className="text-primary max-md:hidden" />
          <select value={query.bolim ?? ''} onChange={(e) => go({ bolim: e.target.value || undefined })} className="cursor-pointer appearance-none bg-transparent pr-5 outline-none">
            <option value="">Barcha bo&apos;limlar</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Icon name="expand_more" size={18} className="pointer-events-none absolute right-3 text-muted" />
        </label>
      )}
      <span className="flex-1 max-md:hidden" />
      <button type="button" role="switch" aria-checked={compare} onClick={() => go({ solishtir: compare ? '0' : undefined })}
        className="flex shrink-0 items-center gap-2.5 text-[13px] font-semibold whitespace-nowrap text-ink-2">
        O&apos;tgan davr bilan solishtirish
        <span className={`relative h-6 w-10 rounded-full transition ${compare ? 'bg-primary' : 'bg-line-strong'}`}>
          <span className={`absolute top-[3px] size-[18px] rounded-full bg-white transition-all ${compare ? 'right-[3px]' : 'right-[19px]'}`} />
        </span>
      </button>
    </div>
  );
}

const SHEETS = [
  { id: 'davomat', label: 'Davomat', hint: 'xodimlar, kunlar', on: true },
  { id: 'vazifalar', label: 'Vazifalar', hint: 'xodimlar, haftalar', on: true },
  { id: 'reyting', label: 'Reyting', hint: 'ball va tarkibi', on: true },
  { id: 'jurnal', label: 'Ish jurnali', hint: 'kun bo‘yicha yozuvlar', on: false },
] as const;

/** «Excel» tugmasi va oynasi (dizayn: Hisobotlar — Excel): har belgilangan bo'lim — alohida varaq. */
export function ExcelButton({ query, rangeText, scopeText }: { query: Query; rangeText: string; scopeText: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(SHEETS.filter((s) => s.on).map((s) => s.id)));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  // Varaqlar davr va filial/bo'lim filtri bilan; tab ichidagi tanlovlar (xodim, manba) — yo'q
  const filters = Object.fromEntries(Object.entries(query).filter(([k]) => ['davr', 'dan', 'gacha', 'filial', 'bolim'].includes(k)));
  const href = reportUrl('/api/eksport/hisobot', filters, { varaq: SHEETS.filter((s) => picked.has(s.id)).map((s) => s.id).join(',') });
  const flip = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Excel" className="btn-secondary h-11 pr-[18px] pl-3.5 text-sm max-md:size-10 max-md:p-0">
        <Icon name="download" className="text-success" /><span className="max-md:hidden">Excel</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/30 px-4 pt-[min(180px,15vh)] pb-6" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal aria-labelledby="excel-title" className="flex w-full max-w-[440px] flex-col gap-[18px] rounded-3xl bg-card p-6 shadow-[0_24px_80px_rgba(11,27,79,.3)]">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-tint text-success"><Icon name="table_view" size={24} /></span>
              <div className="min-w-0 flex-1">
                <div id="excel-title" className="text-lg font-bold">Excel&apos;ga yuklash</div>
                <div className="text-[13px] text-muted">Har bo&apos;lim alohida varaq bo&apos;ladi</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-icon size-9" title="Yopish"><Icon name="close" size={18} /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-page px-3 py-2.5 text-[13px]">
              <Icon name="calendar_today" size={18} className="text-primary" /><b className="font-bold">{rangeText}</b><span className="text-muted">· {scopeText}</span>
            </div>
            <div className="flex flex-col gap-1">
              {SHEETS.map((s) => {
                const on = picked.has(s.id);
                return (
                  <label key={s.id} className="flex h-11 cursor-pointer items-center gap-3 rounded-[10px] px-1.5 hover:bg-page">
                    <input type="checkbox" checked={on} onChange={() => flip(s.id)} className="sr-only" />
                    <span className={`flex size-5 items-center justify-center rounded-md border-[1.5px] text-white ${on ? 'border-primary bg-primary' : 'border-[#C4C9D2] bg-card'}`}>{on && <Icon name="check" size={16} />}</span>
                    <span className="flex-1 text-sm font-semibold">{s.label}</span><span className="text-xs text-placeholder">{s.hint}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11 px-5 text-sm">Bekor qilish</button>
              {picked.size
                ? <a href={href} onClick={() => setTimeout(() => setOpen(false), 300)} className="btn-primary h-11 pr-[22px] pl-[18px] text-sm"><Icon name="download" size={18} />Yuklab olish</a>
                : <span className="btn-primary h-11 cursor-not-allowed pr-[22px] pl-[18px] text-sm opacity-50"><Icon name="download" size={18} />Yuklab olish</span>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** «⋯»: PDF va chop etish — brauzerning chop etish oynasi orqali (PDF sifatida saqlash mumkin). */
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const item = 'flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-semibold hover:bg-primary-soft hover:text-primary';
  const print = () => { setOpen(false); setTimeout(() => window.print(), 50); };
  return (
    <div ref={ref} className="relative max-md:hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`btn-icon size-11 ${open ? 'bg-subtle' : ''}`} title="Yana"><Icon name="more_horiz" /></button>
      {open && (
        <div className={`absolute top-12 right-0 z-30 w-[220px] ${MENU}`}>
          <button type="button" className={item} onClick={print}><Icon name="picture_as_pdf" size={18} className="text-danger" />PDF<span className="ml-auto text-[11px] font-medium text-placeholder">chop etish orqali</span></button>
          <button type="button" className={item} onClick={print}><Icon name="print" size={18} className="text-muted" />Chop etish</button>
        </div>
      )}
    </div>
  );
}

/** Ish jurnali filtrlari (dizayn): xodim tanlovi va manba chiplari. */
export function JournalFilters({ query, employees }: { query: Query; employees: Opt[] }) {
  const router = useRouter();
  const go = (patch: Query) => router.push(reportUrl('/hisobotlar', query, patch));
  const chips: Array<[string | undefined, string]> = [[undefined, 'Hammasi'], ['berilgan', 'Berilgan'], ['ozi', "O'zi qo'shgan"]];
  return (
    <div className="-mx-4 flex items-center gap-2.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
      <label className={`${PILL} border-line pl-1.5`}>
        <span className="flex size-7 items-center justify-center rounded-full bg-subtle"><Icon name="group" size={17} /></span>
        <select value={query.xodim ?? ''} onChange={(e) => go({ xodim: e.target.value || undefined })} className="max-w-[220px] cursor-pointer appearance-none bg-transparent pr-5 outline-none">
          <option value="">Barcha xodimlar</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <Icon name="expand_more" size={18} className="pointer-events-none absolute right-3 text-muted" />
      </label>
      {chips.map(([id, label]) => {
        const on = query.manba === id;
        return (
          <button key={label} type="button" onClick={() => go({ manba: id })}
            className={`flex h-[34px] shrink-0 items-center rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap ${on ? 'border-navy bg-navy text-white' : 'border-line bg-card text-ink-2 hover:bg-page'}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Kartochka ichidagi ikki variantli almashtirgich (Kun | Hafta, Xodimlar | Bo'limlar). */
export function Segmented({ value, options, onChange, dark }: { value: string; options: Array<[string, ReactNode]>; onChange: (v: string) => void; dark?: boolean }) {
  return (
    <div className={`flex gap-1 rounded-full p-1 text-xs font-semibold ${dark ? 'border border-line bg-card text-[13px]' : 'bg-subtle'}`}>
      {options.map(([id, label]) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          className={`rounded-full ${dark ? 'px-4 py-1.5' : 'px-3 py-[5px]'} ${value === id ? (dark ? 'bg-navy text-white' : 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]') : 'text-muted'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
