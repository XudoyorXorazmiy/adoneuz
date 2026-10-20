import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, CheckCircle2, Circle, X } from 'lucide-react';
import { formatDate, formatTime, isoWeekday, WEEKDAY_LONG, WEEKDAY_SHORT } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listDay, summarize, today } from '@/server/attendance';
import { lastWeek, setupState } from '@/server/dashboard';
import { resolveSuspiciousAction } from '@/lib/actions/attendance';
import { Kpi } from '@/components/ui/page-header';
import { REASON_LABELS } from '@/components/attendance/badges';

export const metadata: Metadata = { title: 'Bosh sahifa' };

export default async function DashboardPage() {
  const user = await requireArea('dashboard');
  const t = today(user);
  const tz = user.tenantTimezone;
  const [setup, rows, week] = await Promise.all([setupState(user.tenantId), listDay(user, { date: t }), lastWeek(user, t)]);
  const c = summarize(rows);
  const title = `Bugun, ${formatDate(`${t}T12:00:00Z`)} · ${WEEKDAY_LONG[isoWeekday(t) - 1]}`;

  if (setup.active === 0) {
    const steps = [
      { done: true, title: 'Ishxona ochildi', text: `${user.tenantName} — panelga kirdingiz.`, href: null },
      { done: setup.branches > 0, title: "Filial qo'shish", text: 'Xaritadagi nuqta va radius — xodim shu zona ichida «Keldim» qila oladi.', href: '/filiallar' },
      { done: setup.schedules > 0, title: 'Ish jadvali', text: 'Smena vaqti, tanaffus va kechikish chegarasi.', href: '/jadvallar' },
      { done: setup.employees > 0, title: 'Xodimlarni taklif qilish', text: "Har xodimga havola: Telegram botda telefon, rozilik va dumaloq video so'raladi.", href: '/xodimlar' },
      { done: false, title: 'Xodimni tasdiqlash', text: "Xodim botda ro'yxatdan o'tgach «Tasdiq kutmoqda» bo'ladi — tasdiqlang.", href: '/xodimlar?holat=pending' },
    ];
    return (
      <>
        <div className="flex flex-col gap-1"><h1 className="page-title">{title}</h1><span className="text-muted">Xush kelibsiz, {user.name.split(' ')[0]}.</span></div>
        <div className="card-pad flex flex-col gap-4">
          <h2 className="m-0 text-base font-semibold">Ishga tushirish</h2>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {steps.map((s) => (
              <li key={s.title} className="flex gap-3">
                {s.done ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" /> : <Circle size={20} className="mt-0.5 shrink-0 text-line-strong" />}
                <div className="flex flex-col">
                  {s.href && !s.done ? <Link href={s.href} className="font-medium text-primary hover:underline">{s.title}</Link> : <span className={`font-medium ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>}
                  <span className="text-[13px] text-muted">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </>
    );
  }

  const inside = rows.filter((r) => r.result.open);
  const byBranch = new Map<string, typeof inside>();
  for (const r of inside) byBranch.set(r.branchName ?? 'Filialsiz', [...(byBranch.get(r.branchName ?? 'Filialsiz') ?? []), r]);
  const absent = rows.filter((r) => r.result.status === 'absent');
  const suspicious = rows.flatMap((r) => r.events.filter((e) => e.checkStatus === 'suspicious').map((e) => ({ r, e })))
    .filter(({ r, e }) => !r.events.some((x) => x.kind === 'correction' && (x.meta as { target?: string } | null)?.target === e.id));
  const maxWeek = Math.max(1, ...week.map((w) => w.present + w.late + w.absent));

  return (
    <>
      <h1 className="page-title">{title}</h1>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Ishda" value={<>{c.inside} <span className="text-base text-muted">/ {c.all}</span></>} tone="success" />
        <Kpi label="Kechikdi" value={c.late} tone="warning" />
        <Kpi label="Kelmadi" value={c.absent} tone="danger" />
        <Kpi label="Tekshiruv kutmoqda" value={suspicious.length} tone={suspicious.length ? 'warning' : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <section className="card flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="m-0 text-sm font-semibold">Hozir ishda</h2><Link href="/davomat?holat=inside" className="text-[13px] text-primary">Hammasi</Link></div>
          {inside.length === 0 ? <p className="m-0 px-4 py-8 text-center text-muted">Hozircha hech kim kirmagan.</p> : [...byBranch.entries()].map(([branch, list]) => (
            <div key={branch} className="flex flex-col">
              <div className="bg-page px-4 py-1.5 text-xs font-medium text-muted">{branch} · {list.length}</div>
              {list.map((r) => (
                <div key={r.id} className={`flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] ${r.result.lateMinutes ? 'bg-warning-tint/40' : ''}`}>
                  <span className="min-w-0"><span className="block truncate font-medium">{r.fullName}</span><span className="block truncate text-xs text-muted">{r.position ?? ''}</span></span>
                  <span className="tnum shrink-0 text-right">{formatTime(r.result.firstIn, tz)} dan beri{r.result.lateMinutes > 0 && <span className="block text-xs text-warning-text">kechikdi {r.result.lateMinutes} daqiqa</span>}</span>
                </div>
              ))}
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-6">
          <section className="card flex flex-col">
            <div className="border-b border-line px-4 py-3"><h2 className="m-0 text-sm font-semibold">Qaror kutmoqda</h2></div>
            {suspicious.length === 0 ? <p className="m-0 px-4 py-6 text-center text-[13px] text-muted">Shubhali belgi yo&apos;q.</p> : suspicious.map(({ r, e }) => (
              <div key={e.id} className="flex flex-col gap-2 border-t border-line px-4 py-3 text-[13px] first:border-0">
                <div className="flex justify-between gap-2"><span className="font-medium">{r.fullName}</span><span className="tnum text-muted">{formatTime(e.at, tz)}</span></div>
                <span className="text-warning-text">{e.reasons.map((x) => REASON_LABELS[x] ?? x).join(', ') || 'Shubhali'}{e.distanceM != null ? ` · ${e.distanceM} m` : ''}</span>
                <form action={resolveSuspiciousAction} className="flex gap-2">
                  <input type="hidden" name="employeeId" value={r.id} /><input type="hidden" name="workDate" value={t} /><input type="hidden" name="target" value={e.id} />
                  <button name="decision" value="approve" className="btn-primary btn-sm"><Check size={14} /> Tasdiqlash</button>
                  <button name="decision" value="reject" className="btn-secondary btn-sm text-danger-text"><X size={14} /> Rad etish</button>
                  {e.mediaId && <a href={`/api/media/${e.mediaId}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm ml-auto">Video</a>}
                </form>
              </div>
            ))}
          </section>

          <section className="card flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="m-0 text-sm font-semibold">Kelmaganlar</h2><span className="tnum text-[13px] text-muted">{absent.length}</span></div>
            {absent.length === 0 ? <p className="m-0 px-4 py-6 text-center text-[13px] text-muted">Hamma joyida.</p> : absent.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] first:border-0">
                <span className="truncate">{r.fullName}</span>
                <span className="tnum text-xs text-muted">smena {formatTime(r.shift?.start, tz)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      <section className="card-pad flex flex-col gap-3">
        <h2 className="m-0 text-sm font-semibold">Davomat — so&apos;nggi 7 kun</h2>
        <div className="flex h-40 items-end gap-3">
          {week.map((w) => {
            const h = (n: number) => `${(n / maxWeek) * 100}%`;
            return (
              <Link key={w.date} href={`/davomat?sana=${w.date}`} className="flex h-full flex-1 flex-col items-center gap-1" title={`Ishda ${w.present}, kechikdi ${w.late}, kelmadi ${w.absent}`}>
                <div className="flex w-full max-w-[56px] flex-1 flex-col-reverse overflow-hidden rounded-md bg-subtle">
                  <div className="bg-success" style={{ height: h(w.present) }} />
                  <div className="bg-warning" style={{ height: h(w.late) }} />
                  <div className="bg-danger" style={{ height: h(w.absent) }} />
                </div>
                <span className="text-xs text-muted">{WEEKDAY_SHORT[isoWeekday(w.date) - 1]} {Number(w.date.slice(8))}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-success" />Ishda</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" />Kechikdi</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-danger" />Kelmadi</span></div>
      </section>
    </>
  );
}
