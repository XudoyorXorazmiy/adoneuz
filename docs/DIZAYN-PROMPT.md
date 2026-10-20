# adone — Dizayn prompti (ishxona paneli + xodim Mini App)

> **«## PROMPT»** dan **«## PROMPT TUGADI»** gacha nusxalab Claude Design'ga tashlang.
> Birinchi generatsiya: dizayn tizimi + kirish + bosh sahifa + davomat + xodim tabeli + vazifalar + vazifa paneli + Mini App (3 mobil ekran) — 10 artboard. Bitta promptga 15+ ekran sig'maydi (talimtizim tajribasi) — qolganlari (`DIZAYN-NEXT-PROMPTS.md`, keyin yoziladi) **o'sha sessiyada** bittalab.
> Eksportlar `design/panel/*.dc.html` ga tushadi; kod dizayndan 1:1 quriladi (avval `globals.css` tokenlari dizaynga moslanadi).

---

## PROMPT

Design the working interface of **adone** (adone.uz) — a SaaS for businesses in Uzbekistan to track **employee attendance and tasks through Telegram**. Employees check in and out from a Telegram Mini App: the system verifies **location (inside the branch geofence), a live selfie and face match**. Managers assign tasks; employees submit a report with a photo; managers approve or send back. Everything rolls up into a monthly timesheet, KPI and payroll (late fines and task bonuses by editable rules). Users: shop and office owners, admins and department heads — non-technical, on 13–15" laptops and often on a phone; employees use only the phone (Mini App inside Telegram). The promise: *you know who is at work right now and what they did today.*

The product is being built (Next.js). Screens, labels and data below are real, not invented — the design will be implemented 1:1, so use the exact labels.

### Language and formats
All UI copy in **Uzbek (Latin)**. No Russian or English words except technical ones (Telegram, Mini App, Excel, PDF, GPS, QR, Click, Payme). Money `4 500 000 so'm`. Dates `20.10.2026`, weekday `Dushanba`, time `09:07`. Durations `8 soat 12 daqiqa`, `kechikdi 7 daqiqa`. Distance `35 m`. Phone `+998 90 123 45 67`. Tabular numbers wherever numbers align.

