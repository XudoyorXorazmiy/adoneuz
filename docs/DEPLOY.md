# adone — deploy

> Holat (2026-10-20): **hali sozlanmagan.** Quyidagi qadamlar egasi tomonidan (yoki egasining kompyuteridagi Claude Code sessiyasida — u yerda Chrome, SSH kaliti va Coolify tokeni bor) bajariladi. Bulutli sessiyada Cloudflare/ahost/Coolify'ga kirish yo'q.

## Qayerda nima (reja)

| Qism | Joy |
|---|---|
| Server | Contabo VPS `109.199.121.164` (chaat, openstore bilan bir server), Coolify v4 — panel `http://109.199.121.164:8000` |
| Repo | `github.com/XudoyorXorazmiy/adoneuz`, branch **`main`** — push = avtomatik build + deploy (GitHub App `xudoyor-coolify`) |
| Domen | `adone.uz` — registrar **ahost**, DNS **Cloudflare** |
| Hostlar | `adone.uz` (landing), `www` → apex, `app.adone.uz` (panel + Mini App + webhook), `admin.adone.uz` (super admin) |
| Baza | Coolify Postgres, image `pgvector/pgvector:pg18`, db/user `adone` (ega, migratsiya), ilova roli `adone_app` (NOBYPASSRLS) |
| Yuz servisi | Coolify'da alohida ilova `adone-face` (`services/face/Dockerfile`, 3-bosqichda), faqat ichki tarmoq, port 8000 |
| Cron | `/etc/cron.d/adone` — har daqiqa `/api/cron/jobs` (Bearer `CRON_SECRET`) |
| Media | volume `/data/adone/media` → `/app/media-data` (egasi uid 1001) |

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
4. Persistent storage: `/data/adone/media` → `/app/media-data`.
5. Environment Variables (qiymatlar faqat Coolify'da, chatga chiqarilmaydi):
   - `DATABASE_URL=postgres://adone_app:…@<db-host>:5432/adone?sslmode=disable` (**`sslmode=disable` shart**)
   - `DATABASE_URL_MIGRATE=postgres://adone:…@<db-host>:5432/adone?sslmode=disable`
   - `ROOT_DOMAIN=adone.uz`, `PUBLIC_URL=https://adone.uz`
   - `AUTH_SECRET`, `SECRET_KEY` (AES-GCM), `CRON_SECRET` — har biri `openssl rand -hex 32`
   - `MEDIA_DIR=/app/media-data`, `DB_POOL_MAX=10`
   - Bot: `PLATFORM_BOT_TOKEN` (@BotFather'dan, `@adoneuz_bot`), `PLATFORM_BOT_USERNAME=adoneuz_bot`
   - 3-bosqichda: `FACE_SERVICE_URL=http://adone-face:8000`
6. Cron (serverda): `/etc/cron.d/adone` → har daqiqa `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://app.adone.uz/api/cron/jobs`.

## 4. Telegram bot

@BotFather → `/newbot` → `adone` / `adoneuz_bot` → token Coolify env'ga. Keyin `/setdomain` (Mini App uchun `app.adone.uz`), `/setmenubutton` → Web App `https://app.adone.uz/tg`. Webhook o'rnatish route'i (`/api/cron/setup-bot`) 1-bosqichda yoziladi.

## 5. Migratsiya (prod)

Baza tashqaridan ko'rinmaydi — ilova konteyneri ichidan (openstore usuli):

```bash
ssh -i ~/.ssh/mvps_main root@109.199.121.164
C=$(docker ps --format '{{.Names}}' | grep ^<app-uuid> | head -1)
docker exec $C sh -c 'cd /app && pnpm db:migrate && pnpm --filter @adone/db set-app-password && pnpm db:check'
# bir marta: tariflar + super admin (parolni chatga yozmang)
docker exec -e BOOTSTRAP_ADMIN_PHONE=998XXXXXXXXX -e BOOTSTRAP_ADMIN_PASSWORD='…' $C sh -c 'cd /app && pnpm --filter @adone/db bootstrap'
```

Tartib: avval push, deploy tugagach migrate. **Birinchi deploy'da** `adone_app` roli hali yo'q — ilova bazaga ulana olmaydi (health check o'tadi, sahifalar 500), migrate + `set-app-password` dan keyin ishlaydi. `set-app-password` `DATABASE_URL` dagi parolni `adone_app` ga qo'yadi (Postgres'da qo'lda rol yaratish shart emas). Prod bazada seed ISHLATILMAYDI.
