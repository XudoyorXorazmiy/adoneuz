'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { normalizePhone, homeFor } from '@adone/core';
import { loginPlatformAdmin, loginTenantUser } from '@/lib/auth/login';
import { setSessionCookie } from '@/lib/auth/session';
import { allow } from '@/server/rate-limit';

export type LoginState = { error?: string; phone?: string } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get('phone') ?? '');
  const password = String(form.get('password') ?? '');
  const mode = form.get('mode') === 'platform' ? 'platform' : 'tenant';
  const next = String(form.get('next') ?? '');
  const phone = normalizePhone(raw);
  if (!phone) return { error: "Telefon raqamni to'liq kiriting", phone: raw };
  if (!password) return { error: 'Parolni kiriting', phone: raw };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'local';
  if (!(await allow(`login:ip:${ip}`, 20, 600))) return { error: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring.", phone: raw };

  const res = mode === 'platform' ? await loginPlatformAdmin(phone, password) : await loginTenantUser(phone, password, { ua: h.get('user-agent'), ip });
  if (!res.ok) return { error: res.error, phone: raw };
  await setSessionCookie(res.claims);
  if (mode === 'platform') redirect('/');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : homeFor(res.claims.role!));
}
