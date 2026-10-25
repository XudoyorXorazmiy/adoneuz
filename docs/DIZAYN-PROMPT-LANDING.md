# adone — Landing dizayn prompti (adone.uz)

> **«## PROMPT»** dan **«## PROMPT TUGADI»** gacha nusxalab Claude Design'ga tashlang.
> **Namuna:** Framer shabloni **Tessel** — https://tessel-template.framer.website/ . Uslub o'lchovlari Claude in Chrome auditidan
> (25.10.2026, 1440 va 390 px) — quyida aniq qiymatlar bilan. Claude Design'ga havolani bering va mumkin bo'lsa skrinshotlarini ham biriktiring.
> Egasining skrinshotlari (7 ta: hero, 01–02, 03, 08, 09–10, footer, mobil hero) — prompt bilan birga Claude Design'ga biriktiring.
> Birinchi generatsiya: 6 artboard (desktop 1440 — 5 qism, mobil 390 — 1 uzun). Keyingi promptlar pastda.
> Eksport `design/landing/*.dc.html`; kod `app/sayt/` da 1:1 (landing tokenlari panel tokenlaridan alohida).

---

## PROMPT

Design the marketing landing page of **adone** (adone.uz) — a SaaS for businesses in Uzbekistan to track **employee attendance and tasks through Telegram**. Employees tap «Keldim» in a Telegram Mini App; adone checks four things on the server: **GPS inside the branch geofence, a live selfie (camera only, no gallery), face match with the employee's sample, and the employee's own phone**. Managers assign tasks in a web panel or the bot; employees submit a report with a photo; managers approve. Everything rolls into a monthly timesheet and payroll (late fines, overtime, task bonuses — rules the owner edits) with Excel export.

Audience: owners of shops, small factories, clinics, training centers, restaurants and multi-branch businesses in Uzbekistan, 5–200 employees. Non-technical and skeptical; most open the page on a **phone** from Telegram or Instagram. Today they use a paper journal, a Telegram group full of "keldim" messages, or nothing.

The product exists and works (pilot: Mudom bozor, a large clothing store in Hazorasp). **Do not invent** customer logos, testimonials, usage numbers, certifications or integrations. Where real data is missing, draw a clearly marked placeholder (text in square brackets).

### Reference style — recreate Tessel exactly (measured values)

The page must feel like Tessel (tessel-template.framer.website): an engineered, editorial, isometric-block SaaS page. Copy the system, not the content.

**Colors (light page only)**
- Ink `#0B0B0D` — headings, primary button fill, dark band background, 1px outlines of illustrations.
- Body `#47474E` — paragraphs, nav, eyebrow labels, chips. Muted `#8D8D95` — second half of headings, small mono labels.
- Page `#FFFFFF`. Panel `#F5F5F3` — illustration areas inside cards and the interactive board. Light text on dark `#F3F3F1`.
- Gray block sides `#F0F0EE` / `#DFDFDB` — sides of white buttons, lifted cards, shading on isometric drawings.
- **Accent = adone blue `#2443F5`** (Tessel uses an almost identical `#2337FF`; use ours). Accent dark side `#1322C4`, accent light `#4353FF`, accent tint `rgba(36,67,245,0.08)`.
- Hairline `rgba(11,11,13,0.086)` — all guide lines, dividers, card and chip borders. Strong hairline `rgba(11,11,13,0.22)` — secondary buttons and tiles. Hairline on dark `rgba(255,255,255,0.10)`.
- Status colors exist ONLY inside product UI fragments (phone/panel crops): green `#16A34A`, amber `#F07A1A`, red `#E5484D`.

**Fonts** (all Google Fonts; must support Uzbek Latin `oʻ gʻ ʼ`)
- **Fraunces** (variable serif) — all headings, big numbers, prices, the wordmark. Very light: weight **360** (400 for prices), tight negative tracking.
- **Inter Tight** — UI and body text.
- **Martian Mono** — every small label, always UPPERCASE.

