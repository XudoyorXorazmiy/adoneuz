import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, formatMinutes, formatSom, MONTHS, PAY_TYPE_LABELS, type PayRules } from '@adone/core';
import { withTenant } from '@adone/db';
import { requireArea } from '@/lib/auth/guard';
import { adjustLineAction, periodStatusAction, savePayRulesAction } from '@/lib/actions/payroll';
import { isMonth, loadPayRules, payrollView, type PayrollRow } from '@/server/payroll';
import { employeeOptions } from '@/server/employees';
import { today } from '@/server/attendance';
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page-header';
import { Segmented } from '@/components/settings/ui';
import { Field, FormDrawer } from '@/components/ui/form-drawer';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = { title: 'Ish haqi' };

const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};
const rateText = (r: PayrollRow) => `${PAY_TYPE_LABELS[r.payType]} · ${formatSom(r.rate)}${r.payType === 'hourly' ? '/soat' : r.payType === 'daily' ? '/kun' : ''}`;

/** Ish haqi (4-bosqich): oy bo'yicha hisob — davomat + vazifalar + ishxona qoidalari; qoralama → tuzatish → yopish. */
export default async function PayrollPage({ searchParams }: PageProps<'/ish-haqi'>) {
  const user = await requireArea('payroll');
  const sp = await searchParams;
  const departmentId = typeof sp.bolim === 'string' && /^[0-9a-f-]{36}$/.test(sp.bolim) ? sp.bolim : undefined;
  const current = today(user).slice(0, 7);
  const month = isMonth(sp.oy) && sp.oy <= current ? sp.oy : current;
  const [{ period, rows }, rules, options] = await Promise.all([
    payrollView(user.tenantId, month, departmentId),
    withTenant(user.tenantId, loadPayRules),
    employeeOptions(user.tenantId),
  ]);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const closed = period?.status === 'closed';
  const q = (o: string) => `/ish-haqi?oy=${o}${departmentId ? `&bolim=${departmentId}` : ''}`;
  const sum = (k: 'base' | 'penaltyTotal' | 'bonusTotal' | 'adjustment' | 'total') => rows.reduce((a, r) => a + r[k], 0);

  const total = sum('total');
  const pill = 'relative flex h-10 items-center gap-2 rounded-full border border-line bg-card pr-3 pl-3.5 text-[13px] font-semibold whitespace-nowrap';
  const COLS = 'grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]';
  const closeDrawer = period && (closed ? (
    user.role === 'owner' && (
      <FormDrawer trigger={<><Icon name="lock_open" />Qayta ochish</>} triggerClass="btn-secondary h-11 text-sm" title="Davrni qayta ochish" subtitle={`${MONTHS[m - 1]} ${y}`} action={periodStatusAction} submitLabel="Qayta ochish">
        <input type="hidden" name="month" value={month} /><input type="hidden" name="to" value="draft" />
        <p className="m-0 text-sm text-ink-2">Davr qoralamaga qaytadi va ko&apos;rilganda joriy davomat va qoidalar bo&apos;yicha qayta hisoblanadi. Qo&apos;lda tuzatishlar saqlanadi. Amal jurnalga yoziladi.</p>
      </FormDrawer>
    )
  ) : (
    <FormDrawer trigger={<><Icon name="lock" />Oyni yopish</>} triggerClass="btn-primary h-11 pr-[22px] pl-[18px] text-sm" title="Oyni yopish" subtitle={`${MONTHS[m - 1]} ${y} · ${rows.length} xodim · ${formatSom(total)}`} action={periodStatusAction} submitLabel="Yopish">
      <input type="hidden" name="month" value={month} /><input type="hidden" name="to" value="closed" />
      <p className="m-0 text-sm text-ink-2">Yakuniy hisob saqlanadi va o&apos;zgarmaydi: keyingi davomat tuzatishlari va qoida o&apos;zgarishlari bu oyga ta&apos;sir qilmaydi.</p>
      {month === current && <p className="m-0 flex gap-2 rounded-xl bg-warning-tint px-3.5 py-3 text-[13px] font-semibold text-warning-text"><Icon name="info" size={18} />Oy hali tugamagan — odatda oy oxirida yopiladi.</p>}
    </FormDrawer>
  ));

  return (
    <>
      <PageHeader title="Ish haqi" badge={closed ? 'Yopilgan' : 'Qoralama'}
        subtitle={`${MONTHS[m - 1]} ${y}${closed && period?.closedAt ? ` · yopilgan ${formatDateTime(period.closedAt, user.tenantTimezone)}${period.closedBy ? `, ${period.closedBy}` : ''}` : month === current ? ' · hozirgacha hisoblangan' : ''}`}
        actions={
          <>
            <a href={`/api/eksport/ish-haqi?oy=${month}${departmentId ? `&bolim=${departmentId}` : ''}`} className="btn-secondary h-11 text-sm"><Icon name="table_view" className="text-success" />Excel</a>
            <RulesDrawer rules={rules} open={sp.qoidalar === '1'} />
            {closeDrawer}
          </>
        } />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="payments" tone="primary" label="Jami to'lov" value={formatSom(total, false)} caption={`so'm · ${rows.length} xodim`} />
        <StatCard icon="account_balance_wallet" tone="primary" label="Asosiy" value={formatSom(sum('base'), false)} caption="so'm · stavka bo'yicha" />
        <StatCard icon="trending_down" tone="danger" label="Jarimalar" value={sum('penaltyTotal') ? `−${formatSom(sum('penaltyTotal'), false)}` : '0'} caption="kechikish, kelmaslik, vazifa" />
        <StatCard icon="trending_up" tone="success" label="Bonuslar" value={sum('bonusTotal') ? `+${formatSom(sum('bonusTotal'), false)}` : '0'}
          caption={sum('adjustment') ? `Tuzatishlar: ${sum('adjustment') > 0 ? '+' : '−'}${formatSom(Math.abs(sum('adjustment')))}` : "qo'shimcha soat, vazifalar"} />
      </div>

      <section className="card px-6 pt-5 pb-2 max-sm:px-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-10 items-center gap-1 rounded-full border border-line px-1 text-[13px] font-bold">
            <Link href={q(shiftMonth(month, -1))} className="flex size-8 items-center justify-center rounded-full hover:bg-subtle" title="Oldingi oy"><Icon name="chevron_left" size={18} /></Link>
            <span className="flex items-center gap-1.5 px-1.5 whitespace-nowrap"><Icon name="calendar_month" size={18} />{MONTHS[m - 1]} {y}</span>
            {month < current
              ? <Link href={q(shiftMonth(month, 1))} className="flex size-8 items-center justify-center rounded-full hover:bg-subtle" title="Keyingi oy"><Icon name="chevron_right" size={18} /></Link>
              : <span className="flex size-8 items-center justify-center text-[#C4C9D2]"><Icon name="chevron_right" size={18} /></span>}
          </div>
          {options.departments.length > 0 && (
            <form action="/ish-haqi" className={pill}>
              <input type="hidden" name="oy" value={month} />
              <Icon name="workspaces" size={18} className="text-primary" />
              <select name="bolim" defaultValue={departmentId ?? ''} className="cursor-pointer appearance-none bg-transparent pr-5 outline-none">
                <option value="">Barcha bo&apos;limlar</option>{options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <Icon name="expand_more" size={18} className="pointer-events-none absolute right-12 text-muted" />
              <button className="flex size-7 items-center justify-center rounded-full bg-subtle" title="Filtr"><Icon name="filter_alt" size={16} /></button>
            </form>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted sm:ml-auto">
            <Icon name={closed ? 'lock' : 'autorenew'} size={16} />
            {closed ? "Yopilgan oy — o'zgarmas nusxa" : "Qoralama: davomat va vazifalar o'zgarsa qayta hisoblanadi. Qo'lda tuzatishlar saqlanadi."}
          </span>
        </div>

        {rows.length === 0 ? <EmptyState text="Bu oyda hisoblanadigan xodim yo'q." /> : (
          <>
            <div className="mt-2 overflow-x-auto max-sm:hidden">
              <div className="min-w-[880px]">
                <div className={`grid ${COLS} gap-3 border-b border-line-soft px-1 pt-3.5 pb-2.5 text-xs font-medium text-placeholder`}>
                  <span>Xodim</span><span>Ish</span><span className="text-right">Asosiy</span><span className="text-right">Jarima</span><span className="text-right">Bonus</span><span className="text-right">Tuzatish</span><span className="text-right">Jami</span>
                </div>
                {rows.map((r) => (
                  <details key={r.lineId} className="group -mx-2 my-0.5 rounded-[14px] px-2 open:bg-page">
                    <summary className={`grid ${COLS} cursor-pointer list-none items-center gap-3 border-b border-[#F4F5F7] px-1 py-[11px] text-[13px] [&::-webkit-details-marker]:hidden`}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon name="chevron_right" size={18} className="text-placeholder transition group-open:rotate-90" />
                        <Avatar name={r.name} size={34} />
                        <span className="min-w-0"><span className="block truncate font-bold">{r.name}</span><span className="block truncate text-xs text-muted">{rateText(r)}</span></span>
                      </span>
                      <span className="tnum text-ink-2">{r.breakdown.stats.workedDays}{r.breakdown.stats.plannedDays ? `/${r.breakdown.stats.plannedDays}` : ''} kun · {formatMinutes(r.breakdown.stats.workedMinutes)}</span>
                      <span className="tnum text-right">{formatSom(r.base, false)}</span>
                      <span className="tnum text-right font-semibold text-danger">{r.penaltyTotal ? `−${formatSom(r.penaltyTotal, false)}` : <span className="text-placeholder">—</span>}</span>
                      <span className="tnum text-right font-semibold text-success">{r.bonusTotal ? `+${formatSom(r.bonusTotal, false)}` : <span className="text-placeholder">—</span>}</span>
                      <span className="tnum flex items-center justify-end gap-1 text-right" title={r.adjustmentReason ?? undefined}>
                        {r.adjustmentReason && <span className="size-1.5 rounded-full bg-primary" />}
                        {r.adjustment ? `${r.adjustment > 0 ? '+' : '−'}${formatSom(Math.abs(r.adjustment), false)}` : <span className="text-placeholder">—</span>}
                      </span>
                      <span className="tnum text-right text-[14px] font-extrabold">{formatSom(r.total)}</span>
                    </summary>
                    <div className="pt-3.5 pr-1 pb-[18px] pl-12"><Breakdown r={r} closed={closed} /></div>
                  </details>
                ))}
              </div>
            </div>
            {/* Telefon: kartochkalar */}
            <div className="flex flex-col gap-2.5 py-3 sm:hidden">
              {rows.map((r) => (
                <details key={r.lineId} className="rounded-[20px] border border-line p-3.5">
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <Avatar name={r.name} size={38} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-bold">{r.name}</span><span className="block truncate text-xs text-muted">{rateText(r)}</span></span>
                    <span className="tnum font-extrabold">{formatSom(r.total)}</span>
                  </summary>
                  <div className="mt-3 border-t border-line-soft pt-3"><Breakdown r={r} closed={closed} /></div>
                </details>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-between gap-3 px-1 py-3.5 text-[13px] text-muted max-sm:flex-col">
          <span><span className="tnum">{rows.length}</span> xodim</span>
          <span className="tnum font-bold text-ink">Jami: {formatSom(total)}</span>
        </div>
      </section>
      <p className="m-0 text-xs text-muted">Hisob: davomat yig&apos;masi (tabel) va shu oyda tasdiqlangan vazifalar, «Qoidalar» bo&apos;yicha. Qoralama har ochilganda qayta hisoblanadi; yopilgan oy — o&apos;zgarmas nusxa.</p>
    </>
  );
}

function Breakdown({ r, closed }: { r: PayrollRow; closed: boolean }) {
  const b = r.breakdown;
  const s = b.stats;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto]">
      <div className="flex flex-col gap-1 text-[13px]">
        <div className="text-xs font-bold text-muted uppercase">Davomat</div>
        <div>Ishlagan: <b className="tnum">{s.workedDays} kun</b>{s.plannedDays ? <> (reja {s.plannedDays})</> : null} · <b className="tnum">{formatMinutes(s.workedMinutes)}</b></div>
        <div>Ruxsatda: <b className="tnum">{s.leaveDays}</b> · Kelmagan: <b className="tnum">{s.absentDays}</b> · Kechikkan: <b className="tnum">{s.lateDays}</b>{s.lateMinutes ? ` (${s.lateMinutes} daq)` : ''}</div>
        {s.overtimeMinutes > 0 && <div>Qo&apos;shimcha: <b className="tnum">{formatMinutes(s.overtimeMinutes)}</b></div>}
        <div>Vazifalar: o&apos;z vaqtida <b className="tnum">{s.tasksOnTime}</b> · kechikkan <b className="tnum">{s.tasksLate}</b></div>
        <Link href={`/xodimlar/${r.employeeId}`} className="mt-1 text-xs font-semibold text-primary">Profil va tabel →</Link>
      </div>
      <div className="flex flex-col gap-1 text-[13px]">
        <div className="text-xs font-bold text-muted uppercase">Hisob</div>
        <Line label="Asosiy" value={formatSom(b.base)} />
        {b.penalties.map((p) => <Line key={p.kind} label={`${p.label}: ${p.count}`} value={`−${formatSom(p.amount)}`} tone="text-danger" />)}
        {b.penaltyCapped > 0 && <Line label="Jarima cheklovi" value={`+${formatSom(b.penaltyCapped)}`} tone="text-muted" />}
        {b.bonuses.map((p) => <Line key={p.kind} label={`${p.label}: ${p.count}`} value={`+${formatSom(p.amount)}`} tone="text-success" />)}
        {r.adjustment !== 0 && <Line label={`Tuzatish${r.adjustmentReason ? ` — «${r.adjustmentReason}»` : ''}`} value={`${r.adjustment > 0 ? '+' : '−'}${formatSom(Math.abs(r.adjustment))}`} />}
        <Line label="Jami" value={formatSom(r.total)} bold />
      </div>
      {!closed && (
        <div className="flex items-start">
          <FormDrawer trigger={<><Icon name="edit" size={16} />Tuzatish</>} triggerClass="btn-secondary btn-sm h-9" title="Qo'lda tuzatish" subtitle={`${r.name} · hisoblangan ${formatSom(r.base - r.penaltyTotal + r.bonusTotal)}`} action={adjustLineAction}>
            <input type="hidden" name="lineId" value={r.lineId} />
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Tur</span>
              <Segmented name="sign" full defaultValue={r.adjustment < 0 ? '-' : '+'} options={[{ value: '+', label: "Qo'shish (mukofot)" }, { value: '-', label: 'Ushlab qolish (avans)' }]} />
            </div>
            <Field label="Summa, so'm" hint="0 — tuzatishni bekor qilish."><input name="amount" inputMode="numeric" defaultValue={Math.abs(r.adjustment) || ''} className="input tnum" /></Field>
            <Field label="Sabab" hint="Majburiy. Jurnalga yoziladi."><textarea name="reason" rows={3} maxLength={300} defaultValue={r.adjustmentReason ?? ''} className="input h-auto py-2.5" /></Field>
          </FormDrawer>
        </div>
      )}
    </div>
  );
}

function Line({ label, value, tone = '', bold }: { label: string; value: string; tone?: string; bold?: boolean }) {
  return <div className={`flex justify-between gap-4 ${bold ? 'mt-1 border-t border-line pt-1.5 font-extrabold' : ''}`}><span className="text-ink-2">{label}</span><span className={`tnum ${tone}`}>{value}</span></div>;
}

/** `open` — Sozlamalar → Ish haqi → «Qoidalarni tahrirlash» (/ish-haqi?qoidalar=1). */
function RulesDrawer({ rules, open }: { rules: PayRules; open?: boolean }) {
  const num = (name: string, value: number, suffix: string, hint?: string) => (
    <Field label={suffix} hint={hint}><input name={name} inputMode="numeric" defaultValue={value || ''} placeholder="0" className="input tnum" /></Field>
  );
  const check = (name: string, on: boolean, label: string, hint?: string) => (
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name={name} defaultChecked={on} className="mt-0.5 size-4 accent-[var(--color-primary)]" /><span><b className="font-semibold">{label}</b>{hint && <span className="block text-xs text-muted">{hint}</span>}</span></label>
  );
  return (
    <FormDrawer defaultOpen={open} trigger={<><Icon name="tune" />Qoidalar</>} triggerClass="btn-secondary h-11 text-sm" title="Ish haqi qoidalari" subtitle="Ishxona uchun; qoralama oylar darhol qayta hisoblanadi, yopilganlarga ta'sir qilmaydi" action={savePayRulesAction}>
      <div className="text-xs font-bold text-muted uppercase">Asosiy maosh</div>
      {check('monthlyProration', rules.monthlyProration, 'Oylikni ishlangan kunlarga mutanosib', 'Jadvaldagi ish kunlari bo\'yicha: 22 kundan 20 kun — 20/22.')}
      {check('paidLeave', rules.paidLeave, "Tasdiqlangan ruxsat kunlari to'lanadi")}
      <div className="text-xs font-bold text-muted uppercase">Jarimalar</div>
      <Field label="Kechikish">
        <select name="lateMode" defaultValue={rules.late.mode} className="input"><option value="off">Jarimasiz</option><option value="per_minute">Har daqiqa uchun</option><option value="per_case">Har kechikish uchun</option></select>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {num('lateAmount', rules.late.amount, "Kechikish summasi, so'm")}
        {num('absentPenalty', rules.absentPenalty, "Sababsiz kelmagan kun, so'm", 'Maosh ulushidan tashqari.')}
        {num('earlyPerMinute', rules.earlyPerMinute, "Erta ketish, so'm/daq")}
        {num('latePenalty', rules.task.latePenalty, "Vazifa kechikdi, so'm")}
      </div>
      {num('maxPenaltyPercent', rules.maxPenaltyPercent, 'Jarima chegarasi, % asosiydan', '0 — cheklovsiz. Standart 30%.')}
      <div className="text-xs font-bold text-muted uppercase">Bonuslar</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {num('overtimePerHour', rules.overtimePerHour, "Qo'shimcha soat, so'm")}
        {num('onTimeBonus', rules.task.onTimeBonus, "Vazifa o'z vaqtida, so'm")}
        {num('fiveStarBonus', rules.task.fiveStarBonus, "Vazifa 5 baho, so'm")}
      </div>
      {check('countSelfTasks', rules.task.countSelfTasks, "O'zi qo'shgan ishlar ham hisoblanadi", 'Standart — faqat rahbar bergan vazifalar.')}
      <div className="text-xs font-bold text-muted uppercase">Xodimga</div>
      {check('showToEmployee', rules.showToEmployee, "Xodim o'z ish haqini Mini App'da ko'radi")}
    </FormDrawer>
  );
}
