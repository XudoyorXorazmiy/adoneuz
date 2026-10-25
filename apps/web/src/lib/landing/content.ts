/**
 * Landing matni va sozlamalari (design/landing, docs/DIZAYN-PROMPT-LANDING.md). Narxlar — QORALAMA, egasi o'zgartiradi.
 * Pilot iqtibosi/raqamlari kelmaguncha `PILOT = null` — bo'lim saytda ko'rinmaydi (dizayndagi «[…]» joy tutuvchilar prod'ga chiqmaydi).
 */

export const NAV = [
  { href: '#imkoniyatlar', label: 'Imkoniyatlar', menu: true },
  { href: '#tariflar', label: 'Tariflar' },
  { href: '#savollar', label: 'Savollar' },
] as const;

export const MENU = [
  { n: '01', t: 'Davomat', d: 'Keldi-ketdi, GPS, selfi va yuz tekshiruvi', href: '#tekshiruv' },
  { n: '02', t: 'Vazifalar', d: 'Muddat, isbot va baho bilan', href: '#imkoniyatlar' },
  { n: '03', t: 'Ish haqi', d: 'Jarima, bonus, yopilgan oy', href: '#imkoniyatlar' },
  { n: '04', t: 'Mini App', d: 'Telegram ichida, ilovasiz', href: '#tekshiruv' },
];

export const SECTORS: Array<[string, 'serif' | 'serif-i' | 'mono' | 'sans' | 'caps']> = [
  ["Do'konlar", 'serif'], ['ISHLAB CHIQARISH', 'mono'], ['Klinikalar', 'sans'], ["O'quv markazlar", 'serif-i'],
  ['RESTORANLAR', 'caps'], ["Ko'p filialli biznes", 'serif'], ['OMBORLAR', 'mono'], ['Avtoservis', 'sans'],
];

export const LAYERS = [
  { k: 'QATLAM 01 · GPS', h: 'Filial hududida', p: "Joylashuv filial radiusi ichida bo'lishi shart. Xaritadan tanlangan yoki forward qilingan joylashuv qabul qilinmaydi.", chips: ['RADIUS 100 M', 'ANIQLIK ≤ 100 M', 'JONLI JOYLASHUV'] },
  { k: 'QATLAM 02 · SELFI', h: 'Faqat jonli kamera', p: "Galereyadan rasm yuklab bo'lmaydi. Mini App old kamerani o'zi ochadi, botda — dumaloq video.", chips: ["GALEREYA YO'Q", '3 KADR', 'VIDEO_NOTE'] },
  { k: 'QATLAM 03 · YUZ', h: "Xodimning o'zi", p: "Selfi ro'yxatdan o'tishda olingan yuz namunasi bilan solishtiriladi. Bosh burilishi ham tekshiriladi.", chips: ["O'XSHASHLIK %", 'BOSH BURILISHI', 'ROZILIK BILAN'] },
  { k: 'QATLAM 04 · QURILMA', h: "O'z telefonidan", p: "Birinchi «Keldim» telefonni bog'laydi. Boshqa telefondan kelsa — rahbarga «Shubhali».", chips: ['1 XODIM · 1 QURILMA', 'SHUBHALI → RAHBAR'] },
];

export const FEATURES = [
  { n: '01', t: 'Davomat', p: "Keldi, ketdi, tanaffus, tungi smena. «Ketdim» unutilsa — avtomatik yopiladi.", m: 'ISHDA · KECHIKDI · KELMADI · RUXSATDA' },
  { n: '02', t: 'Vazifalar', p: "Bir yoki o'nta xodimga, muddat va isbot bilan: rasm, video, joylashuv. Tasdiq yoki qaytarish, baho 1–5.", m: 'ISBOT · MUDDAT · BAHO' },
  { n: '03', t: "O'zi qo'shgan ishlar", p: "Xodim qilgan ishini o'zi yozadi. Rahbar kun bo'yicha ish jurnalini ko'radi.", m: 'ISH JURNALI · VAQT' },
  { n: '04', t: "Ruxsat so'rovlari", p: "Kasal, ta'til, shaxsiy ish — botda so'raladi, bir tugma bilan tasdiqlanadi.", m: "KASAL · TA'TIL · SHAXSIY" },
  { n: '05', t: 'Oylik tabel', p: "Har kun — rangli katak: ishlagan soat va kechikish daqiqasi. Excel'ga bir bosishda.", m: 'EXCEL · 31 KUN' },
  { n: '06', t: 'Ish haqi', p: "Kechikish jarimasi, qo'shimcha soat, vazifa bonusi — qoidani o'zingiz yozasiz. Oyni yopasiz — hisob o'zgarmaydi.", m: 'JARIMA · BONUS · YOPILGAN OY' },
];

