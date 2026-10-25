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
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Turi</span>
        <div className="flex gap-1 rounded-full bg-subtle p-1">
          {KINDS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`flex-1 rounded-full py-2 text-[13px] font-semibold whitespace-nowrap transition ${kind === k ? 'bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted hover:text-ink'}`}>{l}</button>
          ))}
        </div>
      </div>
      {kind === 'weekly' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Ish kunlari</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="weekdays" value={i + 1} defaultChecked={s ? s.weekdays.includes(i + 1) : i < 5} className="peer sr-only" />
                <span className="flex h-12 w-11 items-center justify-center rounded-full border border-line bg-card text-[13px] font-semibold text-ink-2 transition peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white">{d}</span>
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
        <p className="m-0 rounded-xl bg-page px-3.5 py-3 text-[13px] text-muted">Erkin grafikda smena vaqti yo&apos;q: kechikish hisoblanmaydi, faqat ishlagan vaqt yoziladi.</p>
      )}
    </>
  );
}
