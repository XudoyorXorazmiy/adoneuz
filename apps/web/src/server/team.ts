import 'server-only';
/**
 * Jamoa (Sozlamalar → Jamoa): panelga kiradigan rahbarlar — egasi, administrator, bo'lim boshlig'i. Xodimlar emas.
 * Yozish faqat shu yerdan. Qoidalar:
 *  - egasi admin va menejer qo'shadi/tahrirlaydi; admin — faqat menejer; egasi qatori bu yerdan o'zgarmaydi;
 *  - o'zini o'chirib/parolini tiklab bo'lmaydi (Profilim);
 *  - boshqa ishxonada ham a'zo bo'lgan hisobning paroli tiklanmaydi va qo'shilganda paroli o'zgarmaydi
 *    (bir ishxona admini boshqa ishxona egasi hisobini egallay olmasin).
 */
import { randomInt, randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { auditLog, branches, departments, employees, invites, memberships, tgLinks, users, withAuth, withTenant, type Tx } from '@adone/db';
import { hashPassword } from '@adone/db/password';
import type { MemberRole } from '@adone/core';
import { BOT_USERNAME } from '@/server/employees';

export type TeamRole = 'admin' | 'manager';

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  phone: string;
  role: MemberRole;
  departmentIds: string[];
  branchIds: string[];
  active: boolean;
  lastLoginAt: Date | null;
  telegram: boolean;
  mustChangePassword: boolean;
}

export async function listTeam(tenantId: string): Promise<TeamMember[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({
        membershipId: memberships.id, userId: users.id, name: users.name, phone: users.phone, role: memberships.role,
        departmentIds: memberships.departmentIds, branchIds: memberships.branchIds, active: memberships.isActive,
        lastLoginAt: users.lastLoginAt, mustChangePassword: users.mustChangePassword,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(ne(memberships.role, 'employee'))
      .orderBy(asc(memberships.createdAt));
    const ids = rows.map((r) => r.userId);
    const linked = ids.length
      ? new Set((await tx.select({ id: tgLinks.refId }).from(tgLinks).where(and(eq(tgLinks.kind, 'member'), inArray(tgLinks.refId, ids)))).map((r) => r.id))
      : new Set<string>();
    const order: Record<string, number> = { owner: 0, admin: 1, manager: 2 };
    return rows
      .map((r) => ({ ...r, telegram: linked.has(r.userId) }))
      .sort((a, b) => Number(b.active) - Number(a.active) || (order[a.role] ?? 9) - (order[b.role] ?? 9));
  });
}

/** Vaqtinchalik parol: «k7m-29qx» — chalkash belgilarsiz, o'qib aytish oson. */
export function tempPassword(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const pick = (n: number) => Array.from({ length: n }, () => a[randomInt(a.length)]).join('');
  return `${pick(3)}-${pick(4)}`;
}

type Actor = { tenantId: string; userId: string; role: MemberRole };
type Fail = { ok: false; error: string };

function canManage(actor: Actor, target: MemberRole): boolean {
  if (target === 'owner' || target === 'employee') return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && target === 'manager';
}

/** Tanlangan bo'lim/filial id'lari shu ishxonaniki (RLS begona qatorni ko'rsatmaydi). */
async function ownIds(tx: Tx, table: typeof departments | typeof branches, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  return (await tx.select({ id: table.id }).from(table).where(inArray(table.id, ids))).map((r) => r.id);
}

/** Hisob faqat shu ishxonada a'zomi (adone_auth hamma a'zoliklarni ko'radi). */
async function onlyHere(userId: string, tenantId: string): Promise<boolean> {
  const rows = await withAuth((tx) => tx.select({ t: memberships.tenantId }).from(memberships).where(eq(memberships.userId, userId)));
  return rows.every((r) => r.t === tenantId);
}

async function audit(tx: Tx, actor: Actor, action: string, entityId: string, meta: Record<string, unknown> = {}) {
  await tx.insert(auditLog).values({ tenantId: actor.tenantId, userId: actor.userId, action, entity: 'membership', entityId, meta });
}

/** Panel foydalanuvchisi uchun bir martalik Telegram havolasi. `login` — bot bog'lagach yangi vaqtinchalik parol yuboradi. */
async function memberInvite(tx: Tx, tenantId: string, userId: string, login: boolean): Promise<string> {
  // Profilim/Jamoa har ochilganda yangi havola yaratilmasin — QR allaqachon skanerlangan bo'lishi mumkin
  if (!login) {
    const [cur] = await tx.select({ code: invites.code }).from(invites)
      .where(and(eq(invites.kind, 'member'), eq(invites.refId, userId), isNull(invites.usedAt), gt(invites.expiresAt, new Date(Date.now() + 86_400_000)))).limit(1);
    if (cur) return `https://t.me/${BOT_USERNAME}?start=mem_${cur.code}`;
  }
  const code = Array.from({ length: 12 }, () => 'abcdefghjkmnpqrstvwxyz0123456789'[randomInt(32)]).join('');
  await tx.update(invites).set({ expiresAt: new Date() }).where(and(inArray(invites.kind, ['member', 'member_login']), eq(invites.refId, userId), isNull(invites.usedAt)));
  await tx.insert(invites).values({ code, tenantId, kind: login ? 'member_login' : 'member', refId: userId, expiresAt: new Date(Date.now() + 7 * 86_400_000) });
  return `https://t.me/${BOT_USERNAME}?start=mem_${code}`;
}

