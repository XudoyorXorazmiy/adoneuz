'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/form-drawer';

type Ev = { id: string; label: string; suspicious: boolean };

export function CorrectFields({ employeeId, workDate, events }: { employeeId: string; workDate: string; events: Ev[] }) {
  const [action, setAction] = useState<'add_in' | 'add_out' | 'void' | 'approve'>('add_in');
  const ACTIONS: Array<[typeof action, string, boolean]> = [
    ['add_in', "Kirish qo'shish", true],
    ['add_out', "Chiqish qo'shish", true],
    ['void', 'Hodisani bekor qilish', events.length > 0],
    ['approve', 'Shubhalini tasdiqlash', events.some((e) => e.suspicious)],
  ];
  return (
    <>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="workDate" value={workDate} />
      <input type="hidden" name="action" value={action} />
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.filter((a) => a[2]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setAction(k)} className={`btn-sm btn ${action === k ? 'bg-primary text-white' : 'border border-line-strong text-ink-2'}`}>{l}</button>
        ))}
      </div>
      {(action === 'add_in' || action === 'add_out') && (
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Vaqt"><input name="time" type="time" required className="input tnum" /></Field>
          <label className="flex h-10 items-center gap-2 text-[13px]"><input type="checkbox" name="nextDay" value="1" /> ertasi kun (tungi smena)</label>
        </div>
      )}
      {(action === 'void' || action === 'approve') && (
        <Field label="Hodisa">
          <select name="target" className="input" required>
            {events.filter((e) => action === 'void' || e.suspicious).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="Sabab" hint="Majburiy. Jurnalga yoziladi, eski yozuv o'chirilmaydi.">
        <textarea name="reason" rows={2} required className="input h-auto py-2" placeholder="Masalan: telefoni o'chib qolgan, rahbar ko'rgan" />
      </Field>
    </>
  );
}
