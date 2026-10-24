import { timingSafeEqual } from 'node:crypto';
import { runJobs } from '@/server/jobs/runner';
import { scheduleTicks } from '@/server/ticks';

/** Server cron har daqiqa: curl -H "Authorization: Bearer $CRON_SECRET" https://app.adone.uz/api/cron/jobs */
export async function GET(req: Request) {
  const want = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const got = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const tenants = await scheduleTicks();
  const r = await runJobs({ limit: 50, budgetMs: 50_000 });
  return Response.json({ ...r, tenants });
}