**Type scale (desktop 1440)**
| Element | Font | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| H1 | Fraunces | 72 / 69 | 360 | −0.035em |
| H2 | Fraunces | 66 / 66 | 360 | −0.03em |
| Big statement | Fraunces | 52 / 60 | 360 | −1.3px |
| Quote | Fraunces | 48 / 57 | 360 | −1.2px |
| Metric / price numbers | Fraunces | 56 / 56 | 360 (price 400) | −1.7px |
| Case stats | Fraunces | 44 | 360 | −1.3px |
| H3 | Fraunces | 24 / 29 | 360–400 | −0.48px |
| Wordmark | Fraunces | 24 | 380 | −0.72px |
| Hero paragraph | Inter Tight | 19 / 28.5 | 400 | — |
| Body | Inter Tight | 16 / 24 | 400 | — |
| FAQ question | Inter Tight | 18 / 25 | 500 | −0.18px |
| Card title | Inter Tight | 17 / 22 | 500 | −0.17px |
| Button | Inter Tight | 15 | 500 | −0.15px |
| Nav | Inter Tight | 14 | 500 | — |
| Label | Martian Mono | 11 / 15.4 | 400 | +0.04em, uppercase |
| Small label | Martian Mono | 10 | 400 | +0.6px, uppercase |

**Heading trick (use everywhere):** the first sentence in ink, the rest in muted gray — e.g. «Kim ishda, kim kechikdi — **telefoningizda.**» where the bold part is gray.

**Corners, depth**
- **Radius 0 everywhere.** Only exception: round avatars. No soft shadows, no gradients, no glow, no purple, no stock photos.
- Depth = flat **isometric extrusions**. Primary button: black box 44px high, padding 0 18px, 1px ink border, with a **7px accent side on the right (`#1322C4`, skewY 45°) and a 7px accent side on the bottom (`#2443F5`, skewX 45°)** so it reads as a 3D block. Hover: the button "presses down" (sides shrink to ~2px), transition 0.3s cubic-bezier(.2,.7,.1,1); the `↗` arrow nudges.
- Secondary button: same construction, white fill, 1px ink border, gray sides; on hover the sides turn accent and shrink.
- Lifted card (pricing «Biznes»): 1px ink border, raised 8px, ~8px accent side right/bottom.

**Grid & guide lines**
- At 1440 a **frame 1312px wide**: 1px vertical hairlines at x=64 and x=1376, running the full page height. Content sits 43px inside → content area 1226px (x=107–1333).
- Section header = two columns: **eyebrow label left** (x=107: 12px isometric cube icon + mono 11px uppercase `#47474E`), **heading right** (x≈618, 715px wide).
- Big statement and quote start at x=462 (872px wide).
- Sections separated by **full-width horizontal hairlines** (0–1440). Where a divider crosses a frame line: a small **hollow diamond marker** (~12×7px, 1px ink outline, white fill).
- Short **tick marks** (~8px) on the inner side of both frame lines every ~120px.
- **Section number tag** at the top-right of the frame, hanging under the divider: `■ 02 TEKSHIRUV` — mono 10–11px, 6px accent square, box with hairline left and bottom borders.
- Chips/tags: 26px tall, padding 0 8px, 1px hairline border, mono 11px, no radius.
- Vertical section padding 128–140px.

**Illustration language:** isometric (30°) line drawings — white blocks with 1px ink outlines, light gray shading, **exactly one accent element per drawing**, small mono annotations (`35 M`, `YUZ · 94%`), drawn on `#F5F5F3` panels with a faint isometric diamond grid. Product UI (phone/laptop crops) is drawn flat and crisp with a 1px ink frame; only the device frame may keep realistic rounded corners — everything around it stays square. Ignore the floating «Made in Framer / Get Free Template» badges in the reference — they are not part of the design.

