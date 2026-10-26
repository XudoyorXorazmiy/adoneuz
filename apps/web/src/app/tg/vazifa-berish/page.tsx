import { redirect } from 'next/navigation';
import { can } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { managerAssignOptions } from '@/server/manager';
import { today } from '@/server/attendance';
import { TgHeader } from '@/components/tg/tg-shell';
import { ManagerAssign } from '@/components/tg/manager-assign';

/** Rahbar Mini App'i — «Vazifa berish» (xodim sessiyasi — o'z bosh sahifasiga). */
export default async function TgAssignPage() {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'tasks')) redirect('/tg');
  const options = await managerAssignOptions(m);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title="Vazifa berish" sub="Xodim Telegram orqali xabar oladi" back="/tg/vazifalar" />
      <ManagerAssign options={options} from={m.name} today={today(memberAsTenantUser(m))} />
    </div>
  );
}