export interface AddMemberInput {
  name: string;
  phone: string; // normallashtirilgan 998XXXXXXXXX
  role: TeamRole;
  departmentIds: string[];
  branchIds: string[];
  method: 'password' | 'telegram';
  /** Oynada ko'rsatilgan vaqtinchalik parol (format tekshiriladi, aks holda serverda yaratiladi). */
  password?: string | null;
}

export type AddMemberResult =
  | { ok: true; existing: boolean; password: string | null; telegramUrl: string | null }
  | Fail;

export async function addMember(actor: Actor, input: AddMemberInput): Promise<AddMemberResult> {
  if (!canManage(actor, input.role)) return { ok: false, error: input.role === 'admin' ? "Administratorni faqat egasi qo'shadi" : "Ruxsat yo'q" };
  // Hisob boshqa ishxonada bo'lishi mumkin — adone_auth bilan qidiriladi (adone_app faqat o'z a'zolarini ko'radi)
  const [found] = await withAuth((tx) => tx.select({ id: users.id, platform: users.isPlatformAdmin }).from(users).where(eq(users.phone, input.phone)).limit(1));
  if (found?.platform) return { ok: false, error: "Bu raqamni jamoaga qo'shib bo'lmaydi — boshqa raqam kiriting" };
  return withTenant(actor.tenantId, async (tx) => {
    if (found) {
      const [m] = await tx.select({ id: memberships.id }).from(memberships).where(eq(memberships.userId, found.id)).limit(1);
      if (m) return { ok: false as const, error: "Bu raqam jamoada bor — ro'yxatdan tahrirlang" };
    }
    const departmentIds = input.role === 'manager' ? await ownIds(tx, departments, input.departmentIds) : [];
    const branchIds = input.role === 'manager' ? await ownIds(tx, branches, input.branchIds) : [];
    if (input.role === 'manager' && !departmentIds.length && !branchIds.length) return { ok: false as const, error: "Bo'lim boshlig'i uchun kamida bitta bo'lim yoki filial tanlang" };

    let password: string | null = null;
    let userId = found?.id;
    if (!userId) {
      password = input.password && /^[a-z2-9]{3}-[a-z2-9]{4}$/.test(input.password) ? input.password : tempPassword();
      // id shu yerda: RETURNING yangi qatorni SELECT siyosati bilan tekshiradi, a'zolik hali yo'q — ko'rinmaydi
      userId = randomUUID();
      await tx.insert(users).values({ id: userId, phone: input.phone, name: input.name, passwordHash: await hashPassword(password), mustChangePassword: true });
    }
    const [m] = await tx.insert(memberships).values({ userId, tenantId: actor.tenantId, role: input.role, departmentIds, branchIds }).returning({ id: memberships.id });
    await audit(tx, actor, 'member.create', m!.id, { name: input.name, phone: input.phone, role: input.role, departmentIds, branchIds, existing: !!found, method: input.method });
    // Telegram usuli: parol ko'rsatilmaydi — bot bog'lagach yangisini o'zi yuboradi (mavjud hisobda faqat bog'lash)
    const telegramUrl = input.method === 'telegram' ? await memberInvite(tx, actor.tenantId, userId, !found) : null;
    return { ok: true as const, existing: !!found, password: input.method === 'password' ? password : null, telegramUrl };
  });
}

export interface UpdateMemberInput {
  membershipId: string;
  name: string;
  role: TeamRole;
  departmentIds: string[];
  branchIds: string[];
}

export async function updateMember(actor: Actor, input: UpdateMemberInput): Promise<{ ok: true } | Fail> {
  return withTenant(actor.tenantId, async (tx) => {
    const [m] = await tx.select().from(memberships).where(eq(memberships.id, input.membershipId)).limit(1);
    if (!m) return { ok: false as const, error: "A'zo topilmadi" };
    if (m.userId === actor.userId) return { ok: false as const, error: "O'zingizni Profilim'da tahrirlang" };
    if (!canManage(actor, m.role) || !canManage(actor, input.role)) return { ok: false as const, error: "Ruxsat yo'q" };
    const departmentIds = input.role === 'manager' ? await ownIds(tx, departments, input.departmentIds) : [];
    const branchIds = input.role === 'manager' ? await ownIds(tx, branches, input.branchIds) : [];
    if (input.role === 'manager' && !departmentIds.length && !branchIds.length) return { ok: false as const, error: "Bo'lim boshlig'i uchun kamida bitta bo'lim yoki filial tanlang" };
    await tx.update(memberships).set({ role: input.role, departmentIds, branchIds }).where(eq(memberships.id, m.id));
    // Ismni faqat shu ishxonaga tegishli hisobda o'zgartiramiz
    if (input.name && (await onlyHere(m.userId, actor.tenantId))) await tx.update(users).set({ name: input.name }).where(eq(users.id, m.userId));
    await audit(tx, actor, 'member.update', m.id, { role: input.role, departmentIds, branchIds, before: { role: m.role, departmentIds: m.departmentIds, branchIds: m.branchIds } });
    return { ok: true as const };
  });
}

