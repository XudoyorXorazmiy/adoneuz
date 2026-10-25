import { eq } from 'drizzle-orm';
import { branches, withTenant } from '@adone/db';
import { currentTgUser } from '@/lib/tg/session';
import { CheckFlow } from '@/components/tg/check-flow';

export default async function TgCheckPage({ searchParams }: PageProps<'/tg/keldim'>) {
  const u = await currentTgUser();
  if (!u) return null; // sessiya yo'q — layout avtorizatsiya ekranini ko'rsatadi (layout va page parallel render qilinadi)
  const sp = await searchParams;
  const b = u.branchId ? await withTenant(u.tenantId, async (tx) => (await tx.select({ radiusM: branches.radiusM }).from(branches).where(eq(branches.id, u.branchId!)).limit(1))[0]) : null;
  return <CheckFlow action={sp.ketdi === '1' ? 'check_out' : 'check_in'} branchName={u.branchName} radiusM={b?.radiusM ?? null} />;
}
