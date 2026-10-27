# adone.uz — xodimlar davomati va vazifalar (Telegram bot + Mini App + web panel)

Xodim Telegram bot / Mini App orqali «Keldim» / «Ketdim» qiladi: **lokatsiya (geofence) + jonli rasm/video + yuz tekshiruvi**.
Rahbar vazifa beradi, xodim bajarib hisobot topshiradi, rahbar tasdiqlaydi yoki qaytaradi. Davomat va vazifalar oylik
tabel, KPI va ish haqi hisobiga (bonus/jarima — admin tahrirlaydigan qoidalar) tushadi. Multi-tenant SaaS: har ishxona — alohida tenant.

**Bu fayl — loyihaning haqiqat manbai. Har sessiya boshida o'qi.** Dizayn: `docs/DIZAYN-PROMPT.md`. Deploy: `docs/DEPLOY.md`.

> **Holat (2026-10-24):** 0- va 1-bosqich kodi tayyor (lokal tekshirilgan, `main`da). Panel: filiallar (xarita havolasidan koordinata),
> jadvallar (haftalik / navbatli / erkin, tungi smena), bo'limlar, xodimlar + taklif havolasi, kunlik davomat (isbot, tuzatish),
> oylik tabel + Excel, jonli bosh sahifa. Bot: ro'yxatdan o'tish (kontakt, rozilik, yuz namunasi), keldi (jonli lokatsiya + geofence +
> dumaloq video) / ketdi, bugun, rahbarlarga bildirishnomalar, avto-yopish, kunlik «Kelmaganlar». **2-bosqich (vazifalar) asosiy qismi tayyor (2026-10-25)** —
> qolgani pastdagi jadvalda. **3-bosqich tayyor (2026-10-25)**: Mini App (GPS + jonli selfi), yuz servisi (InsightFace, liveness), qurilma bog'lash, ruxsat so'rovlari.
> **4-bosqich — ish haqi tayyor (2026-10-25)**: tahrirlanadigan qoidalar, oylik vedomost, qo'lda tuzatish + audit, oyni yopish (snapshot), Excel, Mini App'da o'z ish haqi.
> **Landing (5-bosqich qismi) tayyor (2026-10-25)**: `design/landing` (Tessel uslubi) 1:1, ariza formasi → `leads`, platformada «Arizalar».
> **Prod (2026-10-25):** `adone.uz`, `app.`, `admin.` jonli (Coolify, Let's Encrypt), baza migratsiya qilingan, yuz servisi va cron ishlayapti (`docs/DEPLOY.md`).
> Bot (@adoneuz_bot, webhook IP'ga qotirilgan), super admin va pilot ishxona «Mudom bozor» (17 xodim, filial, 3 jadval) prod'da.
> **Sozlamalar tayyor (2026-10-26)** — §9i: Profilim, Ishxona, Jamoa (admin/menejer qo'shish), Davomat, Vazifalar, Ish haqi, Bildirishnomalar, Tarif.
> Pilot: **Mudom bozor** (Hazorasp, kiyim do'koni; boshqaruv-tizim va chaat'da ham mijoz).

## 1. Asosiy qoidalar — buni buzma

1. **Tenant faqat kontekstdan.** Har tenant jadvalida `tenant_id`, Postgres RLS (openstore konvensiyasi, `docs/BAZA.md` keyin): ilova roli `adone_app` NOBYPASSRLS, siyosat faqat `tenant_id = app_tenant_id()` — **OR yozilmaydi**. Tenant so'rovlari faqat `withTenant()` ichida. Bot webhook'ida tenant `telegram_links` / `employees.telegram_user_id` dan aniqlanadi, so'rov tanasidan emas.
2. **Davomat — o'zgarmas jurnal.** Har keldi/ketdi/tanaffus — `attendance_events` ga append-only yozuv (vaqt **faqat server vaqti**, klient vaqtiga ishonilmaydi). Kunlik yig'ma `attendance_days` faqat `packages/core/attendance.ts` hisobidan qayta quriladi. Admin tuzatishi — yangi `correction` hodisasi + sabab + `audit_log`, eski yozuv o'chirilmaydi.
3. **Isbot serverda tekshiriladi.** Geofence (haversine, filial radiusi + GPS aniqligi), forward qilingan xabar, eskirgan lokatsiya, yuz o'xshashligi — hammasi serverda, deterministik. Natija `check_status`: `ok` · `suspicious` (admin navbatiga) · `rejected`. Klient «tasdiqlandi» deb aytolmaydi.
4. **Biometrika ehtiyot bilan.** Yuz namunasi faqat xodim roziligi (`consents`) bilan olinadi; vektor (embedding) bazada, rasmlar `MEDIA_DIR/<tenant>/...` da. Rasm/vektor boshqa tenantga, logga, chatga chiqmaydi. Xodim o'chirilsa — biometrika ham o'chiriladi.
5. **Holat faqat transition orqali.** Vazifa holati `packages/core/task-flow.ts` jadvalidan tashqari o'zgarmaydi; har o'tish `task_events` ga (kim, qachon, izoh). Holat o'zgarishi compare-and-swap (boshqaruv-tizim naqshi). Vazifa o'chirilmaydi — `cancelled`.
6. **Bir nechta ijrochi = alohida nusxa.** Bitta vazifa N kishiga berilsa `task_batches` + N ta `tasks` (har birida o'z holati, hisoboti, bahosi).
7. **Pul — butun so'm (integer).** Ish haqi, bonus, jarima `packages/core/money.ts` bilan, float yo'q. Qoidalar (jarima/bonus/overtime) — **tenant ma'lumoti** (`pay_rules`), kodga yozilmaydi. Hisoblangan qiymat snapshot qilinadi (`payroll_lines`), qo'lda o'zgartirish `audit_log` bilan.
8. **Vaqt — tenant vaqt mintaqasida** (standart `Asia/Tashkent`). Tungi smena yarim tundan o'tadi — smena «ish kuni» boshlanish sanasiga tegishli.
9. **UZ-first.** UI o'zbek lotinida, matnlar `t()` (`packages/shared/i18n.ts`); keyin kirill va rus. Sana `dd.mm.yyyy`, vaqt `14:32`, pul `12 500 so'm`, telefon `+998 90 123 45 67`.
10. **Sirlar shifrlangan.** Bot tokenlari va kalitlar `*_enc` (AES-GCM, `lib/secrets.ts`); chatga, logga chiqmaydi. Yangi kalitni egasi Coolify env'ga o'zi kiritadi.

## 2. Texnologiya (chaat / openstore bilan bir xil)

- Node 24 (`.nvmrc`), pnpm 10 monorepo: `apps/web` (Next.js 16, App Router, `src/proxy.ts`, TypeScript, Tailwind v4, lucide-react), `packages/core` (sof domen: enum, ruxsatlar, telefon, format, geofence; keyin davomat hisobi, smena, vazifa oqimi, ish haqi + testlar), `packages/db` (Drizzle + pg, migratsiyalar, RLS, seed, bootstrap). Alohida `packages/shared` yo'q — chaat kabi `core` ichida.
- Kod yozishdan oldin `node_modules/next/dist/docs/` ni o'qi (Next 16 o'zgarishlari).
- PostgreSQL 18 (+ `pgvector` — yuz embedding'lari uchun, image `pgvector/pgvector:pg18`), Drizzle `casing: 'snake_case'`.
- Sessiya: jose HS256 cookie (host-only), parol scrypt, 5 xato → 15 daqiqa qulf (boshqaruv-tizim qoidalari).
- Telegram: yupqa fetch mijozi (`server/telegram/api.ts`, grammY shart bo'lmadi), webhook + `secret_token` (AUTH_SECRET'dan HMAC). **Bitta platforma boti** (`@adoneuz_bot`) — hamma ishxona uchun; xodim `/start inv_<kod>`, rahbar bildirishnomalar uchun `/start mem_<kod>` bilan bog'lanadi (kontakt tasdig'i bilan, §9i). Webhook → `tg_updates` (idempotent) → `tg_update` ishi → `server/bot`. Keyin: ishxona o'z botini ulashi mumkin (chaat naqshi).
- Mini App: `app.adone.uz/tg/...` (openstore naqshi) — `initData` HMAC tekshiruvi, `LocationManager` / `navigator.geolocation`, kamera (`getUserMedia`). Bot zaxira yo'li: **live location + dumaloq video (video_note)**.
- Yuz servisi: alohida konteyner `services/face` (Python, FastAPI + InsightFace `buffalo_l`, CPU) — faqat ichki tarmoqda. API: `POST /embed` (rasm → 512 vektor + sifat), `POST /verify` (rasm + namuna vektorlari → o'xshashlik), `POST /liveness` (video kadrlar → ball). Next.js uni `FACE_SERVICE_URL` orqali chaqiradi; servis ishlamasa check-in `suspicious` bo'lib saqlanadi (bloklanmaydi).
- Navbat: `jobs` jadvali + runner (`FOR UPDATE SKIP LOCKED`, qayta urinish 2^n, `dedupe_key`) + server cron har daqiqa `/api/cron/jobs`. Redis yo'q. Eslatmalar, kechikkanlar ro'yxati, kunlik hisobot, takrorlanuvchi vazifalar — shu orqali.
- Excel: exceljs (tabel, ish haqi, vazifalar eksporti).
- Fayllar: server diski `MEDIA_DIR` (Coolify volume), keyin S3-mos.

## 3. Yuzalar va domenlar

| Host | Nima |
|---|---|
| `adone.uz` (+ `www` → apex) | Landing, ro'yxatdan o'tish |
| `app.adone.uz` | Ishxona paneli (egasi, admin, menejer) + `/tg/*` Mini App (xodim) |
| `admin.adone.uz` | Super admin (platforma): ishxonalar, tariflar, obuna |
| `app.adone.uz/api/...` | Telegram webhook, Mini App API, cron, media |

Tenant hostdan emas, sessiyadan (bir foydalanuvchi bir nechta ishxonada bo'lishi mumkin — tanlagich). Wildcard SSL yo'q — yangi subdomen Coolify domains'ga qo'shilib qayta deploy.
Dev: `ROOT_DOMAIN=localhost:3140` → `app.localhost:3140`, `admin.localhost:3140`.

## 3a. Buyruqlar va lokal ishga tushirish

```
cp .env.example .env            # lokal Postgres: adone (ega, superuser) va adone_dev bazasi
pnpm install
pnpm db:migrate                 # ega rol bilan; 0001 adone_app/adone_platform/adone_auth rollarini yaratadi
pnpm --filter @adone/db set-app-password   # adone_app paroli = DATABASE_URL dagi parol
pnpm db:seed                    # HAMMASINI o'chirib demo yozadi (faqat lokal)
pnpm dev                        # http://localhost:3140 · app.localhost:3140 · admin.localhost:3140
pnpm test && pnpm db:check && pnpm db:test-rls && pnpm typecheck && pnpm build
cd apps/web && node --conditions=react-server --import tsx scripts/test-bot.ts   # bot oqimi, soxta Telegram API (seed'dan keyin, o'zi tozalaydi)
cd apps/web && node --conditions=react-server --import tsx scripts/test-payroll.ts   # ish haqi: hisob, tuzatish, yopish/qayta ochish (seed'dan keyin)
```

Next.js `16.4.2` (16.4.0 xavfsizlik zaifligi sababli build'da bloklanadi — versiyani pastga tushirmang).

Demo kirishlar (seed): super admin `admin.localhost:3140` — 998900000000 / admin123 · Mudom bozor egasi 998901112233, admin 998901112244, menejer 998901112255 — hammasi `demo123` · izolyatsiya uchun «Test do'kon» 998905556677 / demo123.

**Yangi tenant jadvali qoidasi:** `tenant_id uuid not null` + `(tenant_id, …)` indeks + migratsiyada `ENABLE ROW LEVEL SECURITY` va
`CREATE POLICY <t>_app ON <t> TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())` — OR yo'q.
Append-only jadval (attendance_events, task_events) — `REVOKE UPDATE, DELETE … FROM adone_app`. `pnpm db:test-rls` OR'li siyosatni ham ushlaydi.
Platforma (`adone_platform`) ishxona ichki jadvallariga huquq olmaydi — kerak bo'lsa aniq GRANT + siyosat bilan.

## 4. Rollar (`packages/shared/permissions.ts`)

| Rol | Kim | Ko'radi / qiladi |
|---|---|---|
| `platform_admin` (`users.is_platform_admin`) | Super admin | Ishxonalar, tariflar, obuna, umumiy statistika. Ishxona ichidagi rasmlar va ish haqini KO'RMAYDI |
| `owner` | Ishxona egasi | Hammasi, tarif va to'lov ham |
| `admin` | Administrator | Tarifdan tashqari hammasi: filiallar, xodimlar, smenalar, ish haqi qoidalari |
| `manager` | Bo'lim/filial boshlig'i | Faqat o'z bo'limi/filiali (`memberships.department_ids` / `branch_ids`): davomat, so'rovlar, vazifa berish va tasdiqlash. Ish haqini sozlamaydi |
| `employee` | Xodim | Faqat bot/Mini App: keldi/ketdi, o'z tarixi, vazifalari, so'rovlari, o'z ish haqi (tenant sozlamasi ruxsat bersa) |

Tekshiruv markazlashgan `can(role, area)`; sahifada qo'lda emas. Ruxsat — maydonni yashirish emas, so'rovdan olib tashlash (boshqaruv-tizim §10).
Vazifa berish: `owner/admin` → hammaga; `manager` → faqat o'z bo'limidagilarga. **Rahbarlarga ham (2026-10-27):** egasi → administrator va bo'lim boshliqlariga, admin → bo'lim boshliqlariga (core `assignableMemberRoles`; xodim yozuvi yo'q a'zo — `tasks.assignee_user_id`, «Kimga»da `u:<userId>`, xodim yozuvi bor a'zo — xodim sifatida). A'zo vazifasini tasdiqlash — core `canReviewMemberTask` (egasi, bergan rahbar, admin — bo'lim boshlig'inikini). A'zo vazifani botda (`tk:*`, `memberLinks`), rahbar Mini App «Vazifalar → Menga» va panel «Mening ishlarim»da ko'radi va topshiradi.

**Bo'lim boshlig'i — bitta tushuncha (2026-10-27):** `manager` a'zoligi (`memberships.department_ids`) + `departments.manager_user_id`; yozish faqat `server/department-head.ts` (`setDepartmentHead`, `releaseHead`, `syncHeads` — Jamoa bilan sinxron). Boshliq jamoa a'zosi yoki **xodim** bo'ladi: Xodimlar → bo'lim formasi «Bo'lim boshlig'i» (`e:<xodim>`/`u:<a'zo>`) yoki xodim profili «Bo'lim boshlig'i qilish» → telefon bo'yicha hisob (parol tasodifiy; panel uchun Jamoa → «Parolni tiklash»), menejer a'zoligi, `employees.user_id`, xodimga bot xabari (Mini App «Rahbar rejimi» tugmasi). Olinsa — boshqa bo'limi qolmasa a'zolik nofaol. Ishdan bo'shatilsa — boshliqlik ham olinadi. Xodim-boshliq: Mini App ikki rejimli (`tgView`, `TG_MODE_COOKIE`, `/tg/rejim?to=rahbar|xodim`; rahbar tomoni xodim sessiyasidan har so'rovda — `currentTgMember`), bot rahbar tugmalari va bildirishnomalar xodim chatiga (`memberLinks`, `userChatsFor`).

## 5. Ma'lumotlar modeli (reja)

Platforma: `tenants` (nom, slug, timezone, holat, `settings` jsonb), `users` (telefon, parol, `is_platform_admin`), `memberships` (user × tenant × rol, `branch_ids`, `department_ids`), `plans`, `subscriptions`, `jobs`, `auth_throttle`, `audit_log`.

Tenant (`tenant_id` + RLS):
- **Tuzilma:** `branches` (nom, manzil, `lat`, `lng`, `radius_m` standart 100, ixtiyoriy QR rejimi), `departments` (nom, `parent_id`, `manager_id`), `positions`.
- **Xodimlar:** `employees` (F.I.Sh., telefon, lavozim, bo'lim, filial, `telegram_user_id` unikal tenant ichida, `device_id`, holat `invited|pending|active|disabled`, stavka turi `monthly|hourly|daily`, stavka), `invites` (kod, muddat, kim yaratdi), `consents` (biometrika roziligi, vaqt, matn versiyasi), `face_templates` (`embedding vector(512)`, sifat, manba media, `is_active`).
- **Jadval:** `schedules` (shablon: `5/2`, `6/1`, `2/2`, smenali, erkin; kunlar, boshlanish/tugash, tanaffus, kechikish chegarasi daqiqa), `shift_assignments` (xodim × sana yoki davr × smena), `holidays` (tenant taqvimi).
- **Davomat:** `attendance_events` (append-only: tur `check_in|check_out|break_start|break_end|correction|auto_close`, `server_at`, lokatsiya + aniqlik + masofa, `is_live_location`, media id, yuz o'xshashligi, liveness balli, `check_status`, sabablar jsonb, manba `bot|miniapp|admin`), `attendance_days` (xodim × ish kuni: kelgan/ketgan, ishlagan daqiqa, kechikish, erta ketish, overtime, holat `present|late|absent|leave|holiday|off`).
- **So'rovlar:** `leave_requests` (tur `sick|vacation|personal|remote|other`, davr, sabab, ilova, holat `pending|approved|rejected`, kim hal qildi), `leave_balances`.
- **Vazifalar:** `task_batches` (sarlavha, tavsif, ilovalar, muddat, muhimlik `high|medium|low`, hisobot turi `button|photo|video|location` (to'plam), checklist jsonb, yaratgan), `task_templates` (takrorlanuvchi: `rrule`-o'xshash qoida, keyingi ishga tushish), `tasks` (batch × ijrochi: holat, `accepted_at`, `submitted_at`, `approved_at`, `due_at`, baho 1–5, `revision_count`), `task_events` (holat o'tishlari va izohlar, from==to = izoh), `task_reports` (matn, media, lokatsiya, checklist holati), `deadline_requests`.
- **Ish haqi:** `pay_rules` (tenant tahrirlaydi: kechikish jarimasi — har daqiqa/har holat, overtime stavkasi, vazifa bonusi/jarimasi — o'z vaqtida/kechikdi/bahoga qarab, chegaralar), `payroll_periods` (oy, holat `draft|closed`), `payroll_lines` (xodim × davr: asosiy, jarima, bonus, qo'lda tuzatish + sabab, jami — snapshot).
- **Media:** `media` (tenant, tur, yo'l, hajm, sha256; RLS).

## 6. Keldi/ketdi oqimi

1. Xodim Mini App'da «Keldim» (yoki botda tugma) → server ochiq smenani topadi (yo'q bo'lsa — erkin grafik yoki «smenadan tashqari» ogohlantirish).
2. **Lokatsiya:** Mini App — GPS (aniqlik ≤ 100 m talab), bot — **faqat live location** (`live_period` bor bo'lsa); oddiy (xaritadan tanlangan) lokatsiya va forward rad etiladi. Masofa ≤ `radius_m` + aniqlik zaxirasi → ok, aks holda `rejected` (sabab bilan xabar).
3. **Jonli isbot:** Mini App — kamera (galereya yo'q), bot — **dumaloq video (video_note)**; oddiy rasm/fayl rad etiladi.
4. **Yuz:** kadr(lar) → `services/face /verify` → o'xshashlik ≥ chegara (standart 0.45 kosinus, tenant sozlamasi) → ok; chegara atrofida yoki liveness past → `suspicious` (admin navbatiga, xodimga «qabul qilindi, tekshiriladi»).
5. Hodisa `attendance_events` ga, `attendance_days` qayta hisoblanadi, kechikish bo'lsa menejerga xabar (jobs).
6. «Ketdim» unutilsa — smena tugashidan N soat keyin `auto_close` + xodim va menejerga xabar.

## 7. Vazifalar oqimi

```
new → accepted → in_progress → submitted → approved
                                   ↑          ↓
                               revision ←─────┘
har qanday ochiq → cancelled (izoh majburiy) · muddat o'tsa → overdue belgisi (holat emas, `due_at < now()`)
```

- Berish: botda (`/vazifa` dialogi) va web panelda. Kimga: bitta / bir nechta / bo'lim / filial → `task_batches` + har ijrochiga `tasks`.
- Xodimga bot xabari (sarlavha, kimdan, muddat, muhimlik, tavsif) + `✅ Qabul qildim` / `❓ Savol`. Hisobot: `✅ Bajardim` → talab qilingan isbot (rasm/video jonli, lokatsiya) + izoh → `submitted`.
- Rahbar: `✅ Qabul qilish` (baho 1–5) / `🔁 Qaytarish` (sabab majburiy). Muddatni uzaytirish so'rovi — tasdiq bilan.
- Takrorlanuvchi (ixtiyoriy): `task_templates` → scheduler har kuni yangi batch yaratadi (`dedupe_key = tpl:<id>:<sana>`).
- Eslatmalar (jobs): 30 daqiqada qabul qilinmasa, muddatga 1 soat qolganda, muddat o'tganda, hisobot 24 soat tekshirilmasa. Tungi vaqtda (22:00–08:00) yuborilmaydi, ertalabga suriladi.
- Vazifa natijasi `pay_rules` bo'yicha ish haqiga (tasdiqlanganda hisoblanadi, `submitted` da emas).
- **Muddatni uzaytirish so'rovi (2026-10-26)** — `deadline_requests` (0015/0016, DELETE yo'q): ijrochi ochiq vazifada (`canRequestDeadline`) yangi muddat + sabab so'raydi (`validDeadline`: kelajak, hozirgidan keyin, ≤30 kun; bitta kutilayotgan so'rov); rahbar (egasi/admin, bo'lim boshlig'i — o'z bo'limi yoki o'zi bergan) ruxsat/rad. Yozish faqat `server/deadline.ts` (CAS, `task_events` izohi, audit, `deadline_notify` ishi); tasdiqlansa `tasks.due_at` yangilanadi va eslatmalar qayta rejalashtiriladi (`rescheduleReminders` — eski navbatdagilar o'chadi, yangi kalit muddat bilan). Yo'llar: bot («⏰ Muddatni uzaytirish» → tugma/«28.10 18:00» → sabab; rahbar `dl:ok|no`), Mini App (xodim — vazifa sahifasi; rahbar — Qarorlar, vazifa sahifasi), panel (vazifa sahifasi).

### 7a. O'zi qo'shgan ishlar (task management, egasi talabi 2026-10-24)

Xodim ham, rahbar (owner/admin/manager) ham **o'zi qilgan yoki rejalashtirgan ishni** tizimga kiritadi — vazifa faqat yuqoridan
berilmaydi. Hammasi bitta `tasks` jadvalida, `source` bilan ajraladi (alohida tizim emas):

| `source` | Kim yaratadi | Oqim |
|---|---|---|
| `assigned` | rahbar → xodim | yuqoridagi to'liq oqim (§7) |
| `self_plan` | xodim/rahbar o'ziga | reja: `accepted → in_progress → submitted → approved`; «Bugun nima qilaman» ro'yxati |
| `self_done` | xodim/rahbar | **bajarilgan ish hisoboti**: darhol `submitted` (isbot + izoh + sarflangan vaqt) → rahbar tasdiqlaydi |

- Kiritish: botda `➕ Ish qo'shish` (sarlavha → «Bajardim / Rejalashtiraman» → izoh, rasm, vaqt), Mini App va panelda «+ Ish qo'shish».
- `tasks.created_by_employee_id` / `created_by_user_id`, `spent_minutes` (ixtiyoriy), `category_id` (ishxona ish turlari — `task_categories`, tenant ma'lumoti).
- Tasdiqlovchi: xodimning bo'lim boshlig'i, bo'lmasa admin/egasi. Rahbarning o'z ishi — egasi/admin ko'radi (egasining ishi tasdiqsiz `approved`).
- Tenant sozlamasi: o'zi qo'shgan ish tasdiq talab qiladimi (`selfTasksNeedApproval`, standart — ha) va ish haqiga ta'sir qiladimi (`pay_rules`, standart — yo'q).
- Panel: «Vazifalar» da tablar `Berilgan · O'zi qo'shgan · Mening ishlarim`; xodim kartasida **ish jurnali** (kun bo'yicha nima qildi, qancha vaqt); hisobot — xodim/bo'lim bo'yicha bajarilgan ishlar soni va vaqti, Excel.

## 8. Bosqichlar

| # | Nima | Natija |
|---|---|---|
| 0 ✅ | Monorepo, Postgres + RLS rollari, kirish, tenant/a'zolik, jobs runner, sirlar, host yuzalari, super admin: ishxona yaratish, Dockerfile (Coolify deploy — domen ulangach) | `admin.adone.uz`da ishxona ochiladi |
| 1 ✅ | Filial (xarita, radius), bo'lim, xodim + taklif havolasi, bot ro'yxatdan o'tish (kontakt, rozilik, yuz namunasi), jadval shablonlari, keldi/ketdi (live location + video_note, geofence), kechikish/kelmaganlar xabari, oylik tabel + Excel | **Mudom pilot** (deploy'dan keyin) |
| 2 ✅ | Vazifalar (bot + panel, ko'p ijrochi, isbot turlari, tasdiq/qaytarish/baho, izohlar, takrorlanuvchi, eslatmalar) + **o'zi qo'shgan ishlar va ish jurnali** (§7a). Qolgan: «Vazifa berish»da fayl/ovozli xabar ilovasi, ish turlari (`task_categories`) | |
| 3 ✅ | Yuz servisi (InsightFace) + liveness, shubhali navbat (bosh sahifa «Qaror kutmoqda»), Mini App (GPS, kamera), qurilma bog'lash, ruxsat so'rovlari. Qolgan: `leave_balances` (ta'til qoldig'i), `holidays` taqvimi | to'liq anti-fraud |
| 4 ✅ | Ish haqi qoidalari (tahrirlanadi), davr yopish, qo'lda tuzatish + audit, Excel, profil va Mini App'da ko'rinish. Qolgan: KPI va reyting, PDF, bayram kunlari (`holidays`) | |
| 5 | ~~Landing~~ ✅ (ariza formasi bilan), o'zi ro'yxatdan o'tish, tariflar (xodim soniga qarab), sinov 14 kun, Click/Payme, kirill/rus, QR rejim | sotuvga chiqish |

## 9. Deploy (qisqa — batafsil `docs/DEPLOY.md`)

- Repo `github.com/XudoyorXorazmiy/adoneuz`, **`main`ga push = Coolify avtomatik deploy** (sozlangandan keyin). `vercel deploy` QILINMAYDI.
- Server: Contabo VPS 109.199.121.164 + Coolify (chaat, openstore bilan bir server). DNS: Cloudflare (registrar ahost).

## 9a. Kod xaritasi

- `packages/core/src` — enums (rollar, holatlar, o'zbekcha yorliqlar), permissions (`can`, `canUsePanel`), phone, slug, format (tz bilan), geo (`checkGeofence`). Testlar `tests/core.test.ts`.
- `packages/db/src` — schema/platform.ts, client (adone_app pool), scoped (`withTenant` / `withPlatform` / `withAuth` — `SET LOCAL ROLE`), migrate, seed, bootstrap, set-app-password, db-check, test-rls. Migratsiyalar `migrations/` (0000 — drizzle, 0001_rls — qo'lda, `drizzle-kit generate --custom`).
- `apps/web/src` — `proxy.ts` (host → yuza), `lib/host.ts`, `lib/auth/*` (jose cookie `adone_session`, login, guard), `lib/actions/*` (auth, platform), `server/jobs/*` (enqueue + `dedupeKey`, runner, handlers), `server/platform.ts`.
- `packages/core/src` (1-bosqich) — time (tz, sana), schedule (`shiftFor`, `workdayFor` — tungi smena), attendance (`computeDay`, `effectiveEvents` — tuzatishlar: add_in/add_out/void/approve; `void` qo'shilgan tuzatishni ham bekor qiladi, `retimePlan` — keldi/ketdi vaqtini almashtirish, `nextAction`). Testlar `tests/attendance.test.ts`.
- `packages/db/src/attendance.ts` — `rebuildDay` (jurnal → attendance_days, yagona yozuvchi), `workdayOf`, `dayEvents`. Sxema: `schema/tenant.ts` (branches, departments, schedules, employees, consents, media, attendance_events, attendance_days), `schema/bot.ts` (invites, tg_links, bot_sessions, tg_updates — platforma roli o'qiydi).
- `apps/web/src/server` — structure, employees (taklif kodi), attendance (kunlik ko'rinish, tabel), profile (xodim oyi, bugun jonli), dashboard, scope (menejer → o'z bo'limlari), media (disk), notify, ticks (avto-yopish, kelmaganlar), telegram/api, bot/ (index — oqimlar, session, links, texts).
- `packages/core/src/task-flow.ts` — vazifa holatlari va o'tishlar jadvali (`canTransition`, assignee/reviewer), `initialStatus` (§7a), `isOverdue`, `onTime`, kanban ustunlari, `missingProofs`, takrorlanish (`occursOn`), `outsideQuietHours` (22:00–08:00). Testlar `tests/tasks.test.ts`.
- `packages/db/src/schema/tasks.ts` — task_templates, task_batches, tasks, task_events (append-only), task_reports (append-only); RLS 0005, vazifa DELETE yo'q.
- `apps/web/src/server/tasks-form.ts` (`createTaskFromForm` — «Vazifa berish» formasi: panel va Mini App), `employees-form.ts` (`saveEmployeeFromForm`), `attendance-correct.ts` (`applyCorrections`, `resolveSuspicious` — tuzatish/shubhali qaror: panel va Mini App), `deadline.ts` (muddat so'rovlari), `manager.ts` (rahbar Mini App'i o'qishlari).
- `apps/web/src/server/tasks.ts` — YAGONA yozish nuqtasi: `createTasks` (to'plam + N nusxa, eslatmalar navbatga), `transitionTask` (CAS, isbot tekshiruvi, egasining o'z ishi avto-tasdiq), `commentTask`, `actorRole`, `runTaskTemplates` (tick'dan, `last_run_date` CAS). `task-notify.ts` — `task_notify` ishi (Telegram xabar/tugmalar, rahbarga hisobot fayllari, eslatmalar holatni qayta tekshiradi). `task-queries.ts` — ro'yxat/KPI/tafsilot/ish jurnali/`onTimeStats`. Bot: `server/bot/tasks.ts`.
- Mini App: `app/tg/*` (layout — initData auth), `components/tg/*` (webapp yordamchilari, check-flow, presence-card, task-report, add-work), `lib/tg/*` (init-data, session), `lib/actions/miniapp.ts`, `server/miniapp.ts`, `server/checkin.ts`, `app/api/tg/auth`.
- Sahifalar: `app/(panel)/*` — bosh sahifa, davomat (+ `/davomat/tabel`), vazifalar (+ `/vazifalar/[id]`; kanban/ro'yxat, `?kor=berilgan|ozi|mening`, `?ber=1` — «Vazifa berish» ochiq), xodimlar (+ `/xodimlar/[id]` profil, `?tab=vazifalar` — ish jurnali), jadvallar, filiallar (qolganlari «tez orada»); `app/platforma/(admin)/*` (super admin: Ishxonalar, Navbat), `app/kirish`, `app/sayt` (vaqtinchalik landing). API: `health`, `cron/jobs` (+ tick'lar), `cron/setup-bot`, `telegram/webhook`, `media/[id]`, `eksport/tabel`.

## 9d. Yuz tekshiruvi (3-bosqich, 2026-10-25)

- **Servis** `services/face` (FastAPI + InsightFace buffalo_l, CPU): `/embed` (namuna → 512 vektor + sifat; yuz yo'q / sifatsiz — rad), `/verify` (rasm(lar) yoki video + namunalar → eng yaxshi kosinus, yuzli kadrlar, `many_faces`, liveness = bosh burilishi `yaw_range`). Rasm/vektor diskka va logga yozilmaydi. Sinov: `python test_service.py` (paketdagi namunaviy rasmlar: o'zi ≥0.8, boshqalar <0.3). `X-Face-Key` ixtiyoriy.
- **Qaror** `packages/core/src/face.ts faceDecision` — Next.js tomonida, ishxona sozlamasi `tenants.settings.face` (`threshold` 0.45, `minYawRange` 15°). Yuz sababli RAD yo'q — faqat `suspicious` + sabab (`face_mismatch`, `no_face`, `many_faces`, `liveness_low`, `face_unavailable`, `no_face_template`); geofence esa `rejected`.
- **Namuna:** ro'yxatda dumaloq video → `face_enroll` ishi → `face_templates` (`real[]`, pgvector shart emas — 1:1 solishtirish). Sifatsiz bo'lsa xodimga «/yuz» va rahbarga xabar. `/yuz` (bot) — namunani yangilash (eski namunalar `is_active=false`). Panel profil: «Qayta olish» → xodimga /yuz haqida xabar.
- **Check-in:** bot — dumaloq video (liveness talab yo'q, video o'zi jonli); Mini App — 3 kadr (to'g'ri / chapga / o'ngga, avtomatik) → liveness talab. Servis chaqiruvi TRANZAKSIYADAN TASHQARIDA (25 s timeout); yo'q bo'lsa `face_unavailable`. `attendance_events.face_score` (0..1), `liveness_score` (gradus).
- **Qurilma:** Mini App localStorage `adone_device` (uuid) — birinchi Keldim bog'laydi (`employees.device_id/label/bound_at`), boshqasidan — `other_device` (shubhali). Panel profil «Qurilma» → «Uzish».
- **Biometrika o'chirish:** xodim `disabled` → `deleteBiometrics` (vektorlar + face_sample fayllari) va qurilma.

## 9e. Ruxsat so'rovlari (3-bosqich)

- `leave_requests` (kind `sick|vacation|personal|remote|other`, davr, sabab, holat `pending|approved|rejected|cancelled`, kim/qachon hal qildi; DELETE yo'q, RLS 0009). Core `leave.ts` (`validLeaveRange` — ≤60 kun, 30 kundan eski emas; `canDecideLeave`).
- Yozish faqat `server/leave.ts`: `createLeave` (ustma-ust pending/approved — rad), `decideLeave` (CAS, menejer — o'z bo'limi, xodim — o'zinikini bekor qiladi; tasdiqlansa o'tgan/bugungi kunlar `rebuildDay`), `leave_notify` ishi (rahbarlarga `lv:ok/no` tugmalari, xodimga qaror).
- Tasdiqlangan ruxsat kuni — `computeDay({ onLeave })` → «Ruxsatda» (kelmagan emas): `rebuildDay` (`onLeave` db helper), kunlik davomat (`leavesOn`), «Kelmaganlar» xabari, profil, Mini App, bot «Bugun».
- Bot: «📝 So'rov» / `/sorov` → tur → «Bugun / Ertaga» yoki `25.10–28.10` → sabab. Mini App: `/tg/sorov` (Tarix'dan). Panel: `/sorovlar` (Kutilmoqda / Tasdiqlangan / Rad etilgan; rad etishda sabab), menyuda kutilayotganlar soni.

## 9f. Ish haqi (4-bosqich)

- Core `payroll.ts`: `PayRules` (`normalizePayRules` — butun so'm, manfiy yo'q), `computePay({ payType, rate, days, tasks }, rules)` → asosiy (oylik — reja kunlariga mutanosib, ruxsat kunlari to'lanadi; kunbay — kun × stavka; soatbay — daqiqa), jarimalar (kechikish har daqiqa / har holat, sababsiz kelmagan kun, erta ketish, vazifa kechikdi), bonuslar (qo'shimcha soat, vazifa o'z vaqtida, 5 baho), jarima chegarasi (% asosiydan, standart 30), jami ≥ 0. Testlar `tests/payroll.test.ts`.
- Baza (0010/0011): `pay_rules` (ishxonaga bitta qator, jsonb), `payroll_periods` (`YYYY-MM`, `draft|closed`, ishlatilgan qoidalar nusxasi; DELETE yo'q), `payroll_lines` (xodim × davr snapshot: asosiy, jarima, bonus, tuzatish + sabab, jami, `breakdown` — PayResult).
- Yozish faqat `server/payroll.ts`: `recomputePeriod` (qoralama — `attendance_days` + reja kunlari `shiftFor` + shu oyda TASDIQLANGAN vazifalar; o'zi qo'shgan ishlar faqat `countSelfTasks` bilan; tuzatish saqlanadi), `adjustLine` (faqat qoralama, sabab majburiy, `audit_log`), `setPeriodStatus` (yopish — yakuniy hisob bilan; qayta ochish — faqat egasi; CAS), `savePayRules` (audit: oldin/keyin). Qoralama `/ish-haqi` ochilganda qayta hisoblanadi, yopilgan oy o'zgarmaydi.
- Panel `/ish-haqi` (egasi, admin — `payroll`): KPI, jadval (qator ochilsa — davomat va hisob tafsiloti, «Tuzatish»), «Qoidalar» drawer, «Oyni yopish» / «Qayta ochish», Excel `/api/eksport/ish-haqi`. Xodim profilida «Ish haqi» tabi (menejerga ko'rinmaydi), «So'rovlar» tabi. Mini App profilida — faqat `showToEmployee` yoqilgan bo'lsa (`ownPay`).

## 9g. Landing (adone.uz, 2026-10-25)

- Dizayn `design/landing/*.dc.html` (A hero+01, B 02–03, C 04–06, D 07–09, E 10+footer, F telefon, Stil; prompt `docs/DIZAYN-PROMPT-LANDING.md`, namuna Tessel). Ko'rish: `.dc.html` React 18 UMD + `iso.js` talab qiladi.
- Kod `app/sayt/` (layout — Fraunces / Inter Tight / Martian Mono, next/font) + `components/landing/*`: `iso.tsx` (iso.js ko'chirmasi — izometrik SVG, server/client), `art.tsx` (sahnalar), `ui.tsx` (Guides ramka chiziqlari, Divider romblar, SectionTag, Eyebrow, `Btn3d` — 3D tugma, Section), `sections.tsx` (server bo'limlar), client: header (dropdown, mobil menyu), hero-art (kursor yaqinida qatlamlar ajraladi), stack-scroll (sticky, faol qatlam), word-reveal, pricing (oylik/yillik), faq, geofence-board (bosiladigan xarita), lead-form, footer-live (soat, `/api/health` javob vaqti, kub so'z belgisi). Matn/narx/FAQ — `lib/landing/content.ts` (narxlar QORALAMA).
- Tokenlar `globals.css` oxirida `l-` prefiksi (panel tokenlariga tegmaydi); `l-label`/`l-label-sm` mono yorliqlar — `var(--font-martian)` to'g'ridan-to'g'ri (`@theme inline` o'zgaruvchisi :root'ga chiqmaydi). Breakpoint: telefon = Landing F, `lg` kasr ustunlar, `xl` = 1440 piksel 1:1; `l-bleed` — chiziq/qora band 1440 dan keng ekranda chetdan chetga.
- Dizayndagi izoh qatorlari («HOLAT: …», «IZOH: …») va joy tutuvchilar prod'ga chiqmaydi: pilot bo'limi `PILOT = null` bo'lsa ko'rinmaydi; huquqiy sahifalar hali yo'q (footer'da havolasiz).
- Ariza: `leads` (platforma jadvali, 0012/0013): anonim yozish `withAuth` (adone_auth faqat INSERT, `status='new'`), o'qish/holat `withPlatform`, adone_app'ga yopiq. `submitLeadAction` — honeypot, IP bo'yicha 10 daqiqada 5 ta, UTM referer'dan, `PLATFORM_OWNER_CHAT_ID` bo'lsa Telegram xabari (`after`). Platforma `/arizalar`. «Bepul sinash» hozircha ariza formasiga (`#ariza-forma`) — o'zi ro'yxatdan o'tish kelgach `/royxat`.
- Landing statik (○): aloqa env'lari (`NEXT_PUBLIC_SUPPORT_*`, `PLATFORM_BOT_USERNAME`) build-arg (Dockerfile).

## 9h. Hisobotlar (2026-10-26)

- Dizayn `design/panel/Hisobotlar.dc.html` (prompt `docs/DIZAYN-NEXT-PROMPTS.md` → PROMPT 2). Sahifa `/hisobotlar` — faqat `reports` (egasi, admin; menejer kirmaydi).
  URL: `tab=davomat|vazifalar|reyting|jurnal`, `davr=hafta|otgan-hafta|oy|otgan-oy|tanlash` (+ `dan`, `gacha`, ≤ 93 kun), `filial`, `bolim`, `solishtir=0`; jurnal — `xodim`, `manba=berilgan|ozi`; reyting — `tur=bolimlar`.
  Ma'lumot `<Suspense key=…>` ichida — filtr o'zgarsa skeleton. Bo'sh davr — «… uchun ma'lumot yo'q». Telefonda: filtrlar gorizontal, KPI 2×2, jadval → kartochkalar.
- **Hisob** `packages/core/src/reports.ts` (testlar `tests/reports.test.ts`): `reportPeriod` (oldingi davr: oy — oldingi oyning shu kunlari, butun oy — butun oldingi oy, hafta — oldingi hafta, tanlash — shu uzunlik),
  `attendanceStats` (davomat % = kelgan / (kelgan + sababsiz kelmagan); ruxsat va dam olish kirmaydi), `dailySeries`/`weeklySeries`, `arrivalHistogram` (smena boshiga nisbatan, 5 daq qutilar),
  `taskStats` (berilgan = `assigned`, bekor qilinganlarsiz; o'z vaqtida — topshirilganlar ichida; kechikdi = kech topshirilgan + hozir muddati o'tgan; o'zi qo'shganlar alohida),
  `ratingScore` (**ball = davomat 40% + o'z vaqtida 40% + baho 20%**, `RATING_WEIGHTS`; yo'q qism — og'irlik qolganlarga qayta taqsimlanadi), `rankBy`, `attentionReason` (ballni eng ko'p tushirgan qism).
- **O'qish** `apps/web/src/server/reports.ts` — `buildReport` (davomat — faqat `attendance_days`; `planned` = smena bor va kun boshlangan; vazifalar — `tasks` davrda **yaratilgani** bo'yicha), `loadJournal` (davrda topshirilgan/yaratilgan barcha ishlar, rahbarning o'z ishlari ham, 300 ta chegara, hisobot rasmlari `/api/media`), `reportOptions`, `parseReportParams` (sahifa va Excel bir xil).
  Faol xodimlar + davrda yozuvi bor o'chirilganlar. O'tgan davrda ma'lumot bo'lmasa farq (delta) va o'rin o'zgarishi ko'rsatilmaydi. «E'tibor talab qiladi» — 90 balldan pastlar (≥ 4 xodim bo'lsa).
- UI `components/reports/*`: `tabs.tsx` (server — KPI, bo'limlar, kelish vaqti, haftalar grafigi, manba donut, shohsupa, jurnal), `charts.tsx` (Kun | Hafta ustunlar, tooltip), `tables.tsx` (saralanadigan jadvallar, vazifalar qatori ochiladi — oxirgi 5),
  `controls.tsx` (davr menyusi, filtrlar, solishtirish, Excel oynasi, ⋯ → chop etish / PDF brauzer orqali). `lib/report-url.ts` — havola (server ham, client ham).
- Excel `/api/eksport/hisobot?varaq=davomat,vazifalar,reyting,jurnal` — har biri alohida varaq (+ kunlar / haftalar / bo'limlar bloklari).
- Hali yo'q: «Ish turlari» kartasi bo'sh holatda (`task_categories` kelgach — turlar bo'yicha vaqt; jurnalda tur chiplari o'rniga manba chiplari), reyting og'irliklari ishxona sozlamasi emas, haqiqiy PDF eksport.

## 9i. Sozlamalar (2026-10-26)

- Dizayn `design/panel/Sozlamalar.dc.html` (prompt `docs/DIZAYN-NEXT-PROMPTS.md`). Sahifa `/sozlamalar?tab=profil|ishxona|jamoa|davomat|vazifalar|ish-haqi|bildirishnomalar|tarif`:
  Profilim — har panel foydalanuvchisi (menejer faqat shuni ko'radi; foydalanuvchi qutisi → Profilim); qolgani `settings` (egasi, admin); Tarif — `billing` (egasi). Telefonda — tablar ro'yxati → ichki sahifa.
- **Model** `packages/core/src/settings.ts` `tenantSettings()` — `tenants.settings` jsonb'dan to'liq, chegaralangan sozlama (standartlar = oldingi xatti-harakat): `autoApprove`, `absentDigestAt`, `autoCloseHours` (3) / `freeAutoCloseHours` (16), `face`, `deviceBinding`, `selfTasksNeedApproval`, `reminders` (qabul qilinmasa N daq, muddatga 1 soat, muddat o'tdi, hisobot 24 soat tekshirilmadi), `quietHours` (22–08), `notifications[event] = { on, to: owner|admin|manager|creator }`. Testlar `tests/settings.test.ts`.
- Yozish `server/settings.ts saveSettings` (bo'lim bo'yicha, audit `settings.<bo'lim>` oldin/keyin; kartochkadagi «Oxirgi o'zgarish» — `lastChanges`). Ulanganlar: `ticks.ts` (avto-yopish soati, «Kelmaganlar» yoqilgan/vaqti), `checkin.ts` (qurilma bog'lash), `tasks.ts` (eslatmalar, tinch vaqt, `review_stale`), `notify.ts memberChats(…, { event, creatorUserId })` — hodisa rollari (menejer = `departments.manager_user_id` + shu bo'limga mas'ul `memberships.department_ids`).
- **Jamoa** `server/team.ts` (yagona yozish nuqtasi): egasi admin va menejer qo'shadi, admin — faqat menejer; egasi qatori va o'zi bu yerdan o'zgarmaydi. Yangi hisob — vaqtinchalik parol (`users.must_change_password`, panelda sariq banner) yoki «Telegram orqali taklif» (invite `member_login` → bot bog'lagach parolni o'zi yuboradi, admin ko'rmaydi). **Har qanday `mem_` havola** (bildirishnoma uchun ham) botda avval kontakt so'raydi — o'z kontakti, raqam `users.phone` ga teng; kod shundan keyingina atomik `used_at` bilan yopiladi (begonaga parol/bildirishnoma ketmaydi). Boshqa ishxonada ham a'zo hisobning paroli tiklanmaydi/o'zgarmaydi (`onlyHere`, adone_auth). Yangi user `RETURNING`siz (id serverda) — RLS SELECT siyosati a'zolikdan oldin qatorni ko'rmaydi.
- Profilim: parol (kamida 8, harf+raqam) o'zgarsa `password_changed_at` suriladi — boshqa qurilmalar chiqadi, joriy cookie qayta imzolanadi; «Kirishlar» — login'da `audit_log auth.login` (UA, IP). Ishxonani yopish = holat `archived` (o'chirish emas).
- Hali yo'q: ish turlari (kategoriyalar), logotip/rasm yuklash, Click/Payme (Tarif — «tez orada», tanlash qo'llab-quvvatlash orqali).

## 9j. Qo'llanmalar (2026-10-27)

- `docs/qollanma/xodim-qollanma.{html,pdf}` (xodim: bot + Mini App, A–Z) va `rahbar-qollanma.{html,pdf}` (egasi/admin/menejer: panel, rahbar Mini App'i, bot bildirishnomalari, rollar jadvali). Uslub `qollanma.css` (talimtizim namunasi + Telegram chat ramkasi — bot matnlari `server/bot/texts.ts`, `task-notify.ts` dan so'zma-so'z).
- Suratlar `docs/qollanma/img/` — lokal seed ma'lumot (prod ma'lumoti ishlatilmaydi). Qayta olish: `docs/qollanma/README.md` (`scripts/shoot.mjs` — Chrome + puppeteer-core, dev server va `PLATFORM_BOT_TOKEN=test:token`, `tg_links` test qatorlari; `scripts/topdf.mjs` — HTML → PDF). Ekran o'zgarsa surat va matnni birga yangilang.

## 9c. Mini App (`app.adone.uz/tg`)

- **Kirish:** `telegram-web-app.js` → `initData` → `POST /api/tg/auth` (HMAC: `WebAppData` + bot tokeni, 24 soatdan eski rad, `lib/tg/init-data.ts`) → Telegram user → `tg_links` (employee) → cookie `adone_tg` (jose, kalit AUTH_SECRET + `:miniapp`, 12 soat, prod'da SameSite=None; Secure). Har so'rovda `currentTgUser()` bog'lanish, xodim holati va `telegram_user_id` ni qayta tekshiradi. Panel sessiyasi bilan aralashmaydi; proxy `/tg` ni panel cookie'siz o'tkazadi (faqat app host'da).
- **Keldim:** brauzer geolocation (aniq rejim; bo'lmasa Telegram `LocationManager`) → `tgGeoPreviewAction` (faqat masofa) → jonli old kamera (`getUserMedia`, galereya yo'q; ko'rsatmalar — yuz servisi kelgach liveness'ga ulanadi) → `tgCheckAction`: geofence SERVERDA qayta (`server/checkin.ts recordCheck`), tashqarida — `rejected` jurnalga; selfi `checkin_photo`, `source='miniapp'`. **Ketdim** — faqat lokatsiya. Tanaffus — `break_start/break_end` (`toggleBreak`).
- **Vazifalar:** `/tg/vazifalar`, `/tg/vazifa/[id]` (qabul, boshladim, checklist belgisi, kamera `capture` bilan rasm ≤10, lokatsiya, izoh → `transitionTask` + isbot tekshiruvi), `/tg/ish` (Bajardim/Rejalashtiraman). Rasm client'da ≤1600px JPEG, server ≤5 MB va MIME tekshiradi. **Video (2026-10-27)** — server action EMAS: tanlangan zahoti `POST /api/tg/upload?task=<id>` (Mini App cookie, vazifa shu ijrochiniki va ochiq, oqim bilan diskka `writeMediaStream`, ≤100 MB, XHR progress) → `{id}` → `tgTaskAction` `media` maydoni (shu ijrochi, 6 soat ichida). `proxy.ts` matcher `/api` ni ushlamaydi — aks holda tana 10 MB gacha buferlanadi. `/api/media` Range (206) beradi — iOS video ijrosi uchun. Eski ochiq klient (deploy'dan keyin) — `actionError` → «Ilova yangilandi» + «Yangilash».
- **Tezlik (2026-10-27):** ikonkalar — Material Symbols faqat ishlatilganlari, o'z serverimizdan (`scripts/icons.mjs` dev/build oldidan: src va core'dagi literal nomlar → `src/app/fonts/material-symbols.woff2`, ~140 KB; oldin Google'dan 3,1 MB). Yangi ikonka nomi — dev/build o'zi yangilaydi (tarmoq kerak), woff2 va `material-symbols.txt` ni commit qiling. `app/tg/loading.tsx` — o'tishda darhol skelet. `TgAuth` — kirgach `router.refresh()` (to'liq qayta yuklash emas). Prod logidagi `Server Reference ID … Received "x"/"r2s"` — skanerlar (React2Shell), proxy hex bo'lmagan `Next-Action` ni 400 bilan qaytaradi.
- **Rahbar ko'rinishi (2026-10-26):** xodim yozuvi bo'lmagan egasi/admin/bo'lim boshlig'i (tg_links `member`, botda kontakt bilan bog'langan) Mini App'ni ochsa — sessiya `{tg, t, m: userId}` (`currentTgMember`, `memberAsTenantUser` → panel server funksiyalari, rol va bo'lim cheklovi bir xil). Ekranlar (`server/manager.ts`, `components/tg/manager-*.tsx`, amallar `lib/actions/miniapp.ts tg*Action`):
  `/tg` — «Bugun» (davomat raqamlari, vazifalar KPI, qaror kutayotganlar, xodimlar ro'yxati, «Vazifa berish» / «Hisobot» tugmalari) · `/tg/vazifalar` — nazorat (Berilgan / O'zi qo'shgan, holat tablari soni bilan) · `/tg/vazifa/[id]` — tafsilot: hisobot fayllari (`/api/media` rahbar sessiyasini ham qabul qiladi), boshqa nusxalar, tarix, **tasdiqlash (baho) / qaytarish / bekor qilish / izoh** — hammasi `transitionTask`/`commentTask` orqali · `/tg/vazifa-berish` — panel drawer'idagi `AssignFields` + `server/tasks-form.ts createTaskFromForm` (panel va Mini App bir xil tekshiruv; menejer faqat o'z bo'limiga) · `/tg/qarorlar` — yangi xodim, ruxsat so'rovi, hisobotga baho · `/tg/hisobot` — faqat `reports` (egasi, admin): davr (hafta/oy), davomat, vazifalar, reyting — `buildReport` bilan bir xil hisob.
  Qo'shimcha (2026-10-26): `/tg/qarorlar` da **shubhali keldi-ketdi** (bugun/kecha, isbot kartochkasi `TgProof`, tasdiqlash/rad — `resolveSuspicious`) va **muddat so'rovlari**; `/tg/xodim/[id]` — xodim kartasi (bugungi holat va isbotlar, oy kalendar-tabeli va KPI, ish jurnali, Vazifa berish / Telegram / qo'ng'iroq); «Bugun» ro'yxatida kelmagan xodimga **bir bosishda eslatma** (`tgRemindEmployeeAction`, kuniga bir marta `remind:<xodim>:<sana>`); `/tg/ish-haqi` — oylik vedomost (`payroll`, faqat o'qish); `/tg/xodim-qoshish` — panel formasi (`EmployeeFields`, `saveEmployeeFromForm`) + taklif havolasi va «Telegram'da yuborish». Bot bildirishnomalarida rahbar uchun «Mini App’da ochish» tugmasi (`miniAppRow`/`miniAppKeyboard`, faqat https).
  Menyu: Bugun · Vazifalar · Qarorlar · Hisobot (`reports` bo'lsa) · Panel (tashqi). Xodim sahifalari (keldim, ish, tarix, profil, so'rov) rahbarni `/tg` ga qaytaradi. Xodim yozuvi ham bo'lsa — xodim ko'rinishi. Lokal sinov: `tg_links` ga `member` qatori (700000100 egasi, 700000101 menejer) + `PLATFORM_BOT_TOKEN=test:token`, `POST /api/tg/auth` imzolangan initData bilan.
- **Bot bog'lanishi:** `setup-bot` https bo'lsa chat menyusiga «Ochish» (web_app `/tg`) qo'yadi; vazifa kartasida «Mini App’da ochish ↗». Dev'da (http) bu tugmalar chiqmaydi — Telegram faqat https qabul qiladi.
- Sinov: `cd apps/web && node --import tsx scripts/test-initdata.ts`; brauzer e2e (soxta WebApp, GPS, kamera) — server `PLATFORM_BOT_TOKEN=test:token` bilan.

## 9b. Bot oqimlari

- **Ro'yxatdan o'tish:** `/start inv_<kod>` → «📱 Raqamni yuborish» (`contact.user_id === from.id`, panelda kiritilgan raqam bilan solishtiriladi) → rozilik (`consents`, `CONSENT_VERSION`) → dumaloq video (`media` face_sample) → `pending` (yoki `tenants.settings.autoApprove`) → rahbarlarga xabar. Panelda «Tasdiqlash» → xodimga xabar.
- **Keldim:** jonli lokatsiya (`live_period` majburiy; forward va 120 s dan eski — rad) → geofence (tashqarida — `rejected` hodisa jurnalga) → dumaloq video → yuz servisi (§9d) → `check_in` (`ok` yoki `suspicious`) → kechiksa rahbarga xabar. **Ketdim:** faqat jonli lokatsiya. Sessiya 15 daqiqa.
- **Vazifalar (2-bosqich):** yangi vazifa → xodimga karta (`✅ Qabul qildim` / `❓ Savol`, callback `tk:<amal>:<uuid>`) → `▶️ Boshladim` → `✅ Bajardim`: hisobot sessiyasi (`task_report`) — rasm/video/dumaloq video (`media` task_report), lokatsiya (forward rad), izoh; talab qilingan isbot yetmasa server rad etadi → `submitted` → rahbarlarga (egasi, admin, bo'lim boshlig'i; o'zi emas) xabar + fayllar + `✅ Tasdiqlash` (baho 1–5) / `🔁 Qaytarish` (sabab matni). `⏰ Muddatni uzaytirish` (ish tugmalarida) → +1/+2/+3 kun yoki «28.10 18:00» → sabab → rahbarga `dl:ok|no` tugmali xabar (§7). `📋 Vazifalarim` — ochiq ro'yxat. `➕ Ish qo'shish` — nom → `Bajardim` (isbot ixtiyoriy, `self_done`, tasdiq kutadi) yoki `Rejalashtiraman` (`self_plan`). Eslatmalar: 30 daq qabul qilinmasa, muddatga 1 soat, muddat o'tganda (xodim + rahbar); 22:00–08:00 ertalabga suriladi.
- **Tick (har 10 daqiqa, har ishxona):** takrorlanuvchi vazifalar (kuniga bir marta), bugun/kecha yig'masi, smena tugaganidan 3 soat keyin (erkin grafikda 16 soat) `auto_close`, `absentDigestAt` (standart 10:00) dan keyin kunlik «Kelmaganlar / kechikkanlar».

## 10. Qarorlar va ochiq savollar

- 2026-10-20: texnologiya chaat/openstore bilan bir xil (egasi tasdiqladi); kodni to'liq Claude yozadi, dizayn Claude Design orqali (`docs/DIZAYN-PROMPT.md` → `design/panel/*.dc.html` → 1:1).
- 2026-10-24: dizayn keldi (`design/panel/`, 12 fayl; uslub — egasi tanlagan «Relink» namunasi `design/ref/`). Shrift **Plus Jakarta Sans** (next/font), ikonkalar **Material Symbols Rounded** (`components/ui/icon.tsx`, `<link>` layout'da), tokenlar `globals.css` `@theme` da 1:1 (primary `#2443F5`, navy `#0B1B4F`, kanvas `#EEF0F4`, kartochka radius 20, pill tugmalar). Asos uslublari `@layer base` ichida bo'lishi SHART (qatlamsiz `a{color}` utilitalarni bosib ketadi).
  Ko'chirish qismlari: **1 ✅** tokenlar, qobiq (Sidebar, sarlavha `PageHeader` + `TopControls`), Kirish, Bosh sahifa (bento, jonli ma'lumot) · **2 ✅** Davomat (KPI, pill filtrlar, qator ⋯ menyusi, isbot kartochkalari, «Davomatni tuzatish» drawer — vaqtni belgilash `retimePlan`, sahifalash), Xodim profili `/xodimlar/[id]` (kalendar-tabel, yuz namunasi, Telegram, Ma'lumotlar); lucide butunlay olib tashlandi · **3 ✅** Vazifalar (KPI, Berilgan / O'zi qo'shgan / Mening ishlarim, kanban — bir topshiriqning nusxalari bitta kartada, ro'yxat, filtrlar), «Vazifa berish» drawer (Kimga chiplari + bo'lim/filial, isbot, checklist, takrorlash, Telegram ko'rinishi), «Ish qo'shish», vazifa sahifasi (tasdiq/baho, qaytarish, bekor, hisobot fayllari, tarix va yozishma), bosh sahifa «Vazifalar bajarilishi» · **4 ✅** Mini App ekranlari: Bosh (Keldim doirasi / ishda vaqti, tanaffus, Ketdim, bugungi vazifalar, oy), Keldim oqimi (lokatsiya → selfi → natija; xato varianti), Vazifa va hisobot (checklist, kamera bilan rasm, lokatsiya, qaytarilgan banner), Ish qo'shish, Tarix, Profil. Dizaynni ko'rish: `.dc.html` lar React 18 UMD'ni unpkg'dan oladi.
- 2026-10-26: dizaynsiz sahifalar (Xodimlar, Filiallar, Jadvallar, Xodim profili tablari, So'rovlar, Ish haqi, super admin, Mini App qolganlari) Claude Design'siz — `docs/DIZAYN-PROMPTS-3.md` texnik topshirig'i va chizilgan sahifalar naqshlari (StatCard, underline tablar, grid jadval, Sozlamalar kartochkalari) asosida qayta qurildi; «optional, not built yet» g'oyalar qurilmagan. Filial xaritasi — Leaflet + OSM (`components/structure/branch-map.tsx`). Telefonda panel va admin uchun menyu — `components/shell/mobile-nav.tsx`.
- Server Contabo'da (Germaniya). Biometrik ma'lumotni O'zbekistonda saqlash talabi — keng sotuvdan oldin qayta ko'riladi (egasi xabardor).
- Vazifalar: bot va panelda; takrorlanuvchi — ixtiyoriy sozlama; ish haqiga ta'siri — admin tahrirlaydigan qoidalar; ko'p ijrochi — har biri alohida hisobot.
