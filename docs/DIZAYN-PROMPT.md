# adone — Dizayn prompti (ishxona paneli + xodim Mini App)

> **«## PROMPT»** dan **«## PROMPT TUGADI»** gacha nusxalab Claude Design'ga tashlang.
> **Prompt bilan birga egasi yoqtirgan namuna rasmni (Relink dashboard) ham Claude Design'ga biriktiring** — uslub shu rasmga mos chiziladi.
> Birinchi generatsiya: dizayn tizimi + kirish + bosh sahifa + davomat + xodim tabeli + vazifalar + vazifa paneli + Mini App (3 mobil ekran) — 10 artboard. Bitta promptga 15+ ekran sig'maydi (talimtizim tajribasi) — qolganlari (`DIZAYN-NEXT-PROMPTS.md`, keyin yoziladi) **o'sha sessiyada** bittalab.
> Eksportlar `design/panel/*.dc.html` ga tushadi; kod dizayndan 1:1 quriladi (avval `globals.css` tokenlari dizaynga moslanadi).

---

## PROMPT

Design the working interface of **adone** (adone.uz) — a SaaS for businesses in Uzbekistan to track **employee attendance and tasks through Telegram**. Employees check in and out from a Telegram Mini App: the system verifies **location (inside the branch geofence), a live selfie and face match**. Managers assign tasks; employees submit a report with a photo; managers approve or send back. Everything rolls up into a monthly timesheet, KPI and payroll (late fines and task bonuses by editable rules). Users: shop and office owners, admins and department heads — non-technical, on 13–15" laptops and often on a phone; employees use only the phone (Mini App inside Telegram). The promise: *you know who is at work right now and what they did today.*

The product is being built (Next.js). Screens, labels and data below are real, not invented — the design will be implemented 1:1, so use the exact labels.

### Language and formats
All UI copy in **Uzbek (Latin)**. No Russian or English words except technical ones (Telegram, Mini App, Excel, PDF, GPS, QR, Click, Payme). Money `4 500 000 so'm`. Dates `19.10.2026`, weekday `Dushanba`, time `09:07`. Durations `8 soat 12 daqiqa`, `kechikdi 7 daqiqa`. Distance `35 m`. Phone `+998 90 123 45 67`. Tabular numbers wherever numbers align.

