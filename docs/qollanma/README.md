# Qo'llanmalar (xodim va rahbar/admin)

- `xodim-qollanma.html` → `xodim-qollanma.pdf` — xodimlar uchun (bot + Mini App, A–Z).
- `rahbar-qollanma.html` → `rahbar-qollanma.pdf` — egasi, administrator, bo'lim boshlig'i uchun (panel, rahbar Mini App'i, bot bildirishnomalari).
- `qollanma.css` — umumiy uslub (A4) va Telegram chat ramkasi. Bot matnlari `apps/web/src/server/bot/texts.ts`, `task-notify.ts`, `leave.ts`, `deadline.ts` dan so'zma-so'z olingan — matn o'zgarsa shu yerda ham yangilang.
- `img/` — ekran suratlari, **lokal seed ma'lumot** bilan (prod ma'lumoti ishlatilmaydi).

## Suratlarni qayta olish

```
pnpm db:seed                                   # toza demo ma'lumot
# .env: PLATFORM_BOT_TOKEN=test:token (vaqtincha), dev server: pnpm dev (app.localhost:3140)
# tg_links: 700000002 → employee (Bekzod), 700000100 → member (egasi), 700000101 → member (menejer)
cd docs/qollanma/scripts && npm i puppeteer-core@24     # o'rnatilgan Google Chrome ishlatiladi
node shoot.mjs ../img 41.3194 61.0742                   # lat lng — «Mudom — Markaz» filiali (geolokatsiya emulyatsiyasi)
node topdf.mjs ../xodim-qollanma.html ../xodim-qollanma.pdf ../rahbar-qollanma.html ../rahbar-qollanma.pdf
```

`shoot.mjs` xodim (telefon 390×844), rahbar Mini App (telefon) va panel (1366×860) sahifalarini aylanib chiqadi; panelga seed egasi (901112233 / demo123) bilan kiradi. Suratlardan keyin `.env` dagi tokenni qayta izohga oling.
