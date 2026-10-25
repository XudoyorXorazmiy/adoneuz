# adone — Landing dizayn prompti (adone.uz)

> **«## PROMPT»** dan **«## PROMPT TUGADI»** gacha nusxalab Claude Design'ga tashlang.
> **Namuna:** egasi tanlagan Framer shabloni **Tessel** — https://tessel-template.framer.website/ . Claude Design'ga havolani bering va
> **sahifaning 4–6 ta skrinshotini ham biriktiring** (hero, raqamli bo'limlar, tariflar, footer; iloji bo'lsa mobil ko'rinish) —
> sayt ochilmasa ham uslub rasmdan olinadi.
> Birinchi generatsiya: 5 artboard (desktop 1440 — 4 qism, mobil 390 — 1 uzun). Keyingi promptlar (ro'yxatdan o'tish, tariflar sahifasi) — o'sha sessiyada, pastdagi «Keyingi promptlar».
> Eksport `design/landing/*.dc.html` ga tushadi; kod `app/sayt/` da 1:1 quriladi (panel tokenlaridan alohida, landing o'z tokenlari bilan).

---

## PROMPT

Design the marketing landing page of **adone** (adone.uz) — a SaaS for businesses in Uzbekistan to track **employee attendance and tasks through Telegram**. Employees tap «Keldim» in a Telegram Mini App; the system checks **location (inside the branch geofence), a live selfie and face match** and the device. Managers assign tasks in a web panel or the bot; employees submit a report with a photo; managers approve. Everything rolls into a monthly timesheet and payroll (late fines, task bonuses — rules the owner edits) with Excel export.

Audience: owners of shops, small factories, clinics, training centers, restaurants and multi-branch businesses in Uzbekistan, 5–200 employees. Non-technical, skeptical, mostly read on a **phone** from a Telegram or Instagram link. They currently use a paper journal, a Telegram group with "keldim" messages, or nothing. The promise: **«Kim ishda, kim kechikdi va bugun nima qilindi — telefoningizda, aniq».**

The product exists and works (pilot: Mudom bozor, a big clothing store). All features below are real — do not invent features, integrations, customer logos or numbers that are not listed here.

### Reference style — follow the attached Tessel template (screenshots + link)
Match **Tessel**: a calm, editorial, engineered SaaS page.
- **Sections numbered like chapters:** small mono label `01 — Muammo`, `02 — Qanday ishlaydi`, … above each section title. The numbering is part of the navigation feel.
- **The page sits on a visible grid:** thin hairline vertical guides (content edges and column lines) running the full page height, horizontal hairlines between sections, small `+` crosshair marks where lines meet. Content blocks snap to this grid; cards are rectangles drawn by the grid lines rather than floating shadows.
- **One accent color does all the pointing** (links, the primary button, the active step, small markers, highlighted numbers). Everything else is ink on warm off-white. **No gradients, no glow, no purple, no glassmorphism, no 3D blobs, no stock photos of smiling people.**
- Big confident headlines (tight tracking, 56–72px desktop), short paragraphs, generous whitespace, mono for labels/numbers.
- Product is shown through **real UI**: crisp phone and laptop mockups (flat, thin frame, no heavy perspective) of the actual screens described below.
- Motion (describe in notes, not required to animate): subtle reveal on scroll, the counter in the hero ticking, the check-in steps highlighting in sequence. Respect reduced motion.

### Brand
- Name **adone**, lowercase wordmark; mark = rounded square with a check mark inside a location pin (same as the product).
- **Accent: adone electric blue `#2443F5`** (hover `#1A34D6`, tint `#EEF1FF`) — the single pointing color, used the way Tessel uses its orange. Ink `#0B1B4F` (navy) for headlines, body `#111827`, muted `#6B7280`, hairlines `#E4E2DC`, background **warm off-white `#F6F5F1`**, surfaces white `#FFFFFF`. Status colors only inside product mockups: green `#16A34A`, amber `#F07A1A`, red `#E5484D`.
- Type: **Plus Jakarta Sans** (headlines 700, body 400/500) + a mono (**JetBrains Mono** or **IBM Plex Mono**) for chapter labels, numbers, small captions.
- Radius small and architectural: 8px buttons/inputs, 12px mockup screens, 0px for grid cells. Pill only for small status chips inside mockups.

### Language and formats
All copy in **Uzbek (Latin)** exactly as written below (it is final copy, keep it). Technical words allowed: Telegram, Mini App, Excel, GPS. Money `149 000 so'm`, phone `+998 90 123 45 67`, time `09:07`, date `25.10.2026`.

### Page structure (desktop 1440, split into 4 artboards: A, B, C, D)

**Header (sticky, thin hairline under it)** — wordmark left; links `Imkoniyatlar` · `Qanday ishlaydi` · `Tariflar` · `Savollar`; right: text link `Kirish` and primary button `Bepul sinash`.

**A1. Hero**
- Chapter label: `00 — adone.uz`
- Headline: **«Kim ishda, kim kechikdi — telefoningizda.»**
- Sub: «Xodimlar Telegram orqali «Keldim» bosadi. adone joylashuvni, jonli selfini va yuzni tekshiradi — siz esa kim qayerda ekanini, kim kechikkanini va bugun nima qilinganini bir qarashda ko'rasiz.»
- Buttons: primary `Bepul sinash — 14 kun`, secondary (outline) `Demo ko'rish`. Under them, mono caption: `Karta kerak emas · 10 daqiqada ulanadi · Telegram yetarli`.
- Visual on the right, inside grid cells: a **phone mockup of the Mini App** check-in result (big green circle `✓ Keldingiz 08:57`, rows `Joylashuv: filial ichida · 35 m`, `Yuz mos: 94%`, `Qurilma: tasdiqlangan`) overlapping a **laptop mockup of the panel** home (`Ishda 39 / 48`, `Kechikdi 5`, `Kelmadi 4`, live list with avatars). A small mono counter strip under the visuals: `Bugun 08:00 dan beri · 39 kishi keldi · 5 kechikdi`.

**A2. 01 — Muammo**
- Title: **«Jurnal yolg'on gapiradi. Telegram guruh ham.»**
- 3 grid cells, each: mono number, short bold line, one sentence:
  1. `«Keldim» deb yozish oson` — «Guruhga xabarni uydan ham yozish mumkin. Kim haqiqatan ishda — noma'lum.»
  2. `Vazifa og'zaki beriladi` — «Kim nima qildi, qachon tugatdi — hech qayerda yozilmaydi, oy oxirida bahs.»
  3. `Tabel qo'lda yuritiladi` — «Oy oxirida kechikishlar va jarimalarni sanash uchun bir kun ketadi.»

**B1. 02 — Qanday ishlaydi**
- Title: **«Uch qadam. Xodim uchun — bitta tugma.»**
- Horizontal 3-step timeline on the grid, each step with a small phone/laptop crop:
  1. `Xodim «Keldim» bosadi` — «Telegram'dagi Mini App'da. Alohida ilova o'rnatish shart emas.» (crop: Mini App home with big `Keldim` circle)
  2. `adone tekshiradi` — «GPS — filial hududida; jonli selfi — galereyadan emas; yuz — namunaga mos; qurilma — xodimniki. Shubhali bo'lsa — rahbarga.» (crop: check-in evidence card: selfie thumb, mini map with branch circle, `35 m`, `Yuz mos: 94%`)
  3. `Rahbar hammasini ko'radi` — «Panelda jonli ro'yxat, kechikkanlar va kelmaganlar. Har kuni 10:00 da Telegram'ga qisqa hisobot.» (crop: Telegram message `Kelmaganlar: 2 · Kechikkanlar: 3`)

**B2. 03 — Imkoniyatlar**
- Title: **«Davomatdan ish haqigacha — bitta tizimda.»**
- A grid of 6 feature cells (2 rows × 3), each: mono index `03.1`…, title, 1–2 lines, a tiny UI fragment:
  1. `Davomat` — «Geofence, jonli selfi va yuz tekshiruvi. Tanaffus, tungi smena, avto-yopish.» (fragment: status chips `Ishda` `Kechikdi` `Kelmadi` `Ruxsatda`)
  2. `Vazifalar` — «Bir yoki bir nechta xodimga, muddat va isbot bilan: rasm, video, joylashuv. Tasdiq yoki qaytarish, baho 1–5.» (fragment: task card `Vitrinani yangilash · Bugun 17:00 · 📷`)
  3. `O'zi qo'shgan ishlar` — «Xodim qilgan ishini o'zi yozadi — kun bo'yicha ish jurnali.» (fragment: journal rows with times)
  4. `Ruxsat so'rovlari` — «Kasal, ta'til, shaxsiy ish — botda so'raladi, bir tugma bilan tasdiqlanadi.» (fragment: request row with `Tasdiqlash` / `Rad etish`)
  5. `Oylik tabel` — «Har kun rangli katakda: ishlagan soat, kechikish daqiqasi. Excel'ga bir bosishda.» (fragment: mini timesheet grid)
  6. `Ish haqi` — «Kechikish jarimasi, qo'shimcha soat va vazifa bonusi — qoidalarni o'zingiz belgilaysiz. Oyni yopasiz — hisob o'zgarmaydi.» (fragment: payroll row `Asosiy 4 500 000 · Jarima −60 000 · Bonus +90 000 · Jami 4 530 000 so'm`)

**C1. 04 — Aldab bo'lmaydi** (the anti-fraud section; visually the strongest, one large cell)
- Title: **«Uydan «keldim» deb bo'lmaydi.»**
- Left: 4 rows with a mono marker and an accent check:
  - `Boshqa joydan` — «Filial radiusidan tashqarida «Keldim» qabul qilinmaydi. Xaritadan tanlangan yoki forward qilingan joylashuv — rad.»
  - `Boshqa odam` — «Selfi xodimning yuz namunasi bilan solishtiriladi. Mos kelmasa — rahbarga «Shubhali».»
  - `Eski rasm` — «Faqat jonli kamera, galereya yo'q. Bosh burilishi tekshiriladi.»
  - `Boshqa telefon` — «Birinchi «Keldim» qurilmani bog'laydi. Boshqa telefondan — shubhali.»
- Right: a large evidence card mockup: selfie, mini map (branch circle + point outside, amber), `Zonadan tashqarida: 420 m`, badge `Rad etildi`; and a second smaller card `Yuz mos kelmadi: 41%` · `Shubhali` with buttons `Tasdiqlash` / `Rad etish`.
- Small mono note under: «Yuz namunasi faqat xodim roziligi bilan olinadi. Xodim o'chirilsa — biometrik ma'lumot ham o'chiriladi.»

**C2. 05 — Kimlar uchun**
- Title: **«Xodimi bor har qanday biznesga.»**
- A row of 6 grid cells with a line icon + name + one-line use case: `Do'konlar` (smenali sotuvchilar), `Ishlab chiqarish` (sex, navbatchilik), `Klinikalar` (shifokor va hamshiralar jadvali), `O'quv markazlar` (o'qituvchilar darsga kelishi), `Restoran va kafe` (oshxona va zal), `Ko'p filialli biznes` (har filial — o'z radiusi).
- **Pilot strip** (one wide cell, no fake logos): mono label `PILOT`, text «Mudom bozor — Hazoraspdagi eng katta kiyim do'koni — adone'ni birinchi bo'lib ishlatmoqda.» (leave space for a real quote later; mark it as placeholder in a note, do not write an invented quote).

**D1. 06 — Tariflar**
- Title: **«Xodimlar soniga qarab. 14 kun bepul.»**
- Monthly / yearly toggle (`Oylik` / `Yillik −20%`).
- 3 plan columns drawn by grid lines (the middle one marked with an accent top border and mono tag `Ko'p tanlanadi`). **Prices are draft placeholders — show them, the owner will change:**
  - `Start` — `99 000 so'm / oy` — «15 xodimgacha · 1 filial · davomat, vazifalar, tabel, Excel»
  - `Biznes` — `249 000 so'm / oy` — «50 xodimgacha · 5 filial · + yuz tekshiruvi, ish haqi, ruxsat so'rovlari»
  - `Korporativ` — `Kelishiladi` — «50+ xodim · cheksiz filial · alohida bot, o'rgatish, ustuvor yordam»
- Each column: feature list with check marks, button (`Bepul sinash`; for Korporativ — `Bog'lanish`). Under the table, mono caption: `To'lov: Click, Payme yoki bank o'tkazmasi · Narxlar QQS bilan`.

**D2. 07 — Savollar (FAQ)** — accordion in a 2-column grid (question left column, answer opens below), 6 items:
1. «Xodimlarga alohida ilova kerakmi?» — «Yo'q. Hammasi Telegram ichida: bot va Mini App. Smartfon va internet yetarli.»
2. «Xodimning telefonida GPS ishlamasa-chi?» — «Joylashuv aniq bo'lmasa adone qayta urinishni so'raydi; baribir bo'lmasa — rahbar panelda qo'lda belgilaydi, sabab yoziladi.»
3. «Yuz ma'lumotlari qayerda saqlanadi?» — «Faqat sizning ishxonangiz uchun, shifrlangan serverda. Boshqa kompaniyaga ko'rinmaydi, xodim o'chirilsa o'chiriladi.»
4. «Smenali va tungi ish bo'lsa?» — «Haftalik, 2/2 kabi navbatli va erkin jadval bor. Tungi smena ertasi kunga o'tsa ham to'g'ri hisoblanadi.»
5. «Ish haqini adone to'laydimi?» — «Yo'q, adone hisoblaydi: asosiy, jarima, bonus. Natijani Excel'da olasiz va o'zingiz to'laysiz.»
6. «Qanday boshlayman?» — «Ro'yxatdan o'ting, filial manzilini kiriting va xodimlarga taklif havolasini yuboring. Odatda 10 daqiqa.»

**D3. Final CTA** — a full-width grid cell with large headline **«Ertaga ertalab kim kelganini aniq biling.»**, short form inline: `Ismingiz`, `Telefon +998`, `Xodimlar soni` (select: `1–15`, `16–50`, `51–200`, `200+`), button `Ariza qoldirish`; secondary text link `yoki Telegram'da yozing →`. Note under: «Ariza qoldirsangiz, 1 ish kunida qo'ng'iroq qilamiz.»

**D4. Footer** — on the grid: wordmark + one line «Xodimlar davomati va vazifalari — Telegram orqali.»; columns `Mahsulot` (Imkoniyatlar, Tariflar, Mini App, Kirish), `Kompaniya` (Biz haqimizda, Aloqa), `Huquqiy` (Maxfiylik siyosati, Foydalanish shartlari, Biometrik ma'lumotlar); contact `+998 __ ___ __ __` and `@adoneuz_bot` (placeholders); bottom mono line `© 2026 adone.uz · Toshkent`.

### Mobile (artboard E — 390 wide, one long frame)
The same page stacked: header collapses to wordmark + `Bepul sinash` + menu icon (show the opened menu as a small inset). Grid guides remain as two side lines (16px gutter) and section hairlines. Hero: headline 36–40px, the phone mockup full width under the buttons (no laptop). Feature grid → 1 column; steps → vertical timeline; pricing → stacked columns (middle plan first); FAQ single column. Tap targets ≥44px. No horizontal scroll anywhere.

### States and details to include
- Hover state for buttons and nav links (accent underline), focus ring (2px accent).
- The FAQ item opened and closed.
- Form: error state for phone (`Telefon raqam noto'g'ri`) and success state (`Rahmat! Tez orada bog'lanamiz.`).
- Pricing toggle in both states (or note the yearly prices: `79 000` / `199 000 so'm / oy`, «yiliga to'lansa»).

### Deliverables
Artboards: **A** (header + hero + 01), **B** (02 + 03), **C** (04 + 05), **D** (06 + 07 + final CTA + footer) — all 1440 wide; **E** mobile 390. Plus a small **style sheet** frame: color tokens (named by role: `bg`, `surface`, `ink`, `body`, `muted`, `line`, `accent`, `accent-hover`, `accent-tint`), type scale (display / h2 / h3 / body / small / mono), buttons, chapter label, grid spec (columns, gutter, guide line color and width, crosshair mark).

## PROMPT TUGADI

---

## Keyingi promptlar (o'sha sessiyada, bittalab)

1. **Ro'yxatdan o'tish** (`app.adone.uz/royxat`, desktop + mobil): «Ishxona nomi», «Ismingiz», «Telefon +998», «Parol», «Xodimlar soni» → `Boshlash`; o'ng tomonda 3 qadam («Filial manzilini kiriting → Jadval tanlang → Xodimlarga havola yuboring») va «14 kun bepul, karta kerak emas». Xuddi shu landing uslubida (to'r, bob raqami yo'q).
2. **Tariflar sahifasi** (`/tariflar`): to'liq solishtirish jadvali (funksiya × tarif), FAQ to'lov haqida, «Yillik» hisobi.
3. **Maxfiylik va biometrik ma'lumotlar** sahifasi shabloni (matnli sahifa: chap tomonda mundarija, o'ngda matn).
