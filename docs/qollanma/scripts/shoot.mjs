// Qo'llanma uchun ekran suratlari: lokal dev server (seed ma'lumot), o'rnatilgan Chrome orqali.
// node shoot.mjs <out-dir> [lat] [lng]
import { createHmac } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://app.localhost:3140';
const OUT = process.argv[2];
const LAT = Number(process.argv[3] ?? 41.3);
const LNG = Number(process.argv[4] ?? 60.9);
mkdirSync(OUT, { recursive: true });

function signInitData(fields, botToken) {
  const dataCheck = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
const initData = (id, name) => signInitData({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: `Q${id}`, user: JSON.stringify({ id, first_name: name }) }, 'test:token');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--lang=uz'] });
const log = (m) => console.log(m);

async function clean(page) {
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((n) => n.remove());
    return document.fonts?.ready;
  });
}
async function shot(page, url, file, { full = false, wait = 400, before } = {}) {
  await page.goto(BASE + url, { waitUntil: 'networkidle0', timeout: 90_000 });
  await new Promise((r) => setTimeout(r, wait));
  if (before) await before(page);
  await clean(page);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
  log(`✓ ${file}`);
}
async function firstHref(page, selector) {
  return page.evaluate((s) => document.querySelector(s)?.getAttribute('href') ?? null, selector);
}

// ---------- Xodim (Bekzod, 700000002) ----------
{
  const ctx = await browser.createBrowserContext();
  await ctx.overridePermissions(BASE, ['geolocation', 'camera']);
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setGeolocation({ latitude: LAT, longitude: LNG, accuracy: 12 });
  await page.goto(BASE + '/tg', { waitUntil: 'networkidle0' });
  await page.evaluate(async (d) => { await fetch('/api/tg/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: d }) }); }, initData(700000002, 'Bekzod'));
  await shot(page, '/tg', 'x-01-bosh');
  await shot(page, '/tg/keldim', 'x-02-keldim', { wait: 2500 });
  await shot(page, '/tg/vazifalar', 'x-03-vazifalar');
  const t = await firstHref(page, 'a[href^="/tg/vazifa/"]');
  if (t) {
    await shot(page, t, 'x-04-vazifa');
    await shot(page, t, 'x-04b-vazifa-toliq', { full: true });
  }
  await shot(page, '/tg/ish', 'x-05-ish-qoshish');
  await shot(page, '/tg/sorov', 'x-06-sorov');
  await shot(page, '/tg/tarix', 'x-07-tarix');
  await shot(page, '/tg/profil', 'x-08-profil');
  await ctx.close();
}

// ---------- Rahbar Mini App (egasi Aziz, 700000100) ----------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/tg', { waitUntil: 'networkidle0' });
  await page.evaluate(async (d) => { await fetch('/api/tg/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: d }) }); }, initData(700000100, 'Aziz'));
  await shot(page, '/tg', 'r-01-bugun');
  await shot(page, '/tg', 'r-01b-bugun-toliq', { full: true });
  await shot(page, '/tg/qarorlar', 'r-02-qarorlar');
  await shot(page, '/tg/qarorlar', 'r-02b-qarorlar-toliq', { full: true });
  await shot(page, '/tg/vazifalar', 'r-03-vazifalar');
  await shot(page, '/tg/vazifalar?tab=review', 'r-03b-tekshiruvda');
  const rv = await firstHref(page, 'a[href^="/tg/vazifa/"]');
  if (rv) await shot(page, rv, 'r-04-vazifa-tekshiruv', { full: true });
  await shot(page, '/tg/vazifa-berish', 'r-05-vazifa-berish');
  await shot(page, '/tg/hisobot', 'r-06-hisobot');
  await shot(page, '/tg/hisobot', 'r-06b-hisobot-toliq', { full: true });
  await shot(page, '/tg/ish-haqi', 'r-07-ish-haqi');
  await page.goto(BASE + '/tg', { waitUntil: 'networkidle0' });
  const emp = await firstHref(page, 'a[href^="/tg/xodim/"]');
  if (emp) {
    await shot(page, emp, 'r-08-xodim');
    await shot(page, emp, 'r-08b-xodim-toliq', { full: true });
  }
  await shot(page, '/tg/xodim-qoshish', 'r-09-xodim-qoshish');
  await ctx.close();
}

// ---------- Panel (egasi) ----------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 860, deviceScaleFactor: 1.5 });
  await shot(page, '/kirish', 'p-00-kirish');
  await page.type('input[placeholder="90 123 45 67"]', '901112233');
  await page.type('input[type="password"]', 'demo123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90_000 }), page.$$eval('button', (bs) => { const b = bs.find((x) => x.textContent?.includes('Kirish')); b?.click(); })]);
  log('panelga kirildi: ' + page.url());
  await shot(page, '/', 'p-01-bosh');
  await shot(page, '/filiallar', 'p-02-filiallar', { wait: 2500 });
  await shot(page, '/jadvallar', 'p-03-jadvallar');
  await shot(page, '/xodimlar', 'p-04-xodimlar');
  const e = await firstHref(page, 'a[href^="/xodimlar/"]');
  if (e) await shot(page, e, 'p-05-xodim-profil');
  await shot(page, '/davomat', 'p-06-davomat');
  await shot(page, '/davomat/tabel', 'p-07-tabel');
  await shot(page, '/vazifalar', 'p-08-vazifalar');
  await shot(page, '/vazifalar?ber=1', 'p-09-vazifa-berish', { wait: 1200 });
  const tk = await firstHref(page, 'a[href^="/vazifalar/"]');
  if (tk) await shot(page, tk, 'p-10-vazifa');
  await shot(page, '/sorovlar', 'p-11-sorovlar');
  await shot(page, '/ish-haqi', 'p-12-ish-haqi');
  await shot(page, '/hisobotlar', 'p-13-hisobotlar');
  await shot(page, '/hisobotlar?tab=reyting', 'p-14-reyting');
  await shot(page, '/sozlamalar', 'p-15-sozlamalar');
  await shot(page, '/sozlamalar?tab=jamoa', 'p-16-jamoa');
  await shot(page, '/sozlamalar?tab=bildirishnomalar', 'p-17-bildirishnomalar');
  await ctx.close();
}

await browser.close();
log('tayyor');