export const WHY = "Jurnalga istalgan vaqtni yozish mumkin. Telegram guruhga «keldim»ni uydan ham yozish mumkin. adone'da esa «Keldim» faqat filialda, faqat jonli kamera bilan, faqat xodimning o'zi va o'z telefonidan qabul qilinadi — oy oxirida tabel tayyor turadi.";

export const METRICS = [['1 tugma', 'XODIM UCHUN: «KELDIM»'], ['10 daqiqa', 'ISHXONANI ULASH'], ['0 ilova', 'HAMMASI TELEGRAM ICHIDA']] as const;

export const BLUEPRINTS = [
  { k: 'SAVDO', t: "Do'kon va savdo markazi", m: '6/1 · 09:00–21:00 · SMENALI KASSA' },
  { k: 'ISHLAB CHIQARISH', t: 'Sex va ombor', m: '2/2 · TUNGI SMENA · KUNBAY' },
  { k: 'TIBBIYOT', t: 'Klinika', m: 'NAVBATCHILIK · BIR NECHA FILIAL' },
  { k: "TA'LIM", t: "O'quv markaz", m: 'ERKIN JADVAL · SOATBAY' },
];

/** Pilot: iqtibos va raqamlar egasidan kelganda to'ldiriladi. */
export const PILOT: null | { quote: string; name: string; role: string; initials: string; stats: Array<[string, string]> } = null;

export interface Plan { id: string; n: string; badge?: string; monthly: number | null; yearly: number | null; lim: string; btn: string; primary?: boolean; feat: string[] }
export const PLANS: Plan[] = [
  { id: 'start', n: 'Start', monthly: 99_000, yearly: 79_000, lim: '15 xodimgacha · 1 filial', btn: 'Bepul sinash', feat: ['Davomat (GPS + selfi)', 'Vazifalar va ish jurnali', 'Oylik tabel, Excel', 'Telegram bot va Mini App'] },
  { id: 'biznes', n: 'Biznes', badge: "KO'P TANLANADI", monthly: 249_000, yearly: 199_000, lim: '50 xodimgacha · 5 filial', btn: '14 kun bepul ↗', primary: true, feat: ["Start'dagi hammasi", 'Yuz va qurilma tekshiruvi', 'Ish haqi va qoidalar', "Ruxsat so'rovlari"] },
  { id: 'korporativ', n: 'Korporativ', monthly: null, yearly: null, lim: '50+ xodim · cheksiz filial', btn: "Bog'lanish", feat: ["Biznes'dagi hammasi", "O'z Telegram botingiz", "Xodimlarni o'rgatish", 'Ustuvor yordam'] },
];

export const FAQ: Array<[string, string]> = [
  ['Xodimlarga alohida ilova kerakmi?', "Yo'q. Hammasi Telegram ichida: bot va Mini App. Smartfon va internet yetarli."],
  ['GPS ishlamasa-chi?', "Joylashuv aniq bo'lmasa, adone qayta urinishni so'raydi. Baribir bo'lmasa — rahbar panelda qo'lda belgilaydi va sababini yozadi."],
  ["Yuz ma'lumotlari qayerda saqlanadi?", "Faqat sizning ishxonangiz uchun, shifrlangan serverda. Namuna faqat xodim roziligi bilan olinadi va xodim o'chirilsa o'chiriladi."],
  ["Smenali va tungi ish bo'lsa?", "Haftalik, 2/2 kabi navbatli va erkin jadval bor. Tungi smena ertasi kunga o'tsa ham to'g'ri hisoblanadi."],
  ["Ish haqini adone to'laydimi?", "Yo'q. adone hisoblaydi: asosiy, jarima, bonus. Natijani Excel'da olasiz va o'zingiz to'laysiz."],
  ['Qanday boshlayman?', "Ro'yxatdan o'ting, filial manzilini kiriting va xodimlarga taklif havolasini yuboring. Odatda 10 daqiqa."],
];

export const STAFF_SIZES = ['1–15', '16–50', '51–200', '200+'] as const;

/** Aloqa kanallari — env bo'lmasa landingda ko'rinmaydi (openstore naqshi). */
export const CONTACTS = {
  bot: process.env.NEXT_PUBLIC_BOT_USERNAME || process.env.PLATFORM_BOT_USERNAME || 'adoneuz_bot',
  telegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || null,
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM || null,
  youtube: process.env.NEXT_PUBLIC_YOUTUBE || null,
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || null,
};
