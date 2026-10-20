'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { createTenantAction, type CreateTenantState } from '@/lib/actions/platform';

export function CreateTenant({ plans }: { plans: Array<{ code: string; name: string; maxEmployees: number }> }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateTenantState, FormData>(createTenantAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  const v = state?.values ?? {};
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> Ishxona qo&apos;shish</button>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <form ref={form} action={action} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col bg-card">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="m-0 text-lg font-semibold">Yangi ishxona</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost size-9 px-0"><X size={18} /></button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              <label><span className="label">Ishxona nomi</span><input name="name" defaultValue={v.name} placeholder="Mudom bozor" className="input" required /></label>
              <label><span className="label">Egasining ismi</span><input name="ownerName" defaultValue={v.ownerName} placeholder="Aziz Karimov" className="input" required /></label>
              <label><span className="label">Egasining telefoni</span><input name="ownerPhone" defaultValue={v.ownerPhone} placeholder="+998 90 123 45 67" inputMode="tel" className="input tnum" required /></label>
              <label>
                <span className="label">Parol</span>
                <input name="password" defaultValue={v.password} placeholder="kamida 6 belgi" className="input" autoComplete="new-password" />
                <span className="mt-1 block text-xs text-muted">Telefon allaqachon ro&apos;yxatda bo&apos;lsa bo&apos;sh qoldiring — egasi eski paroli bilan kiradi.</span>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">Tarif</span>
                  <select name="planCode" defaultValue={v.planCode ?? 'sinov'} className="input">
                    {plans.map((p) => <option key={p.code} value={p.code}>{p.name} · {p.maxEmployees} xodim</option>)}
                  </select>
                </label>
                <label><span className="label">Sinov muddati (kun)</span><input name="trialDays" type="number" min={0} max={365} defaultValue={v.trialDays ?? '14'} className="input tnum" /></label>
              </div>
              {state?.error && <div className="rounded-lg bg-danger-tint px-3 py-2 text-[13px] text-danger-text">{state.error}</div>}
              {state?.ok && <div className="rounded-lg bg-success-tint px-3 py-2 text-[13px] text-success-text">{state.ok}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Yopish</button>
              <button disabled={pending} className="btn-primary">{pending ? 'Saqlanmoqda…' : 'Yaratish'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
