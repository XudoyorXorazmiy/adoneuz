# adone — deploy

> Holat (2026-10-25): **sozlangan** (egasining kompyuteridagi Claude Code sessiyasidan, Coolify API + Cloudflare API + SSH). Sirlar lokal `~/server-backups/adoneuz/secrets.env` da (chatga chiqarilmaydi); bot tokenini egasi Coolify env'ga o'zi kiritadi.
>
> Coolify: project `adone` `5rftf2lcsanzcg3colkmqo0g` · Postgres `adone-pg` `efcybajfcovqhctvtgltdxrb` (ichki host shu uuid, backup har kuni 22:15, 14 nusxa) · `adone-web` `rwsu4i5qshtgp9wumch8efrl` · `adone-face` `5gkaljf2cg2ijtc92wrcx0lt` (network alias `adone-face`, watch path `services/face/**`, RAM chegarasi 1.5 GB).

## Qayerda nima (reja)

| Qism | Joy |
|---|---|
| Server | Contabo VPS `109.199.121.164` (chaat, openstore bilan bir server), Coolify v4 — panel `http://109.199.121.164:8000` |
| Repo | `github.com/XudoyorXorazmiy/adoneuz`, branch **`main`** — push = avtomatik build + deploy (GitHub App `xudoyor-coolify`) |
| Domen | `adone.uz` — registrar **SUVAN NET**, NS allaqachon **Cloudflare** (`anahi`/`sevki`), A yozuvlar DNS only. MX/TXT — timeweb pochtasi (tegilmaydi) |
| Hostlar | `adone.uz` (landing), `www` → apex, `app.adone.uz` (panel + Mini App + webhook), `admin.adone.uz` (super admin) |
| Baza | Coolify Postgres, image `pgvector/pgvector:pg18`, db/user `adone` (ega, migratsiya), ilova roli `adone_app` (NOBYPASSRLS) |
| Yuz servisi | Coolify'da alohida ilova `adone-face` (`services/face/Dockerfile`, base dir `services/face`), faqat ichki tarmoq (domen YO'Q — API bilan yaratilganda Coolify sslip domen qo'yadi, `domains:""` PATCH bilan olib tashlanadi), port 8000, `FACE_SERVICE_URL=http://adone-face:8000` (network alias). Model build paytida yuklanadi (~330 MB), RAM ~1 GB |
| Cron | `/etc/cron.d/adone` — har daqiqa `curl -K /etc/adone/cron.curl` (chmod 600: Bearer `CRON_SECRET` + `https://app.adone.uz/api/cron/jobs`; sir cron qatorida emas — chaat naqshi) |
| Media | Docker volume `rwsu4i5qshtgp9wumch8efrl-adone-media` → `/app/media-data` (Coolify API `host_path` qabul qilmaydi; konteyner root bilan ishlaydi) |

## 1. Cloudflare'ga domen qo'shish

1. dash.cloudflare.com → **Add a domain** → `adone.uz` → Free plan.
2. DNS yozuvlari (hammasi **DNS only / kulrang bulut**, proksisiz — Let's Encrypt HTTP-01 Coolify Traefik'da ishlashi uchun):
   - `A  @    109.199.121.164`
   - `A  www  109.199.121.164`
   - `A  app  109.199.121.164`
   - `A  admin 109.199.121.164`
   - (ixtiyoriy) `A  *  109.199.121.164`
3. Cloudflare bergan ikkita NS'ni yozib oling (`xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`).

## 2. ahost'da NS almashtirish

ahost.uz → kabinet → Domenlar → `adone.uz` → **NS serverlar** → Cloudflare'ning ikkita NS'ini kiriting → Saqlash.
.uz reestrida o'tishi bir necha soatgacha (ba'zan 24 soat). Tekshirish: `dig +short NS adone.uz` → cloudflare NS'lari chiqishi kerak.
NS o'tgach serverda `docker restart coolify-proxy` va SSL'ni tekshirish (chaat tajribasi).

## 3. Coolify