export async function resetMemberPassword(actor: Actor, membershipId: string): Promise<{ ok: true; password: string; phone: string; name: string } | Fail> {
  const target = await withTenant(actor.tenantId, (tx) =>
    tx.select({ m: memberships, phone: users.phone, name: users.name }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.id, membershipId)).limit(1),
  ).then((r) => r[0]);
  if (!target) return { ok: false, error: "A'zo topilmadi" };
  if (target.m.userId === actor.userId) return { ok: false, error: "O'z parolingizni Profilim'da o'zgartiring" };
  if (!canManage(actor, target.m.role)) return { ok: false, error: "Ruxsat yo'q" };
  if (!(await onlyHere(target.m.userId, actor.tenantId))) return { ok: false, error: "Bu hisob boshqa ishxonada ham bor — parolni egasining o'zi o'zgartiradi" };
  const password = tempPassword();
  await withTenant(actor.tenantId, async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(password), passwordChangedAt: new Date(), mustChangePassword: true, failedLogins: 0, lockedUntil: null }).where(eq(users.id, target.m.userId));
    await audit(tx, actor, 'member.password_reset', membershipId);
  });
  return { ok: true, password, phone: target.phone, name: target.name };
}

export async function setMemberActive(actor: Actor, membershipId: string, active: boolean): Promise<{ ok: true } | Fail> {
  return withTenant(actor.tenantId, async (tx) => {
    const [m] = await tx.select().from(memberships).where(eq(memberships.id, membershipId)).limit(1);
    if (!m) return { ok: false as const, error: "A'zo topilmadi" };
    if (m.userId === actor.userId) return { ok: false as const, error: "O'zingizni o'chira olmaysiz" };
    if (!canManage(actor, m.role)) return { ok: false as const, error: "Ruxsat yo'q" };
    await tx.update(memberships).set({ isActive: active }).where(eq(memberships.id, m.id));
    if (!active) await tx.delete(tgLinks).where(and(eq(tgLinks.kind, 'member'), eq(tgLinks.refId, m.userId)));
    await audit(tx, actor, active ? 'member.activate' : 'member.deactivate', m.id);
    return { ok: true as const };
  });
}

/** Jamoa a'zosiga (yoki o'ziga) Telegram bog'lash havolasi. */
export async function memberTelegramLink(actor: Actor, userId: string): Promise<{ ok: true; url: string } | Fail> {
  return withTenant(actor.tenantId, async (tx) => {
    const [m] = await tx.select({ role: memberships.role, active: memberships.isActive }).from(memberships).where(eq(memberships.userId, userId)).limit(1);
    if (!m || !m.active) return { ok: false as const, error: "A'zo topilmadi" };
    if (userId !== actor.userId && !canManage(actor, m.role)) return { ok: false as const, error: "Ruxsat yo'q" };
    return { ok: true as const, url: await memberInvite(tx, actor.tenantId, userId, false) };
  });
}

/**
 * «Telegram orqali taklif»: bot a'zo Telegram'ini bog'lagach chaqiriladi — yangi vaqtinchalik parol (admin ko'rmaydi).
 * Hisob boshqa ishxonada ham bo'lsa — parol o'zgarmaydi (null).
 */
export async function issueTelegramLogin(tenantId: string, userId: string): Promise<{ phone: string; password: string } | null> {
  if (!(await onlyHere(userId, tenantId))) return null;
  const password = tempPassword();
  return withTenant(tenantId, async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password), passwordChangedAt: new Date(), mustChangePassword: true, failedLogins: 0, lockedUntil: null })
      .where(eq(users.id, userId))
      .returning({ phone: users.phone });
    if (!u) return null;
    await tx.insert(auditLog).values({ tenantId, userId, action: 'member.telegram_login', entity: 'user', entityId: userId });
    return { phone: u.phone, password };
  });
}

/** «A'zo qo'shish» oynasida: raqam xodimlar ro'yxatida yoki jamoada bormi. */
export async function lookupPhone(tenantId: string, phone: string): Promise<{ employee: string | null; member: boolean }> {
  return withTenant(tenantId, async (tx) => {
    const [e] = await tx.select({ n: employees.fullName }).from(employees).where(eq(employees.phone, phone)).limit(1);
    const [m] = await tx.select({ id: memberships.id }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(users.phone, phone)).limit(1);
    return { employee: e?.n ?? null, member: !!m };
  });
}
