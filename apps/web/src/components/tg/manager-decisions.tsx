'use client';
/** Rahbar Mini App'i — qaror tugmalari: xodimni tasdiqlash, ruxsat so'rovi, hisobotni baholash/qaytarish, vazifani bekor qilish, izoh. */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { tgApproveEmployeeAction, tgCommentTaskAction, tgDecideDeadlineAction, tgDecideLeaveAction, tgRemindEmployeeAction, tgResolveSuspiciousAction, tgReviewTaskAction } from '@/lib/actions/miniapp';

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

/** Vazifani bekor qilish (sabab majburiy) — vazifa o'chirilmaydi, «Bekor qilindi» bo'lib qoladi. */
export function TaskCancel({ id }: { id: string }) {
  const a = useAct();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (a.done) return <Done text={a.done} />;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-danger"><Icon name="block" size={16} />Vazifani bekor qilish</button>;
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-danger-tint p-3">
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={1000} placeholder="Sabab (majburiy) — xodimga yuboriladi" className="input h-auto py-2.5 text-sm" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary h-11 flex-1 text-sm">Bekor</button>
        <button type="button" disabled={a.pending || !reason.trim()} onClick={() => a.run('Vazifa bekor qilindi', () => tgReviewTaskAction(id, 'cancelled', null, reason))} className="btn h-11 flex-1 bg-danger text-sm text-white"><Icon name="block" size={18} />Bekor qilish</button>
      </div>
      <Err text={a.error} />
    </div>
  );
}

/** Izoh (yozishma): xodim Telegram'da ko'radi. Yuborilgach maydon tozalanadi, tarix yangilanadi. */
export function TaskComment({ id }: { id: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const send = () =>
    start(async () => {
      try {
        const r = await tgCommentTaskAction(id, text);
        if (r.error) setError(r.error);
        else { setError(null); setText(''); router.refresh(); }
      } catch {
        setError('Aloqa uzildi — qayta urinib ko‘ring');
      }
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000} placeholder="Izoh yozing…" className="input h-auto min-h-11 flex-1 py-2.5 text-sm" />
        <button type="button" disabled={pending || !text.trim()} onClick={send} className="btn-primary size-11 shrink-0 rounded-full p-0 shadow-none" aria-label="Yuborish"><Icon name="send" size={20} /></button>
      </div>
      <Err text={error} />
    </div>
  );
}

/** Shubhali keldi-ketdi: tasdiqlash (hodisa «ok» bo'ladi) yoki rad etish (bekor). */
export function SuspiciousDecision({ employeeId, workDate, target }: { employeeId: string; workDate: string; target: string }) {
  const a = useAct();
  if (a.done) return <Done text={a.done} />;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" disabled={a.pending} onClick={() => a.run('Tasdiqlandi', () => tgResolveSuspiciousAction(employeeId, workDate, target, true))} className="btn-primary h-11 flex-1 text-sm shadow-none"><Icon name="verified" size={18} />Tasdiqlash</button>
        <button type="button" disabled={a.pending} onClick={() => a.run('Rad etildi', () => tgResolveSuspiciousAction(employeeId, workDate, target, false))} className="btn-danger h-11 flex-1 text-sm"><Icon name="block" size={18} />Rad etish</button>
      </div>
      <Err text={a.error} />
    </div>
  );
}

/** Muddatni uzaytirish so'rovi: ruxsat / rad (ixtiyoriy izoh — xodimga boradi). */
export function DeadlineDecision({ id }: { id: string }) {
  const a = useAct();
  const [reject, setReject] = useState(false);
  const [comment, setComment] = useState('');
  if (a.done) return <Done text={a.done} />;
  return (
    <div className="flex flex-col gap-2">
      {reject ? (
        <>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} placeholder="Sabab (ixtiyoriy) — xodimga yuboriladi" className="input h-auto py-2.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setReject(false)} className="btn-secondary h-11 flex-1 text-sm">Bekor</button>
            <button type="button" disabled={a.pending} onClick={() => a.run('Rad etildi', () => tgDecideDeadlineAction(id, 'rejected', comment))} className="btn h-11 flex-1 bg-danger text-sm text-white">Rad etish</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={a.pending} onClick={() => a.run('Muddat uzaytirildi', () => tgDecideDeadlineAction(id, 'approved', ''))} className="btn-primary h-11 flex-1 text-sm shadow-none"><Icon name="event_available" size={18} />Ruxsat</button>
          <button type="button" disabled={a.pending} onClick={() => setReject(true)} className="btn-danger h-11 flex-1 text-sm"><Icon name="close" size={18} />Rad etish</button>
        </div>
      )}
      <Err text={a.error} />
    </div>
  );
}

/** Kelmagan xodimga bir bosishda eslatma (kuniga bir marta). `compact` — ro'yxat qatoridagi kichik tugma. */
export function RemindButton({ employeeId, compact = false }: { employeeId: string; compact?: boolean }) {
  const a = useAct();
  if (a.done) return <span className="flex items-center gap-1 text-[12px] font-semibold text-success"><Icon name="check_circle" size={16} fill />Yuborildi</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={a.pending} onClick={() => a.run('Eslatma yuborildi', () => tgRemindEmployeeAction(employeeId))} title="Eslatma yuborish"
        className={compact ? 'flex h-8 items-center gap-1 rounded-full bg-warning-tint px-2.5 text-[12px] font-bold text-warning' : 'btn-secondary h-11 w-full text-sm'}>
        <Icon name="notifications_active" size={compact ? 16 : 18} />{compact ? 'Eslatma' : 'Eslatma yuborish'}
      </button>
      {a.error && <span className={`font-semibold text-danger-text ${compact ? 'max-w-[120px] text-right text-[10px] leading-tight' : 'text-[12px]'}`}>{compact ? a.error.replace('Bugun eslatma allaqachon yuborilgan', 'Bugun yuborilgan') : a.error}</span>}
    </div>
  );
}
