# adone.uz — xodimlar davomati va vazifalar (Telegram bot + Mini App + web panel)

Xodim Telegram bot / Mini App orqali «Keldim» / «Ketdim» qiladi: **lokatsiya (geofence) + jonli rasm/video + yuz tekshiruvi**.
Rahbar vazifa beradi, xodim bajarib hisobot topshiradi, rahbar tasdiqlaydi yoki qaytaradi. Davomat va vazifalar oylik
tabel, KPI va ish haqi hisobiga (bonus/jarima — admin tahrirlaydigan qoidalar) tushadi. Multi-tenant SaaS: har ishxona — alohida tenant.

**Bu fayl — loyihaning haqiqat manbai. Har sessiya boshida o'qi.** Dizayn: `docs/DIZAYN-PROMPT.md`. Deploy: `docs/DEPLOY.md`.

> **Holat (2026-10-24):** 0- va 1-bosqich kodi tayyor (lokal tekshirilgan, `main`da). Panel: filiallar (xarita havolasidan koordinata),
> jadvallar (haftalik / navbatli / erkin, tungi smena), bo'limlar, xodimlar + taklif havolasi, kunlik davomat (isbot, tuzatish),
> oylik tabel + Excel, jonli bosh sahifa. Bot: ro'yxatdan o'tish (kontakt, rozilik, yuz namunasi), keldi (jonli lokatsiya + geofence +
> dumaloq video) / ketdi, bugun, rahbarlarga bildirishnomalar, avto-yopish, kunlik «Kelmaganlar». **2-bosqich (vazifalar) asosiy qismi tayyor (2026-10-25)** —
> qolgani pastdagi jadvalda. **Mini App (3-bosqichning bir qismi) tayyor (2026-10-25)**: GPS + jonli selfi bilan keldi/ketdi, tanaffus, vazifa hisoboti, ish qo'shish.
> Domen, Coolify va bot tokeni hali ulanmagan.
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
- Telegram: yupqa fetch mijozi (`server/telegram/api.ts`, grammY shart bo'lmadi), webhook + `secret_token` (AUTH_SECRET'dan HMAC). **Bitta platforma boti** (`@adoneuz_bot`) — hamma ishxona uchun; xodim `/start inv_<kod>`, rahbar bildirishnomalar uchun `/start mem_<kod>` bilan bog'lanadi. Webhook → `tg_updates` (idempotent) → `tg_update` ishi → `server/bot`. Keyin: ishxona o'z botini ulashi mumkin (chaat naqshi).
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
Vazifa berish: `owner/admin` → hammaga; `manager` → faqat o'z bo'limidagilarga (`departments.manager_id` ierarxiyasi).

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
| 2 ✅ | Vazifalar (bot + panel, ko'p ijrochi, isbot turlari, tasdiq/qaytarish/baho, izohlar, takrorlanuvchi, eslatmalar) + **o'zi qo'shgan ishlar va ish jurnali** (§7a). Qolgan: muddatni uzaytirish so'rovi (`deadline_requests`), «Vazifa berish»da fayl/ovozli xabar ilovasi, `selfTasksNeedApproval` sozlamasi UI'si (Sozlamalar sahifasi bilan) | |
| 3 | Yuz servisi (InsightFace) + liveness, shubhali navbat, ~~Mini App (GPS, kamera)~~ ✅, qurilma bog'lash, ruxsat so'rovlari | to'liq anti-fraud |
| 4 | Ish haqi qoidalari (tahrirlanadi), davr yopish, qo'lda tuzatish + audit, KPI va reyting, Excel/PDF | |
| 5 | Landing, o'zi ro'yxatdan o'tish, tariflar (xodim soniga qarab), sinov 14 kun, Click/Payme, kirill/rus, QR rejim | sotuvga chiqish |

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
- `apps/web/src/server/tasks.ts` — YAGONA yozish nuqtasi: `createTasks` (to'plam + N nusxa, eslatmalar navbatga), `transitionTask` (CAS, isbot tekshiruvi, egasining o'z ishi avto-tasdiq), `commentTask`, `actorRole`, `runTaskTemplates` (tick'dan, `last_run_date` CAS). `task-notify.ts` — `task_notify` ishi (Telegram xabar/tugmalar, rahbarga hisobot fayllari, eslatmalar holatni qayta tekshiradi). `task-queries.ts` — ro'yxat/KPI/tafsilot/ish jurnali/`onTimeStats`. Bot: `server/bot/tasks.ts`.
- Mini App: `app/tg/*` (layout — initData auth), `components/tg/*` (webapp yordamchilari, check-flow, presence-card, task-report, add-work), `lib/tg/*` (init-data, session), `lib/actions/miniapp.ts`, `server/miniapp.ts`, `server/checkin.ts`, `app/api/tg/auth`.
- Sahifalar: `app/(panel)/*` — bosh sahifa, davomat (+ `/davomat/tabel`), vazifalar (+ `/vazifalar/[id]`; kanban/ro'yxat, `?kor=berilgan|ozi|mening`, `?ber=1` — «Vazifa berish» ochiq), xodimlar (+ `/xodimlar/[id]` profil, `?tab=vazifalar` — ish jurnali), jadvallar, filiallar (qolganlari «tez orada»); `app/platforma/(admin)/*` (super admin: Ishxonalar, Navbat), `app/kirish`, `app/sayt` (vaqtinchalik landing). API: `health`, `cron/jobs` (+ tick'lar), `cron/setup-bot`, `telegram/webhook`, `media/[id]`, `eksport/tabel`.

## 9c. Mini App (`app.adone.uz/tg`)

- **Kirish:** `telegram-web-app.js` → `initData` → `POST /api/tg/auth` (HMAC: `WebAppData` + bot tokeni, 24 soatdan eski rad, `lib/tg/init-data.ts`) → Telegram user → `tg_links` (employee) → cookie `adone_tg` (jose, kalit AUTH_SECRET + `:miniapp`, 12 soat, prod'da SameSite=None; Secure). Har so'rovda `currentTgUser()` bog'lanish, xodim holati va `telegram_user_id` ni qayta tekshiradi. Panel sessiyasi bilan aralashmaydi; proxy `/tg` ni panel cookie'siz o'tkazadi (faqat app host'da).
- **Keldim:** brauzer geolocation (aniq rejim; bo'lmasa Telegram `LocationManager`) → `tgGeoPreviewAction` (faqat masofa) → jonli old kamera (`getUserMedia`, galereya yo'q; ko'rsatmalar — yuz servisi kelgach liveness'ga ulanadi) → `tgCheckAction`: geofence SERVERDA qayta (`server/checkin.ts recordCheck`), tashqarida — `rejected` jurnalga; selfi `checkin_photo`, `source='miniapp'`. **Ketdim** — faqat lokatsiya. Tanaffus — `break_start/break_end` (`toggleBreak`).
- **Vazifalar:** `/tg/vazifalar`, `/tg/vazifa/[id]` (qabul, boshladim, checklist belgisi, kamera `capture` bilan rasm ≤10, lokatsiya, izoh → `transitionTask` + isbot tekshiruvi), `/tg/ish` (Bajardim/Rejalashtiraman). Rasm client'da ≤1600px JPEG, server ≤5 MB va MIME tekshiradi.
- **Bot bog'lanishi:** `setup-bot` https bo'lsa chat menyusiga «Ochish» (web_app `/tg`) qo'yadi; vazifa kartasida «Mini App’da ochish ↗». Dev'da (http) bu tugmalar chiqmaydi — Telegram faqat https qabul qiladi.
- Sinov: `cd apps/web && node --import tsx scripts/test-initdata.ts`; brauzer e2e (soxta WebApp, GPS, kamera) — server `PLATFORM_BOT_TOKEN=test:token` bilan.

## 9b. Bot oqimlari

- **Ro'yxatdan o'tish:** `/start inv_<kod>` → «📱 Raqamni yuborish» (`contact.user_id === from.id`, panelda kiritilgan raqam bilan solishtiriladi) → rozilik (`consents`, `CONSENT_VERSION`) → dumaloq video (`media` face_sample) → `pending` (yoki `tenants.settings.autoApprove`) → rahbarlarga xabar. Panelda «Tasdiqlash» → xodimga xabar.
- **Keldim:** jonli lokatsiya (`live_period` majburiy; forward va 120 s dan eski — rad) → geofence (tashqarida — `rejected` hodisa jurnalga) → dumaloq video → `check_in` (`ok`; yuz tekshiruvi 3-bosqichda) → kechiksa rahbarga xabar. **Ketdim:** faqat jonli lokatsiya. Sessiya 15 daqiqa.
- **Vazifalar (2-bosqich):** yangi vazifa → xodimga karta (`✅ Qabul qildim` / `❓ Savol`, callback `tk:<amal>:<uuid>`) → `▶️ Boshladim` → `✅ Bajardim`: hisobot sessiyasi (`task_report`) — rasm/video/dumaloq video (`media` task_report), lokatsiya (forward rad), izoh; talab qilingan isbot yetmasa server rad etadi → `submitted` → rahbarlarga (egasi, admin, bo'lim boshlig'i; o'zi emas) xabar + fayllar + `✅ Tasdiqlash` (baho 1–5) / `🔁 Qaytarish` (sabab matni). `📋 Vazifalarim` — ochiq ro'yxat. `➕ Ish qo'shish` — nom → `Bajardim` (isbot ixtiyoriy, `self_done`, tasdiq kutadi) yoki `Rejalashtiraman` (`self_plan`). Eslatmalar: 30 daq qabul qilinmasa, muddatga 1 soat, muddat o'tganda (xodim + rahbar); 22:00–08:00 ertalabga suriladi.
- **Tick (har 10 daqiqa, har ishxona):** takrorlanuvchi vazifalar (kuniga bir marta), bugun/kecha yig'masi, smena tugaganidan 3 soat keyin (erkin grafikda 16 soat) `auto_close`, `absentDigestAt` (standart 10:00) dan keyin kunlik «Kelmaganlar / kechikkanlar».

## 10. Qarorlar va ochiq savollar

- 2026-10-20: texnologiya chaat/openstore bilan bir xil (egasi tasdiqladi); kodni to'liq Claude yozadi, dizayn Claude Design orqali (`docs/DIZAYN-PROMPT.md` → `design/panel/*.dc.html` → 1:1).
- 2026-10-24: dizayn keldi (`design/panel/`, 12 fayl; uslub — egasi tanlagan «Relink» namunasi `design/ref/`). Shrift **Plus Jakarta Sans** (next/font), ikonkalar **Material Symbols Rounded** (`components/ui/icon.tsx`, `<link>` layout'da), tokenlar `globals.css` `@theme` da 1:1 (primary `#2443F5`, navy `#0B1B4F`, kanvas `#EEF0F4`, kartochka radius 20, pill tugmalar). Asos uslublari `@layer base` ichida bo'lishi SHART (qatlamsiz `a{color}` utilitalarni bosib ketadi).
  Ko'chirish qismlari: **1 ✅** tokenlar, qobiq (Sidebar, sarlavha `PageHeader` + `TopControls`), Kirish, Bosh sahifa (bento, jonli ma'lumot) · **2 ✅** Davomat (KPI, pill filtrlar, qator ⋯ menyusi, isbot kartochkalari, «Davomatni tuzatish» drawer — vaqtni belgilash `retimePlan`, sahifalash), Xodim profili `/xodimlar/[id]` (kalendar-tabel, yuz namunasi, Telegram, Ma'lumotlar); lucide butunlay olib tashlandi · **3 ✅** Vazifalar (KPI, Berilgan / O'zi qo'shgan / Mening ishlarim, kanban — bir topshiriqning nusxalari bitta kartada, ro'yxat, filtrlar), «Vazifa berish» drawer (Kimga chiplari + bo'lim/filial, isbot, checklist, takrorlash, Telegram ko'rinishi), «Ish qo'shish», vazifa sahifasi (tasdiq/baho, qaytarish, bekor, hisobot fayllari, tarix va yozishma), bosh sahifa «Vazifalar bajarilishi» · **4 ✅** Mini App ekranlari: Bosh (Keldim doirasi / ishda vaqti, tanaffus, Ketdim, bugungi vazifalar, oy), Keldim oqimi (lokatsiya → selfi → natija; xato varianti), Vazifa va hisobot (checklist, kamera bilan rasm, lokatsiya, qaytarilgan banner), Ish qo'shish, Tarix, Profil. Dizaynni ko'rish: `.dc.html` lar React 18 UMD'ni unpkg'dan oladi.
- Server Contabo'da (Germaniya). Biometrik ma'lumotni O'zbekistonda saqlash talabi — keng sotuvdan oldin qayta ko'riladi (egasi xabardor).
- Vazifalar: bot va panelda; takrorlanuvchi — ixtiyoriy sozlama; ish haqiga ta'siri — admin tahrirlaydigan qoidalar; ko'p ijrochi — har biri alohida hisobot.
