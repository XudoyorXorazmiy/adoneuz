// Material Symbols — faqat ishlatilgan ikonkalar (Google Fonts `icon_names`) va o'z serverimizdan (next/font/local):
// to'liq shrift ~3 MB edi + fonts.googleapis.com / gstatic ga alohida ulanish va render'ni to'sadigan CSS.
// src/ va packages/core/src dagi barcha qo'shtirnoqli so'zlardan ikonka nomlarini oladi (dinamik `name={x ? 'a' : 'b'}` ham, ro'yxatlar ham),
// ma'lum nomlar (material-symbols.txt) bilan kesishtiradi. Ro'yxat o'zgarsa — kesilgan woff2 qayta yuklanadi (src/app/fonts/).
// dev va build oldidan ishlaydi. Ortiqcha nom zarar qilmaydi; yetishmagan nom — ikonka o'rnida matn, shuning uchun hamma literal olinadi.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const known = new Set(readFileSync(path.join(root, 'scripts/material-symbols.txt'), 'utf8').split('\n').filter(Boolean));
const listFile = path.join(root, 'src/app/fonts/material-symbols.txt');
const fontFile = path.join(root, 'src/app/fonts/material-symbols.woff2');
const used = new Set();

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f)) {
      for (const m of readFileSync(p, 'utf8').matchAll(/['"`]([a-z][a-z0-9_]{1,40})['"`]/g)) if (known.has(m[1])) used.add(m[1]);
    }
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, '../../packages/core/src')); // core'dagi ikonka nomlari (masalan describeDevice)

const names = [...used].sort();
const list = `${names.join('\n')}\n`;
const prev = existsSync(listFile) ? readFileSync(listFile, 'utf8') : '';
if (prev === list && existsSync(fontFile)) {
  console.log(`icons: ${names.length} ta`);
} else {
  const css = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0&icon_names=${names.join(',')}&display=block`;
  // Zamonaviy brauzer UA — woff2 qaytadi
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const text = await (await fetch(css, { headers: { 'user-agent': ua } })).text();
  const url = /url\((https:[^)]+)\) format\(.woff2.\)/.exec(text)?.[1];
  if (!url) throw new Error(`icons: Google Fonts javobida woff2 yo'q:\n${text.slice(0, 300)}`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(fontFile, buf);
  writeFileSync(listFile, list);
  console.log(`icons: ${names.length} ta — shrift yangilandi (${Math.round(buf.length / 1024)} KB)`);
}
