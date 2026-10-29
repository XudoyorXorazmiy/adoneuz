# adone — barqarorlik rejasi (qotishlarsiz ishlash)

> 2026-10-29. Manba: prod server dalillari + 5 yo'nalishdagi kod auditi (baza, bot/navbat, panel, Mini App, yuz servisi/infra).
> Holat (2026-10-29): **uchala bosqich bajarildi va prod'da** (1 — `1be430f`, 2 — `d6db0f5`, 3 — pastda). Qolgan ochiq ishlar — 3-bosqich bo'limi oxirida.

## Prod'da ko'rilgan haqiqiy qotish

- 28.10 21:35–21:59: bitta xodim botga 4 ta dumaloq video yubordi, to'rttasi ham yo'qoldi. Sabab: Telegram `getFile` o'sha paytda 15 s dan oshdi
  (`telegram/api.ts:27`), `tg_update` 3 marta (2–4 daqiqa oraliqda) urinib `failed` bo'ldi, xodimga hech qanday xabar bormadi, rahbar ham bilmadi.
  Hozir o'sha video 3 s da olinadi — Telegram vaqti-vaqti bilan sekinlashadi, kod bunga tayyor emas.
- Disk 84% (2 kun oldin 61% edi): har deploy 1.3 GB image + rollback nusxasi. Media hajmi 15 MB — muammo emas (hali).
- Baza, yuz servisi, xotira — hozircha sog'lom; navbatda qotgan ish yo'q.

## 1-bosqich — qotishlarni yo'qotish (birinchi push)

