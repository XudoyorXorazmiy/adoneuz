import { redirect } from 'next/navigation';
import { addDays, can, isUuid, zonedParts } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { managerAssignOptions } from '@/server/manager';
import { today } from '@/server/attendance';
import { TgHeader } from '@/components/tg/tg-shell';
import { ManagerAssign } from '@/components/tg/manager-assign';

/** Rahbar Mini App'i — «Vazifa berish» (xodim sessiyasi — o'z bosh sahifasiga). */
export default async function TgAssignPage({ searchParams }: PageProps<'/tg/vazifa-berish'>) {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'tasks')) redirect('/tg');
  const sp = await searchParams;
  const options = await managerAssignOptions(m);
  const preselect = typeof sp.xodim === 'string' && isUuid(sp.xodim) && options.some((o) => o.id === sp.xodim) ? [sp.xodim] : [];
  const t = today(memberAsTenantUser(m));
  // Panel bilan bir xil: soat 17 dan keyin standart muddat — ertaga (18:00 o'tib ketmasin)
  const defaultDue = zonedParts(new Date(), m.tz).h >= 17 ? addDays(t, 1) : t;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title="Vazifa berish" sub="Xodim Telegram orqali xabar oladi" back={preselect.length ? `/tg/xodim/${preselect[0]}` : "/tg/vazifalar"} />
      <ManagerAssign options={options} from={m.name} today={t} defaultDue={defaultDue} preselect={preselect} />
    </div>
  );
}