### Design principles
1. **"Right now" first.** The home screen answers in 3 seconds: how many are at work, who is late, who is absent, what needs my decision.
2. **Proof is visible, never hidden.** Every check-in row can expand to its evidence: selfie thumbnail, small map with the branch circle and the point, distance `35 m`, face match `Yuz mos: 94%`, source `Mini App` / `Bot`. Suspicious ones are amber with the reason (`Yuz mos kelmadi: 41%`, `Zonadan tashqarida: 420 m`, `GPS aniqligi past`).
3. **One page skeleton:** page header (title, count, primary button) → 3–4 KPI cards → filter row (date picker, branch, department, tabs with counts, search) → content card. Every number links to the filtered list behind it.
4. **Decisions in one click.** Approve / reject buttons sit on the row itself (leave requests, suspicious check-ins, submitted tasks). Reject and send-back always ask for a reason.
5. **Stateful.** Every list has empty, loading (skeleton) and error states. Empty state = one sentence + the primary action, no illustration.
6. **Mobile is first-class.** The panel works at 390px (a manager on the phone); the Mini App is designed for 390×844 inside Telegram (Telegram header on top, our MainButton-style big bottom button).
7. Light theme for v1; tokens must make a dark theme trivial later (Mini App follows Telegram's theme).

### Visual style — IMPORTANT (follow the attached reference screenshot)
The owner rejected a flat, bordered, "admin template" look. Match the attached reference dashboard (a logistics SaaS called «Relink»): **airy, soft, premium, rounded, white cards floating on a light gray canvas**. Concretely:
- **App frame:** the whole app sits in one big white container with **24px radius** and a very soft shadow, on a light gray canvas `#EEF0F4` with 16px margin. Inside, sidebar and content share the white surface; content area background `#F7F8FA`, cards are pure white.
- **Cards:** white, **radius 20px**, no visible border (or `#EEF0F3` hairline), shadow `0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.04)`, padding 20–24px, generous gaps (20px).
- **Card header pattern:** a 32px **tinted rounded square with an icon** (primary tint background, primary icon) + card title 16px semibold, right side: a pill selector (e.g. `Oktabr 2026 ▾` with a calendar icon) and a **round `⋯` button** (36px circle, light gray border).
- **Inline KPIs inside cards:** `Jami xodim: 48` `Ishda: 39` `Kechikdi: 5` — label muted, value bold, followed by a **small delta chip** (`↗ 2.46%` green tint / `↘ 1.78%` red-orange tint, 11px, radius 6px).
- **Charts:** bars are **rounded pills**, light gray `#E9EBF0`, the current/selected bar in **solid primary**; a **dashed average line** with a small dark label chip (`O'rtacha 41`); grid lines very faint. Vertical progress pills (rounded track gray, fill primary) for percentages, value written vertically inside the bar.
- **Day picker pills:** a row of 7 tall rounded pills (`Du 13`, `Se 14` …), selected days filled primary/dark navy with a white dot under the number, others white with light border.
- **Lists inside cards:** colored dot + bold value + muted label + delta chip on the right (like «2 hours 15m · On the way · ↗1.22%»).
- **Tables:** no zebra, no vertical lines, thin row dividers, header muted 12px, first column bold monospace-like ID or name, **status chips** with icon (green `Ishda ✓`, orange `Kechikdi ⏳`, red `Kelmadi`), search input with icon + `Filtrlar` button with a filter icon above the table.
- **Buttons:** primary is a **pill** (fully rounded, 44px high) in solid primary with a `+` icon, e.g. `+ Vazifa berish`; secondary buttons are white pills with a light border; icon buttons are 40px circles.
- **Header:** left — greeting `Salom, Aziz` (14px muted) and `Xayrli tong!` (28px semibold); right — round icon buttons (bell with a red dot, search) and a **user chip** (avatar, name, email/phone, chevron).
- **Notice line** under the header: small red-orange circle icon + `4 ta qaror kutmoqda — ko'rish ↗` link.
- Typography **Inter** (or Plus Jakarta Sans), tight letter-spacing on big numbers (`-0.02em`), numbers large and bold (28–32px) in KPI cards.

### Brand
- Name **adone**, lowercase wordmark in a rounded geometric sans; the "a" may contain a subtle check mark. Monogram: rounded square with a check mark inside a location pin.
- Primary **electric blue `#2443F5`** (hover `#1A34D6`, tint `#EEF1FF`, soft `#F5F7FF`), secondary accent dark navy `#0B1B4F` (selected day pills, chart labels). Success `#16A34A` (tint `#E8F7EE`), warning `#F07A1A` (tint `#FFF1E6`), danger `#E5484D` (tint `#FDECEC`), info = primary. Neutrals: text `#111827`, muted `#6B7280`, faint `#9CA3AF`, border `#ECEEF2`, canvas `#EEF0F4`, content bg `#F7F8FA`, card `#FFFFFF`.
- Attendance colors (dots, chips, timesheet cells — never large fills): `Ishda` green · `Kechikdi` amber · `Kelmadi` red · `Ruxsatda` blue · `Dam olish` gray · `Shubhali` amber with outline.
- Type Inter. 14px base, 13px in tables, 28px greeting/page titles, 28–32px KPI numbers. Mini App: 16px base, 24px titles.
- Radius: app frame 24px, cards 20px, inputs 12px, buttons and chips fully rounded (pill), icon buttons circles. Soft shadows (see Visual style), almost no borders.

### Layout (panel)
- Left sidebar 248px, **white (not dark)**, inside the app frame: top — wordmark `adone` with a small blue mark + a collapse icon button; under it a **company switcher card** (rounded 14px, light gray bg: company logo/avatar, tiny label `Ishxona`, name `Mudom bozor`, up-down chevron); small caps label `MENYU`; items with outline icons 20px, active item = **light gray rounded pill** (`#F2F4F7`) with primary icon, bold text and a `›` chevron on the right; counters as small blue pills. Items: `Bosh sahifa`, `Davomat`, `Vazifalar` (counter of submitted waiting for approval), `So'rovlar` (counter), `Xodimlar`, `Jadvallar`, `Filiallar`, `Hisobotlar`, `Ish haqi`, `Sozlamalar`. Bottom: plan mini-card `48 / 50 xodim` with a thin progress bar, then the user row (avatar photo, `Aziz Karimov`, phone in muted, small square `›` button). Manager role sees `Bosh sahifa`, `Davomat`, `Vazifalar`, `So'rovlar`, `Xodimlar` (own department only).
- No classic top bar: the **content header** is the greeting / page title on the left and round icon buttons (bell, search `⌘K`), branch filter pill `Barcha filiallar ▾` and the user chip on the right, separated from content by a faint line.
- Content padding 28px, card gaps 20px, layout as a **bento grid** (wide chart card + narrow side card on top row, wide table + narrow chart card below). Create/edit forms open in a right drawer 520px (rounded 24px on the left edge). Destructive actions in a dialog.

### Shared components (design as a system page)
Button (primary / secondary / ghost / danger; sm / md / lg), Input, Textarea with counter, Select, Phone input `+998`, Date picker and date-range (`Bugun · Kecha · Bu hafta · Bu oy`), Time input, Toggle, Segmented control, Choice chips, Search, Tabs with counts, Table (sticky header, checkbox, `⋯`), Badge, Avatar with initials + small status dot, KPI card (label, value, delta), Empty state, Drawer, Dialog, Toast, Progress bar, Star rating (1–5), File/photo drop zone, Skeleton.
Domain components: **check-in evidence card** (selfie thumb 64px, mini map with branch circle and point, distance, face match %, time, source chip), **timesheet cell** (day number + colored state + hours `8:12`, late minutes as a small amber corner), **live presence row** (avatar, name, position, `09:02 dan beri`, branch), **task card** (title, assignee avatar, due `Bugun 17:00`, priority dot, proof icons — camera/location, status badge, overdue red text `2 soat kechikdi`), **report card** (photos grid, comment, location, checklist ticks, `Qabul qilish` / `Qaytarish` + stars), **Telegram message preview** (how the bot message to the employee looks, with inline buttons).

Badge sets (color → meaning):
- Attendance day: `Ishda` green · `Kechikdi` amber · `Kelmadi` red · `Ruxsatda` blue · `Dam olish` gray · `Erta ketdi` amber.
- Check-in check: `Tasdiqlandi` green · `Shubhali` amber · `Rad etildi` red.
- Task: `Yangi` blue · `Qabul qilindi` navy · `Jarayonda` blue outline · `Tekshiruvda` amber · `Tasdiqlandi` green · `Qaytarildi` red · `Bekor qilindi` gray; plus a separate red chip `Muddati o'tdi`.
- Priority: `Shoshilinch` red dot · `O'rta` amber dot · `Oddiy` gray dot.
- Request: `Kutilmoqda` amber · `Tasdiqlandi` green · `Rad etildi` red.
- Employee: `Taklif yuborildi` gray · `Tasdiq kutmoqda` amber · `Faol` green · `O'chirilgan` gray.

### Sample data (use everywhere)
Business `Mudom bozor` — the biggest clothing store in Hazorasp. Branches: `Mudom — Markaz` (Hazorasp, radius 100 m), `Mudom — Ombor` (radius 150 m). Departments: `Sotuv zali`, `Kassa`, `Ombor`, `Ofis`. Owner `Aziz Karimov`; admin `Nilufar Yusupova`; department head `Sardor Rahimov` (Sotuv zali). Schedule `Asosiy smena 09:00–21:00`, tanaffus 60 daqiqa, kechikish chegarasi 10 daqiqa; `Kassa smenasi 2/2 08:30–22:00`. 48 xodim.
Employees: `Gulnora Saidova` (sotuvchi, Sotuv zali), `Dilshod Rahimov` (kassir), `Jasur Karimov` (omborchi), `Madina Ergasheva` (sotuvchi), `Bekzod Tursunov` (sotuvchi), `Shahnoza Allayeva` (kassir), `Ulug'bek Sobirov` (omborchi), `Feruza Qodirova` (ofis).
Today `19.10.2026, Dushanba`: `Ishda 39`, `Kechikdi 5`, `Kelmadi 3`, `Ruxsatda 1`. Suspicious: `Bekzod Tursunov — Yuz mos kelmadi: 41%, 09:14`; `Ulug'bek Sobirov — Zonadan tashqarida: 420 m, 08:58`.
Tasks: `Yangi kolleksiyani vitrinaga terish` (Gulnora, Madina, Bekzod — 3 nusxa, muddat bugun 17:00, Shoshilinch, isbot: rasm) · `Ombor inventarizatsiyasi — oyoq kiyim` (Jasur, ertaga 18:00, O'rta, rasm + checklist 3 band) · `Kassa hisobotini topshirish` (Dilshod, har kuni 21:30, takrorlanuvchi, isbot: rasm) · `Yetkazib berish — Pitnak filialiga` (Ulug'bek, bugun 15:00, isbot: lokatsiya, `Muddati o'tdi`).

### Screens for this generation

1. **Dizayn tizimi** — tokens, type scale, every component above including all domain components and every badge set.

2. **Kirish** — centered card: wordmark, `Telefon raqam` (+998 prefix), `Parol`, `Kirish`, `Parolni unutdingizmi?` link, small line `Hisobingiz yo'qmi? Ro'yxatdan o'ting`.

3. **Bosh sahifa** (desktop 1440, bento layout exactly like the reference) — header: `Salom, Aziz` / `Xayrli tong!`; right: bell, search, branch pill, user chip. Notice line: red-orange dot `4 ta qaror kutmoqda — ko'rish ↗`, and on the right a round icon button (Excel download) + primary pill `+ Vazifa berish`.
   - **Top-left wide card `Davomat tahlili`** (icon: bar chart): pill selector `Oktabr 2026 ▾`, `⋯`. Inline KPIs: `Jami xodim: 48`, `Bugun ishda: 39 ↗ 4.2%`, `Kechikdi: 5 ↘ 1.8%`. Bar chart of daily attendance for the month (gray pill bars, today's bar solid blue, dashed average line labelled `O'rtacha 41`), x-axis days.
   - **Top-right narrow card `O'rtacha ish vaqti`** (icon: clock): big `8 soat 12 daq`, delta chip, caption `Bu hafta`; week **day pills** `Du 19 · Se 20 · Ch 21 · Pa 22 · Ju 23 · Sh 24 · Ya 25` (today navy filled, workdays light blue, Sunday gray); list with colored dots: `● 39  Ishda  ↗1.2%`, `● 5  Kechikdi  ↗0.8%`, `● 3  Kelmadi  ↘2.1%`; ghost pill button `Batafsil ↗`.
   - **Bottom-left wide card `Hozir ishda`** (icon: user-check): search input + `Filtrlar` button; table columns `Xodim` (avatar + bold name), `Lavozim`, `Filial`, `Keldi` (`09:02`), `Ishladi` (`3:18`), `Isbot` (tiny icons: location ✓, video ✓, face `94%`), `Holat` chip (`Ishda ✓` green, `Kechikdi ⏳ 7 daq` orange, `Shubhali` orange outline). 6 rows from sample data.
   - **Bottom-right narrow card `Vazifalar bajarilishi`** (icon: check-square): big `82%` + delta chip, caption `Bu oy o'z vaqtida bajarilgan`; 4 vertical progress pills by department (`Sotuv 92%`, `Kassa 76%`, `Ombor 69%` — highlighted solid blue, `Ofis 88%`), small footnote `O'tgan oydan 6% yuqori`.
   - Under the bento (scroll): `Qaror kutmoqda` card — 2 suspicious check-in evidence cards (selfie thumb, mini map, `Zonadan tashqarida: 420 m` / `Yuz mos kelmadi: 41%`, pill buttons `Tasdiqlash` / `Rad etish`), 1 leave request, 2 submitted tasks.

4. **Davomat** (desktop) — page `Davomat`, date picker (today), branch and department selects, tabs with counts `Barchasi 48 · Ishda 39 · Kechikdi 5 · Kelmadi 3 · Ruxsatda 1 · Shubhali 2`, search. Table: xodim (avatar, name, position), smena `09:00–21:00`, `Keldi` time (amber if late, with `+7 daq`), `Ketdi` time (or `—` / `Ishda`), `Ishladi` `8:12`, `Holat` badge, `Tekshiruv` badge, `⋯` (`Tuzatish`, `Profil`, `Telegramda yozish`). One row expanded inline showing two evidence cards (keldi and ketdi) side by side. Top-right buttons `Excel` and `Qo'lda belgilash`. Show the `Tuzatish` drawer in a small inset: time fields, reason textarea (required), note `O'zgarish jurnalga yoziladi`.

5. **Xodim profili — tabel** (desktop) — header with avatar, `Gulnora Saidova`, `Sotuvchi · Sotuv zali · Mudom — Markaz`, phone, Telegram `@gulnora_s`, badge `Faol`, buttons `Vazifa berish`, `⋯`. Tabs `Tabel · Vazifalar · So'rovlar · Ish haqi · Ma'lumotlar`. `Tabel` tab: month switcher `Oktabr 2026`, KPI `Ish kunlari 22 / 26`, `Kechikishlar 3 (jami 24 daq)`, `Ishlagan soat 176:40`, `Vazifalar o'z vaqtida 92%`. A calendar-grid timesheet (7 columns Du–Ya) of timesheet cells; Sundays gray `Dam olish`; one red `Kelmadi`; one blue `Ruxsatda`. Right side: `Yuz namunasi` card (3 small photo thumbs, `Yangilangan 02.10.2026`, `Qayta olish`), `Qurilma` (`iPhone 13 · bog'langan`, `Uzish`).

6. **Vazifalar** (desktop) — header `Vazifalar` with primary `+ Vazifa berish`. Tabs `Barchasi · Yangi · Jarayonda · Tekshiruvda 3 · Muddati o'tgan 1 · Tasdiqlangan`, filters (ijrochi, bo'lim, muhimlik, muddat), view toggle `Ro'yxat | Kanban`. Show the **Kanban** (columns = statuses) with task cards from the sample data; the 3-assignee task shows as a grouped card `3 ijrochi · 1/3 tasdiqlandi` with stacked avatars. Recurring task shows a small repeat icon `Har kuni`. Second header button `+ Ish qo'shish` (secondary). Source tabs above the status tabs: `Berilgan · O'zi qo'shgan 6 · Mening ishlarim`. Self-reported work cards carry a small chip `O'zi qo'shdi` and the time spent (`1 soat 30 daq`), e.g. `Vitrinadagi narxlarni yangiladim — Madina Ergasheva · Tekshiruvda`, `Yangi kelgan 40 ta tovarni qabul qildim — Jasur Karimov · 2 soat · Tasdiqlandi`.

7. **Vazifa berish** (right drawer 520px over the Vazifalar page) — fields: `Kimga` (multi-select chips of people + quick chips `Bo'lim: Sotuv zali`, `Filial: Mudom — Markaz`; hint `Har bir xodimga alohida nusxa yaratiladi`), `Sarlavha`, `Tavsif` (textarea + attach file / voice note), `Muddat` (date + time), `Muhimlik` segmented, `Hisobot talabi` (choice chips multi: `Faqat tugma`, `Rasm`, `Video`, `Lokatsiya`), `Bosqichlar (checklist)` with `+ Band qo'shish`, `Takrorlash` toggle → `Har kuni · Hafta kunlari · Har oy` + weekday chips (collapsed by default), `Ish haqiga ta'sir` small note `Qoidalar: o'z vaqtida +20 000 so'm · kechiksa −10 000 so'm (Sozlamalar → Ish haqi)`. Below the form: **Telegram message preview** of what the employee receives (`📋 Yangi vazifa!` … with `✅ Qabul qildim` / `❓ Savol` buttons). Footer `Yuborish`.

8. **Mini App — Bosh** (mobile 390×844 inside Telegram) — greeting `Assalomu alaykum, Gulnora`, today card: smena `09:00–21:00`, branch `Mudom — Markaz`, status `Hali kelmadingiz` (or `Ishdasiz · 09:02 dan beri · 3 soat 18 daqiqa`), huge primary button `Keldim` (after check-in: `Tanaffus` secondary + `Ketdim`). Below: `Bugungi vazifalar (2)` task cards with `Bajardim` button and a secondary button `+ Ish qo'shish` (log work I did or plan to do), `Bu oy` mini stats (`Ish kunlari 14`, `Kechikish 1`), bottom tab bar `Bosh · Vazifalar · Tarix · Profil`.

9. **Mini App — Keldim (tekshiruv)** (mobile) — a 3-step flow on one artboard as 3 phone frames: (a) `Lokatsiya tekshirilmoqda…` with a map, branch circle, the user's point and result `Siz zonadasiz · 35 m` (green check) — error variant line `Zonadan tashqaridasiz: 420 m. Filialga yaqinroq boring.`; (b) camera screen with an oval face guide, hint `Yuzingizni ramkaga joylang`, liveness prompt `Boshingizni chapga burang`; (c) result `Qabul qilindi · 09:07` with `Kechikdingiz: 7 daqiqa` amber note and `Yuz mos: 94%` — and an amber variant `Qabul qilindi, rahbar tekshiradi`.

10. **Mini App — Vazifa hisoboti** (mobile) — task detail: title, from `Sardor Rahimov`, due `Bugun 17:00 · 2 soat qoldi`, priority, description, checklist with ticks, required proof chips `Rasm`, then the report form: photo slots (camera only, `Suratga olish`), comment, and big bottom button `Topshirish`. Show also a small second frame with a returned task: red banner `Qaytarildi: «Rasm aniq emas, qayta yuboring»` and button `Qayta topshirish`. Third frame **`Ish qo'shish`**: segmented `Bajardim | Rejalashtiraman`, `Nima qildingiz?` input, category chips (`Savdo`, `Ombor`, `Tozalash`, `Boshqa`), `Sarflangan vaqt` quick chips (`15 daq`, `30 daq`, `1 soat`, `2 soat`, `Boshqa`), photo slot, comment, bottom button `Saqlash`; note `Rahbaringiz tasdiqlaydi`.

### Deliverables
The design system page first, then artboards named exactly: `Kirish`, `Bosh sahifa`, `Davomat`, `Xodim profili — tabel`, `Vazifalar`, `Vazifa berish`, `Mini App — Bosh`, `Mini App — Keldim`, `Mini App — Vazifa hisoboti`. Use the sample data above. Do not design other screens yet — they come in follow-up prompts that reuse this system (So'rovlar, Xodimlar va taklif, Jadvallar, Filiallar (xarita va radius), Hisobotlar, Ish haqi qoidalari va davr, Sozlamalar, Super admin, Bot xabarlari, Landing).

## PROMPT TUGADI