**Header:** 65px tall, `rgba(255,255,255,0.82)` + backdrop blur 14px, 1px hairline bottom border, scrolls away (not sticky). Left: isometric-cube logo mark + wordmark `adone` (Fraunces 24/380). Center: `Imkoniyatlar ⌄`, `Tariflar`, `Savollar`. Right: text link `Kirish` + primary button `Bepul sinash ↗`. Nav hover: accent-tint background, accent text, chevron flips. Dropdown under `Imkoniyatlar`: white panel, 1px ink border, ~8px accent side right/bottom; rows with a 32px square outlined icon, 15px title, gray one-line description (Davomat · Vazifalar · Ish haqi · Mini App).

### Language and formats
All copy in **Uzbek (Latin)** exactly as written below — it is final copy. Allowed technical words: Telegram, Mini App, Excel, GPS. Money `149 000 so'm`, phone `+998 90 123 45 67`, time `09:07`, date `25.10.2026`. Mono labels are UPPERCASE Uzbek.

### Page, section by section (desktop 1440)

**Hero (no number)**
- Eyebrow: `ADONE · TELEGRAM ORQALI DAVOMAT`
- H1 (3 lines): «Kim ishda, kim kechikdi — **telefoningizda.**» (gray part = «telefoningizda.»)
- Paragraph (~450px): «Xodim Telegram'da «Keldim» bosadi. adone joylashuvni, jonli selfini, yuzni va telefonni tekshiradi. Siz kim ishda ekanini, kim kechikkanini va bugun nima qilinganini bir qarashda ko'rasiz.»
- Buttons: primary `Bepul sinash ↗`, secondary `Qanday ishlashini ko'rish`.
- Right: an **isometric stack of 4 plates = the 4 checks** behind every «Keldim», with a small isometric shop building on top and a dashed accent geofence ring on the ground plane below. When the cursor comes close the plates separate and show mono labels `04 QURILMA / 03 YUZ / 02 SELFI / 01 GPS` (active one accent-outlined). Show the separated state in a second small inset or note.
- Strip below the hero (top hairline, mono 11px): `■ 39 / 48 HOZIR ISHDA` (live-looking counter), `GEOFENCE · SELFI · YUZ · QURILMA`, `ILOVA O'RNATISH SHART EMAS`; right: `YAQINROQ KELING — TEKSHIRUVNI OCHING ↗`.