### Design principles
1. **"Right now" first.** The home screen answers in 3 seconds: how many are at work, who is late, who is absent, what needs my decision.
2. **Proof is visible, never hidden.** Every check-in row can expand to its evidence: selfie thumbnail, small map with the branch circle and the point, distance `35 m`, face match `Yuz mos: 94%`, source `Mini App` / `Bot`. Suspicious ones are amber with the reason (`Yuz mos kelmadi: 41%`, `Zonadan tashqarida: 420 m`, `GPS aniqligi past`).
3. **One page skeleton:** page header (title, count, primary button) → 3–4 KPI cards → filter row (date picker, branch, department, tabs with counts, search) → content card. Every number links to the filtered list behind it.
4. **Decisions in one click.** Approve / reject buttons sit on the row itself (leave requests, suspicious check-ins, submitted tasks). Reject and send-back always ask for a reason.
5. **Stateful.** Every list has empty, loading (skeleton) and error states. Empty state = one sentence + the primary action, no illustration.
6. **Mobile is first-class.** The panel works at 390px (a manager on the phone); the Mini App is designed for 390×844 inside Telegram (Telegram header on top, our MainButton-style big bottom button).
7. Light theme for v1; tokens must make a dark theme trivial later (Mini App follows Telegram's theme).

### Brand
- Name **adone**, lowercase wordmark in a rounded geometric sans; the "a" may contain a subtle check mark. Monogram: rounded square with a check mark inside a location pin.
- Primary teal `#0F766E` (hover `#0B5F58`, tint `#E6F4F2`). Success `#16A34A`, warning `#D97706`, danger `#DC2626`, info `#2563EB`. Neutrals: text `#0F172A`, muted `#64748B`, border `#E2E8F0`, page `#F8FAFC`, card `#FFFFFF`.
- Attendance colors (dots, chips, timesheet cells — never large fills): `Ishda` green · `Kechikdi` amber · `Kelmadi` red · `Ruxsatda` blue · `Dam olish` gray · `Shubhali` amber with outline.
- Type Inter. 14px base, 13px in tables, 20px page titles, 28px KPI numbers. Mini App: 16px base, 22px titles.
- Radius 10px cards, 8px controls, 16px Mini App cards and big buttons. 1px borders instead of shadows.

### Layout (panel)
- Left sidebar 240px (collapses to 64px icons): `Bosh sahifa`, `Davomat`, `Vazifalar` (counter of submitted waiting for approval), `So'rovlar` (counter), `Xodimlar`, `Jadvallar`, `Filiallar`, `Hisobotlar`, `Ish haqi`, `Sozlamalar`. Bottom: plan mini-bar `48 / 50 xodim`, user + role (`Aziz Karimov · Egasi`). Manager role sees `Bosh sahifa`, `Davomat`, `Vazifalar`, `So'rovlar`, `Xodimlar` (own department only).
- Top bar 56px: business name `Mudom bozor ▾` (switcher), branch filter chip `Barcha filiallar ▾`, global search `Qidirish… ⌘K`, notifications bell, profile.
- Content max-width 1280px, 24px padding. Create/edit forms open in a right drawer 520px. Destructive actions in a dialog.

### Shared components (design as a system page)
Button (primary / secondary / ghost / danger; sm / md / lg), Input, Textarea with counter, Select, Phone input `+998`, Date picker and date-range (`Bugun · Kecha · Bu hafta · Bu oy`), Time input, Toggle, Segmented control, Choice chips, Search, Tabs with counts, Table (sticky header, checkbox, `⋯`), Badge, Avatar with initials + small status dot, KPI card (label, value, delta), Empty state, Drawer, Dialog, Toast, Progress bar, Star rating (1–5), File/photo drop zone, Skeleton.
Domain components: **check-in evidence card** (selfie thumb 64px, mini map with branch circle and point, distance, face match %, time, source chip), **timesheet cell** (day number + colored state + hours `8:12`, late minutes as a small amber corner), **live presence row** (avatar, name, position, `09:02 dan beri`, branch), **task card** (title, assignee avatar, due `Bugun 17:00`, priority dot, proof icons — camera/location, status badge, overdue red text `2 soat kechikdi`), **report card** (photos grid, comment, location, checklist ticks, `Qabul qilish` / `Qaytarish` + stars), **Telegram message preview** (how the bot message to the employee looks, with inline buttons).

Badge sets (color → meaning):
- Attendance day: `Ishda` green · `Kechikdi` amber · `Kelmadi` red · `Ruxsatda` blue · `Dam olish` gray · `Erta ketdi` amber.
- Check-in check: `Tasdiqlandi` green · `Shubhali` amber · `Rad etildi` red.
- Task: `Yangi` blue · `Qabul qilindi` teal · `Jarayonda` teal outline · `Tekshiruvda` amber · `Tasdiqlandi` green · `Qaytarildi` red · `Bekor qilindi` gray; plus a separate red chip `Muddati o'tdi`.
- Priority: `Shoshilinch` red dot · `O'rta` amber dot · `Oddiy` gray dot.
- Request: `Kutilmoqda` amber · `Tasdiqlandi` green · `Rad etildi` red.
- Employee: `Taklif yuborildi` gray · `Tasdiq kutmoqda` amber · `Faol` green · `O'chirilgan` gray.

### Sample data (use everywhere)
Business `Mudom bozor` — the biggest clothing store in Hazorasp. Branches: `Mudom — Markaz` (Hazorasp, radius 100 m), `Mudom — Ombor` (radius 150 m). Departments: `Sotuv zali`, `Kassa`, `Ombor`, `Ofis`. Owner `Aziz Karimov`; admin `Nilufar Yusupova`; department head `Sardor Rahimov` (Sotuv zali). Schedule `Asosiy smena 09:00–21:00`, tanaffus 60 daqiqa, kechikish chegarasi 10 daqiqa; `Kassa smenasi 2/2 08:30–22:00`. 48 xodim.
Employees: `Gulnora Saidova` (sotuvchi, Sotuv zali), `Dilshod Rahimov` (kassir), `Jasur Karimov` (omborchi), `Madina Ergasheva` (sotuvchi), `Bekzod Tursunov` (sotuvchi), `Shahnoza Allayeva` (kassir), `Ulug'bek Sobirov` (omborchi), `Feruza Qodirova` (ofis).
Today `20.10.2026, Dushanba`: `Ishda 39`, `Kechikdi 5`, `Kelmadi 3`, `Ruxsatda 1`. Suspicious: `Bekzod Tursunov — Yuz mos kelmadi: 41%, 09:14`; `Ulug'bek Sobirov — Zonadan tashqarida: 420 m, 08:58`.
Tasks: `Yangi kolleksiyani vitrinaga terish` (Gulnora, Madina, Bekzod — 3 nusxa, muddat bugun 17:00, Shoshilinch, isbot: rasm) · `Ombor inventarizatsiyasi — oyoq kiyim` (Jasur, ertaga 18:00, O'rta, rasm + checklist 3 band) · `Kassa hisobotini topshirish` (Dilshod, har kuni 21:30, takrorlanuvchi, isbot: rasm) · `Yetkazib berish — Pitnak filialiga` (Ulug'bek, bugun 15:00, isbot: lokatsiya, `Muddati o'tdi`).

### Screens for this generation

1. **Dizayn tizimi** — tokens, type scale, every component above including all domain components and every badge set.

2. **Kirish** — centered card: wordmark, `Telefon raqam` (+998 prefix), `Parol`, `Kirish`, `Parolni unutdingizmi?` link, small line `Hisobingiz yo'qmi? Ro'yxatdan o'ting`.

3. **Bosh sahifa** (desktop 1440) — header `Bugun, 20.10.2026 · Dushanba`. KPI row: `Ishda 39 / 48`, `Kechikdi 5`, `Kelmadi 3`, `Tekshiruv kutmoqda 4` (suspicious check-ins + submitted tasks), each with a delta vs. the same weekday last week. Left (wide): `Hozir ishda` live list grouped by branch, with avatar, name, position, `09:02 dan beri`, and amber rows for late arrivals (`kechikdi 7 daqiqa`). Right column: `Qaror kutmoqda` card — 2 suspicious check-ins as evidence cards with `Tasdiqlash` / `Rad etish`, 1 leave request (`Feruza Qodirova — kasallik, 20–22.10`, `Tasdiqlash` / `Rad etish`), 2 submitted tasks (`Tekshirish` link). Bottom row: `Kelmaganlar` (3 rows with phone and `Qo'ng'iroq` link, `Telegramda yozish`), `Vazifalar bugun` mini progress (`12 ta: 7 tasdiqlandi · 3 tekshiruvda · 2 muddati o'tdi`), and a 7-day stacked bar `Davomat — so'nggi 7 kun` (Ishda / Kechikdi / Kelmadi).

4. **Davomat** (desktop) — page `Davomat`, date picker (today), branch and department selects, tabs with counts `Barchasi 48 · Ishda 39 · Kechikdi 5 · Kelmadi 3 · Ruxsatda 1 · Shubhali 2`, search. Table: xodim (avatar, name, position), smena `09:00–21:00`, `Keldi` time (amber if late, with `+7 daq`), `Ketdi` time (or `—` / `Ishda`), `Ishladi` `8:12`, `Holat` badge, `Tekshiruv` badge, `⋯` (`Tuzatish`, `Profil`, `Telegramda yozish`). One row expanded inline showing two evidence cards (keldi and ketdi) side by side. Top-right buttons `Excel` and `Qo'lda belgilash`. Show the `Tuzatish` drawer in a small inset: time fields, reason textarea (required), note `O'zgarish jurnalga yoziladi`.

5. **Xodim profili — tabel** (desktop) — header with avatar, `Gulnora Saidova`, `Sotuvchi · Sotuv zali · Mudom — Markaz`, phone, Telegram `@gulnora_s`, badge `Faol`, buttons `Vazifa berish`, `⋯`. Tabs `Tabel · Vazifalar · So'rovlar · Ish haqi · Ma'lumotlar`. `Tabel` tab: month switcher `Oktabr 2026`, KPI `Ish kunlari 22 / 26`, `Kechikishlar 3 (jami 24 daq)`, `Ishlagan soat 176:40`, `Vazifalar o'z vaqtida 92%`. A calendar-grid timesheet (7 columns Du–Ya) of timesheet cells; Sundays gray `Dam olish`; one red `Kelmadi`; one blue `Ruxsatda`. Right side: `Yuz namunasi` card (3 small photo thumbs, `Yangilangan 02.10.2026`, `Qayta olish`), `Qurilma` (`iPhone 13 · bog'langan`, `Uzish`).

6. **Vazifalar** (desktop) — header `Vazifalar` with primary `+ Vazifa berish`. Tabs `Barchasi · Yangi · Jarayonda · Tekshiruvda 3 · Muddati o'tgan 1 · Tasdiqlangan`, filters (ijrochi, bo'lim, muhimlik, muddat), view toggle `Ro'yxat | Kanban`. Show the **Kanban** (columns = statuses) with task cards from the sample data; the 3-assignee task shows as a grouped card `3 ijrochi · 1/3 tasdiqlandi` with stacked avatars. Recurring task shows a small repeat icon `Har kuni`.

7. **Vazifa berish** (right drawer 520px over the Vazifalar page) — fields: `Kimga` (multi-select chips of people + quick chips `Bo'lim: Sotuv zali`, `Filial: Mudom — Markaz`; hint `Har bir xodimga alohida nusxa yaratiladi`), `Sarlavha`, `Tavsif` (textarea + attach file / voice note), `Muddat` (date + time), `Muhimlik` segmented, `Hisobot talabi` (choice chips multi: `Faqat tugma`, `Rasm`, `Video`, `Lokatsiya`), `Bosqichlar (checklist)` with `+ Band qo'shish`, `Takrorlash` toggle → `Har kuni · Hafta kunlari · Har oy` + weekday chips (collapsed by default), `Ish haqiga ta'sir` small note `Qoidalar: o'z vaqtida +20 000 so'm · kechiksa −10 000 so'm (Sozlamalar → Ish haqi)`. Below the form: **Telegram message preview** of what the employee receives (`📋 Yangi vazifa!` … with `✅ Qabul qildim` / `❓ Savol` buttons). Footer `Yuborish`.

8. **Mini App — Bosh** (mobile 390×844 inside Telegram) — greeting `Assalomu alaykum, Gulnora`, today card: smena `09:00–21:00`, branch `Mudom — Markaz`, status `Hali kelmadingiz` (or `Ishdasiz · 09:02 dan beri · 3 soat 18 daqiqa`), huge primary button `Keldim` (after check-in: `Tanaffus` secondary + `Ketdim`). Below: `Bugungi vazifalar (2)` task cards with `Bajardim` button, `Bu oy` mini stats (`Ish kunlari 14`, `Kechikish 1`), bottom tab bar `Bosh · Vazifalar · Tarix · Profil`.

9. **Mini App — Keldim (tekshiruv)** (mobile) — a 3-step flow on one artboard as 3 phone frames: (a) `Lokatsiya tekshirilmoqda…` with a map, branch circle, the user's point and result `Siz zonadasiz · 35 m` (green check) — error variant line `Zonadan tashqaridasiz: 420 m. Filialga yaqinroq boring.`; (b) camera screen with an oval face guide, hint `Yuzingizni ramkaga joylang`, liveness prompt `Boshingizni chapga burang`; (c) result `Qabul qilindi · 09:07` with `Kechikdingiz: 7 daqiqa` amber note and `Yuz mos: 94%` — and an amber variant `Qabul qilindi, rahbar tekshiradi`.

10. **Mini App — Vazifa hisoboti** (mobile) — task detail: title, from `Sardor Rahimov`, due `Bugun 17:00 · 2 soat qoldi`, priority, description, checklist with ticks, required proof chips `Rasm`, then the report form: photo slots (camera only, `Suratga olish`), comment, and big bottom button `Topshirish`. Show also a small second frame with a returned task: red banner `Qaytarildi: «Rasm aniq emas, qayta yuboring»` and button `Qayta topshirish`.

### Deliverables
The design system page first, then artboards named exactly: `Kirish`, `Bosh sahifa`, `Davomat`, `Xodim profili — tabel`, `Vazifalar`, `Vazifa berish`, `Mini App — Bosh`, `Mini App — Keldim`, `Mini App — Vazifa hisoboti`. Use the sample data above. Do not design other screens yet — they come in follow-up prompts that reuse this system (So'rovlar, Xodimlar va taklif, Jadvallar, Filiallar (xarita va radius), Hisobotlar, Ish haqi qoidalari va davr, Sozlamalar, Super admin, Bot xabarlari, Landing).

## PROMPT TUGADI
