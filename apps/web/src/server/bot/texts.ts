/** Bot matnlari — bitta joyda (keyin kirill/rus). */
import type { Keyboard } from '@/server/telegram/api';

export const BTN = {
  checkIn: '✅ Keldim',
  checkOut: '🏁 Ketdim',
  today: '📊 Bugun',
  help: '❓ Yordam',
  contact: '📱 Raqamni yuborish',
  tasks: '📋 Vazifalarim',
  addWork: "➕ Ish qo'shish",
  leave: "📝 So'rov",
} as const;

export const CONSENT_VERSION = 'v1-2026-10';

export const T = {
  noInvite: "Assalomu alaykum! Bu bot ishxonangizdagi davomat uchun. Rahbaringizdan <b>taklif havolasini</b> so'rang va shu havola orqali kiring.",
  badInvite: "Havola yaroqsiz yoki muddati o'tgan. Rahbaringizdan yangi havola so'rang.",
  welcome: (company: string, name: string) => `Assalomu alaykum, <b>${name}</b>!\n<b>${company}</b> davomat tizimiga ulanyapsiz.\n\n1-qadam: pastdagi «${BTN.contact}» tugmasini bosing.`,
  ownContactOnly: "Faqat o'zingizning raqamingizni «📱 Raqamni yuborish» tugmasi orqali yuboring.",
  phoneMismatch: "Bu raqam rahbaringiz kiritgan raqamga mos kelmadi. Rahbaringizga murojaat qiling.",
  tgTaken: "Bu Telegram hisobi shu ishxonada boshqa xodimga bog'langan.",
  consent:
    "2-qadam: <b>Rozilik</b>\n\nDavomatni tasdiqlash uchun ishxona sizning <b>joylashuvingiz</b> (faqat «Keldim/Ketdim» paytida), " +
    "<b>yuz tasviringiz</b> (dumaloq video) va kelish-ketish vaqtlaringizni saqlaydi. Ma'lumotlar faqat shu ishxona rahbariyatiga ko'rinadi " +
    "va ishdan bo'shaganingizda o'chiriladi.\n\nRozimisiz?",
  consentNo: "Rozilik bermasangiz bot orqali davomat qilib bo'lmaydi. Fikringiz o'zgarsa «✅ Roziman» tugmasini bosing.",
  faceAsk:
    "3-qadam: <b>yuz namunasi</b>.\n\nPastdagi mikrofon belgisini bir marta bosing — u 📹 kameraga aylanadi. Keyin uni bosib turib, " +
    "yuzingiz aniq ko'rinadigan <b>3–5 soniyalik dumaloq video</b> yozing.",
  needVideoNote: "Iltimos, <b>dumaloq video</b> yuboring (oddiy rasm yoki fayl qabul qilinmaydi).",
  registered: (company: string) => `Rahmat! ✅ Ro'yxatdan o'tdingiz.\n\n<b>${company}</b> rahbari tasdiqlagach «${BTN.checkIn}» tugmasi ishlaydi. Tasdiqlanganda xabar beramiz.`,
  approved: (company: string) => `🎉 <b>${company}</b> sizni tasdiqladi. Endi ishga kelganda «${BTN.checkIn}», ketayotganda «${BTN.checkOut}» tugmasini bosing.`,
  notActive: "Hisobingiz hali tasdiqlanmagan. Rahbaringiz tasdiqlagach xabar beramiz.",
  disabled: 'Hisobingiz faol emas. Rahbaringizga murojaat qiling.',
  noBranch: "Sizga filial biriktirilmagan. Rahbaringizga murojaat qiling.",
  alreadyIn: `Siz allaqachon ishdasiz. Ketayotganda «${BTN.checkOut}» tugmasini bosing.`,
  notIn: `Siz hali «Keldim» qilmagansiz.`,
  locAsk: (action: 'check_in' | 'check_out') =>
    `${action === 'check_in' ? '✅ Keldim' : '🏁 Ketdim'} — <b>jonli joylashuvni</b> yuboring:\n\n📎 (skrepka) → <b>Joylashuv</b> → <b>«Jonli joylashuvni ulashish»</b> → 15 daqiqa.\n\n<i>Xaritadan tanlangan oddiy nuqta qabul qilinmaydi.</i>`,
  notLive: "Bu oddiy joylashuv. Iltimos, <b>«Jonli joylashuvni ulashish»</b>ni tanlang (📎 → Joylashuv).",
  forwarded: 'Forward qilingan xabar qabul qilinmaydi. Joylashuvni o‘zingiz yuboring.',
  stale: 'Joylashuv eskirgan. Qaytadan yuboring.',
  lowAccuracy: (acc: number) => `GPS aniqligi past (±${acc} m). Ochiq joyga chiqib, qaytadan yuboring.`,
  outside: (dist: string, branch: string) => `❌ Siz filialdan <b>${dist}</b> uzoqdasiz (${branch}). Filial hududiga kirib, qaytadan yuboring.`,
  videoAsk: "📍 Joylashuv tasdiqlandi. Endi yuzingiz ko'rinadigan <b>dumaloq video</b> yuboring (3–5 soniya).",
  expired: "Vaqt o'tib ketdi. «✅ Keldim» tugmasini qaytadan bosing.",
  checkedIn: (time: string, late: number) => `✅ Qabul qilindi · <b>${time}</b>${late > 0 ? `\n⚠️ Kechikdingiz: ${late} daqiqa` : ''}\n\nYaxshi ish kuni!`,
  checkedOut: (time: string, worked: string) => `🏁 Ketish qayd etildi · <b>${time}</b>\nBugun ishladingiz: <b>${worked}</b>. Rahmat!`,
  pickCompany: 'Qaysi ishxona uchun?',
  help:
    `<b>Qanday ishlaydi</b>\n\n${BTN.checkIn} — ishga kelganda: jonli joylashuv + dumaloq video.\n${BTN.checkOut} — ketayotganda: jonli joylashuv.\n${BTN.tasks} — sizga berilgan vazifalar: qabul qilish, «Bajardim» va hisobot.\n${BTN.addWork} — o'zingiz qilgan yoki rejalashtirgan ish.\n${BTN.leave} — ruxsat so'rash (kasal, ta'til, shaxsiy).\n${BTN.today} — bugungi holatingiz.\n\nMuammo bo'lsa rahbaringizga yozing.`,
  memberContact: (company: string) =>
    `Assalomu alaykum! Siz <b>${company}</b> rahbariyati sifatida ulanyapsiz.\n\nBu siz ekaningizni tasdiqlash uchun pastdagi «${BTN.contact}» tugmasini bosing — raqam paneldagi raqamingiz bilan solishtiriladi.`,
  memberPhoneMismatch: "Bu raqam taklif qilingan rahbar raqamiga mos kelmadi. Havolani sizga yuborgan kishiga murojaat qiling.",
  tenantInactive: "Bu ishxona hozir faol emas. Qo'llab-quvvatlashga murojaat qiling.",
  memberCredentials: (url: string, phone: string, password: string) =>
    `🔐 <b>Panelga kirish</b>\n${url.replace(/^https?:\/\//, '')}\nTelefon: ${phone}\nVaqtinchalik parol: <code>${password}</code>\n\nKirgach, Sozlamalar → Profilim'da parolni o'zgartiring. Bu xabarni hech kimga yubormang.`,
  memberLinked: (company: string) => `✅ Telegram ulandi. <b>${company}</b> bo'yicha bildirishnomalar (kechikkanlar, kelmaganlar, yangi xodimlar, vazifa hisobotlari) shu yerga keladi. Hisobotni shu yerdan tasdiqlash yoki qaytarish mumkin.`,
  unknown: `Tugmalardan birini tanlang.`,
};

export const menuKeyboard: Keyboard = {
  keyboard: [[{ text: BTN.checkIn }, { text: BTN.checkOut }], [{ text: BTN.tasks }, { text: BTN.addWork }], [{ text: BTN.today }, { text: BTN.leave }, { text: BTN.help }]],
  resize_keyboard: true,
  is_persistent: true,
};
export const contactKeyboard: Keyboard = { keyboard: [[{ text: BTN.contact, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
export const consentKeyboard: Keyboard = { inline_keyboard: [[{ text: '✅ Roziman', callback_data: 'consent:yes' }, { text: '❌ Rozi emasman', callback_data: 'consent:no' }]] };
export const removeKeyboard: Keyboard = { remove_keyboard: true };
