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
const faceCalls: string[] = [];
let faceSim = 0.9;
const VIDEO = Buffer.from('fake-mp4-bytes');
const server = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (req.url?.startsWith('/face/')) {
      // Soxta yuz servisi: /embed — doimiy vektor, /verify — testda o'rnatiladigan o'xshashlik
      faceCalls.push(req.url);
      const v = Array.from({ length: 512 }, (_, i) => (i === 0 ? 1 : 0));
      const body = req.url.endsWith('/embed') ? { ok: true, embedding: v, quality: { det_score: 0.9, face_px: 220, sharpness: 150 } }
        : { ok: true, similarity: faceSim, face_frames: 6, frames: 8, many_faces: false, liveness: { yaw_range: 3 } };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(body));
    }
    if (req.url?.startsWith('/file/')) {
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      return res.end(VIDEO);
    }
    const method = req.url!.split('/').pop()!;
    let body: Record<string, unknown> = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { multipart: raw.length }; }
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
process.env.FACE_SERVICE_URL = `http://127.0.0.1:${port}/face`;
process.env.MEDIA_DIR = await mkdtemp(path.join(tmpdir(), 'adone-media-'));

const { withTenant, withPlatform, employees, branches, schedules, tenants, attendanceEvents, invites, tgLinks, media, consents, jobs, pool } = await import('@adone/db');
const { createInvite } = await import('../src/server/employees');
const { processUpdate } = await import('../src/server/bot');
const { attendanceTick } = await import('../src/server/ticks');
const { enrollFace, deleteBiometrics } = await import('../src/server/face');
const { faceTemplates, leaveRequests } = await import('@adone/db');
const { leaveNotify } = await import('../src/server/leave');
const { createTasks, runTaskTemplates } = await import('../src/server/tasks');
const { taskNotify } = await import('../src/server/task-notify');
const { tasks: tasksT, taskBatches, taskReports, taskEvents, taskTemplates } = await import('@adone/db');
const { addDays, isWorkday, localDate, toRuleSafe, zonedTime } = await import('./test-helpers');

const owner = new Pool({ connectionString: process.env.DATABASE_URL_MIGRATE, max: 1 });
const odb = drizzle(owner, { casing: 'snake_case' });

