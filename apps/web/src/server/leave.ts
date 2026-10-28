import 'server-only';
/**
 * Ruxsat so'rovlari — yagona yozish nuqtasi (bot, Mini App, panel). Hal qilish CAS bilan (ikki rahbar bir vaqtda bossa — bittasi),
 * har qaror audit_log'ga; tasdiqlansa / bekor bo'lsa o'sha kunlarning davomat yig'masi qayta quriladi («Ruxsatda» ↔ «Kelmadi»).
 */
import { aliasedTable, and, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { auditLog, departments, employees, leaveRequests, rebuildDay, tenants, users, withTenant, type Tx } from '@adone/db';
import {
  addDays, canDecideLeave, formatDate, LEAVE_KIND_ICONS, LEAVE_KIND_LABELS, leaveDays, localDate, validLeaveRange,
  type LeaveKind, type LeaveStatus, type MemberRole,
} from '@adone/core';
import type { TenantUser } from '@/lib/auth/session';
import { escHtml as esc } from '@/lib/task-text';
import { enqueue } from './jobs/enqueue';
import { deliver, memberChats, miniAppRow, notifyEmployee } from './notify';
import { departmentScope, inScope } from './scope';
import { send } from './telegram/api';
import type { JobOutcome } from './jobs/types';

const d = (s: string) => formatDate(`${s}T12:00:00Z`);
export const leavePeriod = (from: string, to: string) => (from === to ? d(from) : `${d(from)} – ${d(to)}`);

export async function createLeave(tx: Tx, input: { tenantId: string; employeeId: string; kind: LeaveKind; from: string; to: string; reason: string | null }): Promise<{ id: string } | { error: string }> {
  const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
  const err = validLeaveRange(input.from, input.to, localDate(new Date(), t!.tz));
  if (err) return { error: err };
  const [clash] = await tx.select({ id: leaveRequests.id }).from(leaveRequests).where(and(
    eq(leaveRequests.employeeId, input.employeeId), inArray(leaveRequests.status, ['pending', 'approved']),
    lte(leaveRequests.dateFrom, input.to), gte(leaveRequests.dateTo, input.from),
  )).limit(1);
  if (clash) return { error: "Bu kunlarga so'rov allaqachon bor" };
  const [r] = await tx.insert(leaveRequests).values({ tenantId: input.tenantId, employeeId: input.employeeId, kind: input.kind, dateFrom: input.from, dateTo: input.to, reason: input.reason?.slice(0, 500) || null }).returning({ id: leaveRequests.id });
  await enqueue(tx, input.tenantId, 'leave_notify', { id: r!.id, kind: 'created' }, { maxAttempts: 3 });
  return { id: r!.id };
}

export type LeaveActor = { userId: string; role: MemberRole } | { employeeId: string };

/** Hal qilish: rahbar — tasdiq/rad (menejer faqat o'z bo'limi), xodim — o'z kutilayotgan so'rovini bekor qiladi. */
export async function decideLeave(tx: Tx, input: { tenantId: string; id: string; to: LeaveStatus; actor: LeaveActor; comment?: string | null }): Promise<{ ok: true } | { error: string }> {
  const [r] = await tx.select({ l: leaveRequests, dep: employees.departmentId }).from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId)).where(eq(leaveRequests.id, input.id)).limit(1);
  if (!r) return { error: "So'rov topilmadi" };
  let who: 'employee' | 'reviewer';
  if ('employeeId' in input.actor) {
    if (r.l.employeeId !== input.actor.employeeId) return { error: "Ruxsat yo'q" };
    who = 'employee';
  } else {
    if (input.actor.role === 'manager') {
      const scope = await departmentScope(tx, { id: input.actor.userId, role: 'manager' } as TenantUser);
      if (!scope?.includes(r.dep ?? '')) return { error: "Faqat o'z bo'limingiz xodimlari" };
    }
    who = 'reviewer';
  }
  if (!canDecideLeave(r.l.status, input.to, who)) return { error: r.l.status === 'pending' ? 'Bu amal mumkin emas' : "So'rov allaqachon hal qilingan" };
  const userId = 'userId' in input.actor ? input.actor.userId : null;
  const upd = await tx.update(leaveRequests).set({ status: input.to, decidedByUserId: userId, decidedAt: new Date(), decisionComment: input.comment?.trim().slice(0, 500) || null })
    .where(and(eq(leaveRequests.id, input.id), eq(leaveRequests.status, 'pending'))).returning({ id: leaveRequests.id });
  if (!upd.length) return { error: "So'rov allaqachon hal qilingan" };
  await tx.insert(auditLog).values({ tenantId: input.tenantId, userId, action: `leave.${input.to}`, entity: 'leave_request', entityId: input.id, meta: { employeeId: r.l.employeeId, from: r.l.dateFrom, to: r.l.dateTo } });
  if (input.to === 'approved') {
    // O'tgan va bugungi kunlar yig'masi «Ruxsatda» bo'ladi; kelajak kunlar tick'da quriladi
    const [t] = await tx.select({ tz: tenants.timezone }).from(tenants).limit(1);
    const today = localDate(new Date(), t!.tz);
    for (let day = r.l.dateFrom; day <= r.l.dateTo && day <= today; day = addDays(day, 1)) {
      await rebuildDay(tx, { tenantId: input.tenantId, employeeId: r.l.employeeId, workDate: day, tz: t!.tz });
    }
  }
  if (who === 'reviewer') await enqueue(tx, input.tenantId, 'leave_notify', { id: input.id, kind: input.to }, { maxAttempts: 3 });
  return { ok: true };
}

