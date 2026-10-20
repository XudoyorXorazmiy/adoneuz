'use client';
import { useState } from 'react';
import { WEEKDAY_SHORT } from '@adone/core';
import { Field } from '@/components/ui/form-drawer';

type S = { id: string; name: string; kind: 'weekly' | 'cycle' | 'free'; weekdays: number[]; cycleOn: number; cycleOff: number; cycleStart: string | null; startTime: string; endTime: string; breakMinutes: number; graceMinutes: number };

export function ScheduleFields({ s, today }: { s?: S; today: string }) {
  const [kind, setKind] = useState<S['kind']>(s?.kind ?? 'weekly');
  const KINDS: Array<[S['kind'], string]> = [['weekly', 'Hafta kunlari'], ['cycle', 'Navbatli (2/2)'], ['free', 'Erkin grafik']];
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <input type="hidden" name="kind" value={kind} />
      <Field label="Nomi"><input name="name" defaultValue={s?.name} placeholder="Asosiy smena" className="input" required /></Field>
      <div>
        <span className="label">Turi</span>
        <div className="inline-flex rounded-lg border border-line-strong p-0.5">
          {KINDS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`h-8 rounded-md px-3 text-[13px] font-medium ${kind === k ? 'bg-primary text-white' : 'text-ink-2 hover:bg-subtle'}`}>{l}</button>
          ))}
        </div>
      </div>
      {kind === 'weekly' && (
        <div>
          <span className="label">Ish kunlari</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="weekdays" value={i + 1} defaultChecked={s ? s.weekdays.includes(i + 1) : i < 5} className="peer sr-only" />
                <span className="flex size-10 items-center justify-center rounded-lg border border-line-strong text-[13px] font-medium peer-checked:border-primary peer-checked:bg-primary-tint peer-checked:text-primary">{d}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {kind === 'cycle' && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ish kunlari"><input name="cycleOn" type="number" min={1} max={14} defaultValue={s?.cycleOn || 2} className="input tnum" /></Field>
          <Field label="Dam kunlari"><input name="cycleOff" type="number" min={0} max={14} defaultValue={s?.cycleOff ?? 2} className="input tnum" /></Field>
          <Field label="Boshlanish"><input name="cycleStart" type="date" defaultValue={s?.cycleStart ?? today} className="input tnum" /></Field>
        </div>
      )}
      {kind !== 'free' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Boshlanishi"><input name="startTime" type="time" defaultValue={s?.startTime ?? '09:00'} className="input tnum" /></Field>
            <Field label="Tugashi" hint="Tungi smena bo'lsa ertasi kungi vaqt (masalan 08:00)."><input name="endTime" type="time" defaultValue={s?.endTime ?? '18:00'} className="input tnum" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanaffus (daqiqa)"><input name="breakMinutes" type="number" min={0} max={240} defaultValue={s?.breakMinutes ?? 60} className="input tnum" /></Field>
            <Field label="Kechikish chegarasi (daqiqa)" hint="Shu daqiqagacha kechikish hisoblanmaydi."><input name="graceMinutes" type="number" min={0} max={120} defaultValue={s?.graceMinutes ?? 10} className="input tnum" /></Field>
          </div>
        </>
      ) : (
        <p className="m-0 rounded-lg bg-subtle px-3 py-2 text-[13px] text-muted">Erkin grafikda smena vaqti yo&apos;q: kechikish hisoblanmaydi, faqat ishlagan vaqt yoziladi.</p>
      )}
    </>
  );
}
