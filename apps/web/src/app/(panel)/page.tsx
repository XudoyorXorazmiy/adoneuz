import type { Metadata } from 'next';
import { CheckCircle2, Circle } from 'lucide-react';
import { formatDate } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';

export const metadata: Metadata = { title: 'Bosh sahifa' };

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

/** 0-bosqich: ishxona ochilgani va keyingi qadamlar. Jonli davomat ko'rinishi 1-bosqichda (dizayn «Bosh sahifa»). */
export default async function DashboardPage() {
  const user = await requireArea('dashboard');
  const now = new Date();
  const weekday = WEEKDAYS[new Date(now.toLocaleString('en-US', { timeZone: user.tenantTimezone })).getDay()];
  const steps = [
    { done: true, title: 'Ishxona ochildi', text: `${user.tenantName} — panelga kirdingiz.` },
    { done: false, title: "Filial qo'shish", text: 'Xaritada manzil va radius (masalan 100 m) — xodim shu zona ichida «Keldim» qila oladi.' },
    { done: false, title: 'Ish jadvali', text: 'Smena vaqti, tanaffus va kechikish chegarasi.' },
    { done: false, title: 'Xodimlarni taklif qilish', text: "Har xodimga havola: Telegram botda telefon, rozilik va yuz namunasi so'raladi." },
  ];
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Bugun, {formatDate(now, user.tenantTimezone)} · {weekday}</h1>
        <span className="text-muted">Xush kelibsiz, {user.name.split(' ')[0]}.</span>
      </div>
      <div className="card-pad flex flex-col gap-4">
        <h2 className="m-0 text-base font-semibold">Ishga tushirish</h2>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3">
              {s.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" /> : <Circle size={20} className="mt-0.5 shrink-0 text-line-strong" />}
              <div className="flex flex-col">
                <span className={`font-medium ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                <span className="text-[13px] text-muted">{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="m-0 rounded-lg bg-primary-tint px-3 py-2 text-[13px] text-primary">Filiallar, jadvallar va xodimlar bo&apos;limlari keyingi yangilanishda ochiladi.</p>
      </div>
    </>
  );
}
