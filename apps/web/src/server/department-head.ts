import 'server-only';
/**
 * Bo'lim boshlig'i — BITTA tushuncha: `manager` a'zoligi (memberships.department_ids — qaysi bo'limlar) +
 * `departments.manager_user_id` (bo'limning ko'rsatiladigan boshlig'i). Boshliq jamoa a'zosi (Sozlamalar → Jamoa) yoki xodim
 * bo'lishi mumkin: xodim tayinlansa unga telefon bo'yicha hisob (users) va a'zolik yaratiladi, `employees.user_id` bog'lanadi —
 * u o'z davomatini xodim sifatida qiladi, bo'limini Mini App «Rahbar» rejimida (xohlasa panelda ham) boshqaradi.
 * Ruxsatlar — menejer roli: faqat o'z bo'limi, ish haqi va stavka ko'rinmaydi. Yozish faqat shu yerdan va team.ts dan.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { auditLog, departments, employees, memberships, tgLinks, users, withAuth, withTenant, type Tx } from '@adone/db';
import { hashPassword } from '@adone/db/password';
import type { TenantUser } from '@/lib/auth/session';
import { escHtml as esc } from '@/lib/task-text';
import { enqueue } from './jobs/enqueue';

export type HeadChoice = { employeeId: string } | { userId: string } | null;

/**
 * Boshliqni bo'limdan bo'shatish: `manager_user_id` tozalanadi, menejer a'zoligidan bo'lim chiqariladi; boshqa bo'limi ham,
 * filiali ham qolmasa — a'zolik nofaol va Telegram rahbar bog'lanishi uziladi (xodim bog'lanishi qoladi).
 */
export async function releaseHead(tx: Tx, userId: string, departmentId: string) {
  await tx.update(departments).set({ managerUserId: null }).where(and(eq(departments.id, departmentId), eq(departments.managerUserId, userId)));
  const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId)).limit(1);
  if (!m || m.role !== 'manager') return;
  const left = m.departmentIds.filter((d) => d !== departmentId);
  const [other] = await tx.select({ id: departments.id }).from(departments).where(and(eq(departments.managerUserId, userId), eq(departments.isActive, true))).limit(1);
  const still = left.length > 0 || m.branchIds.length > 0 || !!other;
  await tx.update(memberships).set({ departmentIds: left, isActive: still ? m.isActive : false }).where(eq(memberships.id, m.id));
  if (!still) await tx.delete(tgLinks).where(and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, userId)));
}

/** Xodim ishdan bo'shatilsa — u boshliq bo'lgan hamma bo'limlar bo'shatiladi. */
export async function releaseAllHeadships(tx: Tx, userId: string) {
  const own = await tx.select({ id: departments.id }).from(departments).where(eq(departments.managerUserId, userId));
  const [m] = await tx.select({ ids: memberships.departmentIds, role: memberships.role }).from(memberships).where(eq(memberships.userId, userId)).limit(1);
  const ids = [...new Set([...own.map((d) => d.id), ...(m?.role === 'manager' ? m.ids : [])])];
  for (const id of ids) await releaseHead(tx, userId, id);
}

/**
 * Jamoa (Sozlamalar) bilan sinxron: menejerga tanlangan bo'limlarning boshlig'i bo'sh bo'lsa — u boshliq; tanlovdan chiqarilgan
 * bo'limlarda boshliq bo'lsa — bo'shatiladi. Shunda «Bo'limlar» kartasi va Jamoa bir xil narsani ko'rsatadi.
 */
export async function syncHeads(tx: Tx, userId: string, departmentIds: string[]) {
  if (departmentIds.length) await tx.update(departments).set({ managerUserId: userId }).where(and(inArray(departments.id, departmentIds), isNull(departments.managerUserId)));
  await tx.update(departments).set({ managerUserId: null })
    .where(and(eq(departments.managerUserId, userId), departmentIds.length ? notInArray(departments.id, departmentIds) : sql`true`));
}

