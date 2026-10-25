import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, formatMinutes, formatSom, MONTHS, PAY_TYPE_LABELS, type PayRules } from '@adone/core';
import { withTenant } from '@adone/db';
import { requireArea } from '@/lib/auth/guard';
import { adjustLineAction, periodStatusAction, savePayRulesAction } from '@/lib/actions/payroll';
import { isMonth, loadPayRules, payrollView, type PayrollRow } from '@/server/payroll';
import { employeeOptions } from '@/server/employees';
import { today } from '@/server/attendance';
import { EmptyState, Kpi, PageHeader } from '@/components/ui/page-header';
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

  return (
    <>
      <PageHeader title="Ish haqi" subtitle={`${MONTHS[m - 1]} ${y}${month === current && !closed ? ' · hozirgacha' : ''}`}
        badge={closed ? 'Yopilgan' : 'Qoralama'}
        actions={<a href={`/api/eksport/ish-haqi?oy=${month}${departmentId ? `&bolim=${departmentId}` : ''}`} className="btn-secondary"><Icon name="download" size={18} />Excel</a>}>
        <div className="flex items-center gap-1">
          <Link href={q(shiftMonth(month, -1))} className="btn-secondary btn-sm px-2" title="Oldingi oy"><Icon name="chevron_left" size={16} /></Link>
          {month < current && <Link href={q(shiftMonth(month, 1))} className="btn-secondary btn-sm px-2" title="Keyingi oy"><Icon name="chevron_right" size={16} /></Link>}
        </div>
        <form action="/ish-haqi" className="flex gap-1">
          <input type="hidden" name="oy" value={month} />
          <select name="bolim" defaultValue={departmentId ?? ''} className="input h-8 w-[170px] text-[13px]"><option value="">Barcha bo&apos;limlar</option>{options.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <button className="btn-secondary btn-sm">Filtr</button>
        </form>
        <RulesDrawer rules={rules} open={sp.qoidalar === '1'} />
        {period && (closed ? (
          user.role === 'owner' && (
            <FormDrawer trigger={<><Icon name="lock_open" size={17} />Qayta ochish</>} triggerClass="btn-secondary btn-sm" title="Davrni qayta ochish" subtitle={`${MONTHS[m - 1]} ${y}`} action={periodStatusAction} submitLabel="Qayta ochish">
              <input type="hidden" name="month" value={month} /><input type="hidden" name="to" value="draft" />
              <p className="m-0 text-sm text-ink-2">Davr qoralamaga qaytadi va ko&apos;rilganda joriy davomat va qoidalar bo&apos;yicha qayta hisoblanadi. Qo&apos;lda tuzatishlar saqlanadi. Amal jurnalga yoziladi.</p>
            </FormDrawer>
          )
        ) : (
          <FormDrawer trigger={<><Icon name="lock" size={17} />Oyni yopish</>} triggerClass="btn-primary btn-sm" title="Oyni yopish" subtitle={`${MONTHS[m - 1]} ${y} · ${rows.length} xodim · ${formatSom(sum('total'))}`} action={periodStatusAction} submitLabel="Yopish">
            <input type="hidden" name="month" value={month} /><input type="hidden" name="to" value="closed" />
            <p className="m-0 text-sm text-ink-2">Yakuniy hisob saqlanadi va o&apos;zgarmaydi: keyingi davomat tuzatishlari va qoida o&apos;zgarishlari bu oyga ta&apos;sir qilmaydi.{month === current ? ' Oy hali tugamagan — odatda oy oxirida yopiladi.' : ''}</p>
          </FormDrawer>
        ))}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Jami to'lov" value={formatSom(sum('total'))} tone="info" hint={`${rows.length} xodim`} />
        <Kpi label="Asosiy" value={formatSom(sum('base'))} />
        <Kpi label="Jarimalar" value={formatSom(sum('penaltyTotal'))} tone={sum('penaltyTotal') ? 'danger' : undefined} />
        <Kpi label="Bonuslar" value={formatSom(sum('bonusTotal'))} tone={sum('bonusTotal') ? 'success' : undefined} hint={sum('adjustment') ? `Tuzatish: ${sum('adjustment') > 0 ? '+' : ''}${formatSom(sum('adjustment'))}` : undefined} />
      </div>

      <section className="card overflow-hidden">
        {closed && period?.closedAt && (
          <div className="flex items-center gap-2 border-b border-line-soft bg-subtle px-5 py-3 text-[13px] text-ink-2"><Icon name="lock" size={17} />Yopilgan: {formatDateTime(period.closedAt, user.tenantTimezone)}{period.closedBy ? ` · ${period.closedBy}` : ''}</div>
        )}
        {rows.length === 0 ? <EmptyState text="Bu oyda hisoblanadigan xodim yo'q." /> : (
          <>
            <ul className="m-0 flex list-none flex-col p-0 sm:hidden">
              {rows.map((r) => (
                <li key={r.lineId} className="border-t border-line-soft p-4 first:border-t-0">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <Avatar name={r.name} size={36} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-bold">{r.name}</span><span className="block text-xs text-muted">{rateText(r)}</span></span>
                      <span className="tnum font-extrabold">{formatSom(r.total)}</span>
                    </summary>
                    <div className="mt-3"><Breakdown r={r} closed={closed} /></div>
                  </details>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[860px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-page text-left text-muted">
                    <th className="px-5 py-2.5 font-medium">Xodim</th>
                    <th className="px-3 py-2.5 font-medium">Ish</th>
                    <th className="px-3 py-2.5 text-right font-medium">Asosiy</th>
                    <th className="px-3 py-2.5 text-right font-medium">Jarima</th>
                    <th className="px-3 py-2.5 text-right font-medium">Bonus</th>
                    <th className="px-3 py-2.5 text-right font-medium">Tuzatish</th>
                    <th className="px-5 py-2.5 text-right font-medium">Jami</th>
                  </tr>
                </thead>
                {rows.map((r) => (
                  <tbody key={r.lineId} className="group border-t border-line-soft">
                    <tr>
                      <td className="px-5 py-3">
                        <details className="peer">
                          <summary className="flex cursor-pointer list-none items-center gap-3">
                            <Icon name="chevron_right" size={18} className="text-placeholder transition group-has-[details[open]]:rotate-90" />
                            <Avatar name={r.name} size={34} />
                            <span className="min-w-0"><span className="block truncate font-bold">{r.name}</span><span className="block text-xs text-muted">{rateText(r)}</span></span>
                          </summary>
                        </details>
                      </td>
                      <td className="tnum px-3 text-ink-2">{r.breakdown.stats.workedDays}{r.breakdown.stats.plannedDays ? `/${r.breakdown.stats.plannedDays}` : ''} kun · {formatMinutes(r.breakdown.stats.workedMinutes)}</td>
                      <td className="tnum px-3 text-right">{formatSom(r.base, false)}</td>
                      <td className="tnum px-3 text-right text-danger">{r.penaltyTotal ? `−${formatSom(r.penaltyTotal, false)}` : '—'}</td>
                      <td className="tnum px-3 text-right text-success">{r.bonusTotal ? `+${formatSom(r.bonusTotal, false)}` : '—'}</td>
                      <td className="tnum px-3 text-right" title={r.adjustmentReason ?? undefined}>{r.adjustment ? `${r.adjustment > 0 ? '+' : '−'}${formatSom(Math.abs(r.adjustment), false)}` : '—'}</td>
                      <td className="tnum px-5 text-right text-[14px] font-extrabold">{formatSom(r.total)}</td>
                    </tr>
                    <tr className="hidden group-has-[details[open]]:table-row">
                      <td colSpan={7} className="bg-page/60 px-5 pt-1 pb-4"><Breakdown r={r} closed={closed} /></td>
                    </tr>
                  </tbody>
                ))}
              </table>
            </div>
          </>
        )}
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
          <FormDrawer trigger={<><Icon name="edit" size={16} />Tuzatish</>} triggerClass="btn-secondary btn-sm" title="Qo'lda tuzatish" subtitle={`${r.name} · hisoblangan ${formatSom(r.base - r.penaltyTotal + r.bonusTotal)}`} action={adjustLineAction}>
            <input type="hidden" name="lineId" value={r.lineId} />
            <Field label="Tur">
              <select name="sign" defaultValue={r.adjustment < 0 ? '-' : '+'} className="input"><option value="+">Qo&apos;shish (mukofot)</option><option value="-">Ushlab qolish (avans, jarima)</option></select>
            </Field>
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
    <FormDrawer defaultOpen={open} trigger={<><Icon name="tune" size={17} />Qoidalar</>} triggerClass="btn-secondary btn-sm" title="Ish haqi qoidalari" subtitle="Ishxona uchun; qoralama oylar darhol qayta hisoblanadi, yopilganlarga ta'sir qilmaydi" action={savePayRulesAction}>
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
