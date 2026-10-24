'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';

/** «Ish qo'shish» (§7a): bajarilgan ish hisoboti yoki o'ziga reja. */
export function WorkFields({ today, needsApproval }: { today: string; needsApproval: boolean }) {
  const [mode, setMode] = useState<'done' | 'plan'>('done');
  return (
    <>
      <input type="hidden" name="mode" value={mode} />
      <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
        {([['done', 'task_alt', 'Bajardim'], ['plan', 'event_note', 'Rejalashtiraman']] as const).map(([k, icon, l]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 ${mode === k ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>
            <Icon name={icon} size={18} />{l}
          </button>
        ))}
      </div>
      <Field label={mode === 'done' ? 'Nima qildingiz?' : 'Nima qilmoqchisiz?'} required>
        <input name="title" required maxLength={200} placeholder={mode === 'done' ? 'Yangi kelgan 40 ta tovarni qabul qildim' : 'Ombor inventarizatsiyasi'} className="input" />
      </Field>
      <Field label="Izoh">
        <textarea name="note" rows={3} maxLength={1000} className="input h-auto min-h-20 py-3 leading-normal" placeholder="Qo'shimcha tafsilot (ixtiyoriy)" />
      </Field>
      {mode === 'done' ? (
        <Field label="Sarflangan vaqt (daqiqa)">
          <input name="spentMinutes" type="number" min={1} max={1440} placeholder="90" className="input tnum w-40" />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qachongacha"><input name="dueDate" type="date" defaultValue={today} min={today} className="input tnum" /></Field>
          <Field label="Vaqt"><input name="dueTime" defaultValue="18:00" inputMode="numeric" maxLength={5} pattern="[0-2][0-9]:[0-5][0-9]" className="input tnum" /></Field>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-[13px] font-semibold text-primary">
        <Icon name="info" size={18} />
        {mode === 'plan' ? "Reja «Mening ishlarim»da turadi; bajargach «Bajardim» bosasiz." : needsApproval ? 'Ish jurnalga yoziladi va rahbar tasdiqlaydi.' : 'Ish jurnalga yoziladi (tasdiqsiz).'}
      </div>
    </>
  );
}
