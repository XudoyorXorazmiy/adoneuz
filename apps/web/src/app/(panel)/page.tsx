import type { Metadata } from 'next';
import Link from 'next/link';
import { addDays, formatMinutes, formatTime, isoWeekday, monthDays, MONTHS, WEEKDAY_SHORT, zonedParts } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listDay, summarize, today } from '@/server/attendance';
import { dailyAgg, deltaPct, memberLinked, pendingEmployees, setupState, weekStart } from '@/server/dashboard';
import { setEmployeeStatusAction } from '@/lib/actions/employees';
import { CardHead, PageHeader } from '@/components/ui/page-header';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';
import { Delta } from '@/components/dashboard/delta';
import { PresenceTable, type PresenceRow } from '@/components/dashboard/presence-table';
import { EvidenceCard } from '@/components/dashboard/evidence-card';
import { TelegramLinkCard } from '@/components/shell/telegram-link';

export const metadata: Metadata = { title: 'Bosh sahifa' };

/** Dizayn: design/panel/Bosh sahifa.dc.html (bento). */
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const greeting = (h: number) => (h < 5 ? 'Xayrli tun!' : h < 12 ? 'Xayrli tong!' : h < 18 ? 'Xayrli kun!' : 'Xayrli kech!');

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const user = await requireArea('dashboard');
  const sp = await searchParams;
  const tz = user.tenantTimezone;
  const t = today(user);
  const month = typeof sp.oy === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.oy) && sp.oy <= t.slice(0, 7) ? sp.oy : t.slice(0, 7);
  const tab = ['davomat', 'xodimlar'].includes(String(sp.qaror)) ? String(sp.qaror) : 'all';
  const ws = weekStart(t);
  const prevWs = addDays(ws, -7);
  const from = [`${month}-01`, prevWs].sort()[0]!;
  const [setup, rows, agg, linked, pending] = await Promise.all([
    setupState(user.tenantId),
    listDay(user, { date: t }),
    dailyAgg(user, from, addDays(ws, 6) > `${month}-31` ? addDays(ws, 6) : `${month}-31`),
    memberLinked(user.tenantId, user.id),
    pendingEmployees(user),
  ]);
  const hour = zonedParts(new Date(), tz).h;
  const header = (decisions: number) => (
    <PageHeader
      eyebrow={`Salom, ${user.name.split(' ')[0]}`}
      title={greeting(hour)}
      alert={decisions > 0}
      notice={decisions > 0 ? (
        <a href="#qaror" className="flex items-center gap-2 text-sm font-medium">
          <span className="flex size-[18px] items-center justify-center rounded-full bg-warning text-xs font-extrabold text-white">!</span>
          <span><b className="font-bold">{decisions} ta qaror</b> kutmoqda — <span className="font-semibold underline">ko&apos;rish</span></span>
          <Icon name="arrow_outward" size={16} />
        </a>
      ) : undefined}
    >
      <a href={`/api/eksport/tabel?oy=${t.slice(0, 7)}`} title="Tabel — Excel" className="btn-icon size-11"><Icon name="download" /></a>
      <Link href="/xodimlar" className="btn-primary h-11 px-5"><Icon name="add" />Xodim qo&apos;shish</Link>
    </PageHeader>
  );

  // ---------- Ishga tushirish (faol xodim yo'q) ----------
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
        {header(pending.length)}
        {!linked && <TelegramLinkCard />}
        <section className="card flex flex-col gap-4 p-6">
          <CardHead icon={<Icon name="rocket_launch" fill size={18} />} title="Ishga tushirish" />
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {steps.map((s) => (
              <li key={s.title} className="flex gap-3">
                <Icon name={s.done ? 'check_circle' : 'radio_button_unchecked'} fill={s.done} size={22} className={s.done ? 'text-success' : 'text-line-strong'} />
                <div className="flex flex-col">
                  {s.href && !s.done ? <Link href={s.href} className="font-bold text-primary hover:underline">{s.title}</Link> : <span className={`font-bold ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>}
                  <span className="text-[13px] text-muted">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </>
    );
  }

  // ---------- Jonli ko'rinish ----------
  const c = summarize(rows);
  const weekAgo = agg.get(addDays(t, -7));
  const todayIn = c.present + c.late;
  const inside = rows.filter((r) => r.result.open);
  const suspicious = rows
    .flatMap((r) => r.events.filter((e) => e.checkStatus === 'suspicious').map((e) => ({ r, e })))
    .filter(({ r, e }) => !r.events.some((x) => x.kind === 'correction' && (x.meta as { target?: string } | null)?.target === e.id));
  const decisions = suspicious.length + pending.length;

  // Davomat tahlili — oy kunlari (bugun — jonli hisob)
  const days = monthDays(month);
  const counts = days.map((d) => (d === t ? todayIn : d > t ? 0 : (agg.get(d)?.present ?? 0) + (agg.get(d)?.late ?? 0)));
  const past = counts.filter((v, i) => days[i]! <= t && v > 0);
  const avg = past.length ? Math.round(past.reduce((a, b) => a + b, 0) / past.length) : 0;
  const top = Math.max(10, Math.ceil(Math.max(c.all, ...counts) / 10) * 10);
  const ticks = [5, 4, 3, 2, 1, 0].map((k) => Math.round((top / 5) * k));
  const [y, m] = month.split('-').map(Number) as [number, number];
  const prevMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  // O'rtacha ish vaqti — shu hafta va o'tgan hafta
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const avgWorked = (dates: string[]) => {
    let w = 0, n = 0;
    for (const d of dates) { const a = agg.get(d); if (a && d < t) { w += a.worked; n += a.workedDays; } }
    if (dates.includes(t)) for (const r of rows) if (r.result.workedMinutes > 0) { w += r.result.workedMinutes; n++; }
    return n ? Math.round(w / n) : 0;
  };
  const thisAvg = avgWorked(weekDays);
  const lastAvg = avgWorked(Array.from({ length: 7 }, (_, i) => addDays(prevWs, i)));

  const presence: PresenceRow[] = inside.map((r) => {
    const cin = [...r.events].reverse().find((e) => e.kind === 'check_in' && e.checkStatus !== 'rejected');
    return {
      id: r.id, name: r.fullName, position: r.position ?? '—', branch: r.branchName?.replace(/^.*—\s*/, '') ?? '—',
      inAt: formatTime(r.result.firstIn, tz), worked: hm(r.result.workedMinutes), late: r.result.lateMinutes, suspicious: r.result.suspicious,
      locOk: !!cin && !cin.reasons.includes('outside'), hasVideo: !!cin?.mediaId, face: cin?.faceScore != null ? Math.round(cin.faceScore * 100) : null,
    };
  });

  return (
    <>
      {header(decisions)}
      {!linked && <TelegramLinkCard />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Davomat tahlili */}
        <section className="card px-6 pt-5 pb-[18px]">
          <CardHead icon={<Icon name="bar_chart" fill size={18} />} title="Davomat tahlili">
            <span className="flex h-9 items-center gap-1 rounded-full border border-line px-1 text-[13px] font-semibold">
              <Link href={`/?oy=${prevMonth}`} className="flex size-7 items-center justify-center rounded-full hover:bg-subtle"><Icon name="chevron_left" size={18} /></Link>
              <Icon name="calendar_today" size={18} />{MONTHS[m - 1]} {y}
              {month < t.slice(0, 7) ? <Link href={`/?oy=${nextMonth}`} className="flex size-7 items-center justify-center rounded-full hover:bg-subtle"><Icon name="chevron_right" size={18} /></Link> : <span className="w-2" />}
            </span>
            <Link href="/davomat/tabel" className="btn-icon size-9" title="Oylik tabel"><Icon name="more_horiz" /></Link>
          </CardHead>
          <div className="mt-4 flex flex-wrap items-center gap-6 text-[13px]">
            <span className="text-muted">Jami xodim: <b className="font-bold text-ink">{c.all}</b></span>
            <span className="flex items-center gap-2 text-muted">Bugun ishda: <b className="font-bold text-ink">{todayIn}</b><Delta value={deltaPct(todayIn, (weekAgo?.present ?? 0) + (weekAgo?.late ?? 0))} /></span>
            <span className="flex items-center gap-2 text-muted">Kechikdi: <b className="font-bold text-ink">{c.late}</b><Delta value={deltaPct(c.late, weekAgo?.late ?? 0)} goodWhenUp={false} /></span>
          </div>
          <div className="mt-[18px] flex gap-2.5">
            <div className="flex h-[220px] w-6 flex-col justify-between text-right text-[11px] text-placeholder">
              {ticks.map((v, i) => <span key={i} className={i === 0 ? '-translate-y-1.5' : i === 5 ? 'translate-y-1.5' : ''}>{v}</span>)}
            </div>
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="relative h-[220px] bg-[linear-gradient(#F1F2F5_1px,transparent_1px)] bg-[length:100%_44px]">
                  {avg > 0 && (
                    <>
                      <div className="absolute right-0 left-0 border-t-[1.5px] border-dashed border-navy opacity-55" style={{ bottom: `${(avg / top) * 100}%` }} />
                      <div className="absolute -left-1 z-10 translate-y-1/2 rounded-md bg-navy px-[7px] py-[3px] text-[10px] font-bold text-white" style={{ bottom: `${(avg / top) * 100}%` }}>O&apos;rtacha {avg}</div>
                    </>
                  )}
                  <div className="absolute inset-0 flex items-end gap-1.5 pl-[76px]">
                    {days.map((d, i) => {
                      const v = counts[i]!;
                      const isToday = d === t;
                      return (
                        <Link key={d} href={`/davomat?sana=${d}`} className="relative flex h-full flex-1 items-end justify-center" title={`${Number(d.slice(8))}-kun: ${v} kishi`}>
                          {d > t ? (
                            <div className="h-full w-full max-w-[18px] rounded-full bg-[#F6F7F9]" />
                          ) : (
                            <div className={`relative w-full max-w-[18px] rounded-full ${isToday ? 'bg-primary shadow-[0_6px_14px_rgba(36,67,245,.3)]' : 'bg-bar'}`} style={{ height: `${Math.max(3, (v / top) * 100)}%` }}>
                              {isToday && <div className="absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 rounded-lg bg-navy px-2 py-1 text-[11px] font-bold whitespace-nowrap text-white">{v}</div>}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5 pl-[76px]">
                  {days.map((d) => <div key={d} className={`flex-1 text-center text-[10px] ${d === t ? 'font-extrabold text-primary' : d > t ? 'text-[#C4C9D2]' : 'text-placeholder'}`}>{Number(d.slice(8))}</div>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* O'rtacha ish vaqti */}
        <section className="card flex flex-col gap-4 p-5">
          <CardHead icon={<Icon name="schedule" fill size={18} />} title="O'rtacha ish vaqti">
            <Link href="/davomat/tabel" className="btn-icon size-9"><Icon name="more_horiz" /></Link>
          </CardHead>
          <div>
            <div className="flex items-center gap-2.5"><span className="text-[30px] font-extrabold tracking-[-0.03em]">{thisAvg ? formatMinutes(thisAvg).replace('daqiqa', 'daq') : '—'}</span><Delta value={deltaPct(thisAvg, lastAvg)} /></div>
            <div className="mt-0.5 text-[13px] text-muted">Bu hafta, bir kunda</div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d) => {
              const isT = d === t;
              const worked = d < t && ((agg.get(d)?.present ?? 0) + (agg.get(d)?.late ?? 0)) > 0;
              const cls = isT ? 'border-navy bg-navy text-white' : worked ? 'border-primary-tint bg-primary-tint text-primary' : 'border-line bg-card text-placeholder';
              return (
                <Link key={d} href={`/davomat?sana=${d > t ? t : d}`} className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-full border ${cls}`}>
                  <span className="text-[10px] font-semibold opacity-80">{WEEKDAY_SHORT[isoWeekday(d) - 1]}</span>
                  <span className="text-[13px] font-bold">{Number(d.slice(8))}</span>
                  <span className={`size-1 rounded-full ${isT ? 'bg-white' : 'bg-transparent'}`} />
                </Link>
              );
            })}
          </div>
          <div className="flex flex-col gap-3">
            {[
              { c: 'bg-success', v: todayIn, l: 'Ishda', d: deltaPct(todayIn, (weekAgo?.present ?? 0) + (weekAgo?.late ?? 0)), up: true },
              { c: 'bg-warning', v: c.late, l: 'Kechikdi', d: deltaPct(c.late, weekAgo?.late ?? 0), up: false },
              { c: 'bg-danger', v: c.absent, l: 'Kelmadi', d: deltaPct(c.absent, weekAgo?.absent ?? 0), up: false },
            ].map((s) => (
              <div key={s.l} className="flex items-center gap-2.5 text-[13px]">
                <span className={`size-2.5 rounded-full ${s.c}`} />
                <b className="tnum w-6 font-bold">{s.v}</b>
                <span className="flex-1 text-muted">{s.l}</span>
                <Delta value={s.d} goodWhenUp={s.up} />
              </div>
            ))}
          </div>
          <Link href="/davomat" className="btn-secondary mt-auto w-full">Batafsil<Icon name="arrow_outward" size={16} /></Link>
        </section>

        {/* Hozir ishda */}
        <section className="card min-w-0 px-6 pt-5 pb-2">
          <CardHead icon={<Icon name="how_to_reg" fill size={18} />} title="Hozir ishda" badge={<span className="badge h-[22px] bg-success-tint px-2 text-success">{inside.length}</span>} />
          <div className="mt-3"><PresenceTable rows={presence} total={inside.length} /></div>
        </section>

        {/* Vazifalar bajarilishi — 2-bosqichda */}
        <section className="card flex flex-col gap-3.5 p-5">
          <CardHead icon={<Icon name="check_box" fill size={18} />} title="Vazifalar bajarilishi" />
          <div>
            <div className="flex items-center gap-2.5"><span className="text-[32px] font-extrabold tracking-[-0.03em] text-placeholder">—</span></div>
            <div className="mt-0.5 text-[13px] text-muted">Bu oy o&apos;z vaqtida bajarilgan</div>
          </div>
          <div className="grid min-h-[200px] flex-1 grid-cols-4 gap-3">
            {[60, 80, 45, 70].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="flex w-full max-w-[52px] flex-1 items-end overflow-hidden rounded-full bg-line-soft"><div className="w-full rounded-full bg-[#E6E9EF]" style={{ height: `${h}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-primary-soft px-3 py-2 text-center text-xs font-semibold text-primary">Vazifalar bo&apos;limi keyingi yangilanishda ochiladi</div>
        </section>
      </div>

      {/* Qaror kutmoqda */}
      <section id="qaror" className="card flex scroll-mt-4 flex-col gap-4 px-6 pt-5 pb-6">
        <CardHead icon={<Icon name="gavel" fill size={18} />} tone="warning" title="Qaror kutmoqda" badge={<span className="badge h-[22px] bg-warning-tint px-2 text-warning">{decisions}</span>}>
          <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
            {[['all', `Barchasi ${decisions}`], ['davomat', `Davomat ${suspicious.length}`], ['xodimlar', `Xodimlar ${pending.length}`]].map(([k, l]) => (
              <Link key={k} href={k === 'all' ? '/#qaror' : `/?qaror=${k}#qaror`} className={`rounded-full px-3.5 py-1.5 ${tab === k ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>{l}</Link>
            ))}
          </div>
        </CardHead>
        {decisions === 0 ? (
          <p className="m-0 py-6 text-center text-[13px] text-muted">Hozircha qaror kutayotgan narsa yo&apos;q.</p>
        ) : (
          <>
            {tab !== 'xodimlar' && suspicious.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {suspicious.map(({ r, e }) => (
                  <EvidenceCard key={e.id} employeeId={r.id} workDate={t} eventId={e.id} name={r.fullName}
                    sub={[r.position, `Keldi ${formatTime(e.at, tz)}`, r.branchName].filter(Boolean).join(' · ')} at={e.at} tz={tz}
                    distanceM={e.distanceM} radiusM={r.branchRadiusM} face={e.faceScore != null ? Math.round(e.faceScore * 100) : null}
                    source={e.source} mediaId={e.mediaId} reasons={e.reasons} />
                ))}
              </div>
            )}
            {tab !== 'davomat' && pending.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pending.map((p) => (
                  <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted"><Icon name="person_add" size={16} className="text-primary" />Yangi xodim<span className="flex-1" /><span className="badge h-[22px] bg-warning-tint px-2 text-warning">Tasdiq kutmoqda</span></div>
                    <div className="flex items-center gap-2.5"><Avatar name={p.fullName} size={36} /><div><div className="text-sm font-bold">{p.fullName}</div><div className="text-xs text-muted">{[p.position, p.branchName].filter(Boolean).join(' · ')}</div></div></div>
                    <div className="text-[13px] text-muted">Botda ro&apos;yxatdan o&apos;tdi: raqam, rozilik va yuz namunasi olindi.</div>
                    <form action={setEmployeeStatusAction} className="mt-auto flex gap-2">
                      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="active" />
                      <button className="btn-primary h-9 px-4 shadow-none">Tasdiqlash</button>
                      <Link href="/xodimlar?holat=pending" className="btn-secondary h-9 px-4">Ko&apos;rish</Link>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
