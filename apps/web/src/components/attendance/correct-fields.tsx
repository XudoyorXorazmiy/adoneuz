'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';

type Ev = { id: string; label: string; suspicious: boolean };

/**
 * Davomatni tuzatish (dizayn: «Davomatni tuzatish» drawer). Rejimlar:
 *   set     — Keldi / Ketdi vaqtini belgilash (eski birinchi kirish / oxirgi chiqish bekor bo'ladi)
 *   void    — noto'g'ri hodisani bekor qilish
 *   approve — shubhali hodisani tasdiqlash
 * `employees` berilsa (sarlavhadagi «Qo'lda belgilash») — xodim tanlanadi.
 */
export function CorrectFields({ employeeId, employees, workDate, inTime = '', outTime = '', events = [] }: {
  employeeId?: string; employees?: Array<{ id: string; name: string }>; workDate: string; inTime?: string; outTime?: string; events?: Ev[];
}) {
  const [mode, setMode] = useState<'set' | 'void' | 'approve'>('set');
  const [reason, setReason] = useState('');
  const MODES: Array<[typeof mode, string, boolean]> = [
    ['set', 'Vaqtni belgilash', true],
    ['void', 'Bekor qilish', events.length > 0],
    ['approve', 'Tasdiqlash', events.some((e) => e.suspicious)],
  ];
  const modes = MODES.filter((m) => m[2]);
  return (
    <>
      {employeeId && <input type="hidden" name="employeeId" value={employeeId} />}
      <input type="hidden" name="workDate" value={workDate} />
      <input type="hidden" name="action" value={mode} />
      {employees && (
        <Field label="Xodim" required>
          <select name="employeeId" required className="input" defaultValue="">
            <option value="" disabled>Tanlang…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
      )}
      {modes.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Amal</span>
          <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
            {modes.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMode(k)}
                className={`flex-1 rounded-full py-2 transition ${mode === k ? 'bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted hover:text-ink'}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {mode === 'set' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Keldi">
            <span className="relative flex items-center">
              <Icon name="login" size={18} className="pointer-events-none absolute left-3 text-muted" />
              <input name="in" defaultValue={inTime} placeholder="09:00" inputMode="numeric" maxLength={5} pattern="[0-2][0-9]:[0-5][0-9]" title="Masalan, 09:00" className="input tnum pl-9 font-semibold" />
            </span>
          </Field>
          <div className="flex flex-col gap-1.5">
            <Field label="Ketdi">
              <span className="relative flex items-center">
                <Icon name="logout" size={18} className="pointer-events-none absolute left-3 text-primary" />
                <input name="out" defaultValue={outTime} placeholder="18:00" inputMode="numeric" maxLength={5} pattern="[0-2][0-9]:[0-5][0-9]" title="Masalan, 09:00" className="input tnum pl-9 font-semibold" />
              </span>
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="outNextDay" value="1" /> ertasi kun (tungi smena)</label>
          </div>
        </div>
      )}
      {(mode === 'void' || mode === 'approve') && (
        <Field label="Hodisa" required>
          <select name="target" className="input" required>
            {events.filter((e) => mode === 'void' || e.suspicious).map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="Sabab" required>
        <textarea name="reason" rows={3} required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
          className="input h-auto min-h-24 py-3 leading-normal" placeholder="Masalan: rahbar topshirig'i bilan bankka borgan, 18:00 gacha ishlagan deb hisoblansin" />
        <span className="self-end text-xs text-placeholder tnum">{reason.length} / 300</span>
      </Field>
      <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2.5 text-[13px] font-semibold text-primary">
        <Icon name="history" size={18} />O&apos;zgarish jurnalga yoziladi — eski yozuv o&apos;chirilmaydi
      </div>
    </>
  );
}
