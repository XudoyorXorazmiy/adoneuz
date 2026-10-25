import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canUsePanel, checkGeofence, distanceMeters, formatMinutes, formatPhone, formatSom, normalizePhone, slugify } from '../src/index';

test('telefon', () => {
  assert.equal(normalizePhone('90 123 45 67'), '998901234567');
  assert.equal(normalizePhone('+998 (90) 123-45-67'), '998901234567');
  assert.equal(normalizePhone('8 90 123 45 67'), '998901234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('998101234567'), null);
  assert.equal(formatPhone('998901234567'), '+998 90 123 45 67');
});

test('slug', () => {
  assert.equal(slugify('Mudom bozor'), 'mudom-bozor');
  assert.equal(slugify("O'zbekiston Savdo"), 'ozbekiston-savdo');
  assert.equal(slugify('Ғалаба'), 'galaba');
  assert.equal(slugify('!!!'), 'ishxona');
});

test('format', () => {
  assert.equal(formatSom(4500000), "4 500 000 so'm");
  assert.equal(formatMinutes(492), '8 soat 12 daqiqa');
  assert.equal(formatMinutes(7), '7 daqiqa');
});

test('ruxsatlar', () => {
  assert.equal(can('owner', 'billing'), true);
  assert.equal(can('admin', 'billing'), false);
  assert.equal(can('manager', 'payroll'), false);
  assert.equal(can('manager', 'tasks'), true);
  assert.equal(can('employee', 'dashboard'), false);
  assert.equal(canUsePanel('employee'), false);
  assert.equal(canUsePanel('manager'), true);
});

test('geofence', () => {
  // Hazorasp markazi atrofida: ~111 m shimolga = 0.001 daraja kenglik
  const branch = { lat: 41.3194, lng: 61.0742, radiusM: 100 };
  const near = { lat: 41.3197, lng: 61.0742 };
  const far = { lat: 41.3232, lng: 61.0742 };
  assert.ok(Math.abs(distanceMeters(branch, { lat: 41.3204, lng: 61.0742 }) - 111) < 2);
  assert.equal(checkGeofence({ branch, point: near, accuracyM: 10 }).status, 'ok');
  assert.equal(checkGeofence({ branch, point: far, accuracyM: 10 }).status, 'outside');
  assert.equal(checkGeofence({ branch, point: near, accuracyM: 500 }).status, 'low_accuracy');
  // 120 m — radiusdan tashqarida, lekin 30 m aniqlik zaxirasi bilan ichkarida
  const edge = { lat: 41.31948, lng: 61.0742 + 0.00143 };
  const d = Math.round(distanceMeters(branch, edge));
  assert.ok(d > 100 && d < 130, `masofa ${d}`);
  assert.equal(checkGeofence({ branch, point: edge, accuracyM: 30 }).status, 'ok');
  assert.equal(checkGeofence({ branch, point: edge, accuracyM: 0 }).status, 'outside');
});

test('koordinata va xarita havolasi', async () => {
  const { parseCoordinates } = await import('../src/index');
  assert.deepEqual(parseCoordinates('41.3194, 61.0742'), { lat: 41.3194, lng: 61.0742 });
  assert.deepEqual(parseCoordinates('https://www.google.com/maps/place/X/@41.3194,61.0742,17z/data=!3d41.3195!4d61.0743'), { lat: 41.3195, lng: 61.0743 });
  assert.deepEqual(parseCoordinates('https://maps.google.com/?q=41.3194,61.0742'), { lat: 41.3194, lng: 61.0742 });
  assert.deepEqual(parseCoordinates('https://yandex.uz/maps/?ll=61.0742%2C41.3194&z=17'), { lat: 41.3194, lng: 61.0742 });
  assert.equal(parseCoordinates('Hazorasp'), null);
  assert.equal(parseCoordinates('0, 0'), null);
  // maps.app.goo.gl ochilgandagi manzil (Mudom bozor havolasi)
  assert.deepEqual(parseCoordinates('https://www.google.com/maps/search/41.325259,+61.069181?entry=tts&g_ep=EgoyMDI2MTAyMC4wIPu8ASoASAFQAw%3D%3D'), { lat: 41.325259, lng: 61.069181 });
  assert.deepEqual(parseCoordinates('https://www.google.com/maps/place/41.3194,61.0742'), { lat: 41.3194, lng: 61.0742 });
  assert.deepEqual(parseCoordinates('https://maps.google.com/?q=41.3194,+61.0742'), { lat: 41.3194, lng: 61.0742 });
  assert.equal(parseCoordinates('https://maps.app.goo.gl/KhNDipQMCTFL1tH49'), null, 'qisqa havolada koordinata yo‘q — server ochadi');
});

test('qisqa xarita havolasi — faqat ruxsat etilgan hostlar', async () => {
  const { isShortMapLink } = await import('../src/index');
  assert.equal(isShortMapLink('https://maps.app.goo.gl/KhNDipQMCTFL1tH49'), true);
  assert.equal(isShortMapLink(' https://goo.gl/maps/AbC123 '), true);
  assert.equal(isShortMapLink('https://goo.gl/AbC123'), false, 'goo.gl — faqat /maps/');
  assert.equal(isShortMapLink('https://maps.app.goo.gl.evil.example/x'), false);
  assert.equal(isShortMapLink('https://evil.example/maps.app.goo.gl/x'), false);
  assert.equal(isShortMapLink('http://127.0.0.1/maps/x'), false);
  assert.equal(isShortMapLink('ftp://maps.app.goo.gl/x'), false);
  assert.equal(isShortMapLink('41.3194, 61.0742'), false);
});

test('yuz qarori: chegara, servis yo‘q, namuna yo‘q, liveness', async () => {
  const { faceDecision, faceSettings } = await import('../src/index');
  const v = (similarity: number, yawRange = 0, manyFaces = false) => ({ ok: true as const, similarity, faceFrames: 3, frames: 3, manyFaces, yawRange });
  assert.equal(faceDecision(v(0.82, 30), { templates: 1, challenge: true }).status, 'ok');
  assert.deepEqual(faceDecision(v(0.3, 30), { templates: 1, challenge: true }).reasons, ['face_mismatch']);
  assert.deepEqual(faceDecision(v(0.8, 2), { templates: 1, challenge: true }).reasons, ['liveness_low']);
  assert.equal(faceDecision(v(0.8, 2), { templates: 1, challenge: false }).status, 'ok', 'bot videosida liveness talab yo‘q');
  assert.deepEqual(faceDecision(v(0.9, 30, true), { templates: 1, challenge: true }).reasons, ['many_faces']);
  assert.deepEqual(faceDecision(null, { templates: 1, challenge: true }).reasons, ['face_unavailable']);
  assert.deepEqual(faceDecision(v(0.9), { templates: 0, challenge: false }).reasons, ['no_face_template']);
  assert.deepEqual(faceDecision({ ok: false, reason: 'no_face' }, { templates: 2, challenge: false }).reasons, ['no_face']);
  assert.equal(faceSettings({ threshold: 5 }).threshold, 0.45, 'yaroqsiz sozlama — standart');
  assert.equal(faceDecision(v(0.5), { templates: 1, challenge: false, settings: faceSettings({ threshold: 0.6 }) }).status, 'suspicious');
});

test('ruxsat so‘rovlari', async () => {
  const { validLeaveRange, leaveDays, canDecideLeave } = await import('../src/index');
  assert.equal(validLeaveRange('2026-10-20', '2026-10-22', '2026-10-19'), null);
  assert.match(validLeaveRange('2026-10-22', '2026-10-20', '2026-10-19')!, /oldin/);
  assert.match(validLeaveRange('2026-08-01', '2026-08-02', '2026-10-19')!, /30 kundan/);
  assert.equal(leaveDays('2026-10-20', '2026-10-22'), 3);
  assert.equal(canDecideLeave('pending', 'approved', 'reviewer'), true);
  assert.equal(canDecideLeave('pending', 'approved', 'employee'), false, 'xodim o‘zi tasdiqlamaydi');
  assert.equal(canDecideLeave('approved', 'rejected', 'reviewer'), false, 'hal qilingani o‘zgarmaydi');
  assert.equal(canDecideLeave('pending', 'cancelled', 'employee'), true);
});
