'use client';
import { useActionState, useEffect, useRef } from 'react';
import { commentTaskAction } from '@/lib/actions/tasks';
import type { FormState } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';

/** Yozishma: izoh task_events ga (from == to), ijrochi yozsa rahbarga, rahbar yozsa ijrochiga Telegram'da boradi. */
export function CommentBox({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(commentTaskAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card p-1.5 pl-3 focus-within:border-primary">
        <input name="comment" required maxLength={1000} placeholder="Izoh yoki savol yozing…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-placeholder" />
        <button disabled={pending} className="btn-primary h-9 px-4 shadow-none"><Icon name="send" size={18} />Yuborish</button>
      </div>
      {state?.error && <span className="text-xs font-semibold text-danger">{state.error}</span>}
    </form>
  );
}
