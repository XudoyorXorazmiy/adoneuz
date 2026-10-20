'use client';
import { useActionState, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { loginAction, type LoginState } from '@/lib/actions/auth';

export function LoginForm({ mode, next }: { mode: 'tenant' | 'platform'; next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [show, setShow] = useState(false);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page p-6">
      <form action={action} className="card flex w-full max-w-[400px] flex-col gap-6 px-8 pt-9 pb-8">
        <input type="hidden" name="mode" value={mode} />
        {next && <input type="hidden" name="next" value={next} />}
        <Logo size={36} text={26} />
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-xl font-semibold">{mode === 'platform' ? 'Super admin' : 'Panelga kirish'}</h1>
          <span className="text-muted">{mode === 'platform' ? 'Faqat platforma egasi uchun.' : 'Kim ishda va bugun nima qilindi — bir qarashda.'}</span>
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col">
            <span className="label">Telefon raqam</span>
            <div className="flex h-[42px] items-center overflow-hidden rounded-lg border border-line-strong focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint">
              <span className="tnum flex h-full items-center border-r border-line bg-page px-3 text-muted">+998</span>
              <input name="phone" defaultValue={state?.phone ?? ''} placeholder="90 123 45 67" inputMode="tel" autoComplete="tel" className="tnum h-full min-w-0 flex-1 px-3 text-[15px] outline-none" required />
            </div>
          </label>
          <label className="flex flex-col">
            <span className="label">Parol</span>
            <div className="flex h-[42px] items-center rounded-lg border border-line-strong pr-1.5 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint">
              <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none" required />
              <button type="button" onClick={() => setShow((s) => !s)} title="Ko'rsatish" className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-subtle">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger-tint bg-danger-tint/50 px-3 py-2 text-[13px] text-danger-text">
              <AlertCircle size={16} className="shrink-0" /> {state.error}
            </div>
          )}
        </div>
        <button disabled={pending} className="btn-primary btn-lg w-full">{pending ? 'Kirilmoqda…' : 'Kirish'}</button>
      </form>
      {mode === 'tenant' && <span className="text-center text-muted">Parolni unutdingizmi? Ishxona egasi yoki administratoringizga murojaat qiling.</span>}
    </div>
  );
}
