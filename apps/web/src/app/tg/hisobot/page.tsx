import { redirect } from 'next/navigation';
import { can } from '@adone/core';
import { currentTgMember, currentTgUser } from '@/lib/tg/session';
import { ManagerReport } from '@/components/tg/manager-report';

/** Rahbar Mini App'i — «Hisobot»: faqat `reports` huquqi (egasi, admin); menejer va xodim — bosh sahifaga. */
export default async function TgReportPage({ searchParams }: PageProps<'/tg/hisobot'>) {
  const m = await currentTgMember();
  if (!m) return (await currentTgUser()) ? redirect('/tg') : null;
  if (!can(m.role, 'reports')) redirect('/tg');
  const sp = await searchParams;
  return <ManagerReport m={m} preset={typeof sp.davr === 'string' ? sp.davr : undefined} />;
}
