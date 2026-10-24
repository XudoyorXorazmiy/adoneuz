/**
 * Bot oqimi — soxta Telegram API bilan, lokal bazada (seed'dan keyin). O'zi tozalaydi.
 *   cd apps/web && node --conditions=react-server --import tsx scripts/test-bot.ts
 */
import '@adone/db/load-env';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

type Call = { method: string; body: Record<string, unknown> };
const calls: Call[] = [];
const VIDEO = Buffer.from('fake-mp4-bytes');
const server = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (req.url?.startsWith('/file/')) {
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      return res.end(VIDEO);
    }
    const method = req.url!.split('/').pop()!;
    const body = raw ? JSON.parse(raw) : {};
    calls.push({ method, body });
    const result = method === 'getFile' ? { file_id: body.file_id, file_path: 'videos/file_1.mp4', file_size: VIDEO.length } : method === 'getMe' ? { username: 'adoneuz_bot' } : true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  });
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as { port: number }).port;
process.env.TELEGRAM_API_BASE = `http://127.0.0.1:${port}`;
process.env.PLATFORM_BOT_TOKEN = 'test:token';
process.env.MEDIA_DIR = await mkdtemp(path.join(tmpdir(), 'adone-media-'));

const { withTenant, withPlatform, employees, branches, schedules, tenants, attendanceEvents, invites, tgLinks, media, consents, jobs, pool } = await import('@adone/db');
const { createInvite } = await import('../src/server/employees');
const { processUpdate } = await import('../src/server/bot');
const { attendanceTick } = await import('../src/server/ticks');
const { addDays, isWorkday, localDate, toRuleSafe } = await import('./test-helpers');

const owner = new Pool({ connectionString: process.env.DATABASE_URL_MIGRATE, max: 1 });
const odb = drizzle(owner, { casing: 'snake_case' });

const UID = 990001;
const OTHER = 990002;
let uid = 1;
const lastText = () => String([...calls].reverse().find((c) => c.method === 'sendMessage')?.body.text ?? '');
const msg = (extra: Record<string, unknown>, from = UID) => ({ update_id: uid++, message: { message_id: uid, date: Math.floor(Date.now() / 1000), chat: { id: from, type: 'private' }, from: { id: from, first_name: 'Sinov', username: 'sinov_bot_user' }, ...extra } });
const ok = (m: string) => console.log('ok', m);

const [mudom] = await withPlatform((tx) => tx.select().from(tenants).where(eq(tenants.slug, 'mudom-bozor')));
assert.ok(mudom, 'seed kerak: pnpm db:seed');
const T = mudom!.id;
const { empId, code, branch } = await withTenant(T, async (tx) => {
  const [b] = await tx.select().from(branches).where(eq(branches.name, 'Mudom — Markaz'));
  const [s] = await tx.select().from(schedules).where(eq(schedules.name, 'Asosiy smena'));
  const [e] = await tx.insert(employees).values({ tenantId: T, fullName: 'Bot Sinov', phone: '998935551122', branchId: b!.id, scheduleId: s!.id, status: 'invited' }).returning();
  return { empId: e!.id, code: await createInvite(tx, T, e!.id), branch: b! };
});

