'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { normalizePhone, TENANT_STATUSES } from '@adone/core';
import { requirePlatformUser } from '@/lib/auth/session';
import { createTenant, setTenantStatus } from '@/server/platform';
import { withPlatform } from '@adone/db';
import { enqueue, kick } from '@/server/jobs/enqueue';

export type CreateTenantState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

const CreateSchema = z.object({
  name: z.string().trim().min(2, 'Ishxona nomi kamida 2 belgi').max(80),
  ownerName: z.string().trim().min(2, 'Egasining ismini kiriting').max(80),
  ownerPhone: z.string(),
  password: z.string().max(100),
  planCode: z.string().min(1),
  trialDays: z.coerce.number().int().min(0).max(365),
});

export async function createTenantAction(_prev: CreateTenantState, form: FormData): Promise<CreateTenantState> {
  const admin = await requirePlatformUser();
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = CreateSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri", values };
  const phone = normalizePhone(parsed.data.ownerPhone);
  if (!phone) return { error: "Telefon raqamni to'liq kiriting", values };
  const password = parsed.data.password.trim() || null;
  if (password && password.length < 6) return { error: 'Parol kamida 6 belgi', values };
  const res = await createTenant({ ...parsed.data, ownerPhone: phone, password }, admin.id);
  if (!res.ok) return { error: res.error, values };
  revalidatePath('/');
  return { ok: res.existingUser ? `«${parsed.data.name}» yaratildi. Egasi mavjud hisob bilan kiradi (paroli o'zgarmadi).` : `«${parsed.data.name}» yaratildi. Egasi app.adone.uz ga kirishi mumkin.` };
}

export async function setTenantStatusAction(form: FormData): Promise<void> {
  const admin = await requirePlatformUser();
  const id = z.uuid().parse(form.get('id'));
  const status = z.enum(TENANT_STATUSES).parse(form.get('status'));
  await setTenantStatus(id, status, admin.id);
  revalidatePath('/');
}

/** Navbat ishchisini tekshirish: `ping` ishi yoziladi va darhol aylantiriladi. */
export async function pingJobsAction(): Promise<void> {
  await requirePlatformUser();
  await withPlatform((tx) => enqueue(tx, null, 'ping', {}));
  kick();
  revalidatePath('/navbat');
}
