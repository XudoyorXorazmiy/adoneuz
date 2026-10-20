import { sql } from 'drizzle-orm';
import { db, type Tx } from './client';

/**
 * RLS konteksti (openstore naqshi). Tranzaksiya tugashi bilan sozlama va rol qaytadi.
 *   withTenant   — ilova roli (adone_app), siyosat faqat `tenant_id = app_tenant_id()` (OR yo'q → indeks ishlaydi).
 *   withPlatform — `SET LOCAL ROLE adone_platform`: super admin va navbat ishchisi (tenants, users, plans, jobs).
 *   withAuth     — `SET LOCAL ROLE adone_auth`: login (telefon bo'yicha user + a'zoliklar), auth_throttle.
 * Ilova roli bu rollarning siyosatlarini MEROS OLMAYDI (migratsiya 0001, INHERIT FALSE) — tenant kontekstida
 * platforma siyosati amal qilmaydi. Kontekst yo'q → qator yo'q.
 */
export function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!tenantId) throw new Error('tenantId kerak');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

const DB_ROLE = { platform: 'adone_platform', auth: 'adone_auth' } as const;

function withRole<T>(role: keyof typeof DB_ROLE, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('role', ${DB_ROLE[role]}, true)`);
    return fn(tx);
  });
}

/** Super admin va navbat ishchisi: tenants, users, memberships, plans, subscriptions, jobs. */
export const withPlatform = <T>(fn: (tx: Tx) => Promise<T>) => withRole('platform', fn);
/** Login: telefon bo'yicha user + a'zoliklar, urinishlar cheklovi. */
export const withAuth = <T>(fn: (tx: Tx) => Promise<T>) => withRole('auth', fn);
