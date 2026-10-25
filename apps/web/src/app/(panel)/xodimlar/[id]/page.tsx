import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, describeSchedule, formatDate, formatPhone, formatSom, LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS, leaveDays, MONTHS, PAY_TYPE_LABELS, type LeaveStatus } from '@adone/core';
import { toRule, withTenant } from '@adone/db';
import { leavePeriod, myLeaves } from '@/server/leave';
import { employeePay } from '@/server/payroll';
import { requireArea } from '@/lib/auth/guard';
import { employeeProfile, profileTotals } from '@/server/profile';
import { employeeOptions } from '@/server/employees';
import { today } from '@/server/attendance';
import { employeeJournal } from '@/server/task-queries';
import { StatusPill, minutesText } from '@/components/tasks/task-card';
import { requestFaceResampleAction, saveEmployeeAction, setEmployeeStatusAction, unbindDeviceAction } from '@/lib/actions/employees';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { EmployeeFields } from '@/components/employees/employee-fields';
import { EmployeeStatusBadge } from '@/components/employees/status-badge';
import { CALENDAR_LEGEND, MonthCalendar } from '@/components/attendance/month-calendar';

export const metadata: Metadata = { title: 'Xodim profili' };

const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};
const ALL_TABS = [['tabel', 'Tabel'], ['vazifalar', 'Vazifalar'], ['sorovlar', "So'rovlar"], ['ish-haqi', 'Ish haqi'], ['malumot', "Ma'lumotlar"]] as const;
type Tab = (typeof ALL_TABS)[number][0];
const LEAVE_TONE: Record<LeaveStatus, string> = { pending: 'bg-warning-tint text-warning', approved: 'bg-success-tint text-success', rejected: 'bg-danger-tint text-danger', cancelled: 'bg-subtle text-muted' };
const PAY: Record<string, string> = { monthly: 'oylik', hourly: 'soatbay', daily: 'kunbay' };

