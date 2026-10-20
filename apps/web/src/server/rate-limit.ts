import 'server-only';
import { sql } from 'drizzle-orm';
import { withAuth } from '@adone/db';

/** Oddiy oyna bo'yicha cheklov (auth_throttle jadvali): `limit` urinish / `windowSec` soniya. */
export async function allow(key: string, limit: number, windowSec: number): Promise<boolean> {
  const rows = await withAuth((tx) =>
    tx.execute<{ count: number }>(sql`
      insert into auth_throttle (key, count, reset_at) values (${key}, 1, now() + make_interval(secs => ${windowSec}))
      on conflict (key) do update set
        count = case when auth_throttle.reset_at < now() then 1 else auth_throttle.count + 1 end,
        reset_at = case when auth_throttle.reset_at < now() then now() + make_interval(secs => ${windowSec}) else auth_throttle.reset_at end
      returning count`),
  );
  return (rows.rows[0]?.count ?? 0) <= limit;
}
