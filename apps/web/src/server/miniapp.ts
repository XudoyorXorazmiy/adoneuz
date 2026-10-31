import 'server-only';
import { latestDeadlineFor } from './deadline';
/** Mini App ko'rinishlari (xodim). Faqat o'z ma'lumoti: hamma so'rov employeeId bilan, tenant — Mini App sessiyasidan. */
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { attendanceDays, dayEvents, onLeave, employeeRule, taskBatches, taskEvents, taskReports, tasks, users, withTenant, currentWorkday } from '@adone/db';
import { computeDay, isOverdue, localDate, monthDays, onTime, shiftFor, type TaskStatus } from '@adone/core';
import type { TgUser } from '@/lib/tg/session';
import { isOnBreak } from './checkin';

export async function homeData(u: TgUser) {
  return withTenant(u.tenantId, async (tx) => {
    const now = new Date();
    // Yarim tundan keyin ham kechagi ochiq kun ko'rsatiladi («Ketdim» shu kunga yoziladi)
    const wd = await currentWorkday(tx, u.employeeId, now, u.tz);
    const rule = await employeeRule(tx, u.employeeId);
    const shift = wd.shift;
    const evs = wd.events;
    const leave = await onLeave(tx, u.employeeId, wd.date);
    const day = computeDay({ events: evs, shift, now, onLeave: leave });
    const today = localDate(now, u.tz);
    const open = await tx
      .select({ id: tasks.id, status: tasks.status, dueAt: tasks.dueAt, title: taskBatches.title, priority: taskBatches.priority, proofs: taskBatches.proofs })
      .from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .where(and(eq(tasks.assigneeEmployeeId, u.employeeId), inArray(tasks.status, ['new', 'accepted', 'in_progress', 'revision'])))
      .orderBy(asc(tasks.dueAt)).limit(30);
    // Bugungi: muddati bugun, o'tgan yoki muddatsiz
    const todays = open.filter((t) => !t.dueAt || localDate(t.dueAt, u.tz) <= today);
    return { date: wd.date, onLeave: leave, shift, hasSchedule: !!rule && rule.kind !== 'free', day, onBreak: isOnBreak(evs), tasks: todays.map((t) => ({ ...t, overdue: isOverdue({ status: t.status, dueAt: t.dueAt }, now) })), more: open.length - todays.length };
  });
}

export async function myTasks(u: TgUser) {
  return withTenant(u.tenantId, async (tx) => {
    const now = new Date();
    const rows = await tx
      .select({ id: tasks.id, status: tasks.status, dueAt: tasks.dueAt, submittedAt: tasks.submittedAt, rating: tasks.rating, title: taskBatches.title, priority: taskBatches.priority, proofs: taskBatches.proofs, source: taskBatches.source })
      .from(tasks).innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId))
      .where(and(eq(tasks.assigneeEmployeeId, u.employeeId), sql`(${tasks.status} in ('new','accepted','in_progress','revision','submitted') or ${tasks.updatedAt} > now() - interval '14 days')`))
      .orderBy(asc(tasks.dueAt), desc(tasks.createdAt)).limit(100);
    return rows.map((r) => ({ ...r, overdue: isOverdue({ status: r.status, dueAt: r.dueAt }, now) }));
  });
}

export async function myTask(u: TgUser, id: string) {
  return withTenant(u.tenantId, async (tx) => {
    const [r] = await tx.select({ t: tasks, b: taskBatches, creator: users.name }).from(tasks)
      .innerJoin(taskBatches, eq(taskBatches.id, tasks.batchId)).leftJoin(users, eq(users.id, taskBatches.createdByUserId))
      .where(and(eq(tasks.id, id), eq(tasks.assigneeEmployeeId, u.employeeId))).limit(1);
    if (!r) return null;
    const [rev] = r.t.status === 'revision'
      ? await tx.select({ comment: taskEvents.comment, at: taskEvents.createdAt, by: users.name }).from(taskEvents).leftJoin(users, eq(users.id, taskEvents.actorUserId))
        .where(and(eq(taskEvents.taskId, id), eq(taskEvents.toStatus, 'revision'))).orderBy(desc(taskEvents.createdAt)).limit(1)
      : [];
    const reports = await tx.select().from(taskReports).where(eq(taskReports.taskId, id)).orderBy(desc(taskReports.createdAt)).limit(5);
    const deadline = await latestDeadlineFor(tx, id, u.employeeId);
    return { ...r, revision: rev ?? null, reports, deadline };
  });
}

/** Tarix: oy bo'yicha kunlar (attendance_days) + vazifalar o'z vaqtida. */
export async function myMonth(u: TgUser, month: string) {
  const dates = monthDays(month);
  return withTenant(u.tenantId, async (tx) => {
    const days = await tx.select().from(attendanceDays).where(and(eq(attendanceDays.employeeId, u.employeeId), gte(attendanceDays.workDate, dates[0]!), lte(attendanceDays.workDate, dates.at(-1)!))).orderBy(desc(attendanceDays.workDate));
    const done = await tx.select({ dueAt: tasks.dueAt, submittedAt: tasks.submittedAt }).from(tasks)
      .where(and(eq(tasks.assigneeEmployeeId, u.employeeId), sql`to_char(${tasks.submittedAt} at time zone ${u.tz}, 'YYYY-MM') = ${month}`, sql`${tasks.status} <> 'cancelled'`));
    const timely = done.filter((d) => onTime(d)).length;
    return {
      days,
      worked: days.reduce((s, d) => s + d.workedMinutes, 0),
      workedDays: days.filter((d) => d.workedMinutes > 0).length,
      late: days.filter((d) => d.status === 'late').length,
      absent: days.filter((d) => d.status === 'absent').length,
      tasksDone: done.length,
      onTimePct: done.length ? Math.round((timely / done.length) * 100) : null,
    };
  });
}

export type MiniTaskStatus = TaskStatus;
