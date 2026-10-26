'use server';
/** Sozlamalar sahifasi amallari. Ruxsat — can(): `settings` (egasi, admin), `billing` (egasi); Profilim — har panel foydalanuvchisi. */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import {
  NOT_ACCEPTED_OPTIONS, NOTIFY_EVENTS, NOTIFY_EVENT_META, NOTIFY_ROLES, normalizePhone, tenantSettings, isValidTime,
  type NotifyEvent, type NotifyRole, type TenantSettings,
} from '@adone/core';
import { withTenant } from '@adone/db';
import { assertArea } from '@/lib/auth/guard';
import { requireUser, setSessionCookie } from '@/lib/auth/session';
import type { FormState } from '@/components/ui/form-drawer';
import { changeMyPassword, logoutOtherDevices, unlinkMyTelegram, updateMyName } from '@/server/account';
import { archiveTenant, readSettings, saveSettings, updateTenantProfile } from '@/server/settings';
import { loadPayRules, savePayRules } from '@/server/payroll';
import {
  addMember, lookupPhone, memberTelegramLink, resetMemberPassword, setMemberActive, updateMember, type TeamRole,
} from '@/server/team';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const on = (f: FormData, k: string) => f.get(k) === 'on' || f.get(k) === '1';
const num = (f: FormData, k: string) => Number(str(f, k));
const done = (): FormState => {
  revalidatePath('/sozlamalar');
  return { ok: 'Saqlandi' };
};

// ---------- Profilim ----------

export async function saveMyNameAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const err = await updateMyName(user, str(f, 'name'));
  return err ? { error: err } : done();
}

export async function changePasswordAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const next = str(f, 'next');
  if (next !== str(f, 'repeat')) return { error: 'Yangi parol takrori mos emas' };
  const r = await changeMyPassword(user, String(f.get('current') ?? ''), next);
  if (!r.ok) return { error: r.error };
  // Boshqa qurilmalar chiqadi, joriy sessiya yangi vaqt bilan davom etadi
  await setSessionCookie({ sub: user.id, name: user.name, tenantId: user.tenantId, role: user.role, platform: false, pwd: r.changedAt.getTime() });
  revalidatePath('/', 'layout');
  return { ok: 'Parol yangilandi. Boshqa qurilmalardan chiqildi.' };
}

export async function logoutOthersAction(): Promise<void> {
  const user = await requireUser();
  const at = await logoutOtherDevices(user);
  await setSessionCookie({ sub: user.id, name: user.name, tenantId: user.tenantId, role: user.role, platform: false, pwd: at.getTime() });
  revalidatePath('/sozlamalar');
}

export async function unlinkTelegramAction(): Promise<void> {
  const user = await requireUser();
  await unlinkMyTelegram(user);
  revalidatePath('/sozlamalar');
}

/** O'z Telegram'ini (yoki jamoa a'zosinikini) bog'lash havolasi + QR (SVG). */
export async function telegramLinkAction(userId?: string): Promise<{ url: string; svg: string } | { error: string }> {
  const user = await requireUser();
  const target = userId ?? user.id;
  if (target !== user.id) await assertArea('settings');
  const r = await memberTelegramLink({ tenantId: user.tenantId, userId: user.id, role: user.role }, target);
  if (!r.ok) return { error: r.error };
  const svg = await QRCode.toString(r.url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111827', light: '#0000' } });
  return { url: r.url, svg };
}

// ---------- Ishxona ----------

export async function saveTenantAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('settings');
  const err = await updateTenantProfile({ tenantId: user.tenantId, userId: user.id }, { name: str(f, 'name'), timezone: str(f, 'timezone') });
  if (err) return { error: err };
  revalidatePath('/', 'layout');
  return { ok: 'Saqlandi' };
}

export async function archiveTenantAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('billing'); // faqat egasi
  if (str(f, 'confirm') !== user.tenantName) return { error: `Tasdiqlash uchun «${user.tenantName}» deb yozing` };
  await archiveTenant({ tenantId: user.tenantId, userId: user.id });
  redirect('/kirish');
}