try {
  // 1. Yaroqsiz va to'g'ri taklif
  await processUpdate(msg({ text: '/start inv_yoq' }));
  assert.match(lastText(), /yaroqsiz/);
  await processUpdate(msg({ text: `/start inv_${code}` }));
  assert.match(lastText(), /Bot Sinov/);
  ok('taklif → salomlashish');

  // 2. Kontakt: begona → rad, o'zi → rozilik
  await processUpdate(msg({ contact: { phone_number: '+998935551122', user_id: OTHER } }));
  assert.match(lastText(), /o'zingizning raqamingizni/);
  await processUpdate(msg({ contact: { phone_number: '+998935551122', user_id: UID } }));
  assert.match(lastText(), /Rozimisiz/);
  ok('kontakt tekshiruvi');

  // 3. Rozilik → yuz namunasi
  await processUpdate({ update_id: uid++, callback_query: { id: 'cb1', from: { id: UID }, data: 'consent:yes', message: { message_id: 1, chat: { id: UID } } } });
  assert.match(lastText(), /yuz namunasi/);
  await processUpdate(msg({ photo: [{}] }));
  assert.match(lastText(), /dumaloq video/);
  await processUpdate(msg({ video_note: { file_id: 'F1', file_unique_id: 'U1', duration: 4, length: 240 } }));
  assert.match(lastText(), /Ro'yxatdan o'tdingiz/);
  const e1 = await withTenant(T, async (tx) => (await tx.select().from(employees).where(eq(employees.id, empId)))[0]!);
  assert.equal(e1.status, 'pending');
  assert.equal(e1.telegramUserId, UID);
  const [face] = await withTenant(T, (tx) => tx.select().from(media).where(and(eq(media.employeeId, empId), eq(media.kind, 'face_sample'))));
  assert.ok(face);
  assert.deepEqual(await readFile(path.join(process.env.MEDIA_DIR!, face!.path)), VIDEO);
  assert.equal((await withTenant(T, (tx) => tx.select().from(consents).where(eq(consents.employeeId, empId)))).length, 1);
  const [inv] = await withPlatform((tx) => tx.select().from(invites).where(eq(invites.code, code)));
  assert.ok(inv!.usedAt, 'taklif ishlatildi');
  const notif = await withPlatform((tx) => tx.select().from(jobs).where(and(eq(jobs.tenantId, T), eq(jobs.type, 'notify_members'))));
  assert.ok(notif.some((j) => String(j.payload.text).includes('Bot Sinov')), 'rahbarlarga xabar navbatda');
  ok("ro'yxatdan o'tish: rozilik, yuz namunasi, pending, rahbarga xabar");

  // 4. Tasdiqlanmagan — Keldim ishlamaydi
  await processUpdate(msg({ text: '✅ Keldim' }));
  assert.match(lastText(), /tasdiqlanmagan/);
  await withTenant(T, (tx) => tx.update(employees).set({ status: 'active' }).where(eq(employees.id, empId)));

  // 5. Keldim: oddiy lokatsiya → rad, uzoq → rad (jurnalda), forward → rad, yaqin → video → qabul
  await processUpdate(msg({ text: '✅ Keldim' }));
  assert.match(lastText(), /jonli joylashuvni/);
  await processUpdate(msg({ location: { latitude: branch.lat, longitude: branch.lng } }));
  assert.match(lastText(), /oddiy joylashuv/);
  await processUpdate(msg({ location: { latitude: branch.lat + 0.01, longitude: branch.lng, live_period: 900, horizontal_accuracy: 10 } }));
  assert.match(lastText(), /uzoqdasiz/);
  await processUpdate(msg({ location: { latitude: branch.lat, longitude: branch.lng, live_period: 900 }, forward_origin: { type: 'user' } }));
  assert.match(lastText(), /Forward/);
  await processUpdate(msg({ location: { latitude: branch.lat + 0.0003, longitude: branch.lng, live_period: 900, horizontal_accuracy: 12 } }));
  assert.match(lastText(), /dumaloq video/);
  await processUpdate(msg({ video_note: { file_id: 'F2', file_unique_id: 'U2', duration: 3, length: 240 } }));
  assert.match(lastText(), /Qabul qilindi/);
  const evs = await withTenant(T, (tx) => tx.select().from(attendanceEvents).where(eq(attendanceEvents.employeeId, empId)));
  assert.equal(evs.filter((x) => x.checkStatus === 'rejected' && x.reasons.includes('outside')).length, 1, 'uzoq urinish jurnalda');
  const cin = evs.find((x) => x.kind === 'check_in' && x.checkStatus === 'ok')!;
  assert.ok(cin.mediaId && cin.isLiveLocation && cin.distanceM! < 100);
  ok('keldim: geofence, jonli lokatsiya, forward, video');

  await processUpdate(msg({ text: '✅ Keldim' }));
  assert.match(lastText(), /allaqachon ishdasiz/);

  // 6. Ketdim
  await processUpdate(msg({ text: '🏁 Ketdim' }));
  await processUpdate(msg({ location: { latitude: branch.lat, longitude: branch.lng, live_period: 900, horizontal_accuracy: 8 } }));
  assert.match(lastText(), /Ketish qayd etildi/);
  await processUpdate(msg({ text: '📊 Bugun' }));
  assert.match(lastText(), /Ketdingiz/);
  ok('ketdim va bugun');

  // 7. Rahbar Telegram'i (mem_)
  const memCode = 'testmem' + Date.now();
  const [ownerUser] = await odb.execute<{ id: string }>(sql`select u.id from users u join memberships m on m.user_id = u.id where m.tenant_id = ${T} and m.role = 'owner' limit 1`).then((r) => r.rows);
  await withTenant(T, (tx) => tx.insert(invites).values({ code: memCode, tenantId: T, kind: 'member', refId: ownerUser!.id, expiresAt: new Date(Date.now() + 60_000) }));
  await processUpdate(msg({ text: `/start mem_${memCode}` }, OTHER));
  assert.match(lastText(), /Telegram ulandi/);
  ok('rahbar Telegram bog‘landi');

  // 8. Avto-yopish: oxirgi ish kunida kirgan, chiqmagan
  const now = new Date();
  const tz = mudom!.timezone;
  let d = addDays(localDate(now, tz), -1);
  const rule = await toRuleSafe(T, empId);
  while (!isWorkday(rule, d)) d = addDays(d, -1);
  await odb.execute(sql`insert into attendance_events (tenant_id, employee_id, work_date, kind, server_at, source, check_status) values (${T}, ${empId}, ${d}, 'check_in', (${d}::date + time '09:00') at time zone ${tz}, 'bot', 'ok')`);
  await attendanceTick(T, now);
  const ac = await withTenant(T, (tx) => tx.select().from(attendanceEvents).where(and(eq(attendanceEvents.employeeId, empId), eq(attendanceEvents.kind, 'auto_close'))));
  assert.equal(ac.length, 1, 'avto-yopildi');
  await attendanceTick(T, now);
  assert.equal((await withTenant(T, (tx) => tx.select().from(attendanceEvents).where(and(eq(attendanceEvents.employeeId, empId), eq(attendanceEvents.kind, 'auto_close'))))).length, 1, 'ikki marta yopilmaydi');
  ok('avto-yopish');

  console.log(`\nBot: hammasi joyida ✓ (Telegram chaqiruvlari: ${calls.length})`);
} finally {
  await odb.execute(sql`delete from employees where id = ${empId}`);
  await odb.execute(sql`delete from tg_links where telegram_user_id in (${UID}, ${OTHER})`);
  await odb.execute(sql`delete from bot_sessions where telegram_user_id in (${UID}, ${OTHER})`);
  await odb.execute(sql`delete from invites where tenant_id = ${T} and (ref_id = ${empId} or code like 'testmem%')`);
  await odb.execute(sql`delete from jobs where tenant_id = ${T} and type in ('notify_members', 'notify_employee', 'absent_digest')`);
  await owner.end();
  await pool.end();
  server.close();
}
void tgLinks;
