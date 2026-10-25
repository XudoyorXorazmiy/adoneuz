# adone — dizayni yo'q sahifalar uchun promptlar (3-to'plam)

> Bu sahifalar kodda bor va ishlaydi, lekin Claude Design'da chizilmagan (`design/panel/` da `.dc.html` yo'q). Promptlar kod asosida yozilgan:
> ustunlar, holatlar, tugmalar va matnlar haqiqiy. Dizayn kelgach kod 1:1 moslanadi.
> **Har prompt o'z-o'zini tushuntiradi** — yangi Claude Design chatida ham ishlaydi. Yaxshisi: o'sha panel sessiyasida yuboring
> yoki yangi chatga `design/panel/Dizayn tizimi.dc.html` + `design/ref/` dagi Relink rasmini biriktiring.
> Har prompt — **«## PROMPT N»** dan **«## PROMPT N TUGADI»** gacha. Bitta chatda bittadan yuboring (bitta promptga 15+ ekran sig'maydi).
> Eksport nomlari: `design/panel/<Artboard nomi>.dc.html` (har prompt oxirida yozilgan).
> *«optional, not built yet»* deb belgilangan joylar — kodda hali yo'q g'oyalar: dizaynda variant sifatida chiziladi, quriladimi — egasi hal qiladi.

| # | Sahifa | Kod | Eksport |
|---|---|---|---|
| 1 | Xodimlar ro'yxati + bo'limlar | `/xodimlar` | `Xodimlar.dc.html` |
| 2 | Xodim profili — qolgan tablar | `/xodimlar/[id]` | `Xodim profili - tablar.dc.html` |
| 3 | Jadvallar | `/jadvallar` | `Jadvallar.dc.html` |
| 4 | Filiallar (xarita + radius) | `/filiallar` | `Filiallar.dc.html` |
| 5 | So'rovlar | `/sorovlar` | `Sorovlar.dc.html` |
| 6 | Ish haqi (+ Qoidalar, Tuzatish, Oyni yopish) | `/ish-haqi` | `Ish haqi.dc.html` |
| 7 | Super admin (admin.adone.uz) | `/platforma/*` | `Super admin.dc.html` |
| 8 | Mini App — qolgan ekranlar | `/tg/*` | `Mini App - qolganlar.dc.html` |

---

## PROMPT 1 — Xodimlar

**Context (read first).** You are designing one page of **adone** (adone.uz) — a SaaS for businesses in Uzbekistan that tracks employee attendance and tasks through Telegram: employees check in from a Telegram bot / Mini App (geofence + live selfie + face match), managers assign tasks and approve reports, everything rolls up into a timesheet and payroll. Users of this panel: shop owners, admins, department heads, on 13–15" laptops and phones. All UI copy is **Uzbek (Latin)**, exact labels below. Formats: `25.10.2026`, `09:07`, `4 500 000 so'm`, `+998 90 123 45 67`.

