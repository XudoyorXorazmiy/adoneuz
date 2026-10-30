'use client';
import { useActionState, useState } from 'react';
import { Logo } from '@/components/ui/logo';
import { Icon } from '@/components/ui/icon';
import { PHONE_COUNTRIES } from '@adone/core';
import { loginAction, type LoginState } from '@/lib/actions/auth';

/** Dizayn: design/panel/Kirish.dc.html */
export function LoginForm({ mode, next }: { mode: 'tenant' | 'platform'; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [show, setShow] = useState(false);
  const [cc, setCc] = useState<string>('998');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-4">
      <form action={action} className="flex w-full max-w-[440px] flex-col gap-6 rounded-3xl bg-card p-7 shadow-[var(--shadow-frame)] sm:p-10">
        <input type="hidden" name="mode" value={mode} />
        {next && <input type="hidden" name="next" value={next} />}
        <Logo size={36} text={28} />
        <div>
          <h1 className="page-title">{mode === 'platform' ? 'Super admin' : 'Kirish'}</h1>
          <p className="m-0 mt-1 text-sm text-muted">{mode === 'platform' ? 'Faqat platforma egasi uchun.' : 'Kim ishda va bugun nima qilindi — bir qarashda.'}</p>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Telefon raqam</span>
          <div className="flex h-12 items-center overflow-hidden rounded-xl border border-line focus-within:border-[1.5px] focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--color-primary-tint)]">
            <select name="cc" value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Mamlakat kodi" className="tnum h-full cursor-pointer border-r border-line bg-page px-2 text-sm font-semibold outline-none">
              {PHONE_COUNTRIES.map((c) => <option key={c.cc} value={c.cc}>{c.label}</option>)}
            </select>
            <input name="phone" defaultValue={state?.phone ?? ''} placeholder={PHONE_COUNTRIES.find((c) => c.cc === cc)?.placeholder} inputMode="tel" autoComplete="tel" className="tnum h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] font-medium outline-none" required />
          </div>
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex justify-between text-[13px] font-semibold">
            Parol
            {mode === 'tenant' && <span className="font-semibold text-primary" title="Ishxona egasi yoki administratoringiz yangi parol beradi">Parolni unutdingizmi?</span>}
          </span>
          <div className="flex h-12 items-center gap-2 rounded-xl border border-line pr-2 focus-within:border-[1.5px] focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--color-primary-tint)]">
            <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none" required />
            <button type="button" onClick={() => setShow((s) => !s)} title="Ko'rsatish" className="flex size-8 items-center justify-center rounded-full text-placeholder hover:bg-subtle">
              <Icon name={show ? 'visibility_off' : 'visibility'} />
            </button>
          </div>
        </label>
        {state?.error && (
          <div className="flex items-center gap-2 rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text">
            <Icon name="error" size={18} /> {state.error}
          </div>
        )}
        <button disabled={pending} className="btn-primary btn-lg w-full">{pending ? 'Kirilmoqda…' : 'Kirish'}</button>
        {mode === 'tenant' && <p className="m-0 text-center text-sm text-muted">Hisobingiz yo&apos;qmi? <a href="https://t.me/adoneuz_bot" className="font-bold text-primary">Ulanish uchun yozing</a></p>}
      </form>
      <span className="text-xs text-placeholder">© {new Date().getFullYear()} adone.uz</span>
    </div>
  );
}
