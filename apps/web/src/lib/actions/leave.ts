'use server';
import { flashError } from '@/lib/flash';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { withTenant } from '@adone/db';
import { assertArea } from '@/lib/auth/guard';
import type { FormState } from '@/components/ui/form-drawer';
import { decideLeave } from '@/server/leave';
import { kick } from '@/server/jobs/enqueue';

/** Panel: ruxsat so'rovini tasdiqlash / rad etish (rad etishda sabab ixtiyoriy, xodimga yuboriladi). */
export async function decideLeaveAction(_p: FormState, f: FormData): Promise<FormState> {
  const user = await assertArea('requests');
  const id = z.uuid().safeParse(f.get('id'));
  const to = z.enum(['approved', 'rejected']).safeParse(f.get('to'));
  if (!id.success || !to.success) return { error: "Ma'lumot noto'g'ri" };
  const res = await withTenant(user.tenantId, (tx) => decideLeave(tx, { tenantId: user.tenantId, id: id.data, to: to.data, actor: { userId: user.id, role: user.role }, comment: String(f.get('comment') ?? '') }));
  if ('error' in res) return { error: res.error };
  revalidatePath('/sorovlar');
  revalidatePath('/davomat');
  revalidatePath('/xodimlar/[id]', 'page'); // profil → So'rovlar tabidan ham hal qilinadi
  revalidatePath('/');
  kick();
  return { ok: to.data === 'approved' ? 'Tasdiqlandi' : 'Rad etildi' };
}

export async function quickDecideLeaveAction(f: FormData): Promise<void> {
  const r = await decideLeaveAction(undefined, f);
  if (r?.error) await flashError(r.error);
}