/** Bo'limni boshliqqa biriktirish (null — boshliqsiz). Faqat egasi va administrator. Xato matni yoki null. */
export async function setDepartmentHead(actor: TenantUser, departmentId: string, head: HeadChoice): Promise<string | null> {
  if (actor.role !== 'owner' && actor.role !== 'admin') return "Bo'lim boshlig'ini egasi yoki administrator tayinlaydi";
  let emp: { id: string; fullName: string; phone: string | null; userId: string | null; status: string; tg: number | null } | null = null;
  let found: { id: string; platform: boolean } | null = null;
  if (head && 'employeeId' in head) {
    emp = (await withTenant(actor.tenantId, (tx) => tx
      .select({ id: employees.id, fullName: employees.fullName, phone: employees.phone, userId: employees.userId, status: employees.status, tg: employees.telegramUserId })
      .from(employees).where(eq(employees.id, head.employeeId)).limit(1)))[0] ?? null;
    if (!emp) return 'Xodim topilmadi';
    if (emp.status !== 'active') return "Faqat faol xodim (botda ro'yxatdan o'tgan va tasdiqlangan) boshliq bo'la oladi";
    if (!emp.userId) {
      if (!emp.phone) return "Xodimning telefon raqami yo'q — avval kiriting";
      // Hisob boshqa ishxonada bo'lishi mumkin — adone_auth bilan (adone_app faqat o'z a'zolarini ko'radi)
      found = (await withAuth((tx) => tx.select({ id: users.id, platform: users.isPlatformAdmin }).from(users).where(eq(users.phone, emp!.phone!)).limit(1)))[0] ?? null;
      if (found?.platform) return "Bu raqamni rahbar qilib bo'lmaydi";
    }
  }
  const createUser = !!emp && !emp.userId && !found;
  // Parol hech kimga ko'rsatilmaydi (tasodifiy) — panelga kirish kerak bo'lsa Jamoa → «Parolni tiklash» yoki Telegram taklifi
  const passwordHash = createUser ? await hashPassword(randomUUID()) : null;
  const res = await withTenant(actor.tenantId, async (tx): Promise<string | { notify: { employeeId: string; dept: string } | null }> => {
    const [d] = await tx.select().from(departments).where(and(eq(departments.id, departmentId), eq(departments.isActive, true))).limit(1);
    if (!d) return "Bo'lim topilmadi";
    let userId: string | null = null;
    if (head && 'userId' in head) {
      const [m] = await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, head.userId), eq(memberships.isActive, true))).limit(1);
      if (!m) return 'Boshliq topilmadi';
      userId = head.userId;
    } else if (emp) {
      userId = emp.userId ?? found?.id ?? randomUUID();
      // id shu yerda, RETURNING'siz: users SELECT siyosati a'zolikdan oldin qatorni ko'rsatmaydi
      if (createUser) await tx.insert(users).values({ id: userId, phone: emp.phone!, name: emp.fullName, passwordHash: passwordHash!, mustChangePassword: true });
      if (!emp.userId) await tx.update(employees).set({ userId }).where(eq(employees.id, emp.id));
    }
    if (d.managerUserId === userId) return { notify: null };
    if (d.managerUserId) await releaseHead(tx, d.managerUserId, d.id);
    if (userId) {
      const [m] = await tx.select().from(memberships).where(eq(memberships.userId, userId)).limit(1);
      if (!m) await tx.insert(memberships).values({ userId, tenantId: actor.tenantId, role: 'manager', departmentIds: [d.id] });
      else if (m.role === 'manager' || m.role === 'employee') {
        await tx.update(memberships).set({ role: 'manager', departmentIds: [...new Set([...m.departmentIds, d.id])], isActive: true }).where(eq(memberships.id, m.id));
      }
      await tx.update(departments).set({ managerUserId: userId }).where(eq(departments.id, d.id));
    }
    await tx.insert(auditLog).values({
      tenantId: actor.tenantId, userId: actor.id, action: 'department.head', entity: 'department', entityId: d.id,
      meta: { before: d.managerUserId, after: userId, employeeId: emp?.id ?? null, newAccount: createUser },
    });
    return { notify: emp && userId && emp.tg ? { employeeId: emp.id, dept: d.name } : null };
  });
  if (typeof res === 'string') return res;
  if (res.notify) {
    await withTenant(actor.tenantId, (tx) => enqueue(tx, actor.tenantId, 'notify_employee', {
      employeeId: res.notify!.employeeId, miniPath: '/tg/rejim?to=rahbar',
      text: `👔 Siz <b>${esc(res.notify!.dept)}</b> bo'limi boshlig'i etib tayinlandingiz.\n\nEndi bo'lim xodimlariga vazifa berasiz, hisobotlarni tasdiqlaysiz, ruxsat so'rovlarini hal qilasiz. Mini App'ni oching → «Rahbar rejimi». Bo'lim bo'yicha bildirishnomalar shu chatga keladi.`,
    }, { maxAttempts: 3 }));
  }
  return null;
}

/** Boshliq bo'lgan bo'limlar: userId → bo'lim nomlari (Xodimlar ro'yxati va profil uchun). */
export async function headsByUser(tenantId: string): Promise<Map<string, Array<{ id: string; name: string }>>> {
  const rows = await withTenant(tenantId, (tx) => tx.select({ id: departments.id, name: departments.name, userId: departments.managerUserId }).from(departments)
    .where(and(eq(departments.isActive, true), sql`${departments.managerUserId} is not null`)));
  const map = new Map<string, Array<{ id: string; name: string }>>();
  for (const r of rows) map.set(r.userId!, [...(map.get(r.userId!) ?? []), { id: r.id, name: r.name }]);
  return map;
}

/** «Bo'lim boshlig'i» tanlovi: faol xodimlar (bo'limi bilan) va xodim yozuvi bo'lmagan jamoa a'zolari. */
export async function headCandidates(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const emps = await tx.select({ id: employees.id, name: employees.fullName, departmentId: employees.departmentId, userId: employees.userId })
      .from(employees).where(eq(employees.status, 'active')).orderBy(employees.fullName);
    const linked = new Set(emps.map((e) => e.userId).filter(Boolean));
    const members = (await tx.select({ id: users.id, name: users.name, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.isActive, true), inArray(memberships.role, ['owner', 'admin', 'manager']))).orderBy(users.name))
      .filter((m) => !linked.has(m.id));
    return { employees: emps, members };
  });
}