1. **Project** `adone` yaratish.
2. **Postgres** resursi: image `pgvector/pgvector:pg18`, db/user `adone`, kuchli parol. Faqat ichki tarmoq. Tungi zaxira yoqiladi (UTC 23:00, 14 nusxa).
3. **Ilova** (Application → GitHub App `xudoyor-coolify` → repo `adoneuz`, branch `main`): build pack **Dockerfile** (`/Dockerfile`), port **3000**, health check `/api/health` (`health_check_host=127.0.0.1`), domains: `https://adone.uz,https://www.adone.uz,https://app.adone.uz,https://admin.adone.uz`. `ROOT_DOMAIN` va `PUBLIC_URL` ni «Build Variable» ham qiling (proxy build paytida oladi).
4. Persistent storage: Docker volume `rwsu4i5qshtgp9wumch8efrl-adone-media` → `/app/media-data` (serverda `/var/lib/docker/volumes/rwsu4i5qshtgp9wumch8efrl-adone-media/_data`; `/data/adone/media` EMAS — Coolify API `host_path` qabul qilmadi).
5. Environment Variables (qiymatlar faqat Coolify'da, chatga chiqarilmaydi):
   - `DATABASE_URL=postgres://adone_app:…@<db-host>:5432/adone?sslmode=disable` (**`sslmode=disable` shart**)
   - `DATABASE_URL_MIGRATE=postgres://adone:…@<db-host>:5432/adone?sslmode=disable`
   - `ROOT_DOMAIN=adone.uz`, `PUBLIC_URL=https://app.adone.uz` (webhook va Mini App manzili — `/tg` faqat `app.` hostda ochiladi, `adone.uz` bo'lsa Mini App 404)
   - `TELEGRAM_WEBHOOK_IP=109.199.121.164` (setWebhook `ip_address` — Telegram DNS'ga qaramaydi)
   - `AUTH_SECRET`, `SECRET_KEY` (AES-GCM), `CRON_SECRET` — har biri `openssl rand -hex 32`
   - `MEDIA_DIR=/app/media-data`, `DB_POOL_MAX=20` (2026-10-28)
   - Bot: `PLATFORM_BOT_TOKEN` (@BotFather'dan, `@adoneuz_bot`), `PLATFORM_BOT_USERNAME=adoneuz_bot`
   - `PLATFORM_OWNER_CHAT_ID` — egasining Telegram ID'si (2026-10-29: 927967819 — egasining @adoneuz_bot'ga kontakt bilan bog'langan Telegram'i): yangi ariza, yiqilgan ishlar va sog'liq ogohlantirishlari, kunlik xulosa (09:00), ixtiyoriy `NEXT_PUBLIC_SUPPORT_TELEGRAM`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_INSTAGRAM`, `NEXT_PUBLIC_YOUTUBE` — landing statik yig'iladi, shuning uchun bular va `PLATFORM_BOT_USERNAME` ham «Build Variable» bo'lsin
   - Yuz servisi: `FACE_SERVICE_URL=http://<adone-face konteyner nomi>:8000`, `FACE_SERVICE_KEY=…` (ikkala ilovada bir xil, `openssl rand -hex 24`). Servis o'chiq bo'lsa ham keldi/ketdi ishlaydi — «shubhali» bo'lib tushadi
6. Cron (serverda): `/etc/cron.d/adone` → har daqiqa `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.adone.uz/api/cron/jobs`.

## 4. Telegram bot

@BotFather → `/newbot` → `adone` / `adoneuz_bot` → token Coolify env'ga (`PLATFORM_BOT_TOKEN`, `PLATFORM_BOT_USERNAME=adoneuz_bot`) → Redeploy. Keyin webhook va buyruqlar (bir marta):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.adone.uz/api/cron/setup-bot
```

Mini App: `setup-bot` chat menyusiga «Ochish» → `https://app.adone.uz/tg` ni o'zi qo'yadi (alohida `/setmenubutton` shart emas). Ixtiyoriy: @BotFather → `/newapp` (to'g'ridan-to'g'ri havola `t.me/adoneuz_bot/app` uchun) → URL `https://app.adone.uz/tg`.

## 5. Migratsiya (prod)

Baza tashqaridan ko'rinmaydi — ilova konteyneri ichidan (openstore usuli):

```bash
ssh -i ~/.ssh/mvps_main root@109.199.121.164
C=$(docker ps --format '{{.Names}}' | grep ^<app-uuid> | head -1)
# 2026-10-29 dan image — Next standalone; baza vositalari /app/db da (pnpm deploy, tsx bilan)
docker exec $C sh -c 'cd /app/db && npx tsx src/migrate.ts && npx tsx src/set-app-password.ts && npx tsx src/db-check.ts'
# bir marta: tariflar + super admin (parolni chatga yozmang)
docker exec -e BOOTSTRAP_ADMIN_PHONE=998XXXXXXXXX -e BOOTSTRAP_ADMIN_PASSWORD='…' $C sh -c 'cd /app/db && npx tsx src/bootstrap.ts'
```

Tartib: avval push, deploy tugagach migrate. **Birinchi deploy'da** `adone_app` roli hali yo'q — ilova bazaga ulana olmaydi (health check o'tadi, sahifalar 500), migrate + `set-app-password` dan keyin ishlaydi. `set-app-password` `DATABASE_URL` dagi parolni `adone_app` ga qo'yadi (Postgres'da qo'lda rol yaratish shart emas). Prod bazada seed ISHLATILMAYDI.

## Zaxira va saqlash (2026-10-29, BARQARORLIK 3.1, 3.5)

- **Baza:** Coolify `adone-pg` tungi zaxirasi (22:15, 14 nusxa).
- **Media:** `/etc/cron.d/adone-media-backup` — har kecha 02:30 volume → `/data/backups/adone-media` (rsync, ko'zgu). Hozircha SHU serverda;
  serverdan tashqariga (S3-mos saqlash) — kalit bo'lgach (egasi beradi), shu cron'ga qo'shiladi.
- **Tozalash** (`cleanup` ishi, har kuni 03:00 dan keyin): keldi-ketdi isboti (dumaloq video, selfi) 60 kundan keyin o'chadi (egasi qarori),
  yuz namunasi va vazifa hisobotlari saqlanadi; navbat yozuvlari 14 kun, `tg_updates` 7 kun; yozuvsiz yetim fayllar (1 kundan eski).
  Natija — egasiga kunlik xulosada (09:00).
- **Kuzatuv:** `/api/health` — baza (`select 1`), media papkasi (yozish, bo'sh joy), yuz servisi, navbat; cron har 5 daqiqada muammo bo'lsa
  egasiga darhol (`server/ops.ts watchdog`).
