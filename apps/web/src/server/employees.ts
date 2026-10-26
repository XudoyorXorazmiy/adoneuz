import 'server-only';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { auditLog, branches, departments, employees, invites, schedules, tgLinks, withTenant, type Tx } from '@adone/db';
import type { EmployeeStatus } from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { departmentScope, inScope } from './scope';
import { queueNotifyEmployee } from './notify';
import { deleteBiometrics } from './face';
import { T } from './bot/texts';
import { esc } from './telegram/api';

export const BOT_USERNAME = process.env.PLATFORM_BOT_USERNAME || 'adoneuz_bot';
export const INVITE_DAYS = 14;

export function inviteLink(code: string) {
  return `https://t.me/${BOT_USERNAME}?start=inv_${code}`;
}

/** 10 belgili kod (Crockford base32 — chalkash belgilarsiz). */
export function newInviteCode(): string {
  const alphabet = '0123456789abcdefghjkmnpqrstvwxyz';
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % 32]).join('');
}

export async function createInvite(tx: Tx, tenantId: string, employeeId: string): Promise<string> {
  const code = newInviteCode();
  await tx.insert(invites).values({ code, tenantId, kind: 'employee', refId: employeeId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) });
  return code;
}

export interface EmployeeFilter {
  status?: EmployeeStatus | 'all';
  departmentId?: string;
  q?: string;
}

export async function listEmployees(user: TenantUser, f: EmployeeFilter) {
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const base = and(
      inScope(employees.departmentId, scope),
      f.departmentId ? eq(employees.departmentId, f.departmentId) : undefined,
      f.q ? or(ilike(employees.fullName, `%${f.q}%`), ilike(employees.phone, `%${f.q.replace(/\D/g, '') || f.q}%`), ilike(employees.position, `%${f.q}%`)) : undefined,
    );
    const counts = await tx.select({ status: employees.status, n: sql<number>`count(*)::int` }).from(employees).where(base).groupBy(employees.status);
    const status = f.status && f.status !== 'all' ? f.status : undefined;
    const rows = await tx
      .select({
        id: employees.id, fullName: employees.fullName, phone: employees.phone, position: employees.position, status: employees.status,
        departmentId: employees.departmentId, branchId: employees.branchId, scheduleId: employees.scheduleId,
        payType: employees.payType, payRate: employees.payRate, telegramUserId: employees.telegramUserId, telegramUsername: employees.telegramUsername,
        departmentName: departments.name, branchName: branches.name, scheduleName: schedules.name,
        invite: sql<string | null>`(select i.code from invites i where i.ref_id = ${employees.id} and i.used_at is null and i.expires_at > now() order by i.created_at desc limit 1)`,
      })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(branches, eq(branches.id, employees.branchId))
      .leftJoin(schedules, eq(schedules.id, employees.scheduleId))
      .where(and(base, status ? eq(employees.status, status) : sql`${employees.status} <> 'disabled'`))
      .orderBy(sql`case ${employees.status} when 'pending' then 0 when 'invited' then 1 when 'active' then 2 else 3 end`, asc(employees.fullName));
    return { rows, counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<EmployeeStatus, number>>, scope };
  });
}

/** Forma tanlovlari: bo'lim, filial, jadval. */
export async function employeeOptions(tenantId: string) {
  return withTenant(tenantId, async (tx) => ({
    departments: await tx.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name)),
    branches: await tx.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name)),
    schedules: await tx.select({ id: schedules.id, name: schedules.name }).from(schedules).where(eq(schedules.isActive, true)).orderBy(asc(schedules.name)),
  }));
}


/** Menejer faqat o'z bo'limidagi xodimni o'zgartiradi (`departmentId` — formada tanlangan yangi bo'lim). */
export async function canTouch(tx: Tx, user: TenantUser, employeeId: string | null, departmentId: string | null) {
  const scope = await departmentScope(tx, user);
  if (scope === null) return true;
  if (departmentId && !scope.includes(departmentId)) return false;
  if (employeeId) {
    const [e] = await tx.select({ d: employees.departmentId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
    return !!e?.d && scope.includes(e.d);
  }
  return !!departmentId;
}

/**
 * Holat: tasdiqlash (pending → active), o'chirish (→ disabled), qayta yoqish. Panel action'i va rahbar Mini App'i shu yerdan.
 * Xato matni yoki null.
 */
export async function setEmployeeStatus(tx: Tx, user: TenantUser, id: string, status: 'active' | 'disabled'): Promise<string | null> {
  if (!(await canTouch(tx, user, id, null))) return "Ruxsat yo'q";
  const [e] = await tx.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (!e) return 'Xodim topilmadi';
  if (status === 'active' && !e.telegramUserId) return "Xodim hali botda ro'yxatdan o'tmagan";
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
  return null;
}
