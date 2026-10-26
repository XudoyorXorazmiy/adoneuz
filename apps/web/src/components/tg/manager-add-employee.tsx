'use client';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { tgSaveEmployeeAction } from '@/lib/actions/miniapp';
import { EmployeeFields } from '@/components/employees/employee-fields';
import { CopyButton } from '@/components/ui/copy-button';
import { Icon } from '@/components/ui/icon';
import { haptic, webApp } from './webapp';

type Opt = { id: string; name: string };
type Props = { options: { departments: Opt[]; branches: Opt[]; schedules: Opt[] }; showPay: boolean; tenantName: string };

/** Rahbar Mini App'i — «Xodim qo'shish»: panel formasi (EmployeeFields) + pastda «Qo'shish». Saqlangach — taklif havolasi va «Telegram'da yuborish». */
export function ManagerAddEmployee(props: Props) {
  const [round, setRound] = useState(0);
  return <Form key={round} {...props} again={() => setRound((r) => r + 1)} />;
}

function Form({ options, showPay, tenantName, again }: Props & { again: () => void }) {
  const [state, action, pending] = useActionState(tgSaveEmployeeAction, undefined);
  useEffect(() => {
    if (state?.ok) haptic('success');
    else if (state?.error) haptic('error');
  }, [state]);
  if (state?.ok) {
    const link = state.invite ?? null;
    const share = link ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`${tenantName}: davomat botiga ulaning`)}` : null;
    const open = () => {
      if (!share) return;
      const w = webApp();
      if (w?.openTelegramLink) w.openTelegramLink(share);
      else window.open(share, '_blank', 'noopener');
    };
    return (
      <div className="flex flex-1 flex-col gap-3 px-4 pt-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-success-tint text-success"><Icon name="person_add" size={34} fill /></span>
          <p className="m-0 text-lg font-bold">Xodim qo&apos;shildi</p>
          <p className="m-0 text-sm text-muted">Taklif havolasini xodimga yuboring — u botda raqamini ulashadi, rozilik beradi va dumaloq video yuboradi.</p>
        </div>
        {link && (
          <div className="flex flex-col gap-2 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
            <span className="text-[13px] font-semibold text-muted">Taklif havolasi · 14 kun amal qiladi</span>
            <code className="block overflow-x-auto rounded-xl bg-page px-3 py-2.5 text-[12px] break-all">{link}</code>
            <button type="button" onClick={open} className="btn-primary h-11 w-full text-sm shadow-none"><Icon name="send" size={18} />Telegram&apos;da yuborish</button>
            <CopyButton text={link} label="Havolani nusxalash" className="btn-secondary h-11 w-full text-sm" />
          </div>
        )}
        <button type="button" onClick={again} className="btn-secondary h-12 w-full text-sm"><Icon name="add" size={18} className="text-primary" />Yana xodim qo&apos;shish</button>
        <Link href="/tg" className="flex h-11 items-center justify-center text-sm font-semibold text-primary">Bosh sahifaga</Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-36">
      <EmployeeFields options={options} showPay={showPay} />
      <p className="m-0 flex gap-2 rounded-xl bg-primary-soft px-3.5 py-3 text-[13px] text-[#1F2A5C]">
        <Icon name="info" size={18} className="shrink-0 text-primary" />
        <span>Saqlangach taklif havolasi chiqadi — uni xodimga Telegram&apos;da yuboring.</span>
      </p>
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-line bg-card/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        {state?.error && <p className="m-0 mx-auto flex w-full max-w-[488px] items-center gap-2 rounded-2xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text"><Icon name="error" size={18} fill />{state.error}</p>}
        <button disabled={pending} className="btn-primary mx-auto flex h-12 w-full max-w-[488px] text-[15px] shadow-none"><Icon name="person_add" size={18} />{pending ? 'Saqlanmoqda…' : "Qo'shish"}</button>
      </div>
    </form>
  );
}