export default async function EmployeeProfilePage({ params, searchParams }: PageProps<'/xodimlar/[id]'>) {
  const user = await requireArea('employees');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const tz = user.tenantTimezone;
  const cur = today(user).slice(0, 7);
  const month = typeof sp.oy === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.oy) && sp.oy <= cur ? sp.oy : cur;
  // Ish haqi — faqat `payroll` ruxsati bilan (menejer ko'rmaydi: tab ham, so'rov ham yo'q)
  const TABS = ALL_TABS.filter(([k]) => k !== 'ish-haqi' || can(user.role, 'payroll'));
  const tab: Tab = (TABS.map((t) => t[0]) as string[]).includes(String(sp.tab)) ? (String(sp.tab) as Tab) : 'tabel';
  const [p, options, journal] = await Promise.all([employeeProfile(user, id, month), employeeOptions(user.tenantId), employeeJournal(user, id, month)]);
  if (!p) notFound();
  const [leaves, pay] = await Promise.all([
    tab === 'sorovlar' ? withTenant(user.tenantId, (tx) => myLeaves(tx, id)) : null,
    tab === 'ish-haqi' ? withTenant(user.tenantId, (tx) => employeePay(tx, id, month)) : null,
  ]);
  const { e } = p;
  const tot = profileTotals(p.days, p.today);
  const todayRow = p.days.find((d) => d.date === p.today);
  const scheduleText = p.schedule ? describeSchedule(toRule(p.schedule)) : 'Jadval biriktirilmagan';
  const [y, m] = month.split('-').map(Number) as [number, number];
  const formOptions = { ...options, departments: p.scope ? options.departments.filter((d) => p.scope!.includes(d.id)) : options.departments };
  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab: tab === 'tabel' ? undefined : tab, oy: month === cur ? undefined : month, ...patch })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `/xodimlar/${id}?${s}` : `/xodimlar/${id}`;
  };
  const kpis: Array<[string, string, string, string]> = [
    ['Ish kunlari', String(tot.workedDays), `/ ${tot.plannedSoFar}`, `Oy rejasi: ${tot.planned} kun`],
    ['Kechikishlar', String(tot.lateDays), '', tot.lateMinutes ? `jami ${tot.lateMinutes} daq` : "kechikish yo'q"],
    ['Ishlagan soat', hm(tot.worked), '', tot.workedDays ? `O'rtacha ${hm(Math.round(tot.worked / tot.workedDays))} / kun` : '—'],
    ["Vazifalar o'z vaqtida", journal.onTimePct == null ? '—' : `${journal.onTimePct}%`, '', `${journal.onTimeOf[0]} / ${journal.onTimeOf[1]} vazifa${tot.absent ? ` · kelmagan ${tot.absent} kun` : ''}`],
  ];

  return (
    <>
      <PageHeader title={e.fullName} back={{ href: '/xodimlar', label: 'Xodimlar' }} />

      <section className="card px-6 pt-6 max-sm:px-4">
        <div className="flex flex-wrap items-center gap-5">
          <span className="relative">
            <Avatar name={e.fullName} size={76} />
            {todayRow?.open && <span className="absolute right-0.5 bottom-0.5 size-4 rounded-full border-[3px] border-white bg-success" title="Hozir ishda" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5"><h1 className="m-0 text-[26px] leading-8 font-bold tracking-[-0.02em]">{e.fullName}</h1><EmployeeStatusBadge status={e.status} /></div>
            <div className="text-sm text-ink-2">{[e.position, p.departmentName, p.branchName].filter(Boolean).join(' · ') || '—'}</div>
            <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-muted">
              {e.phone && <a href={`tel:+${e.phone}`} className="tnum flex items-center gap-1.5 hover:text-ink"><Icon name="call" size={16} />{formatPhone(e.phone)}</a>}
              {e.telegramUsername && <a href={`https://t.me/${e.telegramUsername}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-semibold text-[#229ED9]"><Icon name="send" size={16} />@{e.telegramUsername}</a>}
              <span className="flex items-center gap-1.5"><Icon name="schedule" size={16} />{scheduleText}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {e.status === 'active' && <Link href={`/vazifalar?ijrochi=${e.id}`} className="btn-primary h-11 pr-[22px] pl-[18px] text-sm"><Icon name="add" />Vazifa berish</Link>}
            {e.status !== 'disabled' && (
              <FormDrawer trigger={<Icon name="edit" />} triggerClass="btn-icon size-11" title="Xodimni tahrirlash" subtitle={e.fullName} action={saveEmployeeAction}
                danger={<form action={setEmployeeStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="disabled" /><button className="btn-ghost text-danger">Ishdan bo&apos;shatish</button></form>}>
                <EmployeeFields e={e} options={formOptions} />
              </FormDrawer>
            )}
          </div>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <Link key={k} href={qs({ tab: k === 'tabel' ? undefined : k })}
              className={`border-b-2 px-4 pt-3 pb-3.5 text-sm whitespace-nowrap ${tab === k ? 'border-primary font-bold text-ink' : 'border-transparent font-medium text-muted hover:text-ink'}`}>{l}</Link>
          ))}
        </nav>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {tab === 'tabel' && (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {kpis.map(([l, v, s, cap]) => (
                  <div key={l} className="card flex flex-col gap-1.5 px-5 py-[18px]">
                    <span className="text-[13px] font-medium text-muted">{l}</span>
                    <div className="flex items-baseline gap-1.5"><span className="tnum text-[28px] leading-9 font-extrabold tracking-[-0.03em]">{v}</span>{s && <span className="tnum text-sm font-semibold text-placeholder">{s}</span>}</div>
                    <span className="text-xs text-muted">{cap}</span>
                  </div>
                ))}
              </div>
              <section className="card px-6 pt-5 pb-6 max-sm:px-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="card-icon"><Icon name="calendar_month" size={18} fill /></span>
                  <h2 className="m-0 flex-1 text-base font-bold">Tabel</h2>
                  <div className="flex h-9 items-center gap-1 rounded-full border border-line px-1 text-[13px] font-bold">
                    <Link href={qs({ oy: shiftMonth(month, -1) })} className="flex size-7 items-center justify-center rounded-full hover:bg-subtle" title="Oldingi oy"><Icon name="chevron_left" size={18} /></Link>
                    <span className="px-1.5">{MONTHS[m - 1]} {y}</span>
                    {month < cur
                      ? <Link href={qs({ oy: shiftMonth(month, 1) === cur ? undefined : shiftMonth(month, 1) })} className="flex size-7 items-center justify-center rounded-full hover:bg-subtle" title="Keyingi oy"><Icon name="chevron_right" size={18} /></Link>
                      : <span className="flex size-7 items-center justify-center text-[#C4C9D2]"><Icon name="chevron_right" size={18} /></span>}
                  </div>
                  <a href={`/api/eksport/tabel?oy=${month}&xodim=${id}`} className="btn-icon size-9" title="Excel"><Icon name="download" /></a>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-4 text-xs text-muted">
                  {CALENDAR_LEGEND.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${c}`} />{l}</span>)}
                  <span className="flex items-center gap-1.5"><span className="size-0 border-t-8 border-l-8 border-t-warning border-l-transparent" />Kechikish daqiqasi</span>
                </div>
                <MonthCalendar days={p.days} today={p.today} tz={tz} dayHref={(d) => `/davomat?sana=${d}&q=${encodeURIComponent(e.fullName)}`} />
              </section>
            </>
          )}
          {tab === 'malumot' && (
            <section className="card p-6 max-sm:p-4">
              <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                {([
                  ['Telefon', e.phone ? formatPhone(e.phone) : '—'],
                  ['Telegram', e.telegramUsername ? `@${e.telegramUsername}` : e.telegramUserId ? 'ulangan' : 'ulanmagan'],
                  ['Lavozim', e.position ?? '—'],
                  ["Bo'lim", p.departmentName ?? '—'],
                  ['Filial', p.branchName ?? '—'],
                  ['Jadval', p.schedule ? `${p.schedule.name} · ${scheduleText}` : scheduleText],
                  ['Ishga qo‘shilgan', e.joinedAt ? formatDate(e.joinedAt, tz) : '—'],
                  ['Biometrik rozilik', p.consent ? `${formatDate(p.consent.acceptedAt, tz)} (v${p.consent.version})` : "yo'q"],
                  ...(can(user.role, 'payroll') ? [['Stavka', e.payRate ? `${formatSom(e.payRate)} · ${PAY[e.payType]}` : 'kiritilmagan'] as [string, string]] : []),
                ] as Array<[string, string]>).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 border-b border-line-soft pb-3"><dt className="text-xs font-medium text-muted">{k}</dt><dd className="m-0 font-semibold">{v}</dd></div>
                ))}
              </dl>
            </section>
          )}
          {tab === 'vazifalar' && (
            <section className="card flex flex-col gap-4 p-6 max-sm:p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="card-icon"><Icon name="task_alt" size={18} fill /></span>
                <h2 className="m-0 flex-1 text-base font-bold">Ish jurnali · {MONTHS[m - 1]} {y}</h2>
                <span className="text-[13px] text-muted">{journal.doneCount} ta tasdiqlangan{journal.minutes ? ` · ${minutesText(journal.minutes)}` : ''}</span>
              </div>
              {journal.items.length === 0 ? <EmptyState text="Bu oyda vazifa yoki qayd etilgan ish yo'q." /> : (
                [...new Set(journal.items.map((i) => i.day))].map((day) => (
                  <div key={day} className="flex flex-col gap-1.5">
                    <div className="text-xs font-bold text-muted">{formatDate(`${day}T12:00:00Z`)}</div>
                    {journal.items.filter((i) => i.day === day).map((i) => (
                      <Link key={i.id} href={`/vazifalar/${i.id}`} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-page px-3 py-2.5 text-[13px] hover:bg-primary-soft">
                        <Icon name={i.source === 'assigned' ? 'assignment' : 'edit_note'} size={18} className="text-muted" />
                        <span className="min-w-0 flex-1 font-semibold">{i.title}</span>
                        {i.spentMinutes ? <span className="text-xs text-muted">{minutesText(i.spentMinutes)}</span> : null}
                        {i.onTime === false && <span className="text-xs font-semibold text-danger">kechikdi</span>}
                        {i.rating ? <span className="text-xs text-warning">{'★'.repeat(i.rating)}</span> : null}
                        <StatusPill status={i.status} />
                      </Link>
                    ))}
                  </div>
                ))
              )}
            </section>
          )}
          {tab === 'sorovlar' && (
            <section className="card flex flex-col gap-2.5 p-5">
              {!leaves?.length ? <EmptyState text="Ruxsat so'rovlari yo'q. Xodim botda «📝 So'rov» yoki Mini App'da so'raydi." /> : leaves.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line px-4 py-3 text-sm">
                  <span className="font-bold">{LEAVE_KIND_ICONS[l.kind]} {LEAVE_KIND_LABELS[l.kind]}</span>
                  <span className="tnum font-semibold">{leavePeriod(l.dateFrom, l.dateTo)}</span>
                  <span className="text-xs text-muted">{leaveDays(l.dateFrom, l.dateTo)} kun</span>
                  {l.reason && <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">«{l.reason}»</span>}
                  <span className={`badge ml-auto ${LEAVE_TONE[l.status]}`}><span className="badge-dot" />{LEAVE_STATUS_LABELS[l.status]}</span>
                </div>
              ))}
              <Link href="/sorovlar" className="text-xs font-semibold text-primary">Barcha so&apos;rovlar →</Link>
            </section>
          )}
          {tab === 'ish-haqi' && (
            <section className="card flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="card-icon"><Icon name="payments" size={18} fill /></span>
                <h2 className="m-0 flex-1 text-base font-bold">{MONTHS[m - 1]} {y}</h2>
                {pay && <span className={`badge ${pay.status === 'closed' ? 'bg-success-tint text-success' : 'bg-subtle text-muted'}`}><span className="badge-dot" />{pay.status === 'closed' ? 'Yopilgan' : month === cur ? 'Hozirgacha' : 'Qoralama'}</span>}
                <Link href={`/ish-haqi?oy=${month}`} className="btn-secondary btn-sm">Vedomost</Link>
              </div>
              {!pay ? <EmptyState text="Bu xodim uchun hisob yo'q (tasdiqlanmagan)." /> : (
                <div className="flex max-w-[520px] flex-col gap-1 text-[13px]">
                  <PayLine label={`Stavka: ${PAY_TYPE_LABELS[pay.payType]}`} value={formatSom(pay.rate)} muted />
                  <PayLine label={`Asosiy (${pay.result.stats.workedDays}${pay.result.stats.plannedDays ? `/${pay.result.stats.plannedDays}` : ''} kun)`} value={formatSom(pay.result.base)} />
                  {pay.result.penalties.map((x) => <PayLine key={x.kind} label={`${x.label}: ${x.count}`} value={`−${formatSom(x.amount)}`} tone="text-danger" />)}
                  {pay.result.penaltyCapped > 0 && <PayLine label="Jarima cheklovi" value={`+${formatSom(pay.result.penaltyCapped)}`} muted />}
                  {pay.result.bonuses.map((x) => <PayLine key={x.kind} label={`${x.label}: ${x.count}`} value={`+${formatSom(x.amount)}`} tone="text-success" />)}
                  {pay.adjustment !== 0 && <PayLine label={`Tuzatish${pay.adjustmentReason ? ` — «${pay.adjustmentReason}»` : ''}`} value={`${pay.adjustment > 0 ? '+' : '−'}${formatSom(Math.abs(pay.adjustment))}`} />}
                  <div className="mt-1 flex justify-between border-t border-line pt-2 text-base font-extrabold"><span>Jami</span><span className="tnum">{formatSom(pay.total)}</span></div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <section className="card flex flex-col gap-3.5 p-5">
            <div className="flex items-center gap-2.5">
              <span className="card-icon"><Icon name="face" size={18} fill /></span>
              <h2 className="m-0 flex-1 text-base font-bold">Yuz namunasi</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => {
                const f = p.faces[i];
                return (
                  <a key={i} href={f ? `/api/media/${f.id}` : undefined} target="_blank" rel="noreferrer"
                    className="relative flex aspect-square items-end justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#DCE1EA] to-[#C5CCD8]">
                    {f?.mime.startsWith('video/') ? <video src={`/api/media/${f.id}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
                      : f ? <img src={`/api/media/${f.id}`} alt="" className="absolute inset-0 size-full object-cover" />
                        : <Icon name="person" fill size={64} className="-mb-2 text-[#A9B2C2]" />}
                    {f && <span className="tnum absolute top-1.5 left-1.5 rounded bg-ink/65 px-[5px] py-px text-[9px] font-bold text-white">{formatDate(f.createdAt, tz).slice(0, 5)}</span>}
                  </a>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{p.templates[0] ? `Yangilangan ${formatDate(p.templates[0].createdAt, tz)}` : p.faces[0] ? 'Namuna tekshirilmoqda' : "Namuna hali yo'q"}</span>
              {!p.consent ? <span className="font-semibold text-warning">Rozilik yo&apos;q</span>
                : p.templates[0] ? <span className="flex items-center gap-1 font-bold text-success" title={p.templates[0].quality ? `aniqlik ${p.templates[0].quality.det_score}, yuz ${p.templates[0].quality.face_px}px` : undefined}><Icon name="verified" size={15} fill />Sifatli</span>
                  : <span className="font-semibold text-warning">Vektor yo&apos;q</span>}
            </div>
            {p.consent && e.status !== 'disabled' && (
              <form action={requestFaceResampleAction}><input type="hidden" name="id" value={e.id} />
                <button className="btn-secondary h-10 w-full text-[13px]"><Icon name="photo_camera" size={18} />Qayta olish</button>
              </form>
            )}
            <p className="m-0 text-xs leading-normal text-muted">Har «Keldim»da selfi shu namuna bilan solishtiriladi; mos kelmasa — «Shubhali» (rahbar qaror qiladi). Xodim o&apos;chirilsa namuna ham o&apos;chadi.</p>
          </section>

          <section className="card flex flex-col gap-3.5 p-5">
            <div className="flex items-center gap-2.5">
              <span className="card-icon"><Icon name="smartphone" size={18} fill /></span>
              <h2 className="m-0 flex-1 text-base font-bold">Telegram</h2>
            </div>
            <div className="flex items-center gap-3 rounded-[14px] bg-page p-3">
              <Icon name="send" size={24} className={e.telegramUserId ? 'text-[#229ED9]' : 'text-placeholder'} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{e.telegramUsername ? `@${e.telegramUsername}` : e.telegramUserId ? 'Akkaunt ulangan' : 'Ulanmagan'}</div>
                <div className={`text-xs font-semibold ${e.telegramUserId ? 'text-success' : 'text-muted'}`}>{e.telegramUserId ? `bog'langan${e.joinedAt ? ` · ${formatDate(e.joinedAt, tz)}` : ''}` : 'taklif havolasi orqali ulanadi'}</div>
              </div>
              {e.telegramUsername && <a href={`https://t.me/${e.telegramUsername}`} target="_blank" rel="noreferrer" className="btn-secondary h-8 px-3.5 text-xs">Yozish</a>}
            </div>
            <p className="m-0 text-xs leading-normal text-muted">Keldi/ketdi faqat shu Telegram akkauntidan qabul qilinadi.</p>
          </section>

          <section className="card flex flex-col gap-3.5 p-5">
            <div className="flex items-center gap-2.5">
              <span className="card-icon"><Icon name="phone_iphone" size={18} fill /></span>
              <h2 className="m-0 flex-1 text-base font-bold">Qurilma</h2>
            </div>
            {e.deviceId ? (
              <div className="flex items-center gap-3 rounded-[14px] bg-page p-3">
                <Icon name="phone_iphone" size={26} className="text-ink-2" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{e.deviceLabel ?? 'Telefon'}</div><div className="text-xs font-semibold text-success">bog&apos;langan{e.deviceBoundAt ? ` · ${formatDate(e.deviceBoundAt, tz)}` : ''}</div></div>
                <form action={unbindDeviceAction}><input type="hidden" name="id" value={e.id} /><button className="btn-secondary h-8 px-3.5 text-xs text-danger">Uzish</button></form>
              </div>
            ) : <p className="m-0 rounded-[14px] bg-page p-3 text-[13px] text-muted">Hali bog&apos;lanmagan — Mini App&apos;dagi birinchi «Keldim» bog&apos;laydi.</p>}
            <p className="m-0 text-xs leading-normal text-muted">Boshqa qurilmadan kirilsa, check-in «Shubhali» deb belgilanadi.</p>
          </section>
        </div>
      </div>
    </>
  );
}

function PayLine({ label, value, tone = '', muted }: { label: string; value: string; tone?: string; muted?: boolean }) {
  return <div className={`flex justify-between gap-4 ${muted ? 'text-muted' : ''}`}><span className={muted ? '' : 'text-ink-2'}>{label}</span><span className={`tnum ${tone}`}>{value}</span></div>;
}
