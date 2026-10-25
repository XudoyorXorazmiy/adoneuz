import { formatPhone, formatSom, localDate, MONTHS } from '@adone/core';
import { currentTgUser } from '@/lib/tg/session';
import { myMonth } from '@/server/miniapp';
import { ownPay } from '@/server/payroll';
import { Avatar } from '@/components/ui/avatar';
import { TgPage } from '@/components/tg/tg-shell';

export default async function TgProfilePage() {
  const u = (await currentTgUser())!;
  const month = localDate(new Date(), u.tz).slice(0, 7);
  const [m, pay] = await Promise.all([myMonth(u, month), ownPay(u.tenantId, u.employeeId, month)]);
  const mo = MONTHS[Number(month.slice(5)) - 1];
  const rows: Array<[string, string]> = [
    ['Ishxona', u.tenantName], ['Lavozim', u.position ?? '—'], ["Bo'lim", u.departmentName ?? '—'], ['Filial', u.branchName ?? '—'],
    ['Telefon', u.phone ? formatPhone(u.phone) : '—'], ["Vazifalar o'z vaqtida (oy)", m.onTimePct == null ? '—' : `${m.onTimePct}% · ${m.tasksDone} ta`],
  ];
  return (
    <TgPage>
      <div className="flex flex-col items-center gap-3 px-4 pt-6">
        <Avatar name={u.name} size={84} />
        <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">{u.name}</h1>
        <div className="w-full divide-y divide-line-soft rounded-[20px] bg-card text-sm shadow-[var(--shadow-card)]">
          {rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 px-4 py-3.5"><span className="text-muted">{k}</span><b className="text-right">{v}</b></div>)}
        </div>
        {pay && (
          <details className="w-full rounded-[20px] bg-card text-sm shadow-[var(--shadow-card)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
              <span><span className="block text-muted">Ish haqi · {mo}</span><span className="text-xs text-placeholder">{pay.status === 'closed' ? 'Yakuniy' : 'Hozirgacha hisoblangan'}</span></span>
              <b className="tnum text-lg">{formatSom(pay.total)}</b>
            </summary>
            <div className="flex flex-col gap-1.5 border-t border-line-soft px-4 py-3 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-2">Asosiy · {pay.result.stats.workedDays} kun</span><span className="tnum">{formatSom(pay.result.base)}</span></div>
              {pay.result.penalties.map((x) => <div key={x.kind} className="flex justify-between"><span className="text-ink-2">{x.label}: {x.count}</span><span className="tnum text-danger">−{formatSom(x.amount)}</span></div>)}
              {pay.result.penaltyCapped > 0 && <div className="flex justify-between text-muted"><span>Jarima cheklovi</span><span className="tnum">+{formatSom(pay.result.penaltyCapped)}</span></div>}
              {pay.result.bonuses.map((x) => <div key={x.kind} className="flex justify-between"><span className="text-ink-2">{x.label}: {x.count}</span><span className="tnum text-success">+{formatSom(x.amount)}</span></div>)}
              {pay.adjustment !== 0 && <div className="flex justify-between"><span className="text-ink-2">Tuzatish{pay.adjustmentReason ? ` — ${pay.adjustmentReason}` : ''}</span><span className="tnum">{pay.adjustment > 0 ? '+' : '−'}{formatSom(Math.abs(pay.adjustment))}</span></div>}
            </div>
          </details>
        )}
        <p className="m-0 text-center text-xs text-muted">Ma&apos;lumotni o&apos;zgartirish uchun rahbaringizga murojaat qiling.</p>
      </div>
    </TgPage>
  );
}
