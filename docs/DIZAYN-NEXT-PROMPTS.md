# adone — keyingi dizayn promptlari (Sozlamalar, Hisobotlar)

> Asosiy prompt — `docs/DIZAYN-PROMPT.md` (dizayn tizimi, bosh sahifa, davomat, vazifalar, Mini App). Bu fayldagi promptlar
> **o'sha Claude Design sessiyasida** bittalab yuboriladi — tizim (tokenlar, komponentlar, namuna ma'lumot) allaqachon bor.
> Yangi sessiyada bo'lsa: avval `design/panel/Dizayn tizimi.dc.html` va `design/ref/` dagi Relink rasmini biriktiring,
> `DIZAYN-PROMPT.md` dagi «Visual style», «Brand», «Layout», «Sample data» bo'limlarini birinchi xabar qilib tashlang.
> Har prompt — **«## PROMPT N»** dan **«## PROMPT N TUGADI»** gacha. Eksport: `design/panel/Sozlamalar.dc.html`, `design/panel/Hisobotlar.dc.html`.
> Kod dizayndan 1:1 quriladi; yorliqlar koddagi bilan bir xil (rollar: `Egasi`, `Administrator`, `Bo'lim boshlig'i`).

---

## PROMPT 1 — Sozlamalar

Continue the **adone** design in the same system (tokens, components, sample data `Mudom bozor` from the first generation). Same app frame, white sidebar with `Sozlamalar` active, same page skeleton, cards radius 20, pill buttons, right drawer 520px for create/edit. All copy in Uzbek (Latin), exact labels below.

