'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTenant } from '@adone/db';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { adjustLine, isMonth, savePayRules, setPeriodStatus } from '@/server/payroll';

/** Summa maydoni: «12 500», «12500» → 12500; bo'sh → 0. */
const som = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? '').replace(/[\s ']/g, '') || 0);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

/** Ish haqi qoidalari (egasi, admin) — butun shakl bitta saqlashda; tekshiruv core normalizePayRules'da. */
export async function savePayRulesAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('payroll');
  const nums = ['lateAmount', 'absentPenalty', 'earlyPerMinute', 'overtimePerHour', 'onTimeBonus', 'latePenalty', 'fiveStarBonus', 'maxPenaltyPercent'].map((k) => som(f.get(k)));
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return { error: "Summalar musbat butun son bo'lsin" };
  const [lateAmount, absentPenalty, earlyPerMinute, overtimePerHour, onTimeBonus, latePenalty, fiveStarBonus, maxPenaltyPercent] = nums;
  await withTenant(user.tenantId, (tx) => savePayRules(tx, user.tenantId, user.id, {
    monthlyProration: f.get('monthlyProration') === 'on', paidLeave: f.get('paidLeave') === 'on', showToEmployee: f.get('showToEmployee') === 'on',
    late: { mode: String(f.get('lateMode')), amount: lateAmount }, absentPenalty, earlyPerMinute, overtimePerHour, maxPenaltyPercent,
    task: { onTimeBonus, latePenalty, fiveStarBonus, countSelfTasks: f.get('countSelfTasks') === 'on' },
  }));
  revalidatePath('/ish-haqi');
  return { ok: 'Qoidalar saqlandi' };
}

export async function adjustLineAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('payroll');
  const id = z.uuid().safeParse(f.get('lineId'));
  const amount = som(f.get('amount')) * (f.get('sign') === '-' ? -1 : 1);
  if (!id.success || Number.isNaN(amount)) return { error: "Ma'lumot noto'g'ri" };
  const res = await withTenant(user.tenantId, (tx) => adjustLine(tx, { tenantId: user.tenantId, userId: user.id, lineId: id.data, amount, reason: String(f.get('reason') ?? '') }));
  if ('error' in res) return { error: res.error };
  revalidatePath('/ish-haqi');
  return { ok: 'Saqlandi' };
}

/** Davrni yopish (egasi, admin) yoki qayta ochish (faqat egasi). */
export async function periodStatusAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('payroll');
  const month = f.get('month');
  const to = z.enum(['closed', 'draft']).safeParse(f.get('to'));
  if (!isMonth(month) || !to.success) return { error: "Ma'lumot noto'g'ri" };
  if (to.data === 'draft' && user.role !== 'owner') return { error: 'Yopilgan davrni faqat egasi qayta ochadi' };
  const res = await withTenant(user.tenantId, (tx) => setPeriodStatus(tx, { tenantId: user.tenantId, userId: user.id, month, to: to.data }));
  if ('error' in res) return { error: res.error };
  revalidatePath('/ish-haqi');
  return { ok: to.data === 'closed' ? 'Davr yopildi' : 'Davr qayta ochildi' };
}
