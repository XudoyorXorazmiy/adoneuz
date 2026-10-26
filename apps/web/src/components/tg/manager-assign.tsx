'use client';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { tgCreateTaskAction } from '@/lib/actions/miniapp';
import { AssignFields, type AssignOption } from '@/components/tasks/assign-fields';
import { Icon } from '@/components/ui/icon';
import { haptic } from './webapp';

/** Rahbar Mini App'i — «Vazifa berish»: panel drawer'idagi forma (AssignFields) + pastda qotirilgan «Yuborish». Yuborilgach — natija ekrani. */
export function ManagerAssign(props: { options: AssignOption[]; from: string; today: string; defaultDue: string }) {
  const [round, setRound] = useState(0);
  return <Form key={round} {...props} again={() => setRound((r) => r + 1)} />;
}

function Form({ options, from, today, defaultDue, again }: { options: AssignOption[]; from: string; today: string; defaultDue: string; again: () => void }) {
  const [state, action, pending] = useActionState(tgCreateTaskAction, undefined);
  useEffect(() => {
    if (state?.ok) haptic('success');
    else if (state?.error) haptic('error');
  }, [state]);
  if (state?.ok) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-tint text-success"><Icon name="check_circle" size={36} fill /></span>
        <p className="m-0 text-lg font-bold">{state.ok}</p>
        <p className="m-0 text-sm text-muted">Xodim Telegram&apos;da xabar va «Qabul qildim» tugmasini oldi.</p>
        <Link href="/tg/vazifalar" className="btn-primary mt-2 h-12 w-full text-sm shadow-none">Vazifalarga</Link>
        <button type="button" onClick={again} className="btn-secondary h-12 w-full text-sm"><Icon name="add" size={18} className="text-primary" />Yana vazifa berish</button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-36">
      <AssignFields options={options} from={from} today={today} defaultDue={defaultDue} />
      {/* Xato — qotirilgan pastki panelda, forma uzun bo'lsa ham ko'rinadi */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-line bg-card/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        {state?.error && <p className="m-0 mx-auto flex w-full max-w-[488px] items-center gap-2 rounded-2xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text"><Icon name="error" size={18} fill />{state.error}</p>}
        <button disabled={pending} className="btn-primary mx-auto flex h-12 w-full max-w-[488px] text-[15px] shadow-none"><Icon name="send" size={18} />{pending ? 'Yuborilmoqda…' : 'Yuborish'}</button>
      </div>
    </form>
  );
}
