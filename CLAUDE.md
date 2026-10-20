# adone.uz — xodimlar davomati va vazifalar (Telegram bot + Mini App + web panel)

Xodim Telegram bot / Mini App orqali «Keldim» / «Ketdim» qiladi: **lokatsiya (geofence) + jonli rasm/video + yuz tekshiruvi**.
Rahbar vazifa beradi, xodim bajarib hisobot topshiradi, rahbar tasdiqlaydi yoki qaytaradi. Davomat va vazifalar oylik
tabel, KPI va ish haqi hisobiga (bonus/jarima — admin tahrirlaydigan qoidalar) tushadi. Multi-tenant SaaS: har ishxona — alohida tenant.

**Bu fayl — loyihaning haqiqat manbai. Har sessiya boshida o'qi.** Dizayn: `docs/DIZAYN-PROMPT.md`. Deploy: `docs/DEPLOY.md`.

> **Holat (2026-10-20):** loyiha boshlandi — hujjatlar yozildi, kod hali yo'q (0-bosqich navbatda).
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

- Node 24 (`.nvmrc`), pnpm 10 monorepo: `apps/web` (Next.js 16, App Router, `src/proxy.ts`, TypeScript, Tailwind v4, lucide-react), `packages/core` (sof domen: davomat hisobi, geofence, smena, vazifa oqimi, ish haqi, money + testlar), `packages/db` (Drizzle + pg, migratsiyalar, RLS, seed, bootstrap), `packages/shared` (enum, ruxsatlar, i18n, format, zod).
- Kod yozishdan oldin `node_modules/next/dist/docs/` ni o'qi (Next 16 o'zgarishlari).
- PostgreSQL 18 (+ `pgvector` — yuz embedding'lari uchun, image `pgvector/pgvector:pg18`), Drizzle `casing: 'snake_case'`.
- Sessiya: jose HS256 cookie (host-only), parol scrypt, 5 xato → 15 daqiqa qulf (boshqaruv-tizim qoidalari).
- Telegram: **grammY**, webhook + `secret_token`. **Bitta platforma boti** (`@adoneuz_bot`) — hamma ishxona uchun; xodim ishxonaga taklif havolasi `/start inv_<kod>` bilan bog'lanadi. Keyin: ishxona o'z botini ulashi mumkin (chaat naqshi).
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

## 8. Bosqichlar

| # | Nima | Natija |
|---|---|---|
| 0 | Monorepo, Postgres + RLS rollari, kirish, tenant/a'zolik, jobs runner, sirlar, host yuzalari, super admin: ishxona yaratish, Dockerfile + Coolify deploy | `admin.adone.uz`da ishxona ochiladi |
| 1 | Filial (xarita, radius), bo'lim, xodim + taklif havolasi, bot ro'yxatdan o'tish (kontakt, rozilik, yuz namunasi), jadval shablonlari, keldi/ketdi (live location + video_note, geofence), kechikish/kelmaganlar xabari, oylik tabel + Excel | **Mudom pilot** |
| 2 | Vazifalar (bot + panel, ko'p ijrochi, isbot turlari, tasdiq/qaytarish/baho, izohlar, muddat so'rovi, takrorlanuvchi, eslatmalar) | |
| 3 | Yuz servisi (InsightFace) + liveness, shubhali navbat, Mini App (GPS, kamera, qurilma bog'lash), ruxsat so'rovlari | to'liq anti-fraud |
| 4 | Ish haqi qoidalari (tahrirlanadi), davr yopish, qo'lda tuzatish + audit, KPI va reyting, Excel/PDF | |
| 5 | Landing, o'zi ro'yxatdan o'tish, tariflar (xodim soniga qarab), sinov 14 kun, Click/Payme, kirill/rus, QR rejim | sotuvga chiqish |

## 9. Deploy (qisqa — batafsil `docs/DEPLOY.md`)

- Repo `github.com/XudoyorXorazmiy/adoneuz`, **`main`ga push = Coolify avtomatik deploy** (sozlangandan keyin). `vercel deploy` QILINMAYDI.
- Server: Contabo VPS 109.199.121.164 + Coolify (chaat, openstore bilan bir server). DNS: Cloudflare (registrar ahost).

## 10. Qarorlar va ochiq savollar

- 2026-10-20: texnologiya chaat/openstore bilan bir xil (egasi tasdiqladi); kodni to'liq Claude yozadi, dizayn Claude Design orqali (`docs/DIZAYN-PROMPT.md` → `design/panel/*.dc.html` → 1:1).
- Server Contabo'da (Germaniya). Biometrik ma'lumotni O'zbekistonda saqlash talabi — keng sotuvdan oldin qayta ko'riladi (egasi xabardor).
- Vazifalar: bot va panelda; takrorlanuvchi — ixtiyoriy sozlama; ish haqiga ta'siri — admin tahrirlaydigan qoidalar; ko'p ijrochi — har biri alohida hisobot.
