/**
 * RLS chegaralari (seed'dan keyin): ilova roli bilan ishlaydi, hech narsa yozib qoldirmaydi.
 *   pnpm db:seed && pnpm db:test-rls
 */
import './load-env';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db, pool } from './client';
import { withAuth, withPlatform, withTenant } from './scoped';
import { attendanceEvents, auditLog, botSessions, employees, jobs, memberships, plans, taskBatches, taskEvents, taskReports, tasks, tenants, users } from './schema/index';

async function main() {
  // Kontekstsiz — hech narsa ko'rinmaydi
  const bare = await db.transaction((tx) => tx.select().from(tenants));
  assert.equal(bare.length, 0, 'kontekstsiz tenants bo‘sh bo‘lishi kerak');

  const all = await withPlatform((tx) => tx.select().from(tenants));
  assert.ok(all.length >= 2, 'platforma hamma ishxonani ko‘radi');
  const mudom = all.find((t) => t.slug === 'mudom-bozor')!;
  const other = all.find((t) => t.slug === 'test-dokon')!;

  await withTenant(mudom.id, async (tx) => {
    const ts = await tx.select().from(tenants);
    assert.deepEqual(ts.map((t) => t.id), [mudom.id], 'faqat o‘z ishxonasi');
    const ms = await tx.select().from(memberships);
    assert.ok(ms.length > 0 && ms.every((m) => m.tenantId === mudom.id), 'faqat o‘z a‘zolari');
    const us = await tx.select().from(users);
    assert.ok(us.every((u) => !u.isPlatformAdmin), 'super admin ko‘rinmaydi');
    assert.ok(!us.some((u) => u.phone === '998905556677'), 'boshqa ishxona xodimi ko‘rinmaydi');
    assert.ok((await tx.select().from(plans)).length > 0, 'tariflar o‘qiladi');

    // Boshqa ishxonaga yozib bo'lmaydi
    await assert.rejects(tx.transaction((sp) => sp.insert(jobs).values({ tenantId: other.id, type: 'x' })), 'begona tenant_id bilan job yozilmaydi');
    await assert.rejects(tx.transaction((sp) => sp.update(tenants).set({ name: 'X' }).where(eq(tenants.id, other.id)).returning().then((r) => { if (!r.length) throw new Error('0 qator'); })), 'begona ishxona o‘zgarmaydi');
    // Jurnal append-only
    await tx.insert(auditLog).values({ tenantId: mudom.id, action: 'rls_test' });
    await assert.rejects(tx.transaction((sp) => sp.delete(auditLog)), 'audit_log o‘chirilmaydi');
    // Tarifni ishxona o'zgartira olmaydi
    await assert.rejects(tx.transaction((sp) => sp.update(plans).set({ priceSom: 0 })), 'plans yozilmaydi');
    // Platforma roliga o'tib bo'lmaydi (faqat scoped.ts orqali), lekin tenant kontekstida platforma siyosati meros olinmaydi
    throw Object.assign(new Error('rollback'), { rollback: true });
  }).catch((e) => { if (!e.rollback) throw e; });

  await withTenant(other.id, async (tx) => {
    const ms = await tx.select().from(memberships);
    assert.ok(ms.every((m) => m.tenantId === other.id));
    assert.equal((await tx.select().from(auditLog).where(eq(auditLog.action, 'rls_test'))).length, 0);
  });

  // Login konteksti: userlar o'qiladi, ishxona ichki jadvallariga (jobs) kirish yo'q
  await withAuth(async (tx) => {
    assert.ok((await tx.select().from(users)).length > 0);
    await assert.rejects(tx.transaction((sp) => sp.select().from(jobs)), 'auth roli jobs o‘qimaydi');
  });

  // Har jadvalda RLS yoqilgan (drizzle jurnali — boshqa sxemada)
  const noRls = await pool.query<{ t: string }>(`select relname as t from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity`);
  assert.deepEqual(noRls.rows, [], `RLS'siz jadval: ${noRls.rows.map((r) => r.t).join(', ')}`);

  // 1-bosqich jadvallari: boshqa ishxona xodimlari/davomati ko'rinmaydi, jurnal o'zgarmaydi
  await withTenant(other.id, async (tx) => {
    assert.equal((await tx.select().from(employees)).length, 0, 'Test do‘konda Mudom xodimlari ko‘rinmaydi');
    assert.equal((await tx.select().from(attendanceEvents)).length, 0);
  });
  await withTenant(mudom.id, async (tx) => {
    assert.ok((await tx.select().from(employees)).length > 0);
    await assert.rejects(tx.transaction((sp) => sp.update(attendanceEvents).set({ checkStatus: 'ok' })), 'attendance_events o‘zgarmaydi');
    await assert.rejects(tx.transaction((sp) => sp.delete(attendanceEvents)), 'attendance_events o‘chmaydi');
    await assert.rejects(tx.transaction((sp) => sp.select().from(botSessions)), 'bot_sessions tenant uchun yopiq');
  });

  // 2-bosqich: vazifalar — boshqa ishxonada ko'rinmaydi; task_events/task_reports append-only; vazifa o'chirilmaydi
  await withTenant(mudom.id, async (tx) => {
    const emp = (await tx.select().from(employees).limit(1))[0]!;
    const [b] = await tx.insert(taskBatches).values({ tenantId: mudom.id, title: 'rls_test' }).returning();
    const [t] = await tx.insert(tasks).values({ tenantId: mudom.id, batchId: b!.id, assigneeEmployeeId: emp.id }).returning();
    await tx.insert(taskEvents).values({ tenantId: mudom.id, taskId: t!.id, toStatus: 'new' });
    await tx.insert(taskReports).values({ tenantId: mudom.id, taskId: t!.id, text: 'x' });
    await assert.rejects(tx.transaction((sp) => sp.update(taskEvents).set({ comment: 'x' })), 'task_events o‘zgarmaydi');
    await assert.rejects(tx.transaction((sp) => sp.delete(taskReports)), 'task_reports o‘chmaydi');
    await assert.rejects(tx.transaction((sp) => sp.delete(tasks)), 'vazifa o‘chirilmaydi');
    await assert.rejects(tx.transaction((sp) => sp.insert(tasks).values({ tenantId: other.id, batchId: b!.id })), 'begona tenant_id bilan vazifa yo‘q');
    throw Object.assign(new Error('rollback'), { rollback: true });
  }).catch((e) => { if (!e.rollback) throw e; });
  await withTenant(other.id, async (tx) => {
    assert.equal((await tx.select().from(tasks)).length, 0, 'Test do‘konda Mudom vazifalari ko‘rinmaydi');
  });

  // Siyosatlarda OR yo'q (indekslar ishlashi uchun)
  const { rows } = await pool.query<{ name: string }>(`select policyname as name from pg_policies where schemaname = 'public' and (qual ilike '% or %' or with_check ilike '% or %')`);
  assert.deepEqual(rows, [], `OR'li siyosat: ${rows.map((r) => r.name).join(', ')}`);
  // Ilova roli kontekst rollarini meros olmaydi
  const inh = await pool.query<{ n: number }>(`select count(*)::int as n from pg_auth_members m join pg_roles r on r.oid = m.member where r.rolname = 'adone_app' and m.inherit_option`);
  assert.equal(inh.rows[0]!.n, 0, 'adone_app INHERIT FALSE bo‘lishi kerak');

  console.log('RLS: hammasi joyida ✓');
  await pool.end();
}
main().catch(async (e) => { console.error('RLS XATO:', e.message); await pool.end(); process.exit(1); });

