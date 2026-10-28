'use server';
import { flashError } from '@/lib/flash';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTenant } from '@adone/db';
import { isValidDate, isValidTime, zonedTime, addDays, type CorrectionMeta } from '@adone/core';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { applyCorrections } from '@/server/attendance-correct';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/**
 * Davomat tuzatishi — yangi `correction` hodisasi (eski yozuv o'chmaydi, CLAUDE.md §1.2) + audit + kun qayta hisoblanadi.
 *   set             — «Keldi / Ketdi» vaqtini belgilash: eski birinchi kirish / oxirgi chiqish bekor, yangisi qo'shiladi (retimePlan)
 *   add_in / add_out — vaqt (ish kuni sanasi + HH:MM; tungi smenada ertasi kun belgisi)
 *   void / approve  — mavjud hodisa (rad etish / shubhalini tasdiqlash)
 */
export async function correctAttendanceAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('attendance');
  const employeeId = z.uuid().safeParse(str(f, 'employeeId'));
  const workDate = str(f, 'workDate');
  if (!employeeId.success || !isValidDate(workDate)) return { error: "Ma'lumot noto'g'ri" };
  const action = z.enum(['set', 'add_in', 'add_out', 'void', 'approve']).safeParse(str(f, 'action'));
  if (!action.success) return { error: 'Amalni tanlang' };
  const reason = str(f, 'reason').slice(0, 300);
  if (reason.length < 3) return { error: 'Sababni yozing — jurnalga tushadi' };
  const tz = user.tenantTimezone;
  let metas: CorrectionMeta[] | null = null;
  let want: { in?: Date; out?: Date } | null = null;
  if (action.data === 'set') {
    const tin = str(f, 'in');
    const tout = str(f, 'out');
    if ((tin && !isValidTime(tin)) || (tout && !isValidTime(tout))) return { error: "Vaqtni 09:00 ko'rinishida kiriting" };
    if (!tin && !tout) return { error: 'Keldi yoki ketdi vaqtini kiriting' };
    want = {
      in: tin ? zonedTime(workDate, tin, tz) : undefined,
      out: tout ? zonedTime(f.get('outNextDay') === '1' ? addDays(workDate, 1) : workDate, tout, tz) : undefined,
    };
    if (want.in && want.out && want.out <= want.in) return { error: "Ketdi vaqti keldidan keyin bo'lsin (tungi smena — «ertasi kun»)" };
  } else if (action.data === 'add_in' || action.data === 'add_out') {
    const time = str(f, 'time');
    if (!isValidTime(time)) return { error: "Vaqtni 09:00 ko'rinishida kiriting" };
    const date = f.get('nextDay') === '1' ? addDays(workDate, 1) : workDate;
    metas = [{ action: action.data, at: zonedTime(date, time, tz).toISOString(), reason }];
  } else {
    const target = z.uuid().safeParse(str(f, 'target'));
    if (!target.success) return { error: 'Hodisani tanlang' };
    metas = [{ action: action.data, target: target.data, reason }];
  }
  const err = await withTenant(user.tenantId, (tx) => applyCorrections(tx, user, { employeeId: employeeId.data, workDate, metas, want, reason }));
  if (err) return { error: err };
  revalidatePath('/davomat');
  revalidatePath('/xodimlar/[id]', 'page');
  revalidatePath('/');
  return { ok: 'Tuzatildi' };
}

/** Bosh sahifadagi shubhali hodisa: tasdiqlash yoki rad etish (bir bosish, sabab avtomatik). */
export async function resolveSuspiciousAction(f: FormData): Promise<void> {
  const fd = new FormData();
  for (const k of ['employeeId', 'workDate', 'target']) fd.set(k, String(f.get(k) ?? ''));
  const approve = f.get('decision') === 'approve';
  fd.set('action', approve ? 'approve' : 'void');
  fd.set('reason', approve ? 'Rahbar tasdiqladi' : 'Rahbar rad etdi');
  const r = await correctAttendanceAction(undefined, fd);
  // Ikkinchi bosish / allaqachon hal qilingan — sahifa yiqilmaydi, tepada xabar
  if (r?.error) await flashError(r.error);
}
