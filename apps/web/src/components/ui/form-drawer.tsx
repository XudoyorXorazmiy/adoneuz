'use client';
import { useActionState, useEffect, useId, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type FormState = { error?: string; ok?: string } | undefined;

/**
 * O'ng tomondan chiqadigan forma (dizayn: «Create/edit forms open in a right drawer 520px»).
 * `action` — server action (prev, FormData) → { error } | { ok }. Muvaffaqiyatda yopiladi.
 */
export function FormDrawer({
  trigger, triggerClass = 'btn-primary', title, action, submitLabel = 'Saqlash', children, danger,
}: {
  trigger: ReactNode;
  triggerClass?: string;
  title: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel?: string;
  children: ReactNode;
  danger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const formId = useId();
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>{trigger}</button>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          {/* `danger` (o'chirish/arxiv) o'z formasiga ega — asosiy formadan TASHQARIDA (ichma-ich form bo'lmaydi) */}
          <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="m-0 text-lg font-semibold">{title}</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost size-9 px-0" title="Yopish"><X size={18} /></button>
            </div>
            <form id={formId} action={formAction} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              {children}
              {state?.error && <div className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] text-danger-text">{state.error}</div>}
            </form>
            <div className="flex items-center justify-between gap-2 border-t border-line px-6 py-4">
              <div>{danger}</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Bekor qilish</button>
                <button form={formId} disabled={pending} className="btn-primary">{pending ? 'Saqlanmoqda…' : submitLabel}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
