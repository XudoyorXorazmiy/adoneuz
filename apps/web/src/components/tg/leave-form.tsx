'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, LEAVE_KINDS, type LeaveKind } from '@adone/core';
import { tgCancelLeaveAction, tgLeaveAction } from '@/lib/actions/miniapp';
import { haptic, actionError } from './webapp';

/** Ruxsat so'rash formasi (Mini App). Davr — bitta kun yoki «gacha». */
export function LeaveForm({ today }: { today: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<LeaveKind>('sick');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const send = async () => {
    setBusy(true);
    const fd = new FormData();
    fd.set('kind', kind); fd.set('from', from); fd.set('to', to < from ? from : to); fd.set('reason', reason);
    const r = await tgLeaveAction(fd).catch((e: unknown) => ({ error: actionError(e) }));
    setBusy(false); setMsg(r); haptic(r.error ? 'error' : 'success');
    if (!r.error) { setReason(''); router.refresh(); }
  };
  const chip = (on: boolean) => `inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold ${on ? 'border-primary bg-primary-tint text-primary' : 'border-line bg-card'}`;
  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap gap-2">
        {LEAVE_KINDS.map((k) => <button key={k} onClick={() => setKind(k)} className={chip(kind === k)}><span>{LEAVE_KIND_ICONS[k]}</span>{LEAVE_KIND_LABELS[k]}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 text-sm font-semibold">Qachondan<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className="input h-11" /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">Qachongacha<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input h-11" /></label>
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder="Sabab (ixtiyoriy)" className="input h-auto py-2.5 text-[15px]" />
      {msg?.error && <p className="m-0 rounded-xl bg-danger-tint px-3 py-2 text-sm font-semibold text-danger">{msg.error}</p>}
      {msg?.ok && <p className="m-0 rounded-xl bg-success-tint px-3 py-2 text-sm font-semibold text-success">So&apos;rov yuborildi — rahbar javobi Telegram&apos;ga keladi.</p>}
      <button disabled={busy} onClick={send} className="btn-primary h-12 w-full text-base">{busy ? 'Yuborilmoqda…' : "So'rov yuborish"}</button>
    </section>
  );
}

export function CancelLeave({ id }: { id: string }) {
  const router = useRouter();
  return <button onClick={async () => { await tgCancelLeaveAction(id); router.refresh(); }} className="text-xs font-bold text-danger">Bekor qilish</button>;
}
