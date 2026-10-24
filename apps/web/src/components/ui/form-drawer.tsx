'use client';
import { useActionState, useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';

export type FormState = { error?: string; ok?: string } | undefined;

/**
 * O'ng tomondan chiqadigan forma (dizayn: «o'ng drawer, 520px»). `action` — server action (prev, FormData) → { error } | { ok }.
 * Muvaffaqiyatda yopiladi. Drawer `document.body` ga portal qilinadi — jadval qatori (`<summary>`) ichida bo'lsa ham bosishlar qatorni ochib-yopmaydi.
 * `open` / `onOpenChange` berilsa — tashqaridan boshqariladi (masalan, qator menyusidan), `trigger` shart emas.
 */
export function FormDrawer({
  trigger, triggerClass = 'btn-primary', title, subtitle, action, submitLabel = 'Saqlash', children, danger, open: openProp, onOpenChange, defaultOpen = false,
}: {
  trigger?: ReactNode;
  triggerClass?: string;
  title: string;
  subtitle?: ReactNode;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel?: string;
  children: ReactNode;
  danger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Sahifa ochilganda darhol ochiq (masalan, bosh sahifadagi «Vazifa berish» → /vazifalar?ber=1). */
  defaultOpen?: boolean;
}) {
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v));
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const formId = useId();
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      {trigger && <button type="button" onClick={() => setOpen(true)} className={triggerClass}>{trigger}</button>}
      {open && createPortal(
        <div className="fixed inset-0 z-40 flex justify-end bg-navy/20 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          {/* `danger` (o'chirish/arxiv) o'z formasiga ega — asosiy formadan TASHQARIDA (ichma-ich form bo'lmaydi) */}
          <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col rounded-l-3xl bg-card shadow-[0_2px_6px_rgba(16,24,40,.06),0_24px_60px_rgba(16,24,40,.14)]">
            <div className="flex items-center gap-3 border-b border-line-soft px-6 py-[22px]">
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-xl font-bold tracking-[-0.01em]">{title}</h2>
                {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-icon" title="Yopish"><Icon name="close" /></button>
            </div>
            <form id={formId} action={formAction} className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 py-5">
              {children}
              {state?.error && <div className="rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text">{state.error}</div>}
            </form>
            <div className="flex items-center justify-between gap-2.5 border-t border-line-soft px-6 pt-4 pb-[22px]">
              <div>{danger}</div>
              <div className="flex gap-2.5">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Bekor qilish</button>
                <button form={formId} disabled={pending} className="btn-primary shadow-none">{pending ? 'Saqlanmoqda…' : submitLabel}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function Field({ label, hint, required, children }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}
