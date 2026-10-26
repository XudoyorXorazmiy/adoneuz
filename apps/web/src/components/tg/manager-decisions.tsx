'use client';
/** Rahbar Mini App'i — qaror tugmalari: xodimni tasdiqlash, ruxsat so'rovi, hisobotni baholash/qaytarish. */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { tgApproveEmployeeAction, tgDecideLeaveAction, tgReviewTaskAction } from '@/lib/actions/miniapp';

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (label: string, fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.error) setError(r.error);
        else { setError(null); setDone(label); router.refresh(); }
      } catch {
        setError('Aloqa uzildi — qayta urinib ko‘ring');
      }
    });
  return { pending, error, done, run };
}

const Err = ({ text }: { text: string | null }) => (text ? <p className="m-0 text-[13px] font-semibold text-danger-text">{text}</p> : null);
const Done = ({ text }: { text: string | null }) => (text ? <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-success"><Icon name="check_circle" size={16} fill />{text}</p> : null);

export function ApproveEmployee({ id }: { id: string }) {
  const a = useAct();
  if (a.done) return <Done text={a.done} />;
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={a.pending} onClick={() => a.run('Tasdiqlandi', () => tgApproveEmployeeAction(id))} className="btn-primary h-11 w-full text-sm shadow-none"><Icon name="how_to_reg" size={18} />Tasdiqlash</button>
      <Err text={a.error} />
    </div>
  );
}

export function LeaveDecision({ id }: { id: string }) {
  const a = useAct();
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState('');
  if (a.done) return <Done text={a.done} />;
  return (
    <div className="flex flex-col gap-2">
      {reject ? (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} placeholder="Sabab (xodimga Telegram'da yuboriladi)" className="input h-auto py-2.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setReject(false)} className="btn-secondary h-11 flex-1 text-sm">Bekor</button>
            <button type="button" disabled={a.pending} onClick={() => a.run('Rad etildi', () => tgDecideLeaveAction(id, 'rejected', reason))} className="btn h-11 flex-1 bg-danger text-sm text-white">Rad etish</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={a.pending} onClick={() => a.run('Tasdiqlandi', () => tgDecideLeaveAction(id, 'approved', ''))} className="btn-primary h-11 flex-1 text-sm shadow-none"><Icon name="check" size={18} />Tasdiqlash</button>
          <button type="button" disabled={a.pending} onClick={() => setReject(true)} className="btn-danger h-11 flex-1 text-sm"><Icon name="close" size={18} />Rad etish</button>
        </div>
      )}
      <Err text={a.error} />
    </div>
  );
}

export function TaskReview({ id }: { id: string }) {
  const a = useAct();
  const [rating, setRating] = useState<number | null>(null);
  const [revise, setRevise] = useState(false);
  const [reason, setReason] = useState('');
  if (a.done) return <Done text={a.done} />;
  return (
    <div className="flex flex-col gap-2.5">
      {revise ? (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} placeholder="Nimani tuzatsin? (majburiy)" className="input h-auto py-2.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setRevise(false)} className="btn-secondary h-11 flex-1 text-sm">Bekor</button>
            <button type="button" disabled={a.pending || !reason.trim()} onClick={() => a.run('Qaytarildi', () => tgReviewTaskAction(id, 'revision', null, reason))} className="btn h-11 flex-1 bg-danger text-sm text-white"><Icon name="replay" size={18} />Qaytarish</button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[13px] text-muted">Baho:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(rating === n ? null : n)} className={`text-2xl leading-none ${rating != null && n <= rating ? 'text-warning' : 'text-[#D7DBE2]'}`} aria-label={`${n} baho`}>★</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={a.pending} onClick={() => a.run(rating ? `Tasdiqlandi · ${'★'.repeat(rating)}` : 'Tasdiqlandi', () => tgReviewTaskAction(id, 'approved', rating, ''))} className="btn-primary h-11 flex-1 text-sm shadow-none"><Icon name="check" size={18} />Tasdiqlash</button>
            <button type="button" disabled={a.pending} onClick={() => setRevise(true)} className="btn-secondary h-11 flex-1 text-sm"><Icon name="replay" size={18} />Qaytarish</button>
          </div>
        </>
      )}
      <Err text={a.error} />
    </div>
  );
}
