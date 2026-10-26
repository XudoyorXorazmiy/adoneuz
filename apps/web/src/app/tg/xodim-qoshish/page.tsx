import { redirect } from 'next/navigation';
import { can } from '@adone/core';
import { currentTgMember, currentTgUser } from '@/lib/tg/session';
import { managerFormOptions } from '@/server/manager';
import { TgHeader } from '@/components/tg/tg-shell';
import { ManagerAddEmployee } from '@/components/tg/manager-add-employee';

/** Rahbar Mini App'i — «Xodim qo'shish» (`employees`; menejer — faqat o'z bo'limiga, stavkani ko'rmaydi). */
export default async function TgAddEmployeePage() {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'employees')) redirect('/tg');
  const options = await managerFormOptions(m);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title="Yangi xodim" sub="Saqlangach taklif havolasi chiqadi" back="/tg" />
      <ManagerAddEmployee options={options} showPay={can(m.role, 'payroll')} tenantName={m.tenantName} />
    </div>
  );
}
