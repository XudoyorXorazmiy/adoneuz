'use client';
/** Sozlamalar — holatli qismlar: saqlanmagan o'zgarishlar paneli, slider, parol kuchi, Telegram QR, tasdiqlash oynalari. */
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { unstable_rethrow } from 'next/navigation';
import { passwordStrength } from '@adone/core';
import type { FormState } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';
import { logoutOthersAction, telegramLinkAction } from '@/lib/actions/settings';

const STALE = 'Sahifa eskirgan yoki aloqa uzildi — sahifani yangilang va qayta urinib ko‘ring.';

function snapshot(form: HTMLFormElement | null): string {
  if (!form) return '';
  const fd = new FormData(form);
  return [...fd.entries()].map(([k, v]) => `${k}=${String(v)}`).sort().join('&');
}

/**
 * Sozlama formasi: o'zgarish bo'lsa pastda «O'zgarishlar saqlanmagan · Bekor qilish · Saqlash» paneli (dizayn).
 * `submit` — panel o'rniga kartochka ichidagi o'z tugmasi bor (masalan, «Parolni yangilash»): faqat natija matni ko'rsatiladi.
 */
export function SettingsForm({ action, children, submit, resetOnOk }: { action: (p: FormState, f: FormData) => Promise<FormState>; children: ReactNode; submit?: boolean; resetOnOk?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const initial = useRef('');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (p, f) => {
    try {
      return await action(p, f);
    } catch (e) {
      unstable_rethrow(e);
      return { error: STALE };
    }
  }, undefined);
  const check = () => setDirty(snapshot(ref.current) !== initial.current);
  useEffect(() => {
    initial.current = snapshot(ref.current);
  }, []);
  useEffect(() => {
    if (!state?.ok) return;
    if (resetOnOk) ref.current?.reset();
    initial.current = snapshot(ref.current);
    setDirty(false);
    setToast(state.ok);
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [state]);
  return (
    // action= o'rniga onSubmit: xatoda React formani tozalab yubormasin (kiritilgan qiymatlar qoladi)
    <form ref={ref} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }}
      onInput={check} onChange={check} onReset={() => setTimeout(check, 0)} className="flex flex-col gap-5">
      {children}
      {submit && (state?.error || toast) && (
        <div className="-mt-3 pl-2">
          {state?.error && <span role="alert" className="text-[13px] font-semibold text-danger-text">{state.error}</span>}
          {toast && <span className="flex items-center gap-1 text-[13px] font-semibold text-success"><Icon name="check_circle" size={16} fill />{toast}</span>}
        </div>
      )}
      {!submit && (dirty || state?.error || toast) && (
        <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-[18px] border border-line bg-card py-3 pr-3 pl-5 shadow-[0_12px_40px_rgba(16,24,40,.14)]">
          {toast && !dirty ? (
            <span className="flex flex-1 items-center gap-2 text-sm font-semibold text-success"><Icon name="check_circle" fill size={18} />{toast}</span>
          ) : (
            <>
              <span className={`size-2 shrink-0 rounded-full ${state?.error ? 'bg-danger' : 'bg-warning'}`} />
              <span role={state?.error ? 'alert' : undefined} className={`flex-1 text-sm font-semibold ${state?.error ? 'text-danger-text' : ''}`}>{state?.error ?? "O'zgarishlar saqlanmagan"}</span>
              {state?.error === STALE ? (
                <button type="button" onClick={() => window.location.reload()} className="btn-secondary">Yangilash</button>
              ) : (
                <>
                  <button type="reset" className="btn-ghost text-ink-2">Bekor qilish</button>
                  <button disabled={pending} className="btn-primary px-[22px]">{pending ? 'Saqlanmoqda…' : 'Saqlash'}</button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}

/** Slider (dizayn: 320px, qiymat chip'i, chegaralar ostida). Qiymat formaga `name` bilan tushadi. */
export function Slider({ name, min, max, step = 1, defaultValue, unit, lo, hi }: { name: string; min: number; max: number; step?: number; defaultValue: number; unit: string; lo: string; hi: string }) {
  const [v, setV] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    const onReset = () => setTimeout(() => setV(Number(ref.current?.value ?? defaultValue)), 0);
    form?.addEventListener('reset', onReset);
    return () => form?.removeEventListener('reset', onReset);
  }, [defaultValue]);
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className="flex w-[320px] flex-col gap-2 max-md:w-full">
      <div className="flex items-center gap-3">
        <div className="relative h-5 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-bar" />
          <div className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          <div className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-[0_2px_6px_rgba(36,67,245,.25)]" style={{ left: `${pct}%` }} />
          <input ref={ref} type="range" name={name} min={min} max={max} step={step} defaultValue={defaultValue} onInput={(e) => setV(Number(e.currentTarget.value))} className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label={name} />
        </div>
        <span className="tnum flex h-7 min-w-12 items-center justify-center rounded-lg bg-primary-tint px-2 text-[13px] font-bold text-primary">{v}{unit}</span>
      </div>
      <div className="flex justify-between pr-[60px] text-[11px] font-medium text-placeholder"><span>{lo}</span><span>{hi}</span></div>
    </div>
  );
}

/** «Yangi parol» + kuch shkalasi (4 bo'lak). */
function usePasswordField() {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const s = passwordStrength(pw);
  const color = s.score >= 3 ? '#16A34A' : s.score === 2 ? '#F07A1A' : '#E5484D';
  return { pw, input: (name: string, placeholder: string) => (
    <span className="flex h-11 w-[320px] items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint max-md:w-full">
      <input name={name} type={show ? 'text' : 'password'} autoComplete="new-password" placeholder={placeholder} onInput={name === 'next' ? (e) => setPw(e.currentTarget.value) : undefined} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-placeholder" required />
      <button type="button" onClick={() => setShow(!show)} className="text-placeholder hover:text-ink" title={show ? 'Yashirish' : "Ko'rsatish"}><Icon name={show ? 'visibility_off' : 'visibility'} size={18} /></button>
    </span>
  ), meter: (
    <div className="flex w-[280px] flex-col gap-1.5 max-md:w-full">
      <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < s.score ? color : '#E9EBF0' }} />)}</div>
      <span className="h-4 text-xs font-bold" style={{ color }}>{s.label}</span>
    </div>
  ) } as const;
}

