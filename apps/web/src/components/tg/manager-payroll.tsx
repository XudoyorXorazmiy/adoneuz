import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatSom, MONTHS } from '@adone/core';
import type { TgMember } from '@/lib/tg/session';
import { managerPendingCount, managerPayroll, managerShell } from '@/server/manager';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { TgHeader } from './tg-shell';

const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};

/** Rahbar Mini App'i — «Ish haqi» (egasi, admin): oylik vedomost ko'rinishi (faqat o'qish; tuzatish va yopish — panelda). */
export async function ManagerPayroll({ m, month }: { m: TgMember; month: string }) {
  const [v, d] = await Promise.all([managerPayroll(m, month), managerPendingCount(m)]);
  if (!v) redirect('/tg');
  const shell = managerShell(m, d);
  const sum = (k: 'total' | 'base' | 'penaltyTotal' | 'bonusTotal' | 'adjustment') => v.rows.reduce((s, r) => s + r[k], 0);
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const closed = v.period?.status === 'closed';
  const rows = [...v.rows].sort((a, b) => b.total - a.total);
  const card = 'flex flex-col gap-3 rounded-[24px] bg-card p-[18px] shadow-[var(--shadow-card)]';
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page pb-8">
      <TgHeader title="Ish haqi" sub={m.tenantName} back="/tg" />
      <div className="flex flex-col gap-3 px-4 pt-3">
        <div className="flex items-center justify-between">
          <Link href={`/tg/ish-haqi?oy=${shiftMonth(month, -1)}`} className="flex size-10 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)]"><Icon name="chevron_left" /></Link>
          <div className="text-center">
            <div className="text-lg font-bold tracking-[-0.02em]">{MONTHS[mo - 1]} {y}</div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${closed ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning'}`}>{closed ? 'Yopilgan' : v.period ? 'Qoralama — jonli hisob' : 'Hisoblanmagan'}</span>
          </div>
          {month < v.current
            ? <Link href={shiftMonth(month, 1) === v.current ? '/tg/ish-haqi' : `/tg/ish-haqi?oy=${shiftMonth(month, 1)}`} className="flex size-10 items-center justify-center rounded-full bg-card shadow-[var(--shadow-card)]"><Icon name="chevron_right" /></Link>
            : <span className="flex size-10 items-center justify-center rounded-full bg-card text-placeholder shadow-[var(--shadow-card)]"><Icon name="chevron_right" /></span>}
        </div>

        <section className={card}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-muted">Jami to&apos;lov</span>
            <span className="tnum text-[13px] text-muted">{v.rows.length} xodim</span>
          </div>
          <div className="tnum text-[30px] leading-9 font-extrabold tracking-[-0.03em]">{formatSom(sum('total'))}</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['Asosiy', sum('base'), 'text-ink'], ['Jarima', -sum('penaltyTotal'), 'text-danger'], ['Bonus', sum('bonusTotal'), 'text-success']] as const).map(([l, val, tone]) => (
              <div key={l} className="rounded-2xl bg-page px-2 py-2.5">
                <div className={`tnum text-[15px] font-extrabold ${val ? tone : 'text-placeholder'}`}>{val > 0 && l === 'Bonus' ? '+' : ''}{formatSom(val, false)}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          {sum('adjustment') !== 0 && <p className="m-0 text-[13px] text-muted">Qo&apos;lda tuzatishlar: <b className="tnum text-ink">{sum('adjustment') > 0 ? '+' : ''}{formatSom(sum('adjustment'))}</b></p>}
        </section>

        {rows.length === 0 ? (
          <div className={`${card} items-center py-8 text-center`}>
            <span className="flex size-12 items-center justify-center rounded-full bg-subtle text-muted"><Icon name="payments" size={26} /></span>
            <p className="m-0 text-sm font-semibold">Bu oy uchun hisob yo&apos;q</p>
            <p className="m-0 text-[13px] text-muted">Faol xodimlar va davomat paydo bo&apos;lgach vedomost shu yerda chiqadi.</p>
          </div>
        ) : (
          <section className="flex flex-col rounded-[24px] bg-card shadow-[var(--shadow-card)]">
            <h2 className="m-0 px-[18px] pt-4 pb-1 text-base font-bold">Xodimlar bo&apos;yicha</h2>
            <div className="flex flex-col divide-y divide-line-soft">
              {rows.map((r) => (
                <Link key={r.lineId} href={`/tg/xodim/${r.employeeId}`} className="flex items-center gap-3 px-[18px] py-2.5">
                  <Avatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{r.name}</div>
                    <div className="tnum truncate text-xs text-muted">
                      {formatSom(r.base, false)}{r.penaltyTotal ? <span className="text-danger"> −{formatSom(r.penaltyTotal, false)}</span> : null}{r.bonusTotal ? <span className="text-success"> +{formatSom(r.bonusTotal, false)}</span> : null}{r.adjustment ? <span> · tuzatish {r.adjustment > 0 ? '+' : ''}{formatSom(r.adjustment, false)}</span> : null}
                    </div>
                  </div>
                  <b className="tnum text-sm whitespace-nowrap">{formatSom(r.total)}</b>
                </Link>
              ))}
            </div>
          </section>
        )}

        <a href={`${shell.panelUrl}/ish-haqi?oy=${month}`} target="_blank" rel="noreferrer" className="btn-secondary h-12 w-full text-sm"><Icon name="open_in_new" size={18} className="text-primary" />Tuzatish, qoidalar, Excel — panelda</a>
      </div>
    </div>
  );
}
