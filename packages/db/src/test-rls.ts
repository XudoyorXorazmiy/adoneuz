/**
 * RLS chegaralari (seed'dan keyin): ilova roli bilan ishlaydi, hech narsa yozib qoldirmaydi.
 *   pnpm db:seed && pnpm db:test-rls
 */
import './load-env';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db, pool } from './client';
import { withAuth, withPlatform, withTenant } from './scoped';
import { auditLog, jobs, memberships, plans, tenants, users } from './schema/index';

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

