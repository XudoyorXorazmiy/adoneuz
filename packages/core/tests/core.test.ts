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
});