**Visual system (keep identical to the existing adone screens):** airy, soft, premium, rounded; one big white app frame (radius 24, soft shadow) on a light gray canvas `#EEF0F4`; white **sidebar 248px** inside the frame (wordmark `adone`, company switcher card «Ishxona · Mudom bozor», menu: Bosh sahifa, Davomat, Vazifalar, So'rovlar, Xodimlar, Jadvallar, Filiallar, Hisobotlar, Ish haqi, Sozlamalar — active item = light gray pill with blue icon and `›`; bottom: plan card `Tarif · Biznes  17 / 60 xodim` with a thin bar, user row). Content area `#F7F8FA`, white cards radius 20, no borders, shadow `0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.04)`. Font **Plus Jakarta Sans**, icons **Material Symbols Rounded**. Primary `#2443F5` (tint `#EEF1FF`), navy `#0B1B4F`, success `#16A34A`/`#E8F7EE`, warning `#F07A1A`/`#FFF1E6`, danger `#E5484D`/`#FDECEC`, text `#111827`, muted `#6B7280`, line `#ECEEF2`. Buttons are **pills** (44px primary with icon, white secondary with hairline border), icon buttons are 40px circles, status chips are small pills with a dot. Page header: title 28px bold + muted subtitle on the left; right: bell, search `⌘K`, `Barcha filiallar ▾` pill, user chip; faint line under it. Create/edit forms open in a **right drawer 520px** (radius 24 on the left edge, footer `Bekor qilish` + primary). Tables: no zebra, thin row dividers, header 12px muted, first column = avatar + bold name.

**Page `Xodimlar` (desktop 1440).**
- Header: `Xodimlar` + count `17` (faol + tasdiq kutmoqda + taklif yuborildi), primary pill `+ Xodim qo'shish`. Manager variant subtitle: `Faqat o'z bo'limingiz xodimlari`.
- Layout: main column + **right side card `Bo'limlar` (300px)** on wide screens.
- Filter row: status tabs with counts — `Barchasi 17 · Faol 12 · Tasdiq kutmoqda 2 · Taklif yuborildi 3 · O'chirilgan 1`; right: select `Barcha bo'limlar ▾`, search `Qidirish…` (ism, telefon, lavozim), button `Izlash`.
- Table columns: `Xodim` (avatar, bold name, muted `Sotuvchi · +998 90 123 45 67`, the row links to the profile), `Bo'lim · filial` (two lines: `Sotuv zali` / `Mudom — Markaz`), `Jadval` (`Asosiy smena` or muted `jadvalsiz`), `Telegram` (green `@gulnora_s` / `ulangan`, or muted `ulanmagan`), `Holat` chip (`Faol` green, `Tasdiq kutmoqda` amber, `Taklif yuborildi` gray, `O'chirilgan` gray outline), actions on the right by status:
  - `Taklif yuborildi` → secondary `Havola` (copies `t.me/adoneuz_bot?start=inv_…`) + round `send` icon (share to Telegram); if the invite expired → `↻ Yangi havola`.
  - `Tasdiq kutmoqda` → primary small `Tasdiqlash` (how_to_reg icon).
  - `O'chirilgan` → ghost `Qayta yoqish`.
  - everyone else → ghost edit icon (opens the drawer).
- 8 rows: Gulnora Saidova (Sotuvchi, Sotuv zali, Faol, @gulnora_s), Dilshod Rahimov (Kassir, Kassa, Faol), Jasur Karimov (Omborchi, Ombor, Faol), Madina Ergasheva (Sotuvchi, Tasdiq kutmoqda), Bekzod Tursunov (Sotuvchi, Taklif yuborildi), Shahnoza Allayeva (Kassir, Faol), Ulug'bek Sobirov (Omborchi, Taklif yuborildi — invite expired), Feruza Qodirova (Ofis, O'chirilgan).
- Side card `Bo'limlar` + ghost `+ Qo'shish`: rows `Sotuv zali · Sardor Rahimov · 6 xodim`, `Kassa · boshliqsiz · 3 xodim`, `Ombor · Jasur Karimov · 4 xodim`, `Ofis · boshliqsiz · 2 xodim`; each row clickable (filters the table) with a small edit icon. Managers don't see add/edit.
- **Drawer `Yangi xodim`** (and `Xodimni tahrirlash`): `Ism-familiya` (placeholder `Gulnora Saidova`), `Telefon` (hint `Botda xodim o'z raqamini ulashadi — shu bilan solishtiriladi.`), `Lavozim` (`Sotuvchi`), `Bo'lim` select, `Filial` select, `Ish jadvali` select (hint `Jadvalsiz xodimga kechikish hisoblanmaydi.`), `Ish haqi turi` segmented `Oylik · Kunbay · Soatbay`, `Stavka (so'm)` (`4 500 000`). Info box (primary tint): `Saqlangach taklif havolasi chiqadi — uni xodimga Telegram'da yuboring. Xodim botda raqamini ulashadi, rozilik beradi va dumaloq video yuboradi.` Footer `Qo'shish`. Edit variant has a red ghost `Ishdan bo'shatish` on the left of the footer.
- *(Optional idea, not built yet — draw as a variant)* **After adding** — show the success state: a card with the invite link (mono), buttons `Nusxa olish` and `Telegram'da yuborish`, note `Havola 14 kun amal qiladi`.
- **Drawer `Yangi bo'lim`**: `Nomi` (`Sotuv zali`), `Bo'lim boshlig'i` select (`— yo'q —` + panel members), hint `Shu bo'lim xodimlarini ko'radi, vazifa beradi, so'rovlarni hal qiladi.`
- Empty states: no employees — `Hali xodim yo'q. Birinchi xodimni qo'shing va unga taklif havolasini yuboring.` + primary button; filter empty — `Bu filtr bo'yicha xodim topilmadi.`

**Mobile (390):** tabs scroll horizontally, rows become cards (avatar, name, position, status chip, one action button), `Bo'limlar` moves below the list, a sticky bottom primary `+ Xodim qo'shish`.

**Deliverables:** artboards `Xodimlar`, `Xodimlar — Yangi xodim`, `Xodimlar — havola tayyor`, `Xodimlar — bo'lim`, `Xodimlar — bo'sh`, `Xodimlar — mobil`. Export as `Xodimlar.dc.html`.

## PROMPT 1 TUGADI

---

## PROMPT 2 — Xodim profili: qolgan tablar

**Context.** adone (adone.uz) — attendance and tasks through Telegram for businesses in Uzbekistan (bot / Mini App check-in with geofence, live selfie, face match; tasks with photo reports; timesheet and payroll). Uzbek (Latin) UI, formats `25.10.2026`, `09:07`, `4 500 000 so'm`.

