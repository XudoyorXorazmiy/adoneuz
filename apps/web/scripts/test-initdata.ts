/** Mini App initData imzosi: to'g'ri, buzilgan, eskirgan, begona token. cd apps/web && node --import tsx scripts/test-initdata.ts */
import assert from 'node:assert/strict';
import { signInitData, verifyInitData } from '../src/lib/tg/init-data';

const TOKEN = '123:abc';
const now = Date.now();
const fields = { auth_date: String(Math.floor(now / 1000)), query_id: 'Q1', user: JSON.stringify({ id: 700000000, first_name: 'Gulnora' }) };
const good = signInitData(fields, TOKEN);
assert.equal(verifyInitData(good, TOKEN)?.user.id, 700000000, 'to‘g‘ri imzo');
assert.equal(verifyInitData(good, '999:other'), null, 'begona bot tokeni');
assert.equal(verifyInitData(good.replace('700000000', '700000001'), TOKEN), null, 'user o‘zgartirilgan');
const old = signInitData({ ...fields, auth_date: String(Math.floor(now / 1000) - 2 * 86400) }, TOKEN);
assert.equal(verifyInitData(old, TOKEN), null, 'eskirgan');
assert.equal(verifyInitData('', TOKEN), null);
assert.equal(verifyInitData('hash=zz&user=1', TOKEN), null);
console.log('initData: hammasi joyida ✓');