// ---------- Davomat ----------

export async function saveAttendanceAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('settings');
  const digestAt = str(f, 'absentDigestAt');
  if (!isValidTime(digestAt)) return { error: "Xabar vaqtini 10:00 ko'rinishida kiriting" };
  const autoClose = num(f, 'autoCloseHours');
  const freeClose = num(f, 'freeAutoCloseHours');
  if (!(Number.isInteger(autoClose) && autoClose >= 1 && autoClose <= 12)) return { error: 'Avtomatik yopish: 1–12 soat' };
  if (!(Number.isInteger(freeClose) && freeClose >= 4 && freeClose <= 24)) return { error: 'Erkin grafikda: 4–24 soat' };
  const threshold = num(f, 'faceThreshold');
  const yaw = num(f, 'faceYaw');
  if (!(threshold >= 30 && threshold <= 80) || !(yaw >= 5 && yaw <= 45)) return { error: 'Yuz tekshiruvi qiymatlari chegaradan tashqarida' };
  const absentTo = roles(f, 'absentTo', 'absent');
  if (on(f, 'absentOn') && absentTo.length === 0) return { error: "«Kelmaganlar» xabari uchun kamida bitta qabul qiluvchi tanlang yoki uni o'chiring" };
  await withTenant(user.tenantId, async (tx) => {
    const cur = await readSettings(tx);
    const actor = { tenantId: user.tenantId, userId: user.id };
    await saveSettings(tx, actor, 'attendance', {
      autoApprove: on(f, 'autoApprove'), absentDigestAt: digestAt, autoCloseHours: autoClose, freeAutoCloseHours: freeClose,
      notifications: { ...cur.notifications, absent: { on: on(f, 'absentOn'), to: absentTo } },
    });
    await saveSettings(tx, actor, 'face', { face: { threshold: threshold / 100, minYawRange: yaw }, deviceBinding: on(f, 'deviceBinding') });
  });
  return done();
}

function roles(f: FormData, key: string, event: NotifyEvent): NotifyRole[] {
  const got = f.getAll(key).map(String);
  return NOTIFY_ROLES.filter((r) => NOTIFY_EVENT_META[event].roles.includes(r) && got.includes(r));
}

// ---------- Vazifalar ----------

export async function saveTaskSettingsAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('settings');
  const notAcceptedMin = num(f, 'notAcceptedMin');
  if (!(NOT_ACCEPTED_OPTIONS as readonly number[]).includes(notAcceptedMin)) return { error: 'Eslatma vaqtini tanlang' };
  const from = Number(str(f, 'quietFrom').slice(0, 2));
  const to = Number(str(f, 'quietTo').slice(0, 2));
  if (!(from >= 0 && from <= 23 && to >= 0 && to <= 23) || from === to) return { error: 'Tinch vaqt: boshlanish va tugash soati har xil bo‘lsin' };
  await withTenant(user.tenantId, async (tx) => {
    const actor = { tenantId: user.tenantId, userId: user.id };
    await saveSettings(tx, actor, 'tasks', { selfTasksNeedApproval: on(f, 'selfTasksNeedApproval') });
    await saveSettings(tx, actor, 'reminders', {
      reminders: { notAccepted: on(f, 'notAccepted'), notAcceptedMin, dueSoon: on(f, 'dueSoon'), overdue: on(f, 'overdue'), reviewStale: on(f, 'reviewStale') },
      quietHours: { from, to },
    });
    // «Ish haqiga ta'sir qiladi» — ish haqi qoidasi (o'zgarmagan bo'lsa yozilmaydi)
    const rules = await loadPayRules(tx);
    const count = on(f, 'countSelfTasks');
    if (rules.task.countSelfTasks !== count) await savePayRules(tx, user.tenantId, user.id, { ...rules, task: { ...rules.task, countSelfTasks: count } });
  });
  return done();
}

// ---------- Ish haqi ----------