const UID = 990001;
const OTHER = 990002;
const TEAM_TG = 990003;
const TEAM_PHONE = '998977770001';
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
  const enrollJob = (await withPlatform((tx) => tx.select().from(jobs).where(and(eq(jobs.tenantId, T), eq(jobs.type, 'face_enroll'))))).find((j) => j.payload.employeeId === empId);
  assert.ok(enrollJob, 'yuz namunasi navbatda');
  await enrollFace(T, empId, String(enrollJob!.payload.mediaId), false);
  assert.equal((await withTenant(T, (tx) => tx.select().from(faceTemplates).where(eq(faceTemplates.employeeId, empId)))).length, 1, 'vektor saqlandi');
  ok('yuz namunasi → vektor (face_templates)');

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
  assert.equal(cin.faceScore, 0.9, 'yuz o‘xshashligi yozildi');
  assert.ok(faceCalls.some((u) => u.endsWith('/verify')), 'yuz servisi chaqirildi');
  ok('keldim: geofence, jonli lokatsiya, forward, video, yuz mos (ok)');

  await processUpdate(msg({ text: '✅ Keldim' }));
  assert.match(lastText(), /allaqachon ishdasiz/);

  // 6. Ketdim
  await processUpdate(msg({ text: '🏁 Ketdim' }));
  await processUpdate(msg({ location: { latitude: branch.lat, longitude: branch.lng, live_period: 900, horizontal_accuracy: 8 } }));
  assert.match(lastText(), /Ketish qayd etildi/);
  await processUpdate(msg({ text: '📊 Bugun' }));
  assert.match(lastText(), /Ketdingiz/);
  ok('ketdim va bugun');

  // 6b. Ikkinchi kirish — boshqa odam yuzi: o'tadi, lekin «shubhali» (rad etilmaydi), xodimga ogohlantirish
  faceSim = 0.12;
  await processUpdate(msg({ text: '✅ Keldim' }));
  await processUpdate(msg({ location: { latitude: branch.lat + 0.0002, longitude: branch.lng, live_period: 900, horizontal_accuracy: 10 } }));
  await processUpdate(msg({ video_note: { file_id: 'F9', file_unique_id: 'U9', duration: 3, length: 240 } }));
  assert.match(lastText(), /rahbar ko‘rib chiqadi/);
  const sus = (await withTenant(T, (tx) => tx.select().from(attendanceEvents).where(and(eq(attendanceEvents.employeeId, empId), eq(attendanceEvents.kind, 'check_in'))))).find((x) => x.checkStatus === 'suspicious');
  assert.ok(sus && sus.reasons.includes('face_mismatch') && sus.faceScore === 0.12, 'face_mismatch shubhali');
  faceSim = 0.9;
  ok('boshqa yuz → shubhali (face_mismatch)');

  // 7. Rahbar Telegram'i (mem_)
  const memCode = 'testmem' + Date.now();
  const [ownerUser] = await odb.execute<{ id: string; phone: string }>(sql`select u.id, u.phone from users u join memberships m on m.user_id = u.id where m.tenant_id = ${T} and m.role = 'owner' limit 1`).then((r) => r.rows);
  await withTenant(T, (tx) => tx.insert(invites).values({ code: memCode, tenantId: T, kind: 'member', refId: ownerUser!.id, expiresAt: new Date(Date.now() + 60_000) }));
  await processUpdate(msg({ text: `/start mem_${memCode}` }, OTHER));
  assert.match(lastText(), /Raqamni yuborish/, 'avval kontakt so‘raladi');
  await processUpdate(msg({ contact: { phone_number: `+${ownerUser!.phone}`, user_id: OTHER } }, OTHER));
  assert.match(lastText(), /Telegram ulandi/);
  ok('rahbar Telegram bog‘landi (kontakt bilan tasdiqlangan)');

  // 7b. Jamoa: «Telegram orqali taklif» — parol admin'ga ko'rsatilmaydi, bot bog'lagach o'zi yuboradi; havola bir martalik
  const { addMember } = await import('@/server/team');
  const added = await addMember({ tenantId: T, userId: ownerUser!.id, role: 'owner' }, { name: 'Sinov Menejer', phone: TEAM_PHONE, role: 'manager', departmentIds: [], branchIds: [branch.id], method: 'telegram' });
  assert.ok(added.ok && added.telegramUrl && added.password === null, 'telegram usulida parol qaytmaydi');
  const loginCode = added.ok ? added.telegramUrl!.split('mem_')[1]! : '';
  await processUpdate(msg({ text: `/start mem_${loginCode}` }, TEAM_TG));
  await processUpdate(msg({ contact: { phone_number: '+998900000001', user_id: TEAM_TG } }, TEAM_TG));
  assert.match(lastText(), /mos kelmadi/, 'begona raqam — parol berilmaydi');
  assert.doesNotMatch(lastText(), /Vaqtinchalik parol/);
  await processUpdate(msg({ text: `/start mem_${loginCode}` }, TEAM_TG));
  await processUpdate(msg({ contact: { phone_number: `+${TEAM_PHONE}`, user_id: TEAM_TG } }, TEAM_TG));
  assert.match(lastText(), /Vaqtinchalik parol: <code>[a-z2-9]{3}-[a-z2-9]{4}<\/code>/);
  const [tu] = await odb.execute<{ must: boolean }>(sql`select must_change_password as must from users where phone = ${TEAM_PHONE}`).then((r) => r.rows);
  assert.equal(tu?.must, true, 'birinchi kirishda almashtirish so‘raladi');
  await processUpdate(msg({ text: `/start mem_${loginCode}` }, TEAM_TG));
  assert.match(lastText(), /yaroqsiz/, 'havola ikkinchi marta ishlamaydi');
  ok('jamoa: Telegram orqali taklif → bot kirish parolini yubordi');

  // 8. Avto-yopish: oxirgi ish kunida kirgan, chiqmagan
  const now = new Date();
  const tz = mudom!.timezone;
  let d = addDays(localDate(now, tz), -1);
  const rule = await toRuleSafe(T, empId);
  while (!isWorkday(rule, d)) d = addDays(d, -1);
  await odb.execute(sql`insert into attendance_events (tenant_id, employee_id, work_date, kind, server_at, source, check_status) values (${T}, ${empId}, ${d}, 'check_in', (${d}::date + time '09:00') at time zone ${tz}, 'bot', 'ok')`);
  // Tick kecha+bugunni ko'radi: «hozir» = o'sha ish kunining ertasi 12:00 (dushanba/bayramdan keyin ham barqaror)
  const tickAt = zonedTime(addDays(d, 1), '12:00', tz);
  await attendanceTick(T, tickAt);
  const ac = await withTenant(T, (tx) => tx.select().from(attendanceEvents).where(and(eq(attendanceEvents.employeeId, empId), eq(attendanceEvents.kind, 'auto_close'))));
  assert.equal(ac.length, 1, 'avto-yopildi');
  await attendanceTick(T, tickAt);
  assert.equal((await withTenant(T, (tx) => tx.select().from(attendanceEvents).where(and(eq(attendanceEvents.employeeId, empId), eq(attendanceEvents.kind, 'auto_close'))))).length, 1, 'ikki marta yopilmaydi');
  ok('avto-yopish');

  // 9. Vazifalar (2-bosqich): xabar → qabul → isbotsiz topshirish rad → rasm+lokatsiya → rahbar qaytaradi → qayta → baho bilan tasdiq
  const cb = (data: string, from = UID) => processUpdate({ update_id: uid++, callback_query: { id: `c${uid}`, from: { id: from }, data, message: { message_id: uid, chat: { id: from } } } });
  const taskOf = (id: string) => withTenant(T, async (tx) => (await tx.select().from(tasksT).where(eq(tasksT.id, id)))[0]!);
  const { taskIds: [tid] } = await withTenant(T, (tx) => createTasks(tx, {
    tenantId: T, source: 'assigned', title: 'Sinov: vitrinani terish', priority: 'high', proofs: ['photo', 'location'], checklist: ['Maneken'],
    dueAt: new Date(Date.now() + 3 * 3600_000), assignees: [{ employeeId: empId }], createdBy: { userId: ownerUser!.id },
  }));
  const queued = await withPlatform((tx) => tx.select().from(jobs).where(and(eq(jobs.tenantId, T), eq(jobs.type, 'task_notify'))));
  assert.ok(queued.some((j) => j.payload.kind === 'assigned') && queued.some((j) => j.dedupeKey === `tr:overdue:${tid}`), 'xabar va eslatmalar navbatda');
  await taskNotify(T, tid!, 'assigned');
  assert.match(lastText(), /Yangi vazifa/);
  assert.match(lastText(), /rasm \+ lokatsiya bilan/);
  const lastMarkup = () => JSON.stringify([...calls].reverse().find((c) => c.method === 'sendMessage')?.body.reply_markup ?? {});
  assert.ok(lastMarkup().includes(`tk:acc:${tid}`), 'qabul tugmasi');
  await cb(`tk:acc:${tid}`);
  assert.equal((await taskOf(tid!)).status, 'accepted');
  await cb(`tk:done:${tid}`);
  assert.match(lastText(), /rasm \+ lokatsiya/);
  await processUpdate(msg({ text: 'Tayyor' }));
  assert.match(lastText(), /yetishmayapti: rasm, lokatsiya/);
  assert.equal((await taskOf(tid!)).status, 'accepted', 'isbotsiz topshirilmaydi');
  await processUpdate(msg({ photo: [{ file_id: 'P1', width: 90, height: 90 }, { file_id: 'P2', width: 800, height: 800 }] }));
  assert.match(lastText(), /Qabul qilindi \(1\)/);
  await processUpdate(msg({ location: { latitude: branch.lat, longitude: branch.lng } }));
  await cb(`tk:send:${tid}`);
  assert.match(lastText(), /Hisobot yuborildi/);
  let t1 = await taskOf(tid!);
  assert.equal(t1.status, 'submitted');
  const [rep] = await withTenant(T, (tx) => tx.select().from(taskReports).where(eq(taskReports.taskId, tid!)));
  assert.ok(rep!.mediaIds.length === 1 && rep!.lat != null && rep!.text === 'Tayyor', 'hisobot: rasm, lokatsiya, izoh');
  ok('vazifa: xabar, qabul, isbot tekshiruvi, topshirish');

  calls.length = 0;
  await taskNotify(T, tid!, 'submitted');
  const toOwner = calls.filter((c) => c.body.chat_id === OTHER || c.method === 'sendPhoto');
  assert.ok(toOwner.some((c) => String(c.body.text ?? '').includes('Hisobot keldi')), 'rahbarga hisobot');
  assert.ok(calls.some((c) => c.method === 'sendPhoto'), 'rasm rahbarga yuborildi');
  await cb(`tk:ok:${tid}`, 990003);
  assert.equal((await taskOf(tid!)).status, 'submitted', 'begona odam tasdiqlay olmaydi');
  await cb(`tk:rev:${tid}`, OTHER);
  await processUpdate(msg({ text: 'Narx yorliqlari ko‘rinmayapti' }, OTHER));
  assert.match(lastText(), /Qaytarildi/);
  t1 = await taskOf(tid!);
  assert.equal(t1.status, 'revision');
  assert.equal(t1.revisionCount, 1);
  await taskNotify(T, tid!, 'revision');
  assert.match(lastText(), /qaytarildi[\s\S]*Narx yorliqlari/);
  await cb(`tk:done:${tid}`);
  await processUpdate(msg({ photo: [{ file_id: 'P3', width: 800, height: 800 }] }));
  await processUpdate(msg({ location: { latitude: branch.lat, longitude: branch.lng } }));
  await processUpdate(msg({ text: 'Tuzatdim' }));
  assert.equal((await taskOf(tid!)).status, 'submitted');
  await cb(`tk:rt:${tid}:4`, OTHER);
  t1 = await taskOf(tid!);
  assert.equal(t1.status, 'approved');
  assert.equal(t1.rating, 4);
  await cb(`tk:rt:${tid}:5`, OTHER);
  assert.equal((await taskOf(tid!)).rating, 4, 'ikkinchi bosish holatni o‘zgartirmaydi (CAS)');
  const evN = await withTenant(T, (tx) => tx.select().from(taskEvents).where(eq(taskEvents.taskId, tid!)));
  assert.deepEqual(evN.map((e) => e.toStatus), ['new', 'accepted', 'submitted', 'revision', 'submitted', 'approved']);
  ok('vazifa: rahbar Telegramdan qaytardi va baho bilan tasdiqladi; tarix to‘liq');

  // 10. Savol va «Ish qo'shish»
  const { taskIds: [t2] } = await withTenant(T, (tx) => createTasks(tx, { tenantId: T, source: 'assigned', title: 'Sinov: savol', priority: 'low', proofs: [], checklist: [], dueAt: null, assignees: [{ employeeId: empId }], createdBy: { userId: ownerUser!.id } }));
  await cb(`tk:ask:${t2}`);
  await processUpdate(msg({ text: 'Qaysi polka?' }));
  assert.match(lastText(), /rahbarga yuborildi/);
  assert.ok((await withTenant(T, (tx) => tx.select().from(taskEvents).where(eq(taskEvents.taskId, t2!)))).some((e) => e.comment === 'Qaysi polka?' && e.fromStatus === e.toStatus));
  await processUpdate(msg({ text: '📋 Vazifalarim' }));
  assert.match(lastText(), /Ochiq vazifalaringiz: 1/);
  await processUpdate(msg({ text: "➕ Ish qo'shish" }));
  await processUpdate(msg({ text: 'Sinov: kassani sanadim' }));
  assert.match(lastText(), /bajarildimi yoki reja/);
  await cb('wk:done');
  await processUpdate(msg({ text: '30 daqiqa ketdi' }));
  assert.match(lastText(), /Ish qayd etildi/);
  const self = await withTenant(T, (tx) => tx.select({ t: tasksT, b: taskBatches }).from(tasksT).innerJoin(taskBatches, eq(taskBatches.id, tasksT.batchId)).where(and(eq(tasksT.assigneeEmployeeId, empId), eq(taskBatches.source, 'self_done'))));
  assert.equal(self.length, 1);
  assert.equal(self[0]!.t.status, 'submitted', "o'zi qo'shgan ish tasdiq kutadi");
  ok("savol va «Ish qo'shish»");

  // 10a. Muddatni uzaytirish so'rovi: xodim «⏰ Muddatni uzaytirish» → +1 kun → sabab; rahbar Telegram'dan ruxsat beradi (begona — yo'q); muddat yangilanadi
  const { deadlineRequests: dlT } = await import('@adone/db');
  const { deadlineNotify } = await import('../src/server/deadline');
  await cb(`tk:acc:${t2}`);
  assert.ok(lastMarkup().includes(`tk:ext:${t2}`), '«Muddatni uzaytirish» tugmasi');
  await cb(`tk:ext:${t2}`);
  assert.match(lastText(), /Yangi muddatni tanlang/);
  await processUpdate(msg({ text: 'ertaga qandaydir' }));
  assert.match(lastText(), /28\.10 18:00/, 'format eslatmasi');
  await cb(`dl:p:${t2}:1`);
  assert.match(lastText(), /Yangi muddat/);
  await processUpdate(msg({ text: 'Mahsulot ertaga keladi' }));
  assert.match(lastText(), /rahbarga yuborildi/);
  const [dl] = await withTenant(T, (tx) => tx.select().from(dlT).where(eq(dlT.taskId, t2!)));
  assert.ok(dl && dl.status === 'pending' && dl.reason === 'Mahsulot ertaga keladi' && dl.currentDueAt === null, 'so‘rov yozildi');
  calls.length = 0;
  await deadlineNotify(T, dl!.id, 'created');
  assert.ok(calls.some((c) => c.body.chat_id === OTHER && JSON.stringify(c.body.reply_markup).includes(`dl:ok:${dl!.id}`)), 'rahbarga tugmali xabar');
  await cb(`dl:ok:${dl!.id}`, 990003);
  assert.equal((await withTenant(T, (tx) => tx.select().from(dlT).where(eq(dlT.id, dl!.id))))[0]!.status, 'pending', 'begona ruxsat bera olmaydi');
  await cb(`dl:ok:${dl!.id}`, OTHER);
  const dl2 = (await withTenant(T, (tx) => tx.select().from(dlT).where(eq(dlT.id, dl!.id))))[0]!;
  assert.equal(dl2.status, 'approved');
  assert.equal((await taskOf(t2!)).dueAt?.getTime(), dl2.requestedDueAt.getTime(), 'vazifa muddati yangilandi');
  const dlEv = await withTenant(T, (tx) => tx.select().from(taskEvents).where(eq(taskEvents.taskId, t2!)));
  assert.ok(dlEv.some((e) => e.comment?.startsWith("⏰ Muddatni uzaytirish so'raldi")) && dlEv.some((e) => e.comment?.startsWith('✅ Muddat uzaytirildi')), 'tarixda so‘rov va qaror');
  const dlJobs = await withPlatform((tx) => tx.select().from(jobs).where(and(eq(jobs.tenantId, T), eq(jobs.type, 'task_notify'))));
  assert.ok(dlJobs.some((j) => j.dedupeKey === `tr:overdue:${t2}:${dl2.requestedDueAt.getTime()}`), 'eslatma yangi muddatga qayta rejalashtirildi');
  ok("muddatni uzaytirish so'rovi: bot → rahbar ruxsati, muddat va eslatmalar yangilandi");

  // 11. Takrorlanuvchi vazifa: kuniga bir marta
  await withTenant(T, (tx) => tx.insert(taskTemplates).values({ tenantId: T, title: 'Sinov: har kuni', assigneeEmployeeIds: [empId], recurrence: { kind: 'daily', weekdays: [], monthDay: 1 }, dueTime: '23:59' }));
  const made1 = await withTenant(T, (tx) => runTaskTemplates(tx, T));
  const made2 = await withTenant(T, (tx) => runTaskTemplates(tx, T));
  assert.ok(made1 >= 1 && made2 === 0, 'takroriy vazifa kuniga bir marta');
  ok('takrorlanuvchi vazifa');

  // 12a. Ruxsat so'rovi: «📝 So'rov» → kasal → ertaga → sabab → rahbar Telegram'dan tasdiqlaydi; takror so'rov — rad
  await processUpdate(msg({ text: "📝 So'rov" }));
  assert.match(lastText(), /Ruxsat so'rash/);
  await cb('lv:k:sick');
  await cb('lv:d:1');
  await processUpdate(msg({ text: 'Isitma' }));
  assert.match(lastText(), /So'rov yuborildi/);
  const [lv] = await withTenant(T, (tx) => tx.select().from(leaveRequests).where(eq(leaveRequests.employeeId, empId)));
  assert.ok(lv && lv.status === 'pending' && lv.kind === 'sick' && lv.reason === 'Isitma');
  calls.length = 0;
  await leaveNotify(T, lv!.id, 'created');
  assert.ok(calls.some((c) => c.body.chat_id === OTHER && JSON.stringify(c.body.reply_markup).includes(`lv:ok:${lv!.id}`)), 'rahbarga tugmali xabar');
  await cb(`lv:ok:${lv!.id}`, 990003);
  assert.equal((await withTenant(T, (tx) => tx.select().from(leaveRequests).where(eq(leaveRequests.id, lv!.id))))[0]!.status, 'pending', 'begona tasdiqlay olmaydi');
  await cb(`lv:ok:${lv!.id}`, OTHER);
  assert.equal((await withTenant(T, (tx) => tx.select().from(leaveRequests).where(eq(leaveRequests.id, lv!.id))))[0]!.status, 'approved');
  await processUpdate(msg({ text: "📝 So'rov" }));
  await cb('lv:k:personal');
  await cb('lv:d:1');
  await processUpdate(msg({ text: '-' }));
  assert.match(lastText(), /allaqachon bor/, 'ustma-ust so‘rov rad');
  ok("ruxsat so'rovi: bot → rahbar tasdig'i, takror rad");

  // 12. Xodim o'chirilsa biometrika o'chadi (§1.4)
  await withTenant(T, (tx) => deleteBiometrics(tx, empId));
  assert.equal((await withTenant(T, (tx) => tx.select().from(faceTemplates).where(eq(faceTemplates.employeeId, empId)))).length, 0);
  assert.equal((await withTenant(T, (tx) => tx.select().from(media).where(and(eq(media.employeeId, empId), eq(media.kind, 'face_sample'))))).length, 0);
  ok('biometrika o‘chirildi');

  console.log(`\nBot: hammasi joyida ✓ (Telegram chaqiruvlari: ${calls.length})`);
} finally {
  await odb.execute(sql`delete from task_templates where ${empId} = any(assignee_employee_ids)`);
  await odb.execute(sql`delete from task_batches where id in (select batch_id from tasks where assignee_employee_id = ${empId})`);
  await odb.execute(sql`delete from employees where id = ${empId}`);
  await odb.execute(sql`delete from tg_links where telegram_user_id in (${UID}, ${OTHER}, ${TEAM_TG})`);
  await odb.execute(sql`delete from bot_sessions where telegram_user_id in (${UID}, ${OTHER}, ${TEAM_TG})`);
  await odb.execute(sql`delete from invites where ref_id in (select id from users where phone = ${TEAM_PHONE})`);
  await odb.execute(sql`delete from users where phone = ${TEAM_PHONE}`);
  await odb.execute(sql`delete from invites where tenant_id = ${T} and (ref_id = ${empId} or code like 'testmem%')`);
  await odb.execute(sql`delete from jobs where tenant_id = ${T} and type in ('notify_members', 'notify_employee', 'absent_digest', 'task_notify', 'face_enroll', 'leave_notify', 'deadline_notify')`);
  await owner.end();
  await pool.end();
  server.close();
}
void tgLinks; void taskTemplates;
