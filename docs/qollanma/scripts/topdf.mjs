// HTML qo'llanma → PDF (A4), o'rnatilgan Chrome orqali. node topdf.mjs <in.html> <out.pdf> [...]
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pairs = [];
for (let i = 2; i + 1 < process.argv.length; i += 2) pairs.push([process.argv[i], process.argv[i + 1]]);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
for (const [inp, out] of pairs) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(inp).href, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await Promise.all([...document.images].map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  });
  await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#94a3b8;text-align:center;font-family:Helvetica,Arial">adone.uz · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '14mm', right: '13mm', bottom: '16mm', left: '13mm' } });
  console.log('✓', out);
  await page.close();
}
await browser.close();
