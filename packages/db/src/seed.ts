/**
 * Dev seed: HAMMA ma'lumotni o'chirib qayta yozadi. Prod'da ishlamaydi (masofaviy baza — SEED_ALLOW_REMOTE=1 kerak).
 *   Super admin   admin.localhost:3140   998900000000 / admin123
 *   Mudom bozor   app.localhost:3140     998901112233 / demo123 (egasi Aziz Karimov)
 *                                        998901112244 / demo123 (admin Nilufar Yusupova)
 *   Test do'kon   (izolyatsiya sinovi)   998905556677 / demo123
 */
import './load-env';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as s from './schema/index';
import { hashPassword } from './password';
import { PLAN_ROWS, TRIAL_DAYS } from './plans';

const url = process.env.DATABASE_URL_MIGRATE;
if (!url) throw new Error('DATABASE_URL_MIGRATE sozlanmagan');
if (!/localhost|127\.0\.0\.1/.test(url) && process.env.SEED_ALLOW_REMOTE !== '1') throw new Error('Seed faqat lokal bazada (SEED_ALLOW_REMOTE=1)');
const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool, { schema: s, casing: 'snake_case' });

async function main() {
  await db.execute(sql`truncate tenants, users, memberships, plans, subscriptions, jobs, auth_throttle, audit_log cascade`);
  const plans = await db.insert(s.plans).values([...PLAN_ROWS]).returning();
  const trial = plans.find((p) => p.code === 'sinov')!;
  const pw = await hashPassword('demo123');

  await db.insert(s.users).values({ phone: '998900000000', name: 'Super admin', passwordHash: await hashPassword('admin123'), isPlatformAdmin: true });

  const tenantsSpec = [
    { slug: 'mudom-bozor', name: 'Mudom bozor', people: [
      { phone: '998901112233', name: 'Aziz Karimov', role: 'owner' as const },
      { phone: '998901112244', name: 'Nilufar Yusupova', role: 'admin' as const },
      { phone: '998901112255', name: 'Sardor Rahimov', role: 'manager' as const },
    ] },
    { slug: 'test-dokon', name: "Test do'kon", people: [{ phone: '998905556677', name: 'Test Egasi', role: 'owner' as const }] },
  ];
  for (const t of tenantsSpec) {
    const [tenant] = await db.insert(s.tenants).values({ slug: t.slug, name: t.name }).returning();
    await db.insert(s.subscriptions).values({ tenantId: tenant!.id, planId: trial.id, status: 'trial', currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 86_400_000) });
    for (const p of t.people) {
      const [u] = await db.insert(s.users).values({ phone: p.phone, name: p.name, passwordHash: pw }).returning();
      await db.insert(s.memberships).values({ userId: u!.id, tenantId: tenant!.id, role: p.role });
    }
  }
  console.log('Seed tayyor: super admin 998900000000/admin123 · Mudom 998901112233/demo123');
  await pool.end();
}
main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
