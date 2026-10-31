/** Sozlamalar tablari (server): design/panel/Sozlamalar.dc.html 1:1. Ma'lumot sahifadan keladi. */
import Link from 'next/link';
import {
  formatDate, formatPhone, formatSom, NOT_ACCEPTED_OPTIONS, NOTIFY_EVENT_META, NOTIFY_EVENTS, NOTIFY_ROLE_LABELS,
  type PayRules, type TenantSettings,
} from '@adone/core';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';
import type { MyAccount } from '@/server/account';
import {
  archiveTenantAction, changePasswordAction, saveAttendanceAction, saveMyNameAction, saveNotificationsAction, savePaySettingsAction,
  saveInspectionSettingsAction, saveTaskSettingsAction, saveTenantAction, unlinkTelegramAction,
} from '@/lib/actions/settings';
import { ChipCheck, Field, Row, SelectField, Segmented, SettingsCard, StatusChip, Toggle, Value } from './ui';
import { ConfirmByName, LogoutOthersButton, PasswordRows, SettingsForm, Slider, TelegramConnect } from './client';
import { CriteriaEditor } from './criteria-editor';
import type { InspectionCriterion } from '@adone/core';

type Audit = Record<string, { name: string; at: Date }>;
const ROW = 'flex items-center gap-6 border-b border-line-soft py-3.5 max-md:flex-col max-md:items-stretch max-md:gap-3';

