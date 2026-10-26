import 'server-only';
/**
 * Xodim formasini o'qish va saqlash — panel drawer'i (lib/actions/employees.ts) va rahbar Mini App'i («Xodim qo'shish») bir xil
 * tekshiruv bilan. Yangi xodim — `invited` + taklif kodi (havola xodimga Telegram'da yuboriladi).
 */
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditLog, branches, departments, employees, schedules, withTenant, type Tx } from '@adone/db';
import { can, normalizePhone, PAY_TYPES } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { canTouch, createInvite } from './employees';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optUuid = (v: string) => (z.uuid().safeParse(v).success ? v : null);

/** Formadan kelgan uuid shu ishxonaniki (RLS begona qatorni yashiradi, lekin FK uni qabul qiladi — boshqaruv-tizim §10). */
async function owns(tx: Tx, table: typeof branches | typeof departments | typeof schedules, id: string | null) {
  if (!id) return true;
  const [r] = await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  return !!r;
}

export type EmployeeFormResult = { error: string } | { ok: string; id: string; invite: string | null };

export async function saveEmployeeFromForm(user: TenantUser, f: FormData): Promise<EmployeeFormResult> {
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
  const res = await withTenant(user.tenantId, async (tx): Promise<string | { id: string; invite: string | null }> => {
    if (!(await owns(tx, departments, values.departmentId)) || !(await owns(tx, branches, values.branchId)) || !(await owns(tx, schedules, values.scheduleId))) return 'Tanlov topilmadi';
    if (!(await canTouch(tx, user, id, values.departmentId))) return "Faqat o'z bo'limingiz xodimlari";
    if (id) {
      const [r] = await tx.update(employees).set(values).where(eq(employees.id, id)).returning({ id: employees.id });
      if (!r) return 'Xodim topilmadi';
      await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'employee.update', entity: 'employee', entityId: id, meta: values });
      return { id, invite: null };
    }
    const [r] = await tx.insert(employees).values({ tenantId: user.tenantId, ...values, status: 'invited' }).returning({ id: employees.id });
    const invite = await createInvite(tx, user.tenantId, r!.id);
    await tx.insert(auditLog).values({ tenantId: user.tenantId, userId: user.id, action: 'employee.create', entity: 'employee', entityId: r!.id, meta: { fullName } });
    return { id: r!.id, invite };
  });
  if (typeof res === 'string') return { error: res };
  return { ok: id ? 'Saqlandi' : "Xodim qo'shildi — taklif havolasini unga yuboring", id: res.id, invite: res.invite };
}
