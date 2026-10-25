'use server';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { normalizePhone } from '@adone/core';
import { STAFF_SIZES } from '@/lib/landing/content';
import { createLead, LEAD_STATUSES, notifyOwner, setLeadStatus } from '@/server/leads';
import { allow } from '@/server/rate-limit';
import { requirePlatformUser } from '@/lib/auth/session';

export type LeadState = { ok?: true; error?: string; field?: 'name' | 'phone' | 'size'; values?: { name: string; size: string } } | undefined;

/** Landing ariza formasi. Bot tuzog'i — yashirin `company`; IP bo'yicha 10 daqiqada 5 ta. */
export async function submitLeadAction(_p: LeadState, f: FormData): Promise<LeadState> {
  const name = String(f.get('name') ?? '').trim().slice(0, 80);
  const size = String(f.get('size') ?? '');
  const values = { name, size };
  if (String(f.get('company') ?? '')) return { ok: true }; // bot — jim qabul
  if (name.length < 2) return { error: 'Ismingizni yozing', field: 'name', values };
  const phone = normalizePhone(String(f.get('phone') ?? ''));
  if (!phone) return { error: "Telefon raqam noto'g'ri", field: 'phone', values };
  if (!(STAFF_SIZES as readonly string[]).includes(size)) return { error: 'Xodimlar sonini tanlang', field: 'size', values };
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'local';
  if (!(await allow(`lead:${ip}`, 5, 600))) return { error: "Juda ko'p urinish. 10 daqiqadan keyin qayta yuboring yoki Telegram'da yozing.", values };
  const source = String(f.get('source') ?? 'landing').slice(0, 40);
  const ref = new URL(h.get('referer') ?? 'http://x/');
  const utm = Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].flatMap((k) => (ref.searchParams.get(k) ? [[k, ref.searchParams.get(k)!.slice(0, 80)]] : [])));
  const lead = { name, phone, staffSize: size, source, utm };
  await createLead(lead);
  after(() => notifyOwner(lead));
  return { ok: true };
}

/** Platforma: ariza holati. */
export async function setLeadStatusAction(f: FormData): Promise<void> {
  await requirePlatformUser();
  const id = z.uuid().safeParse(f.get('id'));
  const status = z.enum(LEAD_STATUSES).safeParse(f.get('status'));
  if (!id.success || !status.success) return;
  await setLeadStatus(id.data, status.data);
  revalidatePath('/platforma/arizalar');
}
