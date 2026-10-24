import { formatPhone, localDate } from '@adone/core';
import { currentTgUser } from '@/lib/tg/session';
import { myMonth } from '@/server/miniapp';
import { Avatar } from '@/components/ui/avatar';
import { TgPage } from '@/components/tg/tg-shell';

export default async function TgProfilePage() {
  const u = (await currentTgUser())!;
  const m = await myMonth(u, localDate(new Date(), u.tz).slice(0, 7));
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
        <p className="m-0 text-center text-xs text-muted">Ma&apos;lumotni o&apos;zgartirish uchun rahbaringizga murojaat qiling.</p>
      </div>
    </TgPage>
  );
}
