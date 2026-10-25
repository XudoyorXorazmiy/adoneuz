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
    // Stavkalar: sotuvchi/kassir — oylik, omborchi — kunbay, hisobchi — oylik (yuqori)
    payType: position === 'Omborchi' ? 'daily' as const : 'monthly' as const,
    payRate: position === 'Omborchi' ? 180_000 : position === 'Hisobchi' ? 6_000_000 : position === 'Kassir' ? 4_000_000 : 4_500_000,
    joinedAt: status === 'active' ? new Date('2026-09-01T04:00:00Z') : null,
  }))).returning();

  // Ish haqi qoidalari (ishxona ma'lumoti; panel → Ish haqi → Qoidalar)
  await db.insert(s.payRules).values({ tenantId, rules: {
    monthlyProration: true, paidLeave: true, late: { mode: 'per_case', amount: 20_000 }, absentPenalty: 100_000, earlyPerMinute: 0, overtimePerHour: 25_000,
    task: { onTimeBonus: 10_000, latePenalty: 15_000, fiveStarBonus: 20_000, countSelfTasks: false }, maxPenaltyPercent: 30, showToEmployee: true,
  } });

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

  await seedTasks(tenantId, emps, userIds, now);

  // Ruxsat so'rovlari: kutilayotgan (ertadan ta'til), tasdiqlangan (kecha kasal — tabelda «Ruxsatda»)
  const E = Object.fromEntries(emps.map((e) => [e.fullName, e]));
  await db.insert(s.leaveRequests).values([
    { tenantId, employeeId: E['Shahnoza Allayeva']!.id, kind: 'vacation', dateFrom: addDays(today, 1), dateTo: addDays(today, 3), reason: "Oilaviy to'y" },
    { tenantId, employeeId: E['Zarina Qosimova']!.id, kind: 'personal', dateFrom: addDays(today, 2), dateTo: addDays(today, 2), reason: 'Hujjat topshirish' },
    { tenantId, employeeId: E["Ulug'bek Sobirov"]!.id, kind: 'sick', dateFrom: addDays(today, -1), dateTo: addDays(today, -1), reason: 'Isitma', status: 'approved', decidedByUserId: userIds['Aziz Karimov'], decidedAt: now },
  ]);
  await db.transaction(async (tx) => rebuildDay(tx as never, { tenantId, employeeId: E["Ulug'bek Sobirov"]!.id, workDate: addDays(today, -1), tz: TZ, now }));
}

