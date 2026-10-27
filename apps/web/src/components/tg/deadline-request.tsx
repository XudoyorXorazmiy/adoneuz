'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { canRequestDeadline, type TaskStatus } from '@adone/core';
import { tgDeadlineRequestAction } from '@/lib/actions/miniapp';
import { Icon } from '@/components/ui/icon';
import { haptic, actionError } from './webapp';

export type DeadlineInfo = { status: string; requested: string; current: string | null; reason: string | null; comment: string | null } | null;

/** Ijrochi (Mini App): muddatni uzaytirish so'rovi — sana, vaqt, sabab; kutilayotgan so'rov va oxirgi qaror ko'rinadi. */
export function DeadlineRequest({ taskId, status, existing, today, defaultDate }: { taskId: string; status: TaskStatus; existing: DeadlineInfo; today: string; defaultDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!canRequestDeadline(status)) return null;
  if (existing?.status === 'pending') {
    return (
      <div className="flex gap-2.5 rounded-2xl bg-warning-tint p-3.5 text-warning-text">
        <Icon name="schedule_send" size={22} />
        <div className="text-sm"><b>Muddat so&apos;rovi yuborilgan:</b> {existing.requested}<div className="mt-0.5 text-xs opacity-75">Rahbar javobini kuting — Telegram&apos;da xabar keladi.</div></div>
      </div>
    );
  }
  const submit = async () => {
    setBusy(true); setErr(null);
    const r = await tgDeadlineRequestAction(taskId, date, time, reason).catch((e: unknown) => ({ error: actionError(e) }));
    setBusy(false);
    if (r.error) { setErr(r.error); haptic('error'); return; }
    haptic('success');
    setOpen(false);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      {existing && (
        <p className={`m-0 rounded-2xl px-3.5 py-2.5 text-[13px] ${existing.status === 'approved' ? 'bg-success-tint text-success' : 'bg-danger-tint text-danger-text'}`}>
          {existing.status === 'approved' ? `✅ Muddat uzaytirildi: ${existing.requested}` : `❌ Muddatni uzaytirish rad etildi${existing.comment ? ` — ${existing.comment}` : ''}`}
        </p>
      )}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary"><Icon name="more_time" size={18} />Muddatni uzaytirishni so&apos;rash</button>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
          <span className="text-sm font-bold">Yangi muddat</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="input tnum h-11" />
            <input value={time} onChange={(e) => setTime(e.target.value)} inputMode="numeric" maxLength={5} pattern="[0-2][0-9]:[0-5][0-9]" placeholder="18:00" className="input tnum h-11" />
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Sabab (rahbar ko‘radi)" className="input h-auto py-2.5 text-sm" />
          {err && <p className="m-0 text-[13px] font-semibold text-danger-text">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11 flex-1 text-sm">Bekor</button>
            <button type="button" disabled={busy} onClick={submit} className="btn-primary h-11 flex-1 text-sm shadow-none"><Icon name="send" size={18} />{busy ? 'Yuborilmoqda…' : 'Yuborish'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
