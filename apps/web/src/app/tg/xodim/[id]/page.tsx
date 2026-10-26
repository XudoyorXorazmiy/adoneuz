import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { today } from '@/server/attendance';
import { ManagerEmployee } from '@/components/tg/manager-employee';

/** Rahbar Mini App'i — xodim kartasi (menejer faqat o'z bo'limi xodimini ko'radi; xodim sessiyasi — bosh sahifaga). */
export default async function TgEmployeePage({ params, searchParams }: PageProps<'/tg/xodim/[id]'>) {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const cur = today(memberAsTenantUser(m)).slice(0, 7);
  const month = typeof sp.oy === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.oy) && sp.oy <= cur ? sp.oy : cur;
  return <ManagerEmployee m={m} id={id} month={month} />;
}