/** Vazifalar demo (2-bosqich): har holatdan, ko'p ijrochili, o'zi qo'shgan va takroriy. Bildirishnoma navbatga yozilmaydi. */
async function seedTasks(tenantId: string, emps: Array<typeof s.employees.$inferSelect>, userIds: Record<string, string>, now: Date) {
  const E = Object.fromEntries(emps.map((e) => [e.fullName, e.id]));
  const owner = userIds['Aziz Karimov']!;
  const H = 3600_000;
  const at = (h: number) => new Date(now.getTime() + h * H);
  const tpl = await db.insert(s.taskTemplates).values({
    tenantId, title: 'Kassa hisobotini topshirish', priority: 'low', proofs: ['photo'], checklist: [], assigneeEmployeeIds: [E['Dilshod Rahimov']!],
    recurrence: { kind: 'daily', weekdays: [], monthDay: 1 }, dueTime: '21:30', createdByUserId: owner, lastRunDate: localDate(now, 'Asia/Tashkent'),
  }).returning();
  type Copy = { who: string; status: typeof s.tasks.$inferInsert['status']; rating?: number; spent?: number; report?: string; late?: boolean };
  const specs: Array<{ title: string; description?: string; priority: 'low' | 'medium' | 'high'; proofs: string[]; checklist?: string[]; due: number | null; source?: 'assigned' | 'self_plan' | 'self_done'; by?: string; template?: boolean; copies: Copy[] }> = [
    { title: 'Ombor inventarizatsiyasi — oyoq kiyim', priority: 'medium', proofs: ['photo'], checklist: ['Qoldiqni sanash', 'Farqni yozish'], due: 26, copies: [{ who: 'Jasur Karimov', status: 'new' }] },
    { title: 'Yangi kolleksiyani vitrinaga terish', description: "Kuzgi kolleksiyani asosiy vitrinaga, manekenlarga kiydirib joylang. Narx yorliqlari ko'rinib tursin.", priority: 'high', proofs: ['photo'], checklist: ['Manekenlarga kiydirish', 'Narx yorliqlarini tekshirish'], due: 6,
      copies: [{ who: 'Madina Ergasheva', status: 'approved', rating: 5, report: "Vitrina tayyor, 3 ta maneken" }, { who: 'Gulnora Saidova', status: 'submitted', report: 'Tayyor, rasmga oldim' }, { who: 'Bekzod Tursunov', status: 'revision' }] },
    { title: 'Yetkazib berish — Pitnak filialiga', priority: 'medium', proofs: ['location'], due: -1.3, copies: [{ who: "Ulug'bek Sobirov", status: 'in_progress' }] },
    { title: 'Kassa hisobotini topshirish', priority: 'low', proofs: ['photo'], due: 10, template: true, copies: [{ who: 'Dilshod Rahimov', status: 'accepted' }] },
    { title: 'Kassa hisobotini topshirish — kecha', priority: 'low', proofs: ['photo'], due: -14, template: true, copies: [{ who: 'Dilshod Rahimov', status: 'submitted', report: 'Z-hisobot ilova qilindi' }] },
    { title: 'Vitrinadagi narxlarni yangiladim', priority: 'low', proofs: ['button'], due: null, source: 'self_done', copies: [{ who: 'Madina Ergasheva', status: 'submitted', spent: 90, report: '45 ta yorliq almashtirildi' }] },
    { title: 'Yangi kelgan 40 ta tovarni qabul qildim', priority: 'low', proofs: ['button'], due: null, source: 'self_done', copies: [{ who: 'Jasur Karimov', status: 'approved', spent: 120, rating: 5 }] },
    { title: 'Mijozlar bazasini yangilash', priority: 'low', proofs: ['button'], due: 30, source: 'self_plan', copies: [{ who: 'Feruza Qodirova', status: 'accepted' }] },
    { title: 'Oylik hisobotni tayyorlash', priority: 'high', proofs: ['button'], due: -30, copies: [{ who: 'Feruza Qodirova', status: 'approved', rating: 4, report: 'Excel ilova' }] },
  ];
  for (const sp of specs) {
    const src = sp.source ?? 'assigned';
    const [b] = await db.insert(s.taskBatches).values({
      tenantId, source: src, title: sp.title, description: sp.description ?? null, priority: sp.priority, proofs: sp.proofs, checklist: sp.checklist ?? [],
      dueAt: sp.due == null ? null : at(sp.due), templateId: sp.template ? tpl[0]!.id : null,
      createdByUserId: src === 'assigned' ? owner : null, createdByEmployeeId: src === 'assigned' ? null : E[sp.copies[0]!.who] ?? null, createdAt: at(-30),
    }).returning();
    for (const c of sp.copies) {
      const done = ['submitted', 'approved'].includes(c.status!);
      const submittedAt = done ? at(sp.due != null && sp.due < 0 ? sp.due - 0.5 : -1) : null;
      const [t] = await db.insert(s.tasks).values({
        tenantId, batchId: b!.id, assigneeEmployeeId: E[c.who]!, status: c.status, dueAt: b!.dueAt,
        acceptedAt: c.status === 'new' ? null : at(-20), startedAt: ['in_progress', 'submitted', 'approved', 'revision'].includes(c.status!) ? at(-10) : null,
        submittedAt, approvedAt: c.status === 'approved' ? at(-0.5) : null, rating: c.rating ?? null, spentMinutes: c.spent ?? null,
        revisionCount: c.status === 'revision' ? 1 : 0, reviewedByUserId: ['approved', 'revision'].includes(c.status!) ? owner : null,
        checklistDone: (sp.checklist ?? []).map(() => done), createdAt: at(-30),
      }).returning();
      const ev = (from: typeof s.taskEvents.$inferInsert['fromStatus'], to: typeof s.taskEvents.$inferInsert['toStatus'], h: number, comment?: string, byEmp = false) =>
        db.insert(s.taskEvents).values({ tenantId, taskId: t!.id, fromStatus: from, toStatus: to, comment: comment ?? null, createdAt: at(h), actorUserId: byEmp ? null : owner, actorEmployeeId: byEmp ? E[c.who]! : null });
      await ev(null, src === 'assigned' ? 'new' : src === 'self_plan' ? 'accepted' : 'submitted', -30, src === 'self_done' ? c.report : undefined, src !== 'assigned');
      if (src !== 'assigned') { if (c.status === 'approved') await ev('submitted', 'approved', -0.5, c.rating ? `Baho: ${c.rating}/5` : undefined); continue; }
      if (c.status !== 'new') await ev('new', 'accepted', -20, undefined, true);
      if (['in_progress', 'submitted', 'approved', 'revision'].includes(c.status!)) await ev('accepted', 'in_progress', -10, undefined, true);
      if (['submitted', 'approved', 'revision'].includes(c.status!)) {
        await ev('in_progress', 'submitted', -2, c.report ?? 'Bajarildi', true);
        await db.insert(s.taskReports).values({ tenantId, taskId: t!.id, text: c.report ?? 'Bajarildi', source: 'bot', createdAt: at(-2) });
      }
      if (c.status === 'approved') await ev('submitted', 'approved', -0.5, c.rating ? `Baho: ${c.rating}/5` : undefined);
      if (c.status === 'revision') await ev('submitted', 'revision', -1, "Narx yorliqlari ko'rinmayapti — qayta suratga oling");
    }
  }
}

main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
