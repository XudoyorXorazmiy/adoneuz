import { redirect } from 'next/navigation';
import { can } from '@adone/core';
import { currentTgMember, currentTgUser, memberAsTenantUser } from '@/lib/tg/session';
import { isMonth } from '@/server/payroll';
import { today } from '@/server/attendance';
import { ManagerPayroll } from '@/components/tg/manager-payroll';

/** Rahbar Mini App'i — «Ish haqi»: faqat `payroll` (egasi, admin); menejer va xodim — bosh sahifaga. */
export default async function TgPayrollPage({ searchParams }: PageProps<'/tg/ish-haqi'>) {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'payroll')) redirect('/tg');
  const sp = await searchParams;
  const current = today(memberAsTenantUser(m)).slice(0, 7);
  const month = isMonth(sp.oy) && sp.oy <= current ? sp.oy : current;
  return <ManagerPayroll m={m} month={month} />;
}
