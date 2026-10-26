'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, branches, departments, employees, invites, schedules, tgLinks, withTenant, type Tx } from '@adone/db';
import { can, normalizePhone, PAY_TYPES } from '@adone/core';
import { assertArea } from '@/lib/auth/guard';
import type { TenantUser } from '@/lib/auth/session';
import type { FormState } from '@/components/ui/form-drawer';
import { createInvite } from '@/server/employees';
import { queueNotifyEmployee } from '@/server/notify';
import { kick } from '@/server/jobs/enqueue';
import { T } from '@/server/bot/texts';
import { esc } from '@/server/telegram/api';
import { departmentScope } from '@/server/scope';
import { deleteBiometrics } from '@/server/face';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optUuid = (v: string) => (z.uuid().safeParse(v).success ? v : null);

/** Formadan kelgan uuid shu ishxonaniki (RLS begona qatorni yashiradi, lekin FK uni qabul qiladi — boshqaruv-tizim §10). */
async function owns(tx: Tx, table: typeof branches | typeof departments | typeof schedules, id: string | null) {
  if (!id) return true;
  const [r] = await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  return !!r;
}

/** Menejer faqat o'z bo'limidagi xodimni o'zgartiradi. */
async function canTouch(tx: Tx, user: TenantUser, employeeId: string | null, departmentId: string | null) {
  const scope = await departmentScope(tx, user);
  if (scope === null) return true;
  if (departmentId && !scope.includes(departmentId)) return false;
  if (employeeId) {
    const [e] = await tx.select({ d: employees.departmentId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
    return !!e?.d && scope.includes(e.d);
  }
  return !!departmentId;
}

export async function saveEmployeeAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('employees');
  const id = optUuid(str(f, 'id'));
  const fullName = str(f, 'fullName');
  if (fullName.length < 3) return { error: 'Ism-familiyani kiriting' };
  const rawPhone = str(f, 'phone');
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "Telefon raqam noto'g'ri" };
  // Stavka — faqat `payroll` ruxsati bilan (menejer formada ko'rmaydi; yuborsa ham yozilmaydi, §4)
  const pay = can(user.role, 'payroll')
    ? { payType: z.enum(PAY_TYPES).catch('monthly').parse(str(f, 'payType')), payRate: Math.max(0, Math.round(Number(str(f, 'payRate').replace(/\s/g, '') || 0))) }
    : {};
  const values = {
    fullName, phone, position: str(f, 'position') || null,
    departmentId: optUuid(str(f, 'departmentId')), branchId: optUuid(str(f, 'branchId')), scheduleId: optUuid(str(f, 'scheduleId')),
    ...pay,
  };
  const err = await withTenant(user.tenantId, async (tx) => {
    if (!(await owns(tx, departments, values.departmentId)) || !(await owns(tx, branches, values.branchId)) || !(await owns(tx, schedules, values.scheduleId))) return 'Tanlov topilmadi';
    if (!(await canTouch(tx, user, id, values.departmentId))) return "Faqat o'z bo'limingiz xodimlari";
    if (id) {
      const [r] = await tx.update(employees).set(values).where(eq(employees.id, id)).returning({ id: employees.id });
      if (!r) return 'Xodim topilmadi';
      await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'employee.update', entity: 'employee', entityId: id, meta: values });
    } else {
      const [r] = await tx.insert(employees).values({ tenantId: user.tenantId, ...values, status: 'invited' }).returning({ id: employees.id });
      await createInvite(tx, user.tenantId, r!.id);
      await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'employee.create', entity: 'employee', entityId: r!.id, meta: { fullName } });
    }
    return null;
  });
  if (err) return { error: err };
  revalidatePath('/xodimlar');
  return { ok: id ? 'Saqlandi' : "Xodim qo'shildi — taklif havolasini unga yuboring" };
}

