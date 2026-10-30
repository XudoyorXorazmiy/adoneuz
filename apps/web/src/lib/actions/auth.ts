'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { phoneFromForm, homeFor } from '@adone/core';
import { loginPlatformAdmin, loginTenantUser } from '@/lib/auth/login';
import { setSessionCookie } from '@/lib/auth/session';
import { allow } from '@/server/rate-limit';

export type LoginState = { error?: string; phone?: string } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get('phone') ?? '');
  const password = String(form.get('password') ?? '');
  const mode = form.get('mode') === 'platform' ? 'platform' : 'tenant';
  const next = String(form.get('next') ?? '');
  const phone = phoneFromForm(String(form.get('cc') ?? ''), raw);
  if (!phone) return { error: "Telefon raqamni to'liq kiriting", phone: raw };
  if (!password) return { error: 'Parolni kiriting', phone: raw };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'local';
  // Baza bir zum javob bermasa — inglizcha xato sahifasi emas, formada tushunarli xabar (redirect try'dan tashqarida)
  let res: Awaited<ReturnType<typeof loginTenantUser>> | Awaited<ReturnType<typeof loginPlatformAdmin>>;
  try {
    if (!(await allow(`login:ip:${ip}`, 20, 600))) return { error: "Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring.", phone: raw };
    res = mode === 'platform' ? await loginPlatformAdmin(phone, password) : await loginTenantUser(phone, password, { ua: h.get('user-agent'), ip });
  } catch (e) {
    console.error('[auth] login', (e as Error).message);
    return { error: "Server bilan aloqa uzildi — birozdan keyin qayta urinib ko'ring.", phone: raw };
  }
  if (!res.ok) return { error: res.error, phone: raw };
  await setSessionCookie(res.claims);
  if (mode === 'platform') redirect('/');
  // Faqat ichki sahifaga (// va /\ — boshqa sayt); kirish/chiqish'ning o'ziga qaytarilmaydi
  const path = next.split('?')[0];
  const safe = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && path !== '/kirish' && path !== '/chiqish';
  redirect(safe ? next : homeFor(res.claims.role!));
}