### Page `Sozlamalar` (desktop 1440)
Header: title `Sozlamalar`, subtitle `Ishxona, jamoa va qoidalar`. No KPI row. Below the header a **left vertical tab list inside a white card (240px)** with icons, and the content on the right as stacked cards. Tabs (owner sees all; admin sees all except `Tarif`; manager doesn't see this page):
`Profilim` · `Ishxona` · `Jamoa` · `Davomat` · `Vazifalar` · `Ish haqi` · `Bildirishnomalar` · `Tarif`.
Every settings card: header (tinted icon square + title + one-line muted description), rows of `label + muted hint` on the left and the control on the right, thin dividers. A sticky bottom bar appears when something changed: `O'zgarishlar saqlanmagan` + ghost `Bekor qilish` + primary `Saqlash`. Under each card a small muted line `Oxirgi o'zgarish: Nilufar Yusupova · 24.10.2026 18:40` (changes are audited).

Design these tabs as separate artboards (or one tall artboard per tab):

1. **Profilim** — avatar with initials, `Ism`, `Telefon` (read-only `+998 90 123 45 67`, hint `Raqamni administrator o'zgartiradi`), card `Parolni o'zgartirish` (`Joriy parol`, `Yangi parol`, `Yangi parolni takrorlang`, strength bar, primary `Parolni yangilash`). Card `Telegram`: status `Ulangan · @aziz_karimov` with `Uzish`, or not-connected variant: QR code + primary `Telegramda ulash ↗` + hint `Bot sizga kechikishlar, so'rovlar va vazifa hisobotlarini yuboradi`. Card `Kirishlar`: last 3 sessions (`MacBook · Chrome · Hazorasp · bugun 09:12`), button `Boshqa qurilmalardan chiqish`.

2. **Ishxona** — `Nomi` (`Mudom bozor`), logo upload (rounded square avatar `M` + `Logotip yuklash`), `Vaqt mintaqasi` select (`Asia/Tashkent (UTC+5)`), `Til` segmented `O'zbekcha · Ўзбекча · Русский` (last two disabled with tiny `tez orada`), `Sana formati` read-only `25.10.2026`, `Ish haftasi boshlanishi` `Dushanba`. Danger zone card (owner only, red outline): `Ishxonani o'chirish` with explanation and a red ghost button (opens confirm dialog — draw it small).

3. **Jamoa** (most important) — panel users, not employees. Card header `Jamoa a'zolari 4` + primary pill `+ A'zo qo'shish`. Role legend chips above the table: `Egasi — hammasi, tarif va to'lov` · `Administrator — tarifdan tashqari hammasi` · `Bo'lim boshlig'i — faqat o'z bo'limi: davomat, so'rovlar, vazifalar`. Table: `A'zo` (avatar, bold name, phone muted), `Rol` (chip: `Egasi` navy, `Administrator` blue, `Bo'lim boshlig'i` blue outline), `Mas'ul` (`Sotuv zali` / `Barcha bo'limlar` / `Mudom — Ombor`), `Telegram` (`Ulangan ✓` green / `Ulanmagan` gray + `Havola` link), `Oxirgi kirish` (`bugun 09:12`), `Holat` (`Faol` / `O'chirilgan`), `⋯` (`Tahrirlash`, `Parolni tiklash`, `O'chirish`). Rows: Aziz Karimov (Egasi), Nilufar Yusupova (Administrator), Sardor Rahimov (Bo'lim boshlig'i · Sotuv zali), Jasur Karimov (Bo'lim boshlig'i · Ombor, `Ulanmagan`).
   **Drawer `A'zo qo'shish`**: `Ism-familiya`, `Telefon` (+998), `Rol` segmented `Administrator | Bo'lim boshlig'i`; if `Bo'lim boshlig'i` — `Bo'limlar` multi-select chips and optional `Filiallar` chips; `Kirish usuli` choice: `Vaqtinchalik parol` (generated `k7m-29qx` with copy icon, hint `Birinchi kirishda o'zgartirishi so'raladi`) or `Telegram orqali taklif` (link + QR). Below: a small permissions preview list with ✓/✕ (`Davomatni ko'rish ✓`, `Vazifa berish ✓`, `Ish haqini ko'rish ✕`, `Sozlamalar ✕`). Footer `Qo'shish`. Also draw the success state: card `A'zo qo'shildi` with the login line `app.adone.uz · +998 90 555 12 12 · parol: k7m-29qx` and button `Nusxa olish`.
   Note: a person can be both a manager and an employee (checks in with the bot) — show a tiny hint `Bu raqam xodimlar ro'yxatida ham bor — Gulnora Saidova` in the drawer as an info line.

4. **Davomat** — cards:
   - `Yangi xodimlar`: toggle `Avtomatik tasdiqlash` (hint `O'chiq bo'lsa, botda ro'yxatdan o'tgan xodim «Tasdiq kutmoqda» bo'ladi`).
   - `Kunlik xabar`: `«Kelmaganlar va kechikkanlar» xabari` time input `10:00`, toggle on; who receives: chips `Egasi · Administrator · Bo'lim boshliqlari`.
   - `Avtomatik yopish`: `«Ketdim» bosilmasa, smena tugaganidan keyin` number `3 soat`; `Erkin grafikda` `16 soat`; hint `Xodim va rahbarga xabar boradi`.
   - `Joylashuv`: `GPS aniqligi talabi` read-only `≤ 100 m`; `Botda faqat jonli lokatsiya` locked toggle (on, with lock icon and hint `Firibgarlikka qarshi — o'chirib bo'lmaydi`).
   - `Yuz tekshiruvi`: slider `O'xshashlik chegarasi` 30–80% with value `45%` and a small scale `Yumshoq ← → Qattiq`, hint `Chegaradan past — «Shubhali», rahbar ko'radi`; `Bosh burilishi (jonlilik)` slider `15°`; toggle `Qurilmani bog'lash` (hint `Boshqa telefondan «Keldim» — shubhali`).
   - `Kechikish`: read-only line `Kechikish chegarasi har jadvalda alohida — Jadvallar ↗`.

5. **Vazifalar** — cards: `O'zi qo'shgan ishlar` — toggle `Rahbar tasdig'ini talab qiladi` (on), toggle `Ish haqiga ta'sir qiladi` (off, hint `Qoidalar — Ish haqi bo'limida`). `Ish turlari` — editable chips list `Savdo · Ombor · Tozalash · Vitrina · Yetkazib berish · Boshqa` with `+ Qo'shish` and `×` on hover (used in «Ish qo'shish»). `Eslatmalar` — toggles with values: `Qabul qilinmasa — 30 daqiqadan keyin`, `Muddatga 1 soat qolganda`, `Muddat o'tganda`, `Hisobot 24 soat tekshirilmasa (rahbarga)`; `Tinch vaqt` `22:00 – 08:00` (hint `Bu vaqtda xabar yuborilmaydi, ertalabga suriladi`).

6. **Ish haqi** — card `Xodimga ko'rinish`: toggle `Xodim o'z ish haqini Mini App'da ko'radi` (off). Card `Hisob qoidalari` — summary rows read-only (`Kechikish: har daqiqa 1 000 so'm`, `Sababsiz kelmagan kun: 100 000 so'm`, `Qo'shimcha soat: soatiga 25 000 so'm`, `Vazifa o'z vaqtida: +20 000 so'm`, `Jarima chegarasi: asosiyning 30%`) + secondary pill `Qoidalarni tahrirlash ↗` (opens the existing rules drawer on Ish haqi page). Card `Oyni yopish`: `Faqat egasi qayta ochadi` read-only.

7. **Bildirishnomalar** — matrix table: rows = events (`Xodim kechikdi`, `Kelmaganlar ro'yxati`, `Shubhali keldi-ketdi`, `Yangi so'rov`, `Vazifa topshirildi`, `Vazifa muddati o'tdi`, `Yangi xodim ro'yxatdan o'tdi`, `Saytdan ariza` (owner only)), columns = `Telegram` toggle per row; a right column `Kimga` (chips). Top note `Xabarlar @adoneuz_bot orqali keladi. Telegram ulanmagan bo'lsa — Profilim → Telegram`.

8. **Tarif** (owner only) — current plan card `Biznes` (60 xodim · 3 filial · yuz tekshiruvi) with usage bars `17 / 60 xodim`, `1 / 3 filial`, status chip `Sinov · 24.12.2026 gacha` (amber), primary `Tarifni tanlash`; 4 plan cards in a row (`Sinov 0 so'm`, `Start 199 000 so'm/oy · 20 xodim`, `Biznes 449 000 so'm/oy · 60 xodim`, `Pro 899 000 so'm/oy · 200 xodim`) with the current one outlined; payment method row `Click · Payme` (disabled, `tez orada`); table `To'lovlar tarixi` empty state `Hali to'lov yo'q`.

### Mobile (390)
One frame of `Sozlamalar` on the phone: tabs become a list of rows with chevrons (`Profilim ›`, `Jamoa ›` …), and one opened sub-screen (`Jamoa`) with member cards instead of the table and a bottom primary `+ A'zo qo'shish`.

### Deliverables
Artboards named exactly: `Sozlamalar — Profilim`, `Sozlamalar — Ishxona`, `Sozlamalar — Jamoa`, `A'zo qo'shish`, `Sozlamalar — Davomat`, `Sozlamalar — Vazifalar`, `Sozlamalar — Ish haqi`, `Sozlamalar — Bildirishnomalar`, `Sozlamalar — Tarif`, `Sozlamalar — mobil`. Reuse existing components; add new ones to the system page only if needed (slider, permission list, plan card, notification matrix).

## PROMPT 1 TUGADI

---

## PROMPT 2 — Hisobotlar

Continue the **adone** design in the same system. Page `Hisobotlar` (sidebar item active). Purpose: the owner sees in one minute who is disciplined and who isn't, per employee and per department, for any period — and exports it to Excel. Numbers are tabular, every number links to the filtered list behind it (Davomat / Vazifalar / Xodim profili).

### Page skeleton (desktop 1440)
Header: `Hisobotlar`, subtitle `Davomat, vazifalar va reyting`. Right: secondary pill `Excel` (download icon) and ghost round `⋯` (`PDF`, `Chop etish`). Filter row: date-range pill `Oktabr 2026 ▾` (presets `Bu hafta · O'tgan hafta · Bu oy · O'tgan oy · Tanlash…`), `Barcha filiallar ▾`, `Barcha bo'limlar ▾`, comparison toggle `O'tgan davr bilan solishtirish`. Tabs with icons: `Davomat · Vazifalar · Reyting · Ish jurnali`.

### Tab 1 — Davomat
- KPI row (4 cards with delta chips vs previous period): `Davomat 94%` ↗1.8%, `Kechikishlar 37 · jami 6 soat 12 daq` ↘, `Sababsiz kelmagan 9 kun`, `Ishlangan soat 6 412` ↗.
- Wide card `Kunlar bo'yicha` — stacked rounded pill bars per day (green `Ishda`, amber `Kechikdi`, red `Kelmadi`, blue `Ruxsatda`, gray `Dam olish`), legend chips, dashed average, hover tooltip `14.10 · Ishda 41 · Kechikdi 4 · Kelmadi 2`.
- Narrow card `Bo'limlar` — horizontal progress pills `Sotuv zali 96%`, `Kassa 93%`, `Ombor 88%` (lowest highlighted amber), `Ofis 97%`.
- Narrow card `Kelish vaqti` — small histogram of arrival minutes around shift start (`-15 … +30 daq`), most bars before 0 green, after 0 amber; caption `O'rtacha: smenadan 4 daqiqa oldin`.
- Wide table `Xodimlar bo'yicha`: `Xodim` (avatar, name, position), `Bo'lim`, `Ish kuni` (`22 / 26` plan/fact), `Kechikish` (`3 · 24 daq`, amber if >0), `Erta ketish` (`1 · 15 daq`), `Kelmagan` (red number), `Ruxsatda`, `Ishladi` (`176:40`), `Qo'shimcha` (`+6:20`), `Davomat` (mini bar + `92%`). Sortable headers (arrow), sticky header, row click → employee profile. Footer row `Jami`. 8 rows from sample data.

### Tab 2 — Vazifalar
- KPI row: `Berilgan 214`, `Bajarildi 188 · 88%`, `O'z vaqtida 82%` ↗6%, `O'rtacha baho 4.6 ★`, `Qaytarilgan 12`.
- Wide card `Haftalar bo'yicha` — grouped pill bars per week (`Berilgan` gray, `O'z vaqtida` blue, `Kechikib` amber) with a line for `O'rtacha baho`.
- Narrow card `Manba` — donut: `Berilgan 214 · O'zi qo'shgan 96 (rejalashtirilgan 31, bajarilgan ish 65)`.
- Narrow card `Ish turlari` (self-logged work by category, time spent): `Savdo 42 soat`, `Ombor 31 soat`, `Vitrina 18 soat`, `Tozalash 7 soat`.
- Table `Xodimlar bo'yicha`: `Xodim`, `Bo'lim`, `Berilgan`, `Bajarildi`, `O'z vaqtida` (`92%` mini bar), `Kechikdi`, `Qaytarildi`, `Baho` (`4.8 ★`), `O'zi qo'shgan` (`14 ish · 11 soat`). Row expand → last 5 tasks with status badges.

### Tab 3 — Reyting
- Header note (muted, with info icon): `Ball = davomat 40% + vazifalar o'z vaqtida 40% + o'rtacha baho 20%` (weights shown as small chips; the formula is a tenant setting later).
- **Podium card** — top 3 with large avatars, place medals `1 · 2 · 3` (gold/silver/bronze tints, not loud), name, department, score `96`, small component bars (davomat / o'z vaqtida / baho).
- Ranked list 4–8 with score, trend arrow vs previous period (`↑2`, `↓1`), and the three component values.
- Side card `E'tibor talab qiladi` — 3 employees with lowest score and the main reason chip (`Ko'p kechikadi: 7 marta`, `Vazifalar kechikmoqda: 4`, `Past baho: 3.1`), button `Profilga o'tish`.
- Toggle above the list: `Xodimlar | Bo'limlar` (departments ranking variant as a second small frame).

### Tab 4 — Ish jurnali
Who did what, by day. Filter: employee select (`Barcha xodimlar` or one), category chips. Timeline grouped by date headers (`Bugun · 25.10.2026`, `Kecha`), each entry: time, avatar + name, title, source chip (`Berilgan` / `O'zi qo'shdi`), category chip, spent time `1 soat 30 daq`, status badge, photo thumbnails (2–3). Right sticky card `Jami`: `Ishlar 23`, `Sarflangan vaqt 31 soat`, top categories. Empty state: `Bu davrda yozuv yo'q`.

### States and export
- Loading skeleton for KPI and table, empty state for a period with no data (`Oktabr 2026 uchun ma'lumot yo'q — davomat bot orqali yig'iladi`).
- **Excel dialog** (small): checkboxes `Davomat`, `Vazifalar`, `Reyting`, `Ish jurnali` (each becomes a sheet), period line, primary `Yuklab olish`.

### Mobile (390)
One phone frame of `Hisobotlar — Davomat`: filter pills scroll horizontally, KPI as a 2×2 grid, chart compact, the table becomes employee cards (name, `92%` bar, chips `Kechikish 3`, `Kelmagan 1`).

### Deliverables
Artboards named exactly: `Hisobotlar — Davomat`, `Hisobotlar — Vazifalar`, `Hisobotlar — Reyting`, `Hisobotlar — Ish jurnali`, `Hisobotlar — Excel`, `Hisobotlar — mobil`. Use the existing sample data (`Mudom bozor`, 48 xodim, October 2026); keep every number consistent between the KPI, chart and table.

## PROMPT 2 TUGADI