/** Parol kartochkasining qatorlari (Joriy / Yangi / Takror / Kuch). */
export function PasswordRows({ rowClass }: { rowClass: string }) {
  const f = usePasswordField();
  const row = (label: string, el: ReactNode) => (
    <div className={rowClass}><div className="min-w-0 flex-1 text-sm font-semibold">{label}</div><div className="flex shrink-0 items-center">{el}</div></div>
  );
  return (
    <>
      {row('Joriy parol', <span className="flex h-11 w-[320px] items-center gap-2 rounded-xl border border-line bg-card px-3 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint max-md:w-full"><Icon name="lock" size={18} className="text-placeholder" /><input name="current" type="password" autoComplete="current-password" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" required /></span>)}
      {row('Yangi parol', f.input('next', 'kamida 8 belgi'))}
      {row('Yangi parolni takrorlang', f.input('repeat', ''))}
      {row('Parol kuchi', f.meter)}
    </>
  );
}

/** Telegram ulanmagan: QR (ochilganda yaratiladi) + «Telegramda ulash». `userId` — jamoa a'zosi uchun. */
export function TelegramConnect({ userId, compact }: { userId?: string; compact?: boolean }) {
  const [link, setLink] = useState<{ url: string; svg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = () => start(async () => {
    try {
      const r = await telegramLinkAction(userId);
      if ('error' in r) setError(r.error);
      else setLink(r);
    } catch {
      setError(STALE);
    }
  });
  useEffect(() => {
    if (!compact) load();
  }, []);
  if (compact) {
    return link ? (
      <span className="flex items-center gap-2">
        <a href={link.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-primary underline">Havola ↗</a>
        <button type="button" onClick={() => navigator.clipboard.writeText(link.url).catch(() => {})} className="text-placeholder hover:text-ink" title="Nusxa"><Icon name="content_copy" size={14} /></button>
      </span>
    ) : (
      <button type="button" disabled={pending} onClick={load} className="text-xs font-bold text-primary underline">{error ? 'Xato' : 'Havola'}</button>
    );
  }
  return (
    <>
      <div className="flex size-28 items-center justify-center rounded-[14px] border border-line p-2 [&_svg]:size-full">
        {link ? <span className="size-full" dangerouslySetInnerHTML={{ __html: link.svg }} /> : <Icon name={error ? 'error' : 'qr_code_2'} size={40} className="text-placeholder" />}
      </div>
      {link ? (
        <a href={link.url} target="_blank" rel="noreferrer" className="btn-primary">Telegramda ulash ↗</a>
      ) : (
        <button type="button" disabled={pending} onClick={load} className="btn-primary">{error ? 'Qayta urinish' : 'Telegramda ulash ↗'}</button>
      )}
      {error && <span className="w-full text-right text-xs text-danger-text">{error}</span>}
    </>
  );
}

export function LogoutOthersButton() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <button type="button" disabled={pending || done} onClick={() => start(async () => { await logoutOthersAction(); setDone(true); })} className="btn-secondary">
      <Icon name={done ? 'check' : 'logout'} size={18} />{done ? 'Boshqa qurilmalardan chiqildi' : 'Boshqa qurilmalardan chiqish'}
    </button>
  );
}

/** Tasdiqlash oynasi (dizayn: 440px, markazda). Nom yozib tasdiqlanadi. */
export function ConfirmByName({ trigger, title, text, expected, action, submitLabel }: {
  trigger: ReactNode; title: string; text: ReactNode; expected: string; action: (p: FormState, f: FormData) => Promise<FormState>; submitLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (p, f) => {
    try {
      return await action(p, f);
    } catch (e) {
      unstable_rethrow(e);
      return { error: STALE };
    }
  }, undefined);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-danger"><Icon name="delete" size={18} />{trigger}</button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4" onClick={() => setOpen(false)}>
          <form action={formAction} onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-3xl bg-card p-6 shadow-[0_2px_6px_rgba(16,24,40,.06),0_24px_60px_rgba(16,24,40,.14)]">
            <span className="flex size-11 items-center justify-center rounded-full bg-danger-tint text-danger"><Icon name="delete_forever" size={22} /></span>
            <div>
              <div className="text-lg font-bold">{title}</div>
              <div className="mt-1 text-sm leading-normal text-muted">{text}</div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Tasdiqlash uchun «{expected}» deb yozing</span>
              <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus className="input border-[1.5px] border-danger focus:border-danger focus:ring-danger-tint" />
            </label>
            {state?.error && <div role="alert" className="text-[13px] font-semibold text-danger-text">{state.error}</div>}
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11 px-5 text-sm">Bekor qilish</button>
              <button disabled={typed !== expected || pending} className="btn h-11 bg-danger px-5 text-sm text-white hover:bg-danger-text disabled:bg-[#F3B4B6] disabled:opacity-100">{submitLabel}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  );
}