/** Holat: tasdiqlash (pending → active), o'chirish (→ disabled), qayta yoqish. */
export async function setEmployeeStatusAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  const id = z.uuid().parse(f.get('id'));
  const status = z.enum(['active', 'disabled']).parse(f.get('status'));
  await withTenant(user.tenantId, async (tx) => {
    if (!(await canTouch(tx, user, id, null))) throw new Error("Ruxsat yo'q");
    const [e] = await tx.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!e) throw new Error('Xodim topilmadi');
    if (status === 'active' && !e.telegramUserId) throw new Error("Xodim hali botda ro'yxatdan o'tmagan");
    await tx.update(employees).set({ status, joinedAt: status === 'active' && !e.joinedAt ? new Date() : e.joinedAt }).where(eq(employees.id, id));
    // O'chirilgan xodim botdan uziladi; biometrika (yuz vektorlari va namuna videolari) o'chiriladi (§1.4)
    if (status === 'disabled') {
      await tx.delete(tgLinks).where(and(eq(tgLinks.kind, 'employee'), eq(tgLinks.refId, id)));
      await deleteBiometrics(tx, id);
      await tx.update(employees).set({ deviceId: null, deviceLabel: null, deviceBoundAt: null }).where(eq(employees.id, id));
    }
    if (status === 'active' && e.status === 'disabled') {
      // Qayta yoqilgan xodim botga qayta bog'lanadi (shaxsiy chatda chat id = Telegram user id)
      await tx.delete(tgLinks).where(and(eq(tgLinks.kind, 'employee'), eq(tgLinks.refId, id)));
      await tx.insert(tgLinks).values({ telegramUserId: e.telegramUserId!, chatId: e.telegramUserId!, tenantId: user.tenantId, kind: 'employee', refId: id });
    }
    if (status === 'active' && e.status !== 'active') await queueNotifyEmployee(tx, user.tenantId, id, T.approved(esc(user.tenantName)));
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: `employee.${status}`, entity: 'employee', entityId: id });
  });
  kick();
  revalidatePath('/xodimlar');
}

/** Yangi taklif havolasi (eskisi muddati o'tgan yoki yo'qolgan bo'lsa). */
export async function regenerateInviteAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  const id = z.uuid().parse(f.get('id'));
  await withTenant(user.tenantId, async (tx) => {
    if (!(await canTouch(tx, user, id, null))) throw new Error("Ruxsat yo'q");
    await tx.update(invites).set({ expiresAt: new Date() }).where(and(eq(invites.refId, id), isNull(invites.usedAt)));
    await createInvite(tx, user.tenantId, id);
  });
  revalidatePath('/xodimlar');
}

/** Qurilmani uzish: keyingi Mini App «Keldim» yangi qurilmani bog'laydi (telefon almashganda). */
export async function unbindDeviceAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  const id = z.uuid().parse(f.get('id'));
  await withTenant(user.tenantId, async (tx) => {
    if (!(await canTouch(tx, user, id, null))) throw new Error("Ruxsat yo'q");
    await tx.update(employees).set({ deviceId: null, deviceLabel: null, deviceBoundAt: null }).where(eq(employees.id, id));
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'employee.device_unbind', entity: 'employee', entityId: id });
  });
  revalidatePath(`/xodimlar/${id}`);
}

/** Yuz namunasini qayta olish: xodimga botda /yuz buyrug'i haqida xabar. */
export async function requestFaceResampleAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  const id = z.uuid().parse(f.get('id'));
  await withTenant(user.tenantId, async (tx) => {
    if (!(await canTouch(tx, user, id, null))) throw new Error("Ruxsat yo'q");
    await queueNotifyEmployee(tx, user.tenantId, id, "🔄 Rahbaringiz yuz namunasini yangilashni so'radi. /yuz buyrug'ini bosing va 3–5 soniyalik dumaloq video yuboring.");
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'employee.face_resample', entity: 'employee', entityId: id });
  });
  kick();
  revalidatePath(`/xodimlar/${id}`);
}