| # | Nima | Qayerda | Nima uchun |
|---|---|---|---|
| 1.1 | Telegram fayl olish: `getFile` 15 s → 60 s, ish ichida darhol 3 marta qayta urinish, `maxAttempts` 3 → 6; video kelishi bilan «Qabul qilindi, tekshirilmoqda», oxirgi urinish ham yiqilsa «Qayta yuboring» | `telegram/api.ts`, `bot/index.ts`, `webhook/route.ts` | yuqoridagi hodisa |
| 1.2 | Navbat ishchisi: har ishga alohida vaqt chegarasi (120 s), bitta jarayonda bitta ishchi (har webhook o'z ishchisini ochmasin), `locked_by` token + `STALE` 10 → 3 daq, cron curl `--max-time 55` | `jobs/runner.ts`, `jobs/enqueue.ts`, server cron | 09:00 to'lqinida navbat bir-birini bo'g'adi, deploy'dan keyin javob 10 daqiqa kechikadi |
| 1.3 | Bildirishnoma tarqatish: har qabul qiluvchi alohida try/catch (bitta rahbar botni bloklasa qolganlar ham olmay qolyapti), 403 → havola «o'lik», 429 → `retry_after` | `notify.ts`, `task-notify.ts`, `leave.ts`, `deadline.ts`, `telegram/api.ts` | xabarlar yo'qoladi yoki ikki marta boradi |
| 1.4 | Baza: `pool.on('error')` (Postgres qayta ishga tushsa ilova o'lmasin), `statement_timeout 15 s`, `lock_timeout 5 s`, `idle_in_transaction 30 s`, `DB_POOL_MAX` 10 → 20 | `packages/db/client.ts`, Coolify env | bitta qotgan so'rov butun ilovani to'xtatadi |
| 1.5 | Yuz servisi: endpointlar `def` (threadpool) + 2 ta parallel chegara, healthcheck 5 → 15 s, videodan kadrlarni o'qiyotganda tanlash (hozir 240 kadr RAM'da → OOM), hajm tekshiruvi o'qishdan oldin | `services/face/app.py`, `Dockerfile` | 10 kishi birga «Keldim» qilsa servis qotib qayta ishga tushadi, hammasi «shubhali» bo'ladi |
| 1.6 | Mini App mijoz tomoni: `app/tg/error.tsx` (o'zbekcha + «Qayta urinish»), auth try/catch + 10 s kutish + retry tugmasi, `ready/expand` skript yuklangach, lokatsiya 20 s timeout, kamera yo'q bo'lsa xabar, yuklash to'xtab qolsa ogohlantirish, «Ilova yangilandi» hamma joyda tugma bilan, geofence tekshiruvi yuzdan OLDIN (25 s bekor kutish) | `components/tg/*`, `lib/actions/miniapp.ts` | «Yuklanmoqda…» abadiy, inglizcha «Application error» |
| 1.7 | Panel: `error.tsx` + `loading.tsx`, void action'lar `{error}` qaytarsin (hozir xato = butun sahifa yiqiladi), `revalidatePath` tuzatishlari (muddat qarori, xodim saqlash → bosh sahifa/profil), login formasi o'rab qo'yiladi, «Qabul qildim/Boshladim» xatosi ko'rsatiladi | `lib/actions/*`, `app/(panel)` | «Tasdiqlash» ikkinchi bosilsa sahifa yiqiladi, saqlagandan keyin eski ma'lumot |

### 1-bosqich — bajarildi (2026-10-28), rejadan farqlar

- **1.1** `downloadFile`: `getFile`/yuklash 60 s, vaqtinchalik xatoda (timeout, tarmoq, 5xx, 429) shu ishning o'zida yana 2 marta (1 s, 3 s).
  `tg_update` — 6 urinish, oraliq 30 s → 1 → 2 → 4 → 8 daq (bot sessiyasi 15 daqiqa). Video kelishi bilan «📥 Video qabul qilindi, tekshirilmoqda…»
  (faqat 1-urinishda). Oxirgi urinish ham yiqilsa — yuborganga «qaytadan yuboring», egasiga ogohlantirish (`server/alerts.ts`).
  **Qo'shimcha (auditda yo'q edi):** qayta urinilgan ish vaqtni xabar KELGAN paytdan oladi (`bot/context.ts`, `job.created_at`) — aks holda
  4 daqiqadan keyingi urinishda keldi vaqti kechikib yozilar, lokatsiya «eskirgan», sessiya «tugagan» bo'lardi.
- **1.2** `locked_by` ustuni o'rniga egallash payti (`locked_at = clock_timestamp()`) token sifatida — migratsiya kerak bo'lmadi (deploy va
  migratsiya orasida bo'shliq yo'q). Bir aylanmada ≤ 10 ish. Cron `--max-time 55` serverda allaqachon bor edi.
- **1.3** `deliver()` (`notify.ts`): 403/400 — o'sha qabul qiluvchi o'tkazib yuboriladi (bog'lanish O'CHIRILMAYDI — xodim bog'lanishi Mini App
  kirishi uchun ham kerak), 429/5xx — joyida 2 marta (`retry_after` ≤ 30 s). Hech kimga yetmasa — ish qayta urinadi; kimdir olgan bo'lsa —
  takror yuborilmaydi.
- **1.4** `statement_timeout 15 s`, `lock_timeout 5 s`, `idle_in_transaction_session_timeout 30 s`, `pool.on('error')`; `DB_POOL_MAX=20` Coolify'da.
- **1.5** `def` endpointlar + 2 slot (navbat > 15 s → 503 busy → Next'da shubhali), `/health` event loop'da, kadrlar o'qishda siyraklashtiriladi
  (≤ 16 kadr xotirada, ≤ 60 s video), hajm o'qishdan oldin; healthcheck 15 s, start-period 60 s. `test_service.py` serverdagi model bilan o'tdi.
- **1.6** `app/tg/error.tsx`, `TgAuth` 10 s + «Qayta urinish», `TgReady` skriptni kutadi + «Ilova yangilandi» banneri (hamma xatoda),
  lokatsiya 20 s, kamera yo'q/band/ruxsatsiz — alohida matnlar, video yuklash 45 s to'xtasa uziladi, geofence yuz servisidan oldin.
- **1.7** `app/(panel)/error.tsx` + `loading.tsx`; `void` amallar xato tashlamaydi — `lib/flash.ts` (tepada qizil xabar);
  `revalidatePath` (muddat qarori — vazifa sahifasi va So'rovlar; xodim saqlash/holat — profil va bosh sahifa); kirish formasi baza xatosida xabar.

## 2-bosqich — yuk ostida barqarorlik (ikkinchi push)

| # | Nima | Qayerda |
|---|---|---|
| 2.1 | Har sahifa bitta tranzaksiya: bosh sahifa 6 ta parallel `withTenant` → 1 ta (`tx` uzatiladi); rahbar Mini App badge uchun yengil count | `app/(panel)/page.tsx`, `server/manager.ts`, `lib/tg/session.ts` |
| 2.2 | `attendanceTick` N+1 (60 xodim ≈ 700 so'rov, bitta uzun tranzaksiya, «Keldim» shuni kutadi) → 3 ta to'plam so'rov + xotirada hisob + bitta upsert; `absentDigest`, `showToday` ham | `server/ticks.ts`, `packages/db/attendance.ts` |
| 2.3 | Ish haqi: har ochilganda qayta hisoblash emas — faqat `computed_at` eskirgan yoki davomat/qoida o'zgargan bo'lsa | `server/payroll.ts` |
| 2.4 | Ikki marta «Keldim» (ikki bosish / bot + Mini App) → xodim qatori `FOR UPDATE`; `tg_update` ichida bir chat ketma-ket (advisory lock) | `server/checkin.ts`, `jobs/handlers.ts` |
| 2.5 | Bot holat xatolari: `tk:send` taskId tekshiruvi, `task_revise` holati tozalanishi, ro'yxatdan o'tish TTL 15 daq → 24 soat, `leave/deadline` da DB xatosi «Ruxsat yo'q» bo'lib ketmasin | `bot/tasks.ts`, `bot/leave.ts`, `bot/deadline.ts`, `bot/session.ts` |
| 2.6 | Tinch vaqt ishchida (hozir faqat eslatmalarda, retry va `notify_members` 03:00 da ham boradi); `face_enroll` oxirgi yiqilishda xodim + rahbarga xabar; «shubhali» xabarlari tenant/soat bo'yicha cheklov | `jobs/runner.ts`, `server/face.ts`, `notify.ts` |

### 2-bosqich — bajarildi (2026-10-29), o'lchovlar (lokal seed, 9 faol xodim)

| Nima | Oldin | Keyin |
|---|---|---|
| `attendanceTick` (har 10 daq, har ishxona) | 104 so'rov (≈ 11 / xodim → 60 xodim ≈ 690) | 8–9 so'rov (xodim soniga bog'liq emas) |
| `absentDigest` | 30 so'rov | 10 (shundan 3 — hisob, qolgani tarqatish) |
| Panel bosh sahifa | 6 tranzaksiya (6 ulanish) | 1 tranzaksiya, so'rovlar ketma-ket |
| Rahbar Mini App menyu belgisi (Vazifalar, Hisobot, Ish haqi) | 14 so'rov / 7 tranzaksiya | 1 / 1 (qiymat bir xil: egasi 6=6, menejer 4=4) |
| `/ish-haqi` ochilishi, o'zgarish yo'q | 20 so'rov + barcha qatorlar qayta yoziladi | 6 so'rov, yozuv yo'q |

- **2.1** `inTenant(tenantId, tx, fn)` (`server/scope.ts`) — o'qish funksiyalari ixtiyoriy `tx` oladi; bosh sahifa bitta `withTenant`.
  `managerPendingCount` — bitta SQL (5 ta COUNT, `managerDecisions` qoidalari bilan). «Qarorlar» va «Bugun» to'liq ro'yxatni ko'rsatgani uchun o'zgarmadi.
- **2.2** `packages/db/attendance.ts`: `rulesFor`, `eventsFor`, `leavesFor`, `rebuildDays` (bitta upsert); `rebuildDay` endi shu orqali (yagona yozuvchi).
  Tick avto-yopish hodisasini xotiradagi ro'yxatga ham qo'shadi. `showToday` — qoida bir marta.
- **2.3** `isStale`: hisobdan keyin qoidalar, shu oy davomati, vazifalar, xodimlar, jadvallar, ruxsatlar, ishxona sozlamasi o'zgarganmi yoki hisob 6 soatdan
  eskimi. Yopishda — har doim qayta hisob.
- **2.4** Mini App va bot «Keldim/Ketdim» — xodim qatori `FOR UPDATE`; bot «Ketdim» holatni qayta tekshiradi. `tg_update` — chat bo'yicha
  `pg_try_advisory_lock` (30 s, alohida ulanish).
- **2.5** `tk:send` faqat o'z vazifasining hisobot sessiyasida; boshqa qaror bosilsa «qaytarish sababi» holati tozalanadi; ro'yxatdan o'tish
  sessiyasi 24 soat; bot `lv:`/`dl:` qarorida baza xatosi — «Xatolik — qayta bosing» (oldin «Ruxsat yo'q»).
- **2.6** Ishchida tinch vaqt: `notify_members` va bildirishnomalarning qayta urinishlari tunda ertalabga suriladi (urinish hisoblanmaydi);
  `face_enroll` urinishlari tugasa — xodimga «/yuz bilan qayta yuboring», rahbarlarga xabar; «shubhali» — soatiga ishxonaga 5 ta, keyin bitta umumiy.
- Eslatma: `test-payroll` toza seed'ni kutadi (audit soni) — ketma-ket ikki marta ishga tushirilsa yiqiladi (2-bosqichga bog'liq emas).

## 3-bosqich — uzoq muddat: disk, eksploatatsiya (uchinchi push)

| # | Nima | Qayerda |
|---|---|---|
| 3.1 | Saqlash muddati: `jobs` done/failed 14 kun, `tg_updates` 7 kun, `auth_throttle`; media: check-in video/selfi N kun (EGASI HAL QILADI, taklif 60 kun), `face_sample` saqlanadi; DB yozuvsiz yetim fayllar tozalanadi; `saveMedia` faylni tranzaksiyadan tashqarida yozadi | yangi `cleanup` ishi, `server/media.ts` |
| 3.2 | Selfi/rasm uchun 320 px thumbnail (`sharp`), ro'yxatlar to'liq 5 MB rasm yuklamasin | `server/media.ts`, `api/media` |
| 3.3 | Haqiqiy health: `select 1` (2 s), media papka yozish, yuz servisi (ogohlantirish), `failed` ishlar soni; env tekshiruvi ishga tushganda (`instrumentation.ts`) | `api/health`, `instrumentation.ts` |
| 3.4 | Dockerfile: `output: 'standalone'` + `tini` + SIGTERM'da pool'ni yopish → image 1.3 GB → ~300 MB, deploy tez, disk o'smaydi | `next.config.ts`, `Dockerfile` |
| 3.5 | Media zaxirasi serverdan tashqariga (hozir faqat baza zaxiralanadi; media Docker volume'da, DEPLOY.md dagi `/data/adone/media` emas — hujjat tuzatiladi) | server cron, `docs/DEPLOY.md` |
| 3.6 | Yuz servisi `FACE_SERVICE_KEY` bo'sh bo'lsa ishga tushmasin; media route'da menejer uchun bo'lim chegarasi | `services/face/app.py`, `api/media` |

## Egasining qarorlari (2026-10-29, reja tasdiqlangan)

1. Media saqlash muddati (check-in video/selfi): **60 kun**; `face_sample` saqlanadi. (3.1)
2. Yiqilgan ishlar / sog'liq ogohlantirishlari: **egasining Telegram'iga** (`PLATFORM_OWNER_CHAT_ID`), kuniga bir marta xulosa + muhim holatda darhol. (1.2, 3.3)

## Tartib va tekshiruv

Har bosqich: lokal brauzer (egasi/menejer/xodim), core testlar, `db:check`, `test-rls`, `test-bot`, build — haqiqiy exit kodi bilan; push oldidan `df -h /`; deploy'dan keyin prod health va sahifalar; 1-bosqichdan keyin haqiqiy telefonda bot va Mini App sinovi (egasi).

### 3-bosqich — bajarildi (2026-10-29)

| Nima | Oldin | Keyin |
|---|---|---|
| Ilova image'i (`adone-web`) | 1,33 GB (butun repo + node_modules) | **388 MB** (Next standalone + `/app/db`); build ~2 daq |
| Media ro'yxatlardagi rasm | to'liq fayl (5 MB gacha) | `?w=320` kichik nusxa (~20 KB), bir marta yasalib `.thumbs` da |
| `/api/health` | `{ok:true}` | baza (`select 1`, ms), media papkasi (yozish, bo'sh joy %), yuz servisi, navbat (24 soat yiqilgan, kutayotgan) |
| Saqlash | cheksiz | isbot 60 kun, `jobs` 14 kun, `tg_updates` 7 kun, yetim fayllar 1 kun |

- **3.1** `server/cleanup.ts` — `cleanup` ishi (platforma, kuniga bir marta 03:00 dan keyin, `dedupe cleanup:<sana>`): keldi-ketdi isboti
  (`checkin_video`, `checkin_photo`) 60 kundan keyin — yozuv + fayl + kichik nusxa (hodisa qoladi, `media_id` NULL); `face_sample` va vazifa
  hisobotlari saqlanadi; `jobs` done/failed 14 kun, `tg_updates` 7 kun, `auth_throttle`; diskda bor, bazada yo'q fayllar (>1 kun).
  `writeMediaFile` + `insertMedia` — fayl tranzaksiyadan tashqarida yoziladi (bekor bo'lsa yetim → ertasi tozalanadi). Natija `last_error` da
  «skip: …» izohi sifatida — kunlik xulosada ko'rinadi.
- **3.2** `/api/media/<id>?w=320` (sharp, `MEDIA_DIR/.thumbs/<tenant>/<id>.jpg`, `Cache-Control: private, max-age=86400`); 7 ta ro'yxat/kartochka `<img>`.
- **3.3** `server/ops.ts`: `checkDb` (2 s), `checkMedia` (yozish + `statfs`), `checkFace` (3 s), `queueStats`; `/api/health` 503 — faqat baza yoki
  media ishlamasa (yuz servisi/navbat — ma'lumot, 30 s kesh). `watchdog` — cron har daqiqa chaqiradi, 5 daqiqada bir: yuz servisi yo'q, media
  yozilmaydi, disk < 10 %, navbat ≥ 20 ta 5 daqiqadan beri → egasiga darhol (`alertOwner`, 10 daqiqada bir marta). `daily_report` ishi —
  09:00 dan keyin egasiga xulosa (baza, yuz, disk, navbat, tozalash natijasi). `instrumentation.ts` + `server/env-check.ts`: prod'da
  `DATABASE_URL, AUTH_SECRET, ROOT_DOMAIN, PLATFORM_BOT_TOKEN, CRON_SECRET, MEDIA_DIR` yo'q bo'lsa server ishga tushmaydi (healthcheck o'tmaydi,
  eski konteyner qoladi); `FACE_SERVICE_URL`, `PLATFORM_OWNER_CHAT_ID`, `FACE_SERVICE_KEY` yo'q — ogohlantirish.
- **3.4** `next.config` `output: 'standalone'` + `outputFileTracingRoot` (monorepo); Dockerfile: build bosqichi → `.next/standalone` + `.next/static`
  + `/app/db` (`pnpm --filter @adone/db deploy --prod --legacy`, `tsx` dependencies'da); `tini` PID 1; `NEXT_MANUAL_SIG_HANDLE` — SIGTERM'da
  3 s kutib pool yopiladi, exit 0. `client.ts`: `next build` paytida `DATABASE_URL` bo'lmasa soxta manzil (ulanmaydi) — image'ni Coolify'siz ham
  yig'ish mumkin. Sinov (2026-10-29, serverda, prod env, `--network coolify`): health ok (db 73 ms, face ok), `/kirish` `/tg` `/` `admin./kirish`
  200, css/woff2 200, `/app/db` dan migrate/set-app-password/db-check/bootstrap exit 0, SIGTERM → exit 0.
- **3.5** `/etc/cron.d/adone-media-backup` — 02:30 rsync volume → `/data/backups/adone-media` (birinchi nusxa 15 MB). DEPLOY.md: volume yo'li,
  `/app/db` buyruqlari, zaxira bo'limi. Serverdan tashqariga — S3 kaliti bo'lgach.
- **3.6** `services/face/app.py` startup: `FACE_SERVICE_KEY` bo'sh → ishga tushmaydi (`FACE_ALLOW_NO_KEY=1` — faqat sinov). Push'dan oldin
  Coolify'da ikkala ilovada kalit borligi tekshirildi (48 belgi, bir xil). Media route: menejer — faqat o'z bo'limi xodimlarining fayli
  (`departmentScope`), aks holda 404.
- `PLATFORM_OWNER_CHAT_ID` Coolify'da (egasining xodim sifatida bog'langan Telegram'i, prod `employees` dan tasdiqlandi) — shu deploy bilan jonli.

Qolgan (3-bosqichdan tashqari): media zaxirasi serverdan tashqariga (S3 kaliti), reyting og'irliklari sozlamasi, `task_categories` — alohida ishlar.