export async function savePaySettingsAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('settings');
  if (user.role !== 'owner' && user.role !== 'admin') return { error: "Ruxsat yo'q" };
  await withTenant(user.tenantId, async (tx) => {
    const rules = await loadPayRules(tx);
    const show = on(f, 'showToEmployee');
    if (rules.showToEmployee !== show) await savePayRules(tx, user.tenantId, user.id, { ...rules, showToEmployee: show });
  });
  return done();
}

// ---------- Bildirishnomalar ----------

export async function saveNotificationsAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('settings');
  const notifications = Object.fromEntries(NOTIFY_EVENTS.map((e) => [e, { on: on(f, `on_${e}`), to: roles(f, `to_${e}`, e) }])) as TenantSettings['notifications'];
  const empty = NOTIFY_EVENTS.find((e) => notifications[e].on && notifications[e].to.length === 0);
  if (empty) return { error: `«${NOTIFY_EVENT_META[empty].label}» uchun kamida bitta qabul qiluvchi tanlang yoki o'chiring` };
  await withTenant(user.tenantId, (tx) => saveSettings(tx, { tenantId: user.tenantId, userId: user.id }, 'notifications', { notifications: tenantSettings({ notifications }).notifications }));
  return done();
}

// ---------- Jamoa ----------

export type MemberFormState =
  | { error?: string; ok?: undefined }
  | { ok: true; name: string; roleLabel: string; phone: string; password: string | null; existing: boolean; telegramUrl: string | null }
  | undefined;

const ROLE_LABEL: Record<TeamRole, string> = { admin: 'Administrator', manager: "Bo'lim boshlig'i" };

export async function addMemberAction(_p: MemberFormState, f: FormData): Promise<MemberFormState> {
  const user = await assertArea('settings');
  const name = str(f, 'name');
  if (name.length < 3) return { error: 'Ism-familiyani kiriting' };
  const phone = normalizePhone(str(f, 'phone'));
  if (!phone) return { error: "Telefon raqamni to'liq kiriting" };
  const role = str(f, 'role') === 'admin' ? 'admin' : 'manager';
  const method = str(f, 'method') === 'telegram' ? 'telegram' : 'password';
  const r = await addMember({ tenantId: user.tenantId, userId: user.id, role: user.role }, {
    name, phone, role, method, password: method === 'password' ? str(f, 'password') : null,
    departmentIds: f.getAll('departmentIds').map(String), branchIds: f.getAll('branchIds').map(String),
  });
  if (!r.ok) return { error: r.error };
  revalidatePath('/sozlamalar');
  return { ok: true, name, roleLabel: ROLE_LABEL[role], phone, password: r.password, existing: r.existing, telegramUrl: r.telegramUrl };
}

export async function updateMemberAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('settings');
  const r = await updateMember({ tenantId: user.tenantId, userId: user.id, role: user.role }, {
    membershipId: str(f, 'membershipId'), name: str(f, 'name'), role: str(f, 'role') === 'admin' ? 'admin' : 'manager',
    departmentIds: f.getAll('departmentIds').map(String), branchIds: f.getAll('branchIds').map(String),
  });
  if (!r.ok) return { error: r.error };
  return done();
}

export async function resetMemberPasswordAction(membershipId: string): Promise<{ password: string; phone: string; name: string } | { error: string }> {
  const user = await assertArea('settings');
  const r = await resetMemberPassword({ tenantId: user.tenantId, userId: user.id, role: user.role }, membershipId);
  if (!r.ok) return { error: r.error };
  revalidatePath('/sozlamalar');
  return { password: r.password, phone: r.phone, name: r.name };
}

export async function setMemberActiveAction(membershipId: string, active: boolean): Promise<{ error?: string }> {
  const user = await assertArea('settings');
  const r = await setMemberActive({ tenantId: user.tenantId, userId: user.id, role: user.role }, membershipId, active);
  if (!r.ok) return { error: r.error };
  revalidatePath('/sozlamalar');
  return {};
}

export async function lookupPhoneAction(raw: string): Promise<{ employee: string | null; member: boolean } | null> {
  const user = await assertArea('settings');
  const phone = normalizePhone(raw);
  return phone ? lookupPhone(user.tenantId, phone) : null;
}