/** «bugun 09:12» / «kecha 21:40» / «22.10.2026». */
export function whenLabel(at: Date | null, tz: string): string {
  if (!at) return '—';
  const day = formatDate(at, tz);
  const today = formatDate(new Date(), tz);
  const yesterday = formatDate(new Date(Date.now() - 86_400_000), tz);
  const time = new Intl.DateTimeFormat('uz-UZ', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
  return day === today ? `bugun ${time}` : day === yesterday ? `kecha ${time}` : day;
}

// ---------- Profilim ----------

export function ProfileTab({ acc, mustChange, audit, tz }: { acc: MyAccount; mustChange: boolean; audit: Audit; tz: string }) {
  return (
    <>
      <SettingsForm action={saveMyNameAction}>
        <SettingsCard icon="person" title="Shaxsiy ma'lumotlar" desc="Panelda va Telegram xabarlarda ko'rinadi" audit={audit['account.name'] ?? null} tz={tz}>
          <Row label="Rasm" hint="Hozircha ism bosh harflari ko'rinadi"><Avatar name={acc.name} size={56} /></Row>
          <Row label="Ism"><Field name="name" defaultValue={acc.name} width={320} required minLength={2} /></Row>
          <Row label="Telefon" hint="Raqamni administrator o'zgartiradi"><Field value={formatPhone(acc.phone)} readOnly width={320} /></Row>
        </SettingsCard>
      </SettingsForm>
      <SettingsForm action={changePasswordAction} submit resetOnOk>
        <SettingsCard icon="key" title="Parolni o'zgartirish" desc="Kamida 8 belgi: harf va raqam" audit={audit['account.password'] ?? null} tz={tz}
          chip={mustChange ? <span className="rounded-full bg-warning-tint px-2.5 py-[3px] text-xs font-bold whitespace-nowrap text-warning">Vaqtinchalik parol</span> : undefined}>
          <PasswordRows rowClass={ROW} />
          <Row><button className="btn-primary">Parolni yangilash</button></Row>
        </SettingsCard>
      </SettingsForm>
      <SettingsCard icon="send" tone={acc.telegramSince ? 'telegram' : 'gray'} title="Telegram" desc="Bot sizga kechikishlar, so'rovlar va vazifa hisobotlarini yuboradi" audit={audit['account.telegram'] ?? null} tz={tz}>
        {acc.telegramSince ? (
          <Row label="@adoneuz_bot" hint={`Ulangan: ${formatDate(acc.telegramSince, tz)}`}>
            <StatusChip tone="success" icon="check_circle">Ulangan</StatusChip>
            <form action={unlinkTelegramAction}><button className="btn-danger">Uzish</button></form>
          </Row>
        ) : (
          <Row label="Telefoningiz kamerasi bilan QR ni skanerlang" hint="Yoki tugmani bosing — Telegram ochiladi va «Start» bosasiz"><TelegramConnect /></Row>
        )}
      </SettingsCard>
      <SettingsCard icon="devices" title="Kirishlar" desc="Panelga oxirgi kirgan qurilmalar" audit={audit['auth.login'] ? { ...audit['auth.login'], name: 'tizim' } : null} tz={tz}>
        {acc.logins.length === 0 && <Row hint="Kirishlar tarixi keyingi kirishdan boshlab yoziladi" />}
        {acc.logins.map((l, i) => (
          <Row key={i} icon={l.icon} label={l.label} hint={[l.ip, whenLabel(l.at, tz)].filter(Boolean).join(' · ')}>
            {i === 0 ? <StatusChip tone="info">Oxirgi</StatusChip> : <Value tone="muted">{whenLabel(l.at, tz)}</Value>}
          </Row>
        ))}
        <Row><LogoutOthersButton /></Row>
      </SettingsCard>
    </>
  );
}

// ---------- Ishxona ----------

export function TenantTab({ name, timezone, timezones, isOwner, audit, tz }: { name: string; timezone: string; timezones: Array<{ id: string; label: string }>; isOwner: boolean; audit: Audit; tz: string }) {
  return (
    <>
      <SettingsForm action={saveTenantAction}>
        <SettingsCard icon="storefront" title="Ishxona ma'lumotlari" desc="Xodimlar botda shu nomni ko'radi" audit={audit['settings.tenant'] ?? null} tz={tz}>
          <Row label="Nomi"><Field name="name" defaultValue={name} width={320} required minLength={2} maxLength={80} /></Row>
          <Row label="Logotip" hint="Hozircha nomning bosh harfi"><span className="flex size-14 items-center justify-center rounded-2xl bg-navy text-xl font-extrabold text-white">{name.slice(0, 1).toUpperCase()}</span></Row>
        </SettingsCard>
        <SettingsCard icon="language" title="Mintaqa va til" desc="Vaqt hisobi va interfeys tili" audit={audit['settings.tenant'] ?? null} tz={tz}>
          <Row label="Vaqt mintaqasi" hint="Barcha kechikishlar shu vaqtda hisoblanadi">
            <SelectField name="timezone" defaultValue={timezone} icon="schedule" width={320}>{timezones.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</SelectField>
          </Row>
          <Row label="Til"><Segmented name="lang" defaultValue="uz" options={[{ value: 'uz', label: "O'zbekcha" }, { value: 'uz-cyrl', label: 'Ўзбекча', soon: true }, { value: 'ru', label: 'Русский', soon: true }]} /></Row>
          <Row label="Sana formati"><Field value={formatDate(new Date(), timezone)} readOnly width={200} /></Row>
          <Row label="Ish haftasi boshlanishi" hint="Tabel va haftalik hisobotlar uchun"><Field value="Dushanba" readOnly width={200} /></Row>
        </SettingsCard>
      </SettingsForm>
      {isOwner && (
        <SettingsCard icon="warning" tone="danger" danger title="Xavfli hudud" desc="Bu amalni o'zingiz qaytara olmaysiz" audit={audit['tenant.archive'] ?? null} tz={tz}
          chip={<span className="rounded-full bg-navy px-2.5 py-[3px] text-xs font-bold whitespace-nowrap text-white">Faqat egasi</span>}>
          <Row label="Ishxonani yopish" hint="Hech kim panelga va botga kira olmaydi, xodimlar «Keldim» qila olmaydi. Ma'lumotlar o'chirilmaydi — qayta ochish yoki butunlay o'chirish uchun qo'llab-quvvatlashga yozing. Avval Excel'ga yuklab oling.">
            <ConfirmByName trigger="Ishxonani yopish" title="Ishxonani yopasizmi?" expected={name} action={archiveTenantAction} submitLabel="Yopish"
              text={<>«{name}» yopiladi: barcha rahbarlar panel'dan chiqariladi, bot xodimlarga javob bermaydi. Qayta ochish — faqat qo&apos;llab-quvvatlash orqali.</>} />
          </Row>
        </SettingsCard>
      )}
    </>
  );
}

// ---------- Davomat ----------

export function AttendanceTab({ s, audit, tz }: { s: TenantSettings; audit: Audit; tz: string }) {
  const a = audit['settings.attendance'] ?? null;
  return (
    <SettingsForm action={saveAttendanceAction}>
      <SettingsCard icon="person_add" title="Yangi xodimlar" desc="Botda ro'yxatdan o'tganlar" audit={a} tz={tz}>
        <Row label="Avtomatik tasdiqlash" hint="O'chiq bo'lsa, botda ro'yxatdan o'tgan xodim «Tasdiq kutmoqda» bo'ladi"><Toggle name="autoApprove" defaultChecked={s.autoApprove} /></Row>
      </SettingsCard>
      <SettingsCard icon="mark_email_unread" title="Kunlik xabar" desc="Har kuni rahbarlarga" audit={audit['settings.notifications'] && (!a || audit['settings.notifications'].at > a.at) ? audit['settings.notifications'] : a} tz={tz}>
        <Row label="«Kelmaganlar va kechikkanlar» xabari" hint="Belgilangan vaqtda Telegram orqali yuboriladi">
          <Field type="time" name="absentDigestAt" defaultValue={s.absentDigestAt} icon="schedule" width={120} required />
          <Toggle name="absentOn" defaultChecked={s.notifications.absent.on} />
        </Row>
        <Row label="Kimga">
          <div className="flex max-w-[460px] flex-wrap justify-end gap-1.5 max-md:justify-start">
            {NOTIFY_EVENT_META.absent.roles.map((r) => <ChipCheck key={r} name="absentTo" value={r} label={r === 'manager' ? "Bo'lim boshliqlari" : NOTIFY_ROLE_LABELS[r]} defaultChecked={s.notifications.absent.to.includes(r)} />)}
          </div>
        </Row>
      </SettingsCard>
      <SettingsCard icon="timer_off" title="Avtomatik yopish" desc="«Ketdim» unutilganda" audit={a} tz={tz}>
        <Row label="«Ketdim» bosilmasa" hint="Smena tugaganidan keyin. Xodim va rahbarga xabar boradi."><Field type="number" name="autoCloseHours" defaultValue={s.autoCloseHours} min={1} max={12} width={80} suffix="soat" required /></Row>
        <Row label="Erkin grafikda" hint="«Keldim»dan keyin"><Field type="number" name="freeAutoCloseHours" defaultValue={s.freeAutoCloseHours} min={4} max={24} width={80} suffix="soat" required /></Row>
      </SettingsCard>
      <SettingsCard icon="location_on" title="Joylashuv" desc="GPS tekshiruvi" audit={undefined}>
        <Row label="GPS aniqligi talabi" hint="Bundan yomon aniqlikdagi lokatsiya qabul qilinmaydi"><Field value="≤ 100 m" readOnly width={140} /></Row>
        <Row label="Botda faqat jonli lokatsiya" hint="Firibgarlikka qarshi — o'chirib bo'lmaydi"><Toggle locked defaultChecked /></Row>
      </SettingsCard>
      <SettingsCard icon="face" title="Yuz tekshiruvi" desc="Selfi yuz namunasi bilan solishtiriladi" audit={audit['settings.face'] ?? null} tz={tz}>
        <Row label="O'xshashlik chegarasi" hint="Chegaradan past — «Shubhali», rahbar ko'radi">
          <Slider name="faceThreshold" min={30} max={80} defaultValue={Math.round(s.face.threshold * 100)} unit="%" lo="Yumshoq · 30%" hi="80% · Qattiq" />
        </Row>
        <Row label="Bosh burilishi (jonlilik)" hint="Mini App selfisida boshni burish burchagi">
          <Slider name="faceYaw" min={5} max={45} defaultValue={Math.min(45, Math.max(5, s.face.minYawRange))} unit="°" lo="5°" hi="45°" />
        </Row>
        <Row label="Qurilmani bog'lash" hint="Boshqa telefondan «Keldim» — shubhali"><Toggle name="deviceBinding" defaultChecked={s.deviceBinding} /></Row>
      </SettingsCard>
      <SettingsCard icon="schedule" title="Kechikish" audit={undefined}>
        <Row label="Kechikish chegarasi har jadvalda alohida" hint="Masalan, «Asosiy smena» — 10 daqiqa">
          <Link href="/jadvallar" className="flex items-center gap-1 text-sm font-bold whitespace-nowrap text-primary">Jadvallar<Icon name="arrow_outward" size={16} /></Link>
        </Row>
      </SettingsCard>
    </SettingsForm>
  );
}

// ---------- Vazifalar ----------

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

export function TasksTab({ s, countSelfTasks, audit, tz }: { s: TenantSettings; countSelfTasks: boolean; audit: Audit; tz: string }) {
  const r = audit['settings.reminders'] ?? null;
  return (
    <SettingsForm action={saveTaskSettingsAction}>
      <SettingsCard icon="edit_note" title="O'zi qo'shgan ishlar" desc="Xodim «Ish qo'shish» orqali yozgan ishlar" audit={audit['settings.tasks'] ?? null} tz={tz}>
        <Row label="Rahbar tasdig'ini talab qiladi" hint="Tasdiqlanmaguncha hisobotga kirmaydi"><Toggle name="selfTasksNeedApproval" defaultChecked={s.selfTasksNeedApproval} /></Row>
        <Row label="Ish haqiga ta'sir qiladi" hint="Qoidalar — Ish haqi bo'limida"><Toggle name="countSelfTasks" defaultChecked={countSelfTasks} /></Row>
      </SettingsCard>
      <SettingsCard icon="notifications_active" title="Eslatmalar" desc="Telegram orqali avtomatik" audit={r} tz={tz}>
        <Row label="Qabul qilinmasa" hint="Xodimga qayta eslatma">
          <SelectField name="notAcceptedMin" defaultValue={String(s.reminders.notAcceptedMin)} width={200}>
            {NOT_ACCEPTED_OPTIONS.map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} soatdan keyin` : `${m} daqiqadan keyin`}</option>)}
          </SelectField>
          <Toggle name="notAccepted" defaultChecked={s.reminders.notAccepted} />
        </Row>
        <Row label="Muddatga 1 soat qolganda" hint="Xodimga"><Toggle name="dueSoon" defaultChecked={s.reminders.dueSoon} /></Row>
        <Row label="Muddat o'tganda" hint="Xodimga va vazifa bergan rahbarga"><Toggle name="overdue" defaultChecked={s.reminders.overdue} /></Row>
        <Row label="Hisobot 24 soat tekshirilmasa" hint="Rahbarga"><Toggle name="reviewStale" defaultChecked={s.reminders.reviewStale} /></Row>
        <Row label="Tinch vaqt" hint="Bu vaqtda xodimga eslatma yuborilmaydi, ertalabga suriladi">
          <span className="flex items-center gap-2">
            <SelectField name="quietFrom" defaultValue={HOURS[s.quietHours.from]} icon="bedtime" width={124}>{HOURS.map((h) => <option key={h}>{h}</option>)}</SelectField>
            <span className="text-muted">–</span>
            <SelectField name="quietTo" defaultValue={HOURS[s.quietHours.to]} width={100}>{HOURS.map((h) => <option key={h}>{h}</option>)}</SelectField>
          </span>
        </Row>
      </SettingsCard>
    </SettingsForm>
  );
}

// ---------- Nazorat ----------

export function InspectionTab({ criteria, employeeCriteria, departments, audit, tz }: { criteria: InspectionCriterion[]; employeeCriteria: InspectionCriterion[]; departments: Array<{ id: string; name: string }>; audit: Audit; tz: string }) {
  return (
    <SettingsForm action={saveInspectionSettingsAction}>
      <SettingsCard icon="checklist" title="Bo'lim mezonlari" desc="Admin bo'limni shu mezonlar bo'yicha tekshiradi (Mini App → Nazorat). ✗ — bo'lim javobgariga avtomatik vazifa" audit={audit['settings.inspection'] ?? null} tz={tz}>
        <CriteriaEditor criteria={criteria} departments={departments} />
      </SettingsCard>
      <SettingsCard icon="person_check" title="Xodim mezonlari" desc="Admin alohida xodimni shu mezonlar bo'yicha tekshiradi (Mini App → Nazorat → Xodimlar). ✗ — vazifa xodimning o'ziga. Bo'lim tanlansa — faqat shu bo'lim xodimlariga" audit={undefined}>
        <CriteriaEditor criteria={employeeCriteria} departments={departments} prefix="e_" />
      </SettingsCard>
      <SettingsCard icon="person_pin" title="Javobgarlar" desc="Har bo'limning javobgari — Xodimlar → Bo'limlar → bo'lim formasi «Nazorat javobgari». Jarima — Ish haqi → Qoidalar → «Nazorat ✗»" audit={undefined}>
        <p className="m-0 text-sm text-muted">Javobgar bo&apos;lmasa, bo&apos;lim boshlig&apos;i xodim bo&apos;lsa — u. Hisobot: <Link href="/nazorat" className="font-semibold text-primary">Nazorat</Link>.</p>
      </SettingsCard>
    </SettingsForm>
  );
}

// ---------- Ish haqi ----------

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

export function PayTab({ rules, closed, audit, tz }: { rules: PayRules; closed: { month: string; closedAt: Date | null } | null; audit: Audit; tz: string }) {
  const late = rules.late.mode === 'per_minute' ? `har daqiqa ${formatSom(rules.late.amount)}` : rules.late.mode === 'per_case' ? `har holat ${formatSom(rules.late.amount)}` : "yo'q";
  const money = (n: number, plus = '') => (n ? `${plus}${formatSom(n)}` : "yo'q");
  const a = audit['payroll.rules'] ?? null;
  return (
    <SettingsForm action={savePaySettingsAction}>
      <SettingsCard icon="visibility" title="Xodimga ko'rinish" desc="Mini App ichida" audit={a} tz={tz}>
        <Row label="Xodim o'z ish haqini Mini App'da ko'radi" hint="O'chiq bo'lsa, faqat ish kunlari va kechikishlar ko'rinadi"><Toggle name="showToEmployee" defaultChecked={rules.showToEmployee} /></Row>
      </SettingsCard>
      <SettingsCard icon="rule" title="Hisob qoidalari" desc="Ish haqi sahifasida tahrirlanadi" audit={a} tz={tz}>
        <Row label="Kechikish"><Value>{late}</Value></Row>
        <Row label="Sababsiz kelmagan kun"><Value tone={rules.absentPenalty ? 'danger' : undefined}>{money(rules.absentPenalty)}</Value></Row>
        <Row label="Qo'shimcha soat"><Value tone={rules.overtimePerHour ? 'success' : undefined}>{rules.overtimePerHour ? `soatiga ${formatSom(rules.overtimePerHour)}` : "yo'q"}</Value></Row>
        <Row label="Vazifa o'z vaqtida"><Value tone={rules.task.onTimeBonus ? 'success' : undefined}>{money(rules.task.onTimeBonus, '+')}</Value></Row>
        <Row label="Jarima chegarasi" hint="Jarimalar bundan oshmaydi"><Value>{rules.maxPenaltyPercent ? `asosiyning ${rules.maxPenaltyPercent}%` : 'cheklovsiz'}</Value></Row>
        <Row><Link href="/ish-haqi?qoidalar=1" className="btn-secondary">Qoidalarni tahrirlash ↗</Link></Row>
      </SettingsCard>
      <SettingsCard icon="lock" title="Oyni yopish" desc="Yopilgan oyda hisob o'zgarmaydi" audit={undefined}>
        <Row label="Qayta ochish"><Value tone="muted">Faqat egasi qayta ochadi</Value></Row>
        <Row label="Oxirgi yopilgan oy"><Value>{closed ? `${MONTHS[Number(closed.month.slice(5, 7)) - 1]} ${closed.month.slice(0, 4)}${closed.closedAt ? ` · ${formatDate(closed.closedAt, tz)}` : ''}` : '—'}</Value></Row>
      </SettingsCard>
    </SettingsForm>
  );
}

// ---------- Bildirishnomalar ----------

export function NotificationsTab({ s, audit, tz }: { s: TenantSettings; audit: Audit; tz: string }) {
  const grid = 'grid grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1.6fr)] gap-4 max-md:grid-cols-1 max-md:gap-2';
  return (
    <SettingsForm action={saveNotificationsAction}>
      <div className="flex flex-col gap-2">
        <section className="card px-6 pt-5 pb-2 max-md:px-4">
          <div className="flex items-center gap-3 pb-3.5">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-tint text-primary"><Icon name="notifications" fill /></span>
            <div className="flex-1"><div className="text-base font-bold">Bildirishnomalar</div><div className="text-[13px] text-muted">Qaysi hodisa haqida kimga xabar boradi</div></div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-primary-soft px-3.5 py-2.5 text-[13px] text-[#1F2A5C]">
            <Icon name="send" size={18} className="text-[#229ED9]" />
            <span>Xabarlar <b className="font-bold">@adoneuz_bot</b> orqali keladi. Telegram ulanmagan bo&apos;lsa — <Link href="/sozlamalar?tab=profil" className="font-bold text-primary">Profilim → Telegram</Link>.</span>
          </div>
          <div className={`${grid} border-b border-line-soft px-1 pt-4 pb-2.5 text-xs font-medium text-placeholder max-md:hidden`}><span>Hodisa</span><span>Telegram</span><span>Kimga</span></div>
          {NOTIFY_EVENTS.map((e, i) => {
            const meta = NOTIFY_EVENT_META[e];
            const rule = s.notifications[e];
            return (
              <div key={e} className={`${grid} items-center px-1 py-[13px] ${i < NOTIFY_EVENTS.length - 1 ? 'border-b border-[#F4F5F7]' : ''}`}>
                <div className="min-w-0"><div className="text-sm font-semibold">{meta.label}</div><div className="mt-0.5 text-xs text-muted">{e === 'absent' ? `Har kuni ${s.absentDigestAt} da` : meta.hint}</div></div>
                <Toggle name={`on_${e}`} defaultChecked={rule.on} />
                <div className="flex flex-wrap items-center gap-1.5">
                  {meta.roles.map((r) => <ChipCheck key={r} name={`to_${e}`} value={r} label={NOTIFY_ROLE_LABELS[r]} defaultChecked={rule.to.includes(r)} />)}
                </div>
              </div>
            );
          })}
        </section>
        <div className="pl-2 text-xs text-placeholder">Oxirgi o&apos;zgarish: {audit['settings.notifications'] ? `${audit['settings.notifications'].name} · ${formatDate(audit['settings.notifications'].at, tz)}` : '—'}</div>
      </div>
    </SettingsForm>
  );
}

// ---------- Tarif ----------

type Billing = {
  sub: { status: string; periodEnd: Date; code: string; name: string; maxEmployees: number; maxBranches: number; face: boolean } | null;
  employees: number; branches: number;
  plans: Array<{ code: string; name: string; priceSom: number; maxEmployees: number; maxBranches: number; faceControl: boolean }>;
};

const FEATURES: Record<string, string[]> = {
  sinov: ['Hamma imkoniyatlar', 'Karta kerak emas'],
  start: ['Davomat (GPS + selfi)', 'Vazifalar', 'Oylik tabel, Excel'],
  biznes: ['Yuz va qurilma tekshiruvi', 'Ish haqi va qoidalar', "Ruxsat so'rovlari"],
  pro: ["Biznes'dagi hammasi", "O'z Telegram botingiz", 'Ustuvor yordam'],
};

export function BillingTab({ b, tz, support }: { b: Billing; tz: string; support: string | null }) {
  const sub = b.sub;
  const trial = sub?.status === 'trial';
  const usage = sub ? [['Xodimlar', b.employees, sub.maxEmployees, 'xodim'], ['Filiallar', b.branches, sub.maxBranches, 'filial']] as const : [];
  const choose = (label: string, cls: string) => support
    ? <a href={support} target="_blank" rel="noreferrer" className={cls}>{label}</a>
    : <span title="To'lov tez orada — hozircha qo'llab-quvvatlash orqali" className={`${cls} cursor-not-allowed opacity-60`}>{label}</span>;
  return (
    <>
      <section className="card grid grid-cols-[minmax(0,1fr)_340px] items-center gap-8 p-6 max-lg:grid-cols-1 max-md:p-4">
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-medium text-muted">Joriy tarif</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[32px] font-extrabold tracking-[-0.03em]">{sub?.name ?? '—'}</span>
            {sub && (trial
              ? <StatusChip tone="warning" icon="hourglass_top">Sinov · {formatDate(sub.periodEnd, tz)} gacha</StatusChip>
              : <StatusChip tone="success" icon="check_circle">Faol · {formatDate(sub.periodEnd, tz)} gacha</StatusChip>)}
          </div>
          {sub && <span className="text-sm text-ink-2">{sub.maxEmployees} xodim · {sub.maxBranches} filial{sub.face ? ' · yuz tekshiruvi' : ''}</span>}
          <div className="mt-1">{choose('Tarifni tanlash', 'btn-primary h-11 px-[22px] text-sm')}</div>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl bg-page p-[18px]">
          {usage.map(([l, v, max, unit]) => (
            <div key={l} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]"><span className="text-muted">{l}</span><b className="tnum font-bold">{v} / {max} {unit}</b></div>
              <div className="h-1.5 rounded-full bg-primary-line"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, max ? Math.round((v / max) * 100) : 0)}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        {b.plans.map((p) => {
          const cur = sub?.code === p.code;
          return (
            <div key={p.code} className={`card flex flex-col gap-3 border-2 p-5 ${cur ? 'border-primary' : 'border-transparent'}`}>
              <div className="flex items-center justify-between"><span className="text-base font-bold">{p.name}</span>{cur && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white">Joriy</span>}</div>
              <div className="whitespace-nowrap"><span className="tnum text-[24px] font-extrabold tracking-[-0.03em]">{formatSom(p.priceSom)}</span><span className="text-[13px] text-muted"> {p.priceSom ? '/ oy' : '· 14 kun'}</span></div>
              <span className="text-[13px] font-semibold text-ink-2">{p.code === 'sinov' ? 'Biznes imkoniyatlari' : `${p.maxEmployees} xodim · ${p.maxBranches} filial`}</span>
              <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
                {(FEATURES[p.code] ?? []).map((x) => <span key={x} className="flex items-center gap-1.5 text-[13px] text-ink-2"><Icon name="check" size={16} className="text-success" />{x}</span>)}
              </div>
              <div className="mt-auto">
                {cur ? <span className="flex h-10 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary">Joriy tarif</span>
                  : p.code === 'sinov' ? <span className="flex h-10 items-center justify-center rounded-full border border-line text-[13px] font-bold text-placeholder">{trial ? 'Faol' : 'Sinov'}</span>
                  : choose('Tanlash', 'flex h-10 w-full items-center justify-center rounded-full border border-line text-[13px] font-bold hover:bg-page')}
              </div>
            </div>
          );
        })}
      </div>
      <section className="card flex flex-wrap items-center gap-6 px-6 py-5 max-md:px-4">
        <div className="min-w-[200px] flex-1"><div className="text-base font-bold">To&apos;lov usuli</div><div className="text-[13px] text-muted">Hozircha bank o&apos;tkazmasi orqali — hisob-faktura so&apos;rang</div></div>
        {[['Click', '#0A6CF5'], ['Payme', '#00A3A3']].map(([n, c]) => (
          <div key={n} className="flex h-12 items-center gap-2.5 rounded-[14px] border border-line bg-page px-[18px] opacity-60"><span className="text-base font-extrabold" style={{ color: c }}>{n}</span><span className="text-[11px] font-bold text-placeholder">tez orada</span></div>
        ))}
      </section>
      <section className="card px-6 pt-5 pb-6 max-md:px-4">
        <div className="text-base font-bold">To&apos;lovlar tarixi</div>
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] gap-3 border-b border-line-soft px-1 pt-3.5 pb-2.5 text-xs font-medium text-placeholder max-md:hidden"><span>Sana</span><span>Tarif</span><span>Davr</span><span>Summa</span><span>Chek</span></div>
        <div className="flex flex-col items-center gap-2.5 pt-9 pb-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-subtle text-placeholder"><Icon name="receipt_long" size={24} /></span>
          <span className="text-sm font-semibold text-ink-2">Hali to&apos;lov yo&apos;q</span>
          <span className="text-xs text-placeholder">Sinov muddati tugagach birinchi to&apos;lov shu yerda ko&apos;rinadi</span>
        </div>
      </section>
    </>
  );
}
