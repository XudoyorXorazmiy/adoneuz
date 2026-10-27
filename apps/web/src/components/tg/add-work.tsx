'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tgAddWorkAction } from '@/lib/actions/miniapp';
import { Icon } from '@/components/ui/icon';
import { haptic, shrinkImage, actionError } from './webapp';

const SPENT: Array<[number, string]> = [[15, '15 daq'], [30, '30 daq'], [60, '1 soat'], [120, '2 soat']];

/** «Ish qo'shish» (dizayn, §7a): bajarilgan ish (vaqt, rasm, izoh) yoki reja (muddat). */
export function AddWork({ today, needsApproval }: { today: string; needsApproval: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'done' | 'plan'>('done');
  const [title, setTitle] = useState('');
  const [spent, setSpent] = useState<number | null>(60);
  const [other, setOther] = useState(false);
  const [note, setNote] = useState('');
  const [due, setDue] = useState(today);
  const [shots, setShots] = useState<Array<{ blob: Blob; url: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set('mode', mode); fd.set('title', title); fd.set('note', note);
    if (mode === 'done' && spent) fd.set('spentMinutes', String(spent));
    if (mode === 'plan') { fd.set('dueDate', due); fd.set('dueTime', '18:00'); }
    shots.forEach((s, i) => fd.append('photo', new File([s.blob], `w${i}.jpg`, { type: 'image/jpeg' })));
    const r = await tgAddWorkAction(fd).catch((e: unknown) => ({ error: actionError(e) }));
    setBusy(false);
    if ('error' in r && r.error) { setErr(r.error); haptic('error'); return; }
    haptic('success');
    router.push('/tg/vazifalar?qoshildi=1');
  };
  const chip = (on: boolean) => `h-10 rounded-full border px-4 text-[15px] font-semibold ${on ? 'border-primary bg-primary-tint text-primary' : 'border-line bg-card'}`;
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-3">
      <div className="flex gap-1 rounded-2xl bg-subtle p-1 text-[15px] font-semibold">
        {([['done', 'Bajardim'], ['plan', 'Rejalashtiraman']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`flex-1 rounded-xl py-2.5 ${mode === k ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{mode === 'done' ? 'Nima qildingiz?' : 'Nima qilmoqchisiz?'}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={mode === 'done' ? 'Vitrinadagi narxlarni yangiladim' : 'Ombor inventarizatsiyasi'} className="input h-12 text-[15px]" />
      </label>
      {mode === 'done' ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Sarflangan vaqt</span>
          <div className="flex flex-wrap gap-2">
            {SPENT.map(([m, l]) => <button key={m} onClick={() => { setSpent(m); setOther(false); }} className={chip(!other && spent === m)}>{l}</button>)}
            <button onClick={() => { setOther(true); setSpent(null); }} className={chip(other)}>Boshqa</button>
          </div>
          {other && <input type="number" min={1} max={1440} inputMode="numeric" placeholder="Daqiqa" onChange={(e) => setSpent(Number(e.target.value) || null)} className="input h-11 w-40" />}
        </div>
      ) : (
        <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Qachongacha</span><input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} className="input h-12 w-48" /></label>
      )}
      <div className="grid grid-cols-[88px_1fr] gap-2.5">
        {mode === 'done' && (
          shots[0] ? (
            <button onClick={() => setShots([])} className="relative size-[88px] overflow-hidden rounded-2xl"><img src={shots[0].url} alt="" className="size-full object-cover" /><span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink/60 text-white"><Icon name="close" size={16} /></span></button>
          ) : (
            <button onClick={() => input.current?.click()} className="flex size-[88px] flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-line-strong text-xs font-semibold text-primary"><Icon name="photo_camera" size={24} />Suratga olish</button>
          )
        )}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Izoh (ixtiyoriy)" className={`input h-[88px] py-3 text-[15px] ${mode === 'plan' ? 'col-span-2' : ''}`} />
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const b = await shrinkImage(f); setShots([{ blob: b, url: URL.createObjectURL(b) }]); } }} />
      <div className="flex items-center gap-2 text-[13px] text-muted"><Icon name="info" size={18} />{mode === 'plan' ? "Reja vazifalaringiz ro'yxatiga qo'shiladi" : needsApproval ? 'Rahbaringiz tasdiqlaydi' : 'Ish jurnalga yoziladi'}</div>
      <div className="sticky bottom-0 mt-auto -mx-4 flex flex-col gap-2 bg-gradient-to-t from-page via-page to-page/0 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),16px)]">
        {err && <p className="m-0 rounded-xl bg-danger-tint px-3 py-2.5 text-sm font-semibold text-danger">{err}</p>}
        <button disabled={busy || title.trim().length < 3} onClick={save} className="btn-primary h-[52px] w-full text-base">{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
      </div>
    </div>
  );
}
