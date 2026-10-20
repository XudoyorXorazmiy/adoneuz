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
import { rebuildDay } from './attendance';
import { addDays, isWorkday, localDate, shiftFor, type ScheduleRule } from '@adone/core';

const url = process.env.DATABASE_URL_MIGRATE;
if (!url) throw new Error('DATABASE_URL_MIGRATE sozlanmagan');
if (!/localhost|127\.0\.0\.1/.test(url) && process.env.SEED_ALLOW_REMOTE !== '1') throw new Error('Seed faqat lokal bazada (SEED_ALLOW_REMOTE=1)');
const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool, { schema: s, casing: 'snake_case' });

async function main() {
  await db.execute(sql`truncate tenants, users, memberships, plans, subscriptions, jobs, auth_throttle, audit_log, bot_sessions, tg_updates cascade`);
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
    const userIds: Record<string, string> = {};
    for (const p of t.people) {
      const [u] = await db.insert(s.users).values({ phone: p.phone, name: p.name, passwordHash: pw }).returning();
      await db.insert(s.memberships).values({ userId: u!.id, tenantId: tenant!.id, role: p.role });
      userIds[p.name] = u!.id;
    }
    if (t.slug === 'mudom-bozor') await seedMudom(tenant!.id, userIds);
  }
  console.log('Seed tayyor: super admin 998900000000/admin123 · Mudom 998901112233/demo123');
  await pool.end();
}
/** Mudom bozor: filiallar, bo'limlar, jadvallar, xodimlar va joriy oy davomati (deterministik). */
async function seedMudom(tenantId: string, userIds: Record<string, string>) {
  const TZ = 'Asia/Tashkent';
  const [markaz, ombor] = await db.insert(s.branches).values([
    { tenantId, name: 'Mudom — Markaz', address: 'Hazorasp, markaz', lat: 41.3194, lng: 61.0742, radiusM: 100 },
    { tenantId, name: 'Mudom — Ombor', address: 'Hazorasp, sanoat zonasi', lat: 41.3151, lng: 61.0803, radiusM: 150 },
  ]).returning();
  const deps = await db.insert(s.departments).values([
    { tenantId, name: 'Sotuv zali', managerUserId: userIds['Sardor Rahimov'] },
    { tenantId, name: 'Kassa' },
    { tenantId, name: 'Ombor' },
    { tenantId, name: 'Ofis' },
  ]).returning();
  const dep = Object.fromEntries(deps.map((d) => [d.name, d.id]));
  const [asosiy, kassa, ofis] = await db.insert(s.schedules).values([
    { tenantId, name: 'Asosiy smena', kind: 'weekly', weekdays: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '21:00', breakMinutes: 60, graceMinutes: 10 },
    { tenantId, name: 'Kassa smenasi', kind: 'cycle', weekdays: [], cycleOn: 2, cycleOff: 2, cycleStart: '2026-10-01', startTime: '08:30', endTime: '22:00', breakMinutes: 60, graceMinutes: 5 },
    { tenantId, name: 'Ofis', kind: 'weekly', weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10 },
  ]).returning();
  const people: Array<[string, string, string, string, string, typeof s.employees.$inferInsert['status']]> = [
    ['Gulnora Saidova', 'Sotuvchi', 'Sotuv zali', 'm', 'a', 'active'],
    ['Madina Ergasheva', 'Sotuvchi', 'Sotuv zali', 'm', 'a', 'active'],
    ['Bekzod Tursunov', 'Sotuvchi', 'Sotuv zali', 'm', 'a', 'active'],
    ['Zarina Qosimova', 'Sotuvchi', 'Sotuv zali', 'm', 'a', 'active'],
    ['Dilshod Rahimov', 'Kassir', 'Kassa', 'm', 'k', 'active'],
    ['Shahnoza Allayeva', 'Kassir', 'Kassa', 'm', 'k', 'active'],
    ['Jasur Karimov', 'Omborchi', 'Ombor', 'o', 'a', 'active'],
    ["Ulug'bek Sobirov", 'Omborchi', 'Ombor', 'o', 'a', 'active'],
    ['Feruza Qodirova', 'Hisobchi', 'Ofis', 'm', 'f', 'active'],
    ['Otabek Yusupov', 'Sotuvchi', 'Sotuv zali', 'm', 'a', 'pending'],
    ['Nodira Jumayeva', 'Sotuvchi', 'Sotuv zali', 'm', 'a', 'invited'],
  ];
  const emps = await db.insert(s.employees).values(people.map(([fullName, position, d, b, sch, status], i) => ({
    tenantId, fullName, position, status,
    phone: `99891${String(2000000 + i * 1111).padStart(7, '0')}`,
    departmentId: dep[d], branchId: b === 'm' ? markaz!.id : ombor!.id,
    scheduleId: sch === 'k' ? kassa!.id : sch === 'f' ? ofis!.id : asosiy!.id,
    telegramUserId: status === 'invited' ? null : 700000000 + i,
    payType: 'monthly' as const, payRate: 4_500_000,
    joinedAt: status === 'active' ? new Date('2026-09-01T04:00:00Z') : null,
  }))).returning();

  // Joriy oy davomati: kun boshidan bugungi soatgacha. Psevdo-tasodif — qayta seed'da bir xil.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const now = new Date();
  const today = localDate(now, TZ);
  const rules: Record<string, ScheduleRule> = Object.fromEntries([asosiy!, kassa!, ofis!].map((x) => [x.id, x as unknown as ScheduleRule]));
  const branchOf = (e: (typeof emps)[number]) => (e.branchId === markaz!.id ? markaz! : ombor!);
  for (const e of emps.filter((x) => x.status === 'active')) {
    const rule = rules[e.scheduleId!]!;
    const br = branchOf(e);
    for (let d = `${today.slice(0, 8)}01`; d <= today; d = addDays(d, 1)) {
      if (!isWorkday(rule, d)) continue;
      const shift = shiftFor(rule, d, TZ)!;
      const roll = rnd();
      if (roll < 0.05 && d !== today) continue; // kelmagan
      const lateMin = roll < 0.2 ? 11 + Math.floor(rnd() * 25) : -Math.floor(rnd() * 12);
      const inAt = new Date(shift.start.getTime() + lateMin * 60_000);
      if (inAt > now) continue;
      const evs: Array<typeof s.attendanceEvents.$inferInsert> = [{
        tenantId, employeeId: e.id, workDate: d, kind: 'check_in', serverAt: inAt, branchId: br.id,
        lat: br.lat + (rnd() - 0.5) * 0.0006, lng: br.lng + (rnd() - 0.5) * 0.0006, accuracyM: 8 + Math.floor(rnd() * 20),
        distanceM: Math.floor(rnd() * 60), isLiveLocation: true, source: 'bot',
        checkStatus: e.fullName === 'Bekzod Tursunov' && d === today ? 'suspicious' : 'ok',
        reasons: e.fullName === 'Bekzod Tursunov' && d === today ? ['face_pending'] : [],
      }];
      const outAt = new Date(shift.end.getTime() + (rnd() < 0.1 ? -90 : Math.floor(rnd() * 15)) * 60_000);
      if (outAt <= now) evs.push({ tenantId, employeeId: e.id, workDate: d, kind: 'check_out', serverAt: outAt, branchId: br.id, lat: br.lat, lng: br.lng, accuracyM: 12, distanceM: 20, isLiveLocation: true, source: 'bot' });
      await db.insert(s.attendanceEvents).values(evs);
    }
    // Hamma ish kunlari uchun yig'ma (kelmaganlar ham — absent)
    await db.transaction(async (tx) => {
      for (let d = `${today.slice(0, 8)}01`; d <= today; d = addDays(d, 1)) {
        await rebuildDay(tx as never, { tenantId, employeeId: e.id, workDate: d, tz: TZ, now });
      }
    });
  }

}

main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
