/**
 * Production bootstrap (idempotent): tariflar + super admin. Hech narsani o'chirmaydi.
 *   BOOTSTRAP_ADMIN_PHONE=998XXXXXXXXX BOOTSTRAP_ADMIN_PASSWORD=… pnpm --filter @adone/db bootstrap
 */
import './load-env';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as s from './schema/index';
import { hashPassword } from './password';
import { PLAN_ROWS } from './plans';

const url = process.env.DATABASE_URL_MIGRATE;
if (!url) throw new Error('DATABASE_URL_MIGRATE sozlanmagan');
const pool = new Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } });
const db = drizzle(pool, { schema: s, casing: 'snake_case' });

async function main() {
  for (const p of PLAN_ROWS) await db.insert(s.plans).values(p).onConflictDoNothing({ target: s.plans.code });
  const phone = process.env.BOOTSTRAP_ADMIN_PHONE;
  const pw = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (phone && pw) {
    const [u] = await db.select().from(s.users).where(eq(s.users.phone, phone)).limit(1);
    if (!u) {
      await db.insert(s.users).values({ phone, name: 'Super admin', passwordHash: await hashPassword(pw), isPlatformAdmin: true });
      console.log('Super admin yaratildi');
    } else console.log('Super admin allaqachon bor');
  }
  console.log('Bootstrap tayyor');
  await pool.end();
}
main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