**Visual system:** same as existing adone panel — white app frame radius 24 on `#EEF0F4`, white sidebar 248px (Xodimlar active), content `#F7F8FA`, white cards radius 20 with soft shadow, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, navy `#0B1B4F`, success/warning/danger tints, pill buttons, status chips with a dot, right drawer 520px for forms.

**Existing part (already designed, keep it):** profile header — avatar, `Gulnora Saidova`, `Sotuvchi · Sotuv zali · Mudom — Markaz`, phone, Telegram `@gulnora_s`, chip `Faol`, buttons `Vazifa berish`, `⋯`; tabs `Tabel · Vazifalar · So'rovlar · Ish haqi · Ma'lumotlar`; the `Tabel` tab is a month calendar timesheet. **Design the other four tabs** with the same header:

1. **Vazifalar (ish jurnali)** — month switcher `Oktabr 2026 ‹ ›`; KPI row *(optional, not built yet)*: `Bajarildi 18`, `O'z vaqtida 92%`, `O'rtacha baho 4.7 ★`, `O'zi qo'shgan 6 ish · 9 soat`; a timeline grouped by day (`25.10.2026, Shanba`): each entry — time, title, chip `Berilgan` / `O'zi qo'shdi`, status chip (`Tasdiqlandi` green, `Tekshiruvda` amber, `Qaytarildi` red), spent time `1 soat 30 daq`, small photo thumbnails, rating stars. Items: `Yangi kolleksiyani vitrinaga terish` (Berilgan, Tasdiqlandi, ★5), `Vitrinadagi narxlarni yangiladim` (O'zi qo'shdi, Tekshiruvda, 40 daq), `Kassa hisobotini topshirish` (takrorlanuvchi, Tasdiqlandi). Empty: `Bu oyda ish yozilmagan.`
2. **So'rovlar** — list of this employee's leave requests: icon + type (`🤒 Kasal`, `🏖 Ta'til`, `👤 Shaxsiy ish`, `🏠 Masofadan ishlash`), period `20.10–22.10` + `3 kun`, reason in quotes, status chip (`Kutilmoqda` amber with inline `Tasdiqlash` / `Rad etish` buttons, `Tasdiqlandi` green, `Rad etildi` red with the manager's comment, `Bekor qilindi` gray); link `Barcha so'rovlar →`.
3. **Ish haqi** (owner/admin only; managers don't see this tab) — month switcher; big total `3 912 000 so'm` with chip `Qoralama` or `Yopilgan`; breakdown card: `Asosiy · 22 kun 4 500 000`, `Kechikish (daqiqa): 24 −24 000`, `Sababsiz kelmagan kun: 1 −100 000`, `Jarima cheklovi +0`, `Qo'shimcha soat: 6 +150 000`, `Vazifa o'z vaqtida: 12 +240 000`, `Tuzatish — avans −850 000`, divider, `Jami`. Button `Vedomost` (opens Ish haqi page).
4. **Ma'lumotlar** — two columns. Left card «Ma'lumotlar»: rows `Telefon`, `Telegram`, `Lavozim`, `Filial`, `Jadval` (`Asosiy smena · 6/1 · 09:00–21:00`), `Ishga qo'shilgan` (`02.10.2026`), `Biometrik rozilik` (`Berilgan · 02.10.2026` / `Rozilik yo'q`), `Stavka` (`4 500 000 so'm / oy`) + edit button. Right column cards: **Yuz namunasi** (3 thumbnails, chip `Sifatli` / `Vektor yo'q`, button `Qayta olish` — sends the employee a /yuz request), **Telegram** (`@gulnora_s`, button `Yozish`, note `Keldi/ketdi faqat shu Telegram akkauntidan qabul qilinadi.`), **Qurilma** (`iPhone 13 · bog'langan 02.10.2026`, button `Uzish`, note `Boshqa qurilmadan kirilsa, check-in «Shubhali» deb belgilanadi.`; empty variant `Hali bog'lanmagan — Mini App'dagi birinchi «Keldim» bog'laydi.`). Danger: red ghost `Ishdan bo'shatish` (biometrics are deleted).

**Mobile (390):** header compact, tabs scroll horizontally, cards stack.

**Deliverables:** artboards `Xodim profili — Vazifalar`, `Xodim profili — So'rovlar`, `Xodim profili — Ish haqi`, `Xodim profili — Ma'lumotlar`, `Xodim profili — mobil`. Export as `Xodim profili - tablar.dc.html`.

## PROMPT 2 TUGADI

---

## PROMPT 3 — Jadvallar

**Context.** adone (adone.uz) — employee attendance and tasks through Telegram (Uzbekistan). A schedule (`jadval`) defines when an employee should be at work; lateness and absence are computed from it. Uzbek (Latin) UI, time `09:00`.

**Visual system:** same as the existing adone panel — white app frame radius 24 on `#EEF0F4`, white sidebar 248px (Jadvallar active), content `#F7F8FA`, white cards radius 20, soft shadows, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, navy `#0B1B4F`, pill buttons, chips, right drawer 520px.

**Page `Jadvallar` (desktop 1440).**
- Header: `Jadvallar` + count `3`, subtitle `Smena vaqti, tanaffus va kechikish chegarasi. Xodimga jadval «Xodimlar» bo'limida biriktiriladi.`, primary `+ Jadval qo'shish`.
- Prefer cards over a plain table (one card per schedule) — each card: icon `event_repeat`, name, a big readable rule line, a **week strip** of 7 day pills `Du Se Ch Pa Ju Sh Ya` (work days filled navy, off days light gray; for a rotating 2/2 schedule show the next 14 days as small pills with the cycle start), time `09:00 – 21:00`, chips `Tanaffus 60 daq`, `Kechikish chegarasi 10 daq`, `12 xodim` (link to filtered Xodimlar), a `tungi` chip when the shift crosses midnight, edit button. Schedules:
  - `Asosiy smena` — Hafta kunlari, Du–Sh (6/1), 09:00–21:00, tanaffus 60, chegara 10, 12 xodim.
  - `Kassa smenasi` — Navbatli 2/2, boshlanish 01.10.2026, 08:30–22:00, chegara 5, 3 xodim.
  - `Tungi qorovul` — Hafta kunlari har kuni, 20:00–08:00 (tungi), 1 xodim.
  - `Ofis — erkin` — Erkin grafik (no time; note `kechikish hisoblanmaydi`), 2 xodim.
- **Drawer `Yangi jadval` / `Jadvalni tahrirlash`**: `Nomi` (`Asosiy smena`); type segmented `Hafta kunlari · Navbatli (2/2) · Erkin grafik`;
  - Hafta kunlari → 7 toggle chips `Du Se Ch Pa Ju Sh Ya`;
  - Navbatli → `Ish kunlari` (2), `Dam kunlari` (2), `Boshlanish` (date);
  - Erkin → gray note `Erkin grafikda smena vaqti yo'q: kechikish hisoblanmaydi, faqat ishlagan vaqt yoziladi.`
  - for non-free: `Boshlanishi` / `Tugashi` time inputs (hint `Tungi smena bo'lsa ertasi kungi vaqt (masalan 08:00).`), `Tanaffus (daqiqa)`, `Kechikish chegarasi (daqiqa)` (hint `Shu daqiqagacha kechikish hisoblanmaydi.`).
  - *(optional, not built yet)* live preview at the bottom: `6/1 · 09:00–21:00 · 11 soat ish` + the week strip.
  - Footer `Saqlash`; red ghost `O'chirish` only when no employee uses it.
- Empty: `Hali jadval yo'q. Masalan: «Asosiy smena», 6/1, 09:00–21:00.` + primary button.

**Mobile (390):** cards full width, the week strip stays visible, sticky bottom `+ Jadval qo'shish`.

**Deliverables:** `Jadvallar`, `Jadvallar — Yangi jadval` (three type variants side by side), `Jadvallar — bo'sh`, `Jadvallar — mobil`. Export as `Jadvallar.dc.html`.

## PROMPT 3 TUGADI

---

## PROMPT 4 — Filiallar

**Context.** adone (adone.uz) — employees check in with GPS: «Keldim» is accepted only inside the branch geofence (radius + GPS accuracy margin). This page manages branches: map point + radius. Uzbek (Latin) UI, distance `100 m`.

**Visual system:** same as the existing adone panel — white app frame on `#EEF0F4`, white sidebar 248px (Filiallar active), content `#F7F8FA`, white cards radius 20, soft shadows, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, pill buttons, right drawer 520px.

**Page `Filiallar` (desktop 1440).**
- Header: `Filiallar` + count `2`, subtitle `Xodim faqat filial zonasida «Keldim» qila oladi.`, primary `+ Filial qo'shish`.
- Two-column grid of branch cards. Each card: `location_on` icon + name, muted line `Hazorasp, markaz · radius 100 m · 15 xodim`, round buttons `open_in_new` (Google xaritada) and edit; a **map** (light, minimal style) with the branch point and a **translucent blue radius circle**, small mono coordinates `41.32526, 61.06918` under the map. *(Optional idea, not built yet — draw as a variant: today's check-in dots on the map, green inside / red outside `420 m`, and a footer strip `Bugun 12 ta «Keldim» · 1 ta zonadan tashqari`.)*
  - `Mudom — Markaz` — Hazorasp, markaz, radius 100 m, 15 xodim.
  - `Mudom — Ombor` — radius 150 m, 2 xodim.
- Archive card at the bottom: `Arxiv` with rows `Pitnak (eski) · Qaytarish`.
- **Drawer `Yangi filial` / `Filialni tahrirlash`**: `Nomi` (`Mudom — Markaz`), `Manzil` (`Hazorasp, markaz`), `Joylashuv` — input with placeholder `https://maps.app.goo.gl/… yoki 41.3194, 61.0742` and hint `Google yoki Yandex xaritada filial nuqtasini bosib, havolani shu yerga qo'ying — yoki «41.3194, 61.0742».` Below it *(optional, not built yet)* a live map preview that shows the parsed point (success line `Nuqta topildi: 41.32526, 61.06918`, error variant `Koordinata topilmadi. «41.3194, 61.0742» ko'rinishida yoki Google/Yandex xarita havolasini qo'ying.`), `Radius (metr)` as a slider 20–2000 with value chip + number input (hint `Xodim shu doira ichida «Keldim» qila oladi. Odatda 50–150 m.`), the circle on the preview grows with the slider. Footer `Saqlash`, red ghost `Arxivlash` on the left.
- Empty: `Hali filial yo'q. Birinchi filialni qo'shing — xaritadagi nuqta va radius.` + primary.

**Mobile (390):** one card per row, map 180px high, drawer becomes a full-screen sheet.

**Deliverables:** `Filiallar`, `Filiallar — Yangi filial` (with the error variant), `Filiallar — bo'sh`, `Filiallar — mobil`. Export as `Filiallar.dc.html`.

## PROMPT 4 TUGADI

---

## PROMPT 5 — So'rovlar

**Context.** adone (adone.uz) — employees ask for leave from the Telegram bot («📝 So'rov») or the Mini App; managers decide here (the bot also sends them `✅ Tasdiqlash / ❌ Rad etish` buttons). An approved day shows as «Ruxsatda» in attendance (not «Kelmadi»). Managers see only their department. Uzbek (Latin) UI.

**Visual system:** same as the existing adone panel — white app frame on `#EEF0F4`, white sidebar 248px (So'rovlar active, with an amber counter), content `#F7F8FA`, white cards radius 20, soft shadows, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, pill buttons, status chips with a dot, right drawer 520px.

**Page `So'rovlar` (desktop 1440).**
- Header: `So'rovlar` + amber badge `3 kutilmoqda`, subtitle `Ruxsat so'rovlari: kasal, ta'til, shaxsiy ish, masofadan ishlash`; the bell has a red dot.
- One big card: tabs `Kutilmoqda 3 · Tasdiqlangan 12 · Rad etilgan 2 · Barchasi`.
- List of request rows (rounded bordered rows, not a table): left — avatar, bold name, muted `Sotuvchi · Sotuv zali` (links to the profile); middle — `🤒 Kasal` bold, period `20.10–22.10`, muted `3 kun`, reason in quotes `«Isitma, shifokorga boraman»`, small gray line `19.10.2026 21:40` (+ for decided ones ` · Sardor Rahimov: «Sog'ayib keting»`); right — for pending: primary `✓ Tasdiqlash` + danger outline `✕ Rad etish`; for decided: status chip (`Tasdiqlandi` green, `Rad etildi` red, `Bekor qilindi` gray).
  Rows: Madina Ergasheva — 🤒 Kasal 20.10–22.10; Bekzod Tursunov — 👤 Shaxsiy ish 24.10 (1 kun) «To'yga boraman»; Jasur Karimov — 🏖 Ta'til 01.11–10.11 (10 kun); Dilshod Rahimov — 🏠 Masofadan ishlash 18.10 (Tasdiqlandi).
- *(Optional idea, not built yet — draw as a variant)* a thin **calendar strip** above the list (next 14 days) showing how many people are on leave each day — helps decide (`3 kishi ruxsatda` on overlapping days in amber).
- **Drawer `Rad etish`** (subtitle `Bekzod Tursunov · 24.10`): `Sabab` textarea (hint `Xodimga Telegram'da yuboriladi.`), footer danger `Rad etish`.
- Empty (Kutilmoqda): `Kutilayotgan so'rov yo'q. Xodimlar botda «📝 So'rov» yoki Mini App'da ruxsat so'raydi.`

**Mobile (390):** rows become cards, decision buttons full width at the bottom of each card.

**Deliverables:** `So'rovlar`, `So'rovlar — Rad etish`, `So'rovlar — bo'sh`, `So'rovlar — mobil`. Export as `Sorovlar.dc.html`.

## PROMPT 5 TUGADI

---

## PROMPT 6 — Ish haqi

**Context.** adone (adone.uz) — monthly payroll from attendance and tasks by **editable rules** (late fines, absence penalty, overtime and task bonuses, penalty cap). The month is a **draft** (recomputed whenever opened; manual adjustments are kept) until the owner/admin **closes** it — then it is a frozen snapshot; only the owner can reopen. Every change is audited. Money is whole so'm: `4 500 000 so'm`. Uzbek (Latin) UI. Managers don't see this page.

**Visual system:** same as the existing adone panel — white app frame on `#EEF0F4`, white sidebar 248px (Ish haqi active), content `#F7F8FA`, white cards radius 20, soft shadows, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, navy `#0B1B4F`, success green for bonuses, red for penalties, pill buttons, right drawer 520px, centered dialogs 440px.

**Page `Ish haqi` (desktop 1440).**
- Header: `Ish haqi`, subtitle `Oktabr 2026 · Qoralama` (closed variant: `Sentabr 2026 · Yopilgan 01.10.2026`); right: secondary `Excel`, secondary small `⚙ Qoidalar`, primary `Oyni yopish` (closed variant: secondary `Qayta ochish`, owner only).
- Filter row: month switcher `‹ Oktabr 2026 ›` (no future months), `Barcha bo'limlar ▾`, `Filtr`. A gray info line for drafts: `Qoralama: davomat va vazifalar o'zgarsa qayta hisoblanadi. Qo'lda tuzatishlar saqlanadi.`
- KPI cards: `Jami to'lov 41 250 000 so'm` (hint `15 xodim`), `Asosiy 43 800 000`, `Jarimalar −1 340 000` (red), `Bonuslar +2 190 000` (green, hint `Tuzatishlar −3 400 000`).
- Table: `Xodim` (avatar, name, muted `Oylik · 4 500 000`), `Asosiy`, `Jarima` (red), `Bonus` (green), `Tuzatish` (with a tooltip-dot when there is a reason), `Jami` (bold), chevron. **One row expanded** inline in two columns: left «Davomat» — `Ishlagan: 22 kun · 176:40`, `Ruxsatda: 1 · Kelmagan: 1 · Kechikkan: 3 marta (24 daq)`, `Qo'shimcha: 6:20`, `Vazifalar: o'z vaqtida 12 · kechikkan 1`, link `Profil va tabel →`; right «Hisob» — `Asosiy 4 500 000`, penalty lines (`Kechikish (daqiqa): 24 −24 000`, `Sababsiz kelmagan kun: 1 −100 000`), `Jarima cheklovi +0`, bonus lines (`Qo'shimcha soat: 6 +150 000`, `Vazifa o'z vaqtida: 12 +240 000`), `Tuzatish — «avans» −850 000`, divider, `Jami 3 916 000`; button `Tuzatish` (disabled when the month is closed).
- **Drawer `Qo'lda tuzatish`** (subtitle `Gulnora Saidova · Oktabr 2026`): `Tur` segmented `Qo'shish (mukofot) · Ushlab qolish (avans, jarima)`, `Summa, so'm` (hint `0 — tuzatishni bekor qilish.`), `Sabab` (hint `Majburiy. Jurnalga yoziladi.`), footer `Saqlash`.
- **Drawer `Ish haqi qoidalari`** (subtitle `Ishxona uchun; qoralama oylar darhol qayta hisoblanadi, yopilganlarga ta'sir qilmaydi`), grouped sections with small caps headers:
  - ASOSIY MAOSH — checkbox rows `Oylikni ishlangan kunlarga mutanosib` (hint `Jadvaldagi ish kunlari bo'yicha: 22 kundan 20 kun — 20/22.`), `Tasdiqlangan ruxsat kunlari to'lanadi`.
  - JARIMALAR — `Kechikish` segmented `Yo'q · Har daqiqa · Har holat` + `Kechikish summasi, so'm`; `Sababsiz kelmagan kun, so'm` (hint `Maosh ulushidan tashqari.`); `Erta ketish, so'm/daq`; `Vazifa kechikdi, so'm`; `Jarima chegarasi, % asosiydan` (hint `0 — cheklovsiz. Standart 30%.`).
  - BONUSLAR — `Qo'shimcha soat, so'm`; `Vazifa o'z vaqtida, so'm`; `Vazifa 5 baho, so'm`; checkbox `O'zi qo'shgan ishlar ham hisoblanadi` (hint `Standart — faqat rahbar bergan vazifalar.`).
  - XODIMGA — checkbox `Xodim o'z ish haqini Mini App'da ko'radi`.
  - *(optional, not built yet)* a small live example at the bottom: `Misol: 3 marta 8 daqiqa kechikish → −24 000 so'm`.
- **Dialog `Oyni yopish`**: text `Yakuniy hisob saqlanadi va o'zgarmaydi: keyingi davomat tuzatishlari va qoida o'zgarishlari bu oyga ta'sir qilmaydi.` (+ amber note if the month hasn't ended: `Oy hali tugamagan — odatda oy oxirida yopiladi.`), buttons `Bekor qilish` / primary `Yopish`. **Dialog `Davrni qayta ochish`** (owner): `Davr qoralamaga qaytadi va ko'rilganda joriy davomat va qoidalar bo'yicha qayta hisoblanadi. Qo'lda tuzatishlar saqlanadi. Amal jurnalga yoziladi.`
- Empty: `Bu oy uchun faol xodim yo'q.`

**Mobile (390):** KPI 2×2, rows as cards (name + Jami, tap → expands the breakdown).

**Deliverables:** `Ish haqi`, `Ish haqi — yopilgan oy`, `Ish haqi — Tuzatish`, `Ish haqi — Qoidalar`, `Ish haqi — Oyni yopish`, `Ish haqi — mobil`. Export as `Ish haqi.dc.html`.

## PROMPT 6 TUGADI

---

## PROMPT 7 — Super admin (admin.adone.uz)

**Context.** adone (adone.uz) is a multi-tenant SaaS (each business = a «ishxona»). This is the **platform owner's** panel at `admin.adone.uz`: create businesses, block/activate them, see plans and trial dates, handle leads from the landing page, watch the background job queue. It never shows a business's internal data (photos, payroll). Uzbek (Latin) UI.

**Visual system:** same family as the adone business panel but visibly «platform»: white app frame radius 24 on `#EEF0F4`, a **narrow white sidebar** with wordmark `adone` + small navy chip `admin`, section label `PLATFORMA`, items `Ishxonalar`, `Arizalar` (counter), `Navbat`; content `#F7F8FA`, white cards radius 20, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, navy `#0B1B4F`, pill buttons, right drawer 520px.

**Screens:**
1. **Kirish** — centered card: wordmark + chip `admin`, `Telefon raqam` (+998), `Parol`, primary `Kirish`, small note `Faqat platforma administratori`.
2. **Ishxonalar** — header `Ishxonalar 3`, primary `+ Ishxona qo'shish`. KPI row: `Ishxonalar 3`, `Faol (to'lagan) 1`, `Sinovda 2`, `Panel foydalanuvchilari 9`. Table: `Ishxona` (initial avatar + name + slug `mudom-bozor`), `Egasi` (name + phone), `Tarif` (`Biznes`), `Muddat` (`24.12.2026` — amber if < 7 days), `A'zolar` (4), `Holat` chip (`Sinov` amber, `Faol` green, `To'lov kutilmoqda` red outline, `Bloklangan` red, `Arxiv` gray), actions `Bloklash` / `Faollashtirish` / `Blokdan chiqarish`. Rows: `Mudom bozor` (Fayzulloh, Biznes, Sinov), `Test do'kon` (Sinov), `Aura parfums` (Start, Faol). Empty: `Hali ishxona yo'q. «Ishxona qo'shish» bilan birinchisini oching.`
   **Drawer `Ishxona qo'shish`**: `Ishxona nomi` (`Mudom bozor`), `Egasining ismi` (`Aziz Karimov`), `Egasining telefoni` (`+998 90 123 45 67`), `Parol` (`kamida 6 belgi`; hint `Raqam allaqachon ro'yxatda bo'lsa — bo'sh qoldiring, egasi mavjud hisob bilan kiradi`), `Tarif` select (`Sinov · 15 xodim`, `Start · 20 xodim`, `Biznes · 60 xodim`, `Pro · 200 xodim`), `Sinov muddati (kun)` (14). Success line: `«Mudom bozor» yaratildi. Egasi app.adone.uz ga kirishi mumkin.`
3. **Arizalar** (leads from the landing form) — header `Arizalar 4`; tabs `Yangi 4 · Bog'lanildi 2 · Mijoz bo'ldi 1 · Rad · Barchasi`; table: `Ism`, `Telefon` (blue tel link), `Xodimlar` (`1–15`, `16–50`, `51–200`, `200+`), `Qayerdan` (muted `landing · instagram · oktabr`), `Vaqt` (`25.10.2026 14:32`), `Holat` (inline select with the status chip color). Mobile: cards. Empty: `Ariza yo'q.`
4. **Navbat** (background jobs) — header `Navbat`, secondary `Tekshirish (ping)`; *(optional, not built yet)* KPI chips `Kutmoqda 2 · Bajarilmoqda 0 · Xato 1 · Bajarildi (24 soat) 312`; table: `Tur` (mono `task_notify`, `notify_members`, `attendance_tick`, `tg_update`), `Ishxona`, `Holat` chip (`queued` gray, `running` blue, `done` green, `failed` red), `Urinish` (`2/3`), `Vaqt`, `Xato` (truncated red mono text with a tooltip). Empty: `Navbat bo'sh.`

**Mobile (390):** sidebar → top bar with a menu; tables → cards.

**Deliverables:** `Super admin — Kirish`, `Super admin — Ishxonalar`, `Super admin — Ishxona qo'shish`, `Super admin — Arizalar`, `Super admin — Navbat`, `Super admin — mobil`. Export as `Super admin.dc.html`.

## PROMPT 7 TUGADI

---

## PROMPT 8 — Mini App: qolgan ekranlar

**Context.** adone (adone.uz) — employees use only a **Telegram Mini App** (390×844, inside Telegram: Telegram header on top, our big bottom button). Already designed: `Bosh` (Keldim circle / time at work, today's tasks, month stats, bottom tab bar `Bosh · Vazifalar · Tarix · Profil`), `Keldim` flow (location → selfie → result), `Vazifa hisoboti` (task detail + report + «Ish qo'shish»). **Design the remaining screens** in the same style. Uzbek (Latin), 16px base, 24px titles, formats `25.10`, `09:02`, `8:12`, `4 500 000 so'm`.

**Visual system (Mini App):** page background `#F7F8FA` (follows Telegram theme later), white cards radius 20 with soft shadow, Plus Jakarta Sans, Material Symbols Rounded, primary `#2443F5`, success/warning/danger tints, pill buttons; small round pill buttons in headers (`+ Ish qo'shish`, `📝 So'rov`); bottom tab bar with 4 items, active blue.

**Screens (each a 390×844 phone frame):**
1. **Vazifalar** (tab) — title `Vazifalar`, header pill `+ Ish qo'shish`; success banner variant `Hisobot yuborildi — rahbar tekshiradi.` / `Ish qayd etildi.`; groups with counts `Ochiq · 3`, `Tekshiruvda · 1`, `Bajarilgan (14 kun) · 5`. Task row card: title, `Sardor Rahimov` (from), due `Bugun 17:00` (red `2 soat kechikdi` when overdue), priority dot, proof icons (camera, location), right side action/status: `Qabul` (new), `Bajardim` (in progress), `Tekshiruvda` chip, `Tasdiqlandi` chip with ★, red `Qaytarildi` chip. Empty: `Hozircha vazifa yo'q.`
2. **Tarix** (tab) — title `Tarix · Oktabr 2026`, header pill `📝 So'rov`; 3 stat tiles `Ish kuni 18`, `Soat 146:20`, `Kechikish 2`; a list of days: `25.10 Sh` · `09:02 – 21:05` · `11:48` · status chip (`Ishda` green, `Kechikdi` amber, `Kelmadi` red, `Ruxsatda` blue, `Ochiq` while still at work `09:02 – …`); off days hidden unless worked. Footer note `Xato bo'lsa rahbaringizga ayting — tuzatish jurnalga yoziladi.` Empty: `Bu oyda yozuv yo'q.`
3. **Profil** (tab) — big avatar 84, name `Gulnora Saidova`; info card rows `Ishxona · Mudom bozor`, `Lavozim · Sotuvchi`, `Bo'lim · Sotuv zali`, `Filial · Mudom — Markaz`, `Telefon · +998 90 123 45 67`, `Vazifalar o'z vaqtida (oy) · 92% · 12 ta`. **Ish haqi** card (only if the business allows it): collapsed — `Ish haqi · Oktabr` + small `Hozirgacha hisoblangan` (or `Yakuniy`) and big `3 916 000 so'm`; expanded — `Asosiy · 18 kun 3 680 000`, red penalty lines (`Kechikish (daqiqa): 24 −24 000`), green bonus lines, `Jarima cheklovi`, `Tuzatish — avans −850 000`. Footer note `Ma'lumotni o'zgartirish uchun rahbaringizga murojaat qiling.` Show both variants (with and without the pay card).
4. **Ruxsat so'rash** — Telegram-style header with back arrow `Ruxsat so'rash`; form card: type chips `🤒 Kasal · 🏖 Ta'til · 👤 Shaxsiy ish · 🏠 Masofadan ishlash · 📝 Boshqa`, `Qachondan` / `Qachongacha` date fields, `Sabab (ixtiyoriy)` textarea, big bottom button `Yuborish` (loading `Yuborilmoqda…`); success state `So'rov yuborildi — rahbar javobi Telegram'ga keladi.`; below — section `So'rovlarim`: rows with the type icon, `Kasal · 20.10–22.10`, `3 kun · «Sog'ayib keting»`, status chip (`Kutilmoqda` with a small `Bekor qilish` link, `Tasdiqlandi`, `Rad etildi`).
5. **Tasdiqlanmagan** state of `Bosh` — card `Hisobingiz hali tasdiqlanmagan. Rahbaringiz tasdiqlagach «Keldim» ishlaydi.` with a gray disabled Keldim circle.

**Deliverables:** frames `Mini App — Vazifalar`, `Mini App — Tarix`, `Mini App — Profil` (2 variants), `Mini App — Ruxsat so'rash`, `Mini App — tasdiqlanmagan`. Export as `Mini App - qolganlar.dc.html`.

## PROMPT 8 TUGADI