/** `leave_notify`: yangi so'rov → rahbarlarga (tugmalar bilan); qaror → xodimga. */
export async function leaveNotify(tenantId: string, id: string, kind: string): Promise<JobOutcome> {
  const r = await withTenant(tenantId, async (tx) => (await tx.select({ l: leaveRequests, name: employees.fullName, dep: employees.departmentId }).from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId)).where(eq(leaveRequests.id, id)).limit(1))[0]);
  if (!r) return { skip: "so'rov yo‘q" };
  const { l } = r;
  const what = `${LEAVE_KIND_ICONS[l.kind]} ${LEAVE_KIND_LABELS[l.kind]} · ${leavePeriod(l.dateFrom, l.dateTo)} (${leaveDays(l.dateFrom, l.dateTo)} kun)`;
  if (kind === 'created') {
    if (l.status !== 'pending') return { skip: 'hal qilingan' };
    const chats = await memberChats(tenantId, r.dep, null, { event: 'leave' });
    if (!chats?.length) return { skip: 'rahbarlar Telegram ulamagan' };
    return deliver(chats, (chat) => send(chat, `📝 <b>Ruxsat so'rovi</b> · ${esc(r.name)}\n${what}${l.reason ? `\n💬 ${esc(l.reason)}` : ''}`, {
      inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `lv:ok:${id}` }, { text: '❌ Rad etish', callback_data: `lv:no:${id}` }], ...miniAppRow('/tg/qarorlar')],
    }));
  }
  const text = kind === 'approved' ? `✅ Ruxsat so'rovingiz tasdiqlandi:\n${what}` : `❌ Ruxsat so'rovingiz rad etildi:\n${what}${l.decisionComment ? `\nSabab: ${esc(l.decisionComment)}` : ''}`;
  return notifyEmployee(tenantId, l.employeeId, text);
}

export interface LeaveRow {
  id: string; employeeId: string; name: string; position: string | null; departmentName: string | null; kind: LeaveKind; from: string; to: string;
  reason: string | null; status: LeaveStatus; createdAt: Date; decidedAt: Date | null; decidedBy: string | null; comment: string | null;
}

/** Panel ro'yxati (menejer — faqat o'z bo'limi). */
export async function listLeaves(user: TenantUser, status: LeaveStatus | 'all') {
  return withTenant(user.tenantId, async (tx) => {
    const scope = await departmentScope(tx, user);
    const decider = aliasedTable(users, 'decider');
    const rows = await tx
      .select({ l: leaveRequests, name: employees.fullName, position: employees.position, departmentName: departments.name, decidedBy: decider.name })
      .from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .leftJoin(departments, eq(departments.id, employees.departmentId)).leftJoin(decider, eq(decider.id, leaveRequests.decidedByUserId))
      .where(and(inScope(employees.departmentId, scope), status === 'all' ? ne(leaveRequests.status, 'cancelled') : eq(leaveRequests.status, status)))
      .orderBy(desc(leaveRequests.createdAt)).limit(300);
    const counts = await tx.select({ s: leaveRequests.status, n: sql<number>`count(*)::int` }).from(leaveRequests).innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(inScope(employees.departmentId, scope)).groupBy(leaveRequests.status);
    return {
      rows: rows.map((r): LeaveRow => ({
        id: r.l.id, employeeId: r.l.employeeId, name: r.name, position: r.position, departmentName: r.departmentName, kind: r.l.kind, from: r.l.dateFrom, to: r.l.dateTo,
        reason: r.l.reason, status: r.l.status, createdAt: r.l.createdAt, decidedAt: r.l.decidedAt, decidedBy: r.decidedBy, comment: r.l.decisionComment,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.s, c.n])) as Partial<Record<LeaveStatus, number>>,
    };
  });
}

/** Xodimning o'z so'rovlari (bot / Mini App). */
export async function myLeaves(tx: Tx, employeeId: string) {
  return tx.select().from(leaveRequests).where(eq(leaveRequests.employeeId, employeeId)).orderBy(desc(leaveRequests.createdAt)).limit(20);
}
