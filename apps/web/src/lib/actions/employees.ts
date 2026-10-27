'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, employees, invites, tgLinks, withTenant } from '@adone/db';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { canTouch, createInvite, setEmployeeStatus } from '@/server/employees';
import { saveEmployeeFromForm } from '@/server/employees-form';
import { setDepartmentHead } from '@/server/department-head';
import { kick } from '@/server/jobs/enqueue';
import { queueNotifyEmployee } from '@/server/notify';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Xodim qo'shish / tahrirlash — forma tekshiruvi `server/employees-form.ts` da (rahbar Mini App'i bilan bir xil). */
export async function saveEmployeeAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('employees');
  const res = await saveEmployeeFromForm(user, f);
  if ('error' in res) return res;
  revalidatePath('/xodimlar');
  return { ok: res.ok };
}

/** Holat: tasdiqlash (pending → active), o'chirish (→ disabled), qayta yoqish — mantiq `server/employees.ts setEmployeeStatus`. */
export async function setEmployeeStatusAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  const id = z.uuid().parse(f.get('id'));
  const status = z.enum(['active', 'disabled']).parse(f.get('status'));
  const err = await withTenant(user.tenantId, (tx) => setEmployeeStatus(tx, user, id, status));
  if (err) throw new Error(err);
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

/** Xodimni bo'lim boshlig'i qilish (egasi, admin): hisob va menejer a'zoligi ochiladi, xodimga bot xabari ketadi. */
export async function appointHeadAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('employees');
  const employeeId = z.uuid().safeParse(str(f, 'employeeId'));
  const departmentId = z.uuid().safeParse(str(f, 'departmentId'));
  if (!employeeId.success || !departmentId.success) return { error: "Bo'limni tanlang" };
  const err = await setDepartmentHead(user, departmentId.data, { employeeId: employeeId.data });
  if (err) return { error: err };
  revalidatePath('/xodimlar');
  revalidatePath(`/xodimlar/${employeeId.data}`);
  kick();
  return { ok: "Bo'lim boshlig'i tayinlandi — xodimga Telegram'da xabar ketdi" };
}

/** Bo'limni boshliqsiz qoldirish (boshliqlikdan olish). */
export async function removeHeadAction(f: FormData): Promise<void> {
  const user = await assertArea('employees');
  const departmentId = z.uuid().parse(f.get('departmentId'));
  const err = await setDepartmentHead(user, departmentId, null);
  if (err) throw new Error(err);
  revalidatePath('/xodimlar');
  const back = z.uuid().safeParse(str(f, 'employeeId'));
  if (back.success) revalidatePath(`/xodimlar/${back.data}`);
}