**01 — SOHALAR** (thin band ~100px between two dividers; replaces Tessel's client logos — we have no logos to show)
- Left: `PILOT: MUDOM BOZOR, HAZORASP` gray mono.
- Right: continuously scrolling strip of business types in deliberately mixed styles (mono, bold sans, serif), gray/black, fading at both edges: `Do'konlar`, `ISHLAB CHIQARISH`, `Klinikalar`, `O'quv markazlar`, `RESTORANLAR`, `Ko'p filialli biznes`, `Omborlar`, `Avtoservis`.

**02 — TEKSHIRUV** (Tessel "Stack": sticky scroll)
- Eyebrow `TEKSHIRUV`; H2 «To'rt qatlam. **Bitta «Keldim» ortida.»**
- Left column (553px): 4 layer blocks separated by top hairlines, each: mono label (`QATLAM 01 · GPS`, accent when active), H3, 16px paragraph, mono chips:
  1. `QATLAM 01 · GPS` — H3 «Filial hududida» — «Joylashuv filial radiusi ichida bo'lishi shart. Xaritadan tanlangan yoki forward qilingan joylashuv qabul qilinmaydi.» — chips `RADIUS 100 M` `ANIQLIK ≤ 100 M` `JONLI JOYLASHUV`
  2. `QATLAM 02 · SELFI` — H3 «Faqat jonli kamera» — «Galereyadan rasm yuklab bo'lmaydi. Mini App old kamerani o'zi ochadi, botda — dumaloq video.» — chips `GALEREYA YO'Q` `3 KADR` `VIDEO_NOTE`
  3. `QATLAM 03 · YUZ` — H3 «Xodimning o'zi» — «Selfi ro'yxatdan o'tishda olingan yuz namunasi bilan solishtiriladi. Bosh burilishi ham tekshiriladi.» — chips `O'XSHASHLIK %` `BOSH BURILISHI` `ROZILIK BILAN`
  4. `QATLAM 04 · QURILMA` — H3 «O'z telefonidan» — «Birinchi «Keldim» telefonni bog'laydi. Boshqa telefondan kelsa — rahbarga «Shubhali».» — chips `1 XODIM · 1 QURILMA` `SHUBHALI → RAHBAR`
- Right stays fixed: the exploded isometric stack of 4 plates labelled 01–04 in mono; the active plate's blocks turn accent; inactive layer text fades to ~30% opacity. Under the stack, a small flat UI crop of the result: `✓ Keldingiz 08:57 · 35 m · Yuz mos 94%`.

**03 — IMKONIYATLAR** (Tessel "Blocks": 3×2 grid, cells 409×489, no gaps, shared 1px hairlines)
- Eyebrow `IMKONIYATLAR`; H2 «Davomatdan ish haqigacha. **Bitta tizimda.»** Sub: «Telegram guruhdagi «keldim» xabarlari va qo'lda yuritiladigan jurnal o'rniga — tekshiriladigan, hisoblanadigan, Excel'ga chiqadigan tizim.»
- Each cell: top ~280px `#F5F5F3` panel with faint isometric grid + an isometric drawing with one accent element and mono annotations; bottom white: H3 Fraunces 24, 16px gray paragraph, mono gray detail line.
  1. «Davomat» — «Keldi, ketdi, tanaffus, tungi smena. «Ketdim» unutilsa — avtomatik yopiladi.» — `ISHDA · KECHIKDI · KELMADI · RUXSATDA` (drawing: row of 6 isometric people-blocks, one accent = late)
  2. «Vazifalar» — «Bir yoki o'nta xodimga, muddat va isbot bilan: rasm, video, joylashuv. Tasdiq yoki qaytarish, baho 1–5.» — `ISBOT · MUDDAT · BAHO` (drawing: checklist board, one accent tick)
  3. «O'zi qo'shgan ishlar» — «Xodim qilgan ishini o'zi yozadi. Rahbar kun bo'yicha ish jurnalini ko'radi.» — `ISH JURNALI · VAQT` (drawing: stacked log plates)
  4. «Ruxsat so'rovlari» — «Kasal, ta'til, shaxsiy ish — botda so'raladi, bir tugma bilan tasdiqlanadi.» — `KASAL · TA'TIL · SHAXSIY` (drawing: calendar block, one accent day)
  5. «Oylik tabel» — «Har kun — rangli katak: ishlagan soat va kechikish daqiqasi. Excel'ga bir bosishda.» — `EXCEL · 31 KUN` (drawing: isometric grid of day-cells, one accent)
  6. «Ish haqi» — «Kechikish jarimasi, qo'shimcha soat, vazifa bonusi — qoidani o'zingiz yozasiz. Oyni yopasiz — hisob o'zgarmaydi.» — `JARIMA · BONUS · YOPILGAN OY` (drawing: coin stack, one accent coin)

**04 — NEGA ADONE** (Tessel "Why Blocks": one big statement from x=462, words darken from light gray to ink one by one on scroll; show a mid-scroll state with part gray)
- Eyebrow `NEGA ADONE`
- Statement: «Jurnalga istalgan vaqtni yozish mumkin. Telegram guruhga «keldim»ni uydan ham yozish mumkin. adone'da esa «Keldim» faqat filialda, faqat jonli kamera bilan, faqat xodimning o'zi va o'z telefonidan qabul qilinadi — oy oxirida tabel tayyor turadi.»

**05 — BIR KUN** (Tessel "Metrics": full-width dark band `#0B0B0D`, frame lines continue faintly)
- Eyebrow `NAMUNA KUN`; H2 in `#F3F3F1`: «Ertalab 09:00 dan oldin. **Hammasi aniq.»** (gray part)
- Left: 3 rows separated by hairlines on dark — big Fraunces 56 number + right-aligned mono label. These are product facts, not usage claims:
  - `1 tugma` — `XODIM UCHUN: «KELDIM»`
  - `10 daqiqa` — `ISHXONANI ULASH`
  - `0 ilova` — `HAMMASI TELEGRAM ICHIDA`
- Right: an isometric 3D bar chart of arrivals of one sample morning, 12 bars `07:00 … 09:45` (15-min buckets), dark bars with thin light outlines; the bar of the shift start `09:00` in accent with value `27` in blue. Captions mono: `KELGANLAR · 15 DAQIQALIK ORALIQ` / `NAMUNA: SHANBA, 25.10.2026`. Mark the chart as illustrative in a note.

**06 — QAYSI BIZNES UCHUN** (Tessel "Blueprints": 4 cards 295×415, 16px gaps)
- Eyebrow `TAYYOR SOZLAMALAR`; H2 «Biznesingizni tanlang. **Ertaga ertalab boshlang.»**
- Each card: top square `#F5F5F3` panel with grid pattern and an isometric "block town" with one accent building; bottom: mono category, title Inter Tight 17/500, mono detail, `↗` right. Hover: card shifts up-left ~6px revealing a gray side, `↗` turns accent (show one card hovered).
  1. `SAVDO` — «Do'kon va savdo markazi» — `6/1 · 09:00–21:00 · SMENALI KASSA`
  2. `ISHLAB CHIQARISH` — «Sex va ombor» — `2/2 · TUNGI SMENA · KUNBAY`
  3. `TIBBIYOT` — «Klinika» — `NAVBATCHILIK · BIR NECHA FILIAL`
  4. `TA'LIM` — «O'quv markaz» — `ERKIN JADVAL · SOATBAY`

**07 — PILOT** (Tessel "Customers": quote from x=462, Fraunces 48)
- Eyebrow `MUDOM BOZOR · PILOT`
- Quote: **draw a placeholder** «[Mudom bozor egasining iqtibosi — keyin qo'yiladi]» in the quote style.
- Author: 32px gray circle with initials `MB`, name `[Ism Familiya]`, role mono `[LAVOZIM], MUDOM BOZOR`.
- 3 stat columns with vertical hairlines and a top hairline — placeholders: `[—]` `[—]` `[—]` with mono captions `KECHIKISHLAR`, `TABELGA KETADIGAN VAQT`, `XODIMLAR`. No buttons.

**08 — TARIFLAR** (Tessel "Pricing": 3 cards 398×453, padding 32, gaps 8 and 24 for the lifted card's side)
- Eyebrow `TARIFLAR`; H2 «Xodimlar soniga qarab. **14 kun bepul.»** Monthly / yearly switch in mono: `OYLIK` / `YILLIK −20%`.
- **Prices are drafts — show them, the owner will change.**
  - `Start` — white, hairline border — `99 000` + mono `SO'M / OY` — «15 xodimgacha · 1 filial» — button `Bepul sinash` (secondary).
  - `Biznes` — 1px ink border, raised 8px, accent side right/bottom, mono `KO'P TANLANADI` in accent — `249 000` + `SO'M / OY` — «50 xodimgacha · 5 filial» — button `14 kun bepul ↗` (primary).
  - `Korporativ` — white, hairline — `Kelishiladi` — «50+ xodim · cheksiz filial» — button `Bog'lanish` (secondary).
- Prices Fraunces 56/400. Under each button: hairline + feature list with small arrow bullets (accent on Biznes):
  - Start: Davomat (GPS + selfi) · Vazifalar va ish jurnali · Oylik tabel, Excel · Telegram bot va Mini App
  - Biznes: Start'dagi hammasi · Yuz va qurilma tekshiruvi · Ish haqi va qoidalar · Ruxsat so'rovlari
  - Korporativ: Biznes'dagi hammasi · O'z Telegram botingiz · Xodimlarni o'rgatish · Ustuvor yordam
- Under the cards, mono caption: `TO'LOV: CLICK, PAYME YOKI BANK O'TKAZMASI`. Yearly state prices: `79 000` / `199 000`.

**09 — SAVOLLAR** (Tessel FAQ: H2 in the left column, accordion right 715px, 70px rows, hairlines, `+`/`−`, first item open)
- Eyebrow `SAVOLLAR`; H2 «Boshlashdan **oldin so'rashadi.»**
  1. «Xodimlarga alohida ilova kerakmi?» — «Yo'q. Hammasi Telegram ichida: bot va Mini App. Smartfon va internet yetarli.»
  2. «GPS ishlamasa-chi?» — «Joylashuv aniq bo'lmasa, adone qayta urinishni so'raydi. Baribir bo'lmasa — rahbar panelda qo'lda belgilaydi va sababini yozadi.»
  3. «Yuz ma'lumotlari qayerda saqlanadi?» — «Faqat sizning ishxonangiz uchun, shifrlangan serverda. Namuna faqat xodim roziligi bilan olinadi va xodim o'chirilsa o'chiriladi.»
  4. «Smenali va tungi ish bo'lsa?» — «Haftalik, 2/2 kabi navbatli va erkin jadval bor. Tungi smena ertasi kunga o'tsa ham to'g'ri hisoblanadi.»
  5. «Ish haqini adone to'laydimi?» — «Yo'q. adone hisoblaydi: asosiy, jarima, bonus. Natijani Excel'da olasiz va o'zingiz to'laysiz.»
  6. «Qanday boshlayman?» — «Ro'yxatdan o'ting, filial manzilini kiriting va xodimlarga taklif havolasini yuboring. Odatda 10 daqiqa.»

**10 — SINAB KO'RING** (Tessel "Build": interactive board on the right, CTA on the left)
- Eyebrow `NAVBAT SIZDA`; H2 «Birinchi «Keldim»ni **bosing.»** Paragraph: «Xaritadagi istalgan katakni bosing — xodim shu joydan «Keldim» bosdi, deb hisoblaymiz. Doira ichida — qabul, tashqarida — rad. Keyin haqiqiysini ulang: 14 kun bepul, karta kerak emas.»
- Buttons: `Bepul sinash ↗`, `Demo so'rash`.
- Right: 634×507 panel, hairline border, `#F5F5F3` isometric grid background, an 8×8 isometric tile board with a small shop block in the middle and a **dashed accent geofence circle** around it; clicked tiles get a little person-block: inside the circle — accent block with `✓`, outside — gray block with `✕`. Top bar mono: `QABUL 03 · RAD 01` (numbers accent), bordered `TOZALASH` button. Show a state with 4 placed blocks.
- Below the CTA (still in this section, full content width, hairline box): short lead form in one row — `Ismingiz`, `Telefon +998`, `Xodimlar soni` (select `1–15`, `16–50`, `51–200`, `200+`), primary `Ariza qoldirish ↗`; mono caption `1 ISH KUNIDA QO'NG'IROQ QILAMIZ`. Also show the error state `Telefon raqam noto'g'ri` and success `Rahmat! Tez orada bog'lanamiz.`

**Footer** (Tessel spreadsheet footer: bordered cells, gray mono coordinate in each cell's top-right — A1, C1, D1, E1, C2, E2)
- A1: logo + «Xodimlar davomati va vazifalari — Telegram orqali.» (Fraunces ~22) + `Telegram'da yozing ↗` link and `@adoneuz_bot` mono.
- Link columns, mono gray headings, 15px gray links: `MAHSULOT` (Davomat, Vazifalar, Ish haqi, Mini App, Tariflar) · `KOMPANIYA` (Biz haqimizda, Aloqa) · `HUQUQIY` (Maxfiylik siyosati, Foydalanish shartlari, Biometrik ma'lumotlar).
- C2: `■ TIZIM ISHLAYAPTI` + a small live latency bar `TOSHKENT` (black bar on light track).
- E2: `BIZ BILAN` — Telegram, Instagram, YouTube with `↗` and hairline underline.
- A huge `adone` wordmark built from isometric cubes, mono caption `SICHQONCHANI OLIB O'TING` / `ISO 30°`.
- Bottom bar, 4 cells: `© 2026 ADONE.UZ` | `TOSHKENT 09:12:44` (live clock) | `+998 __ ___ __ __` | `YUQORIGA ↑`.

### Interactions to annotate (draw key states, note the rest)
Live «HOZIR ISHDA» counter and live clock; scrolling sector strip with edge fade; sticky TEKSHIRUV section with fading inactive layers; word-by-word reveal in NEGA ADONE; button press on hover; card lift on hover; nav tint on hover; hero stack opens when the cursor is near; clickable geofence board; reactive footer wordmark. Respect reduced motion (everything shown in its final state).

### Mobile (390)
- Frame lines at x=16 and x=374; content gutter 32px. Diamond markers, ticks and section tags stay.
- Header: logo + 38×38 square menu button with hairline border. The menu opens inside the header and pushes the page down: `Imkoniyatlar` / `Tariflar` / `Savollar` as accordion rows in Fraunces ~26 with chevrons and hairlines, then a black `Bepul sinash` with accent side. Show it opened.
- Hero: one column, H1 44/42 (3 lines), paragraph 19px, both buttons full width (326×44) stacked, the isometric stack moves below; the counter strip wraps to 2 lines.
- H2 36/36, H3 24. TEKSHIRUV: illustration above the layer text, single column. IMKONIYATLAR and TAYYOR SOZLAMALAR → 1 column (326 wide). Dark band: numbers stacked, chart below. Pricing stacked, `Biznes` first, keeps its offset and accent side. FAQ: H2 above the accordion. Geofence board shrinks to full width (326) with a 6×6 grid. Footer cells stack into one column, wordmark shrinks, each bottom-bar item on its own row. No horizontal scroll anywhere; tap targets ≥44px.

### Deliverables
Desktop 1440: **A** header (with open dropdown inset) + hero + 01; **B** 02 + 03; **C** 04 + 05 + 06; **D** 07 + 08 + 09; **E** 10 + footer. Mobile 390: **F** one long frame of the whole page. Plus a **style sheet** frame: color tokens by role (`ink`, `body`, `muted`, `page`, `panel`, `on-dark`, `side`, `side-2`, `accent`, `accent-side`, `accent-light`, `accent-tint`, `line`, `line-strong`, `line-dark`), the type scale, primary/secondary buttons (default, hover/pressed), chip, eyebrow, section tag, diamond marker, tick marks, grid spec (frame 1312, content 1226, columns x=107 / 462 / 618).

## PROMPT TUGADI

---

## Keyingi promptlar (o'sha sessiyada, bittalab)

1. **Ro'yxatdan o'tish** (`app.adone.uz/royxat`, desktop + mobil), xuddi shu uslubda: chapda forma («Ishxona nomi», «Ismingiz», «Telefon +998», «Parol», «Xodimlar soni» → `Boshlash ↗`), o'ngda `#F5F5F3` panelda 3 qadam izometrik chizma bilan («01 FILIAL MANZILI → 02 JADVAL → 03 XODIMLARGA HAVOLA») va mono `14 KUN BEPUL · KARTA KERAK EMAS`.
2. **Tariflar sahifasi** (`/tariflar`): to'liq solishtirish jadvali (funksiya × tarif, hairline katakchalar, accent belgi), to'lov haqidagi FAQ, yillik hisob.
3. **Huquqiy sahifa shabloni** (maxfiylik, biometrik ma'lumotlar): chapda mono mundarija, o'ngda Fraunces sarlavha va Inter Tight matn, o'sha to'r va ramka.
