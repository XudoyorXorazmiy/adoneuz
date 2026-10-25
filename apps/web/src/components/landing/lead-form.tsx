'use client';
import { useActionState, useState } from 'react';
import { STAFF_SIZES } from '@/lib/landing/content';
import { submitLeadAction, type LeadState } from '@/lib/actions/leads';
import { Btn3d } from './ui';

/** Telefon maydoni: «90 123 45 67» ko'rinishida (faqat raqam, 9 ta). */
const fmt = (v: string) => {
  const d = v.replace(/\D+/g, '').replace(/^998/, '').slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
};

/** 10 — ariza: ism, telefon (+998), xodimlar soni → `leads`. Xato — qizil chegara + mono xabar; yuborilgach — «Rahmat!». */
export function LeadForm({ source = 'landing' }: { source?: string }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitLeadAction, undefined);
  // Boshqariladigan maydonlar: React 19 action'dan keyin formani tozalaydi — xato holatida kiritilgan qiymatlar saqlansin
  const [tel, setTel] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  if (state?.ok) {
    return (
      <div className="flex min-h-11 items-center gap-3.5 px-6 py-5 font-l-serif text-xl font-[360] tracking-[-0.48px] lg:text-2xl" role="status">
        <span className="flex size-7 shrink-0 items-center justify-center border border-l-accent font-l-sans text-sm text-l-accent">✓</span>
        Rahmat! Tez orada bog&apos;lanamiz.
      </div>
    );
  }
  const err = state?.field;
  const input = 'h-11 w-full border bg-white px-3.5 text-[15px] text-l-ink outline-none placeholder:text-l-muted focus:border-l-accent';
  return (
    <form action={action} className="grid grid-cols-1 items-start gap-2.5 px-0 py-0 lg:grid-cols-[1fr_1fr_220px_auto] lg:gap-3 lg:px-6 lg:py-5" noValidate>
      <input type="hidden" name="source" value={source} />
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="sr-only" htmlFor="lead-name">Ismingiz</label>
      <input id="lead-name" name="name" placeholder="Ismingiz" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
        className={`${input} ${err === 'name' ? 'border-l-danger' : 'border-l-line-strong'}`} />
      <div className="flex flex-col gap-1.5">
        <div className={`flex h-11 items-center border bg-white focus-within:border-l-accent ${err === 'phone' ? 'border-l-danger' : 'border-l-line-strong'}`}>
          <span className="flex h-full items-center border-r border-l-line px-3 font-l-mono text-xs text-l-body">+998</span>
          <label className="sr-only" htmlFor="lead-phone">Telefon</label>
          <input id="lead-phone" name="phone" inputMode="tel" autoComplete="tel-national" placeholder="__ ___ __ __" value={tel} onChange={(e) => setTel(fmt(e.target.value))}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-l-ink outline-none placeholder:text-l-muted" />
        </div>
        {err === 'phone' && <span className="l-label-sm text-l-danger">TELEFON RAQAM NOTO&apos;G&apos;RI</span>}
      </div>
      <label className="sr-only" htmlFor="lead-size">Xodimlar soni</label>
      <div className="relative">
        <select id="lead-size" name="size" value={size} onChange={(e) => setSize(e.target.value)} className={`${input} cursor-pointer appearance-none ${err === 'size' ? 'border-l-danger' : 'border-l-line-strong'} ${size ? '' : 'text-l-muted'}`}>
          <option value="" disabled>Xodimlar soni</option>
          {STAFF_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] text-l-body">⌄</span>
      </div>
      <div className="mt-1.5 lg:mt-0">
        <Btn3d type="submit" full className="lg:w-auto">{pending ? 'Yuborilmoqda…' : 'Ariza qoldirish ↗'}</Btn3d>
      </div>
      {state?.error && !err && <p className="m-0 text-[13px] text-l-danger lg:col-span-4" role="alert">{state.error}</p>}
    </form>
  );
}
