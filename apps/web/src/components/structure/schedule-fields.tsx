'use client';
import { useState } from 'react';
import { WEEKDAY_SHORT } from '@adone/core';
import { Field } from '@/components/ui/form-drawer';

type DayTimes = { weekdays: number[]; startTime: string; endTime: string };
type S = {
  id: string; name: string; kind: 'weekly' | 'cycle' | 'free'; weekdays: number[]; cycleOn: number; cycleOff: number; cycleStart: string | null; startTime: string; endTime: string;
  dayTimes: DayTimes[]; altStartTime: string | null; altEndTime: string | null; altAnchor: string | null; breakMinutes: number; graceMinutes: number;
};

export function ScheduleFields({ s, today }: { s?: S; today: string }) {
  const [kind, setKind] = useState<S['kind']>(s?.kind ?? 'weekly');
  const [dayTimes, setDayTimes] = useState<DayTimes[]>(s?.dayTimes ?? []);
  const [alt, setAlt] = useState(Boolean(s?.altStartTime));
  const setDt = (i: number, patch: Partial<DayTimes>) => setDayTimes((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggleDay = (i: number, d: number) => setDt(i, { weekdays: dayTimes[i]!.weekdays.includes(d) ? dayTimes[i]!.weekdays.filter((x) => x !== d) : [...dayTimes[i]!.weekdays, d].sort() });
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
          {kind === 'weekly' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">Ayrim kunlarda boshqa vaqt</span>
                {dayTimes.length < 3 && (
                  <button type="button" onClick={() => setDayTimes((xs) => [...xs, { weekdays: [], startTime: '11:00', endTime: '23:00' }])} className="text-[13px] font-semibold text-primary">+ Qo&apos;shish</button>
                )}
              </div>
              {dayTimes.map((dt, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                  <input type="hidden" name={`dtDays${i}`} value={dt.weekdays.join(',')} />
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_SHORT.map((d, k) => {
                      const on = dt.weekdays.includes(k + 1);
                      return <button key={d} type="button" onClick={() => toggleDay(i, k + 1)} className={`flex h-9 w-10 items-center justify-center rounded-full border text-xs font-semibold transition ${on ? 'border-navy bg-navy text-white' : 'border-line bg-card text-ink-2'}`}>{d}</button>;
                    })}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <Field label="Boshlanishi"><input name={`dtStart${i}`} type="time" value={dt.startTime} onChange={(e) => setDt(i, { startTime: e.target.value })} className="input tnum" /></Field>
                    <Field label="Tugashi"><input name={`dtEnd${i}`} type="time" value={dt.endTime} onChange={(e) => setDt(i, { endTime: e.target.value })} className="input tnum" /></Field>
                    <button type="button" onClick={() => setDayTimes((xs) => xs.filter((_, j) => j !== i))} className="btn-ghost h-11 px-3 text-danger-text">O&apos;chirish</button>
                  </div>
                </div>
              ))}
              {dayTimes.length === 0 && <p className="m-0 text-xs text-muted">Masalan: Du, Ch, Ju — 08:00–20:00, qolgan kunlar 11:00–23:00.</p>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="text-[13px] font-semibold">Haftalik almashinuv</span>
              <input type="checkbox" name="altOn" value="1" checked={alt} onChange={(e) => setAlt(e.target.checked)} className="size-5 accent-navy" />
            </label>
            {alt && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="2-hafta boshi"><input name="altStartTime" type="time" defaultValue={s?.altStartTime ?? '08:00'} className="input tnum" /></Field>
                <Field label="2-hafta tugashi"><input name="altEndTime" type="time" defaultValue={s?.altEndTime ?? '20:00'} className="input tnum" /></Field>
                <Field label="Asosiy vaqt haftasi" hint="Shu sana haftasida yuqoridagi vaqt, keyingi haftada 2-hafta vaqti."><input name="altAnchor" type="date" defaultValue={s?.altAnchor ?? today} className="input tnum" /></Field>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanaffus (daqiqa)" hint="Bo'linma smena (08:00–11:30 va 18:00–23:00) — 08:00–23:00 va 390 daqiqa tanaffus."><input name="breakMinutes" type="number" min={0} max={600} defaultValue={s?.breakMinutes ?? 60} className="input tnum" /></Field>
            <Field label="Kechikish chegarasi (daqiqa)" hint="Shu daqiqagacha kechikish hisoblanmaydi."><input name="graceMinutes" type="number" min={0} max={120} defaultValue={s?.graceMinutes ?? 10} className="input tnum" /></Field>
          </div>
        </>
      ) : (
        <p className="m-0 rounded-xl bg-page px-3.5 py-3 text-[13px] text-muted">Erkin grafikda smena vaqti yo&apos;q: kechikish hisoblanmaydi, faqat ishlagan vaqt yoziladi.</p>
      )}
    </>
  );
}
