import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { memberships, tenants, users, withPlatform, withTenant } from '@adone/db';
import { canUsePanel, type MemberRole, type TenantStatus } from '@adone/core';
import { currentSurface } from '@/lib/surface';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './constants';
import { signSession, verifySession, type SessionClaims } from './tokens';

export interface CurrentUser {
  id: string;
  name: string;
  phone: string;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  tenantName: string | null;
  tenantStatus: TenantStatus | null;
  tenantTimezone: string | null;
  role: MemberRole | null;
}

export type TenantUser = CurrentUser & { tenantId: string; role: MemberRole; tenantName: string; tenantTimezone: string };

/**
 * Shu so'rov uchun kirgan foydalanuvchi — baza bilan tasdiqlangan (a'zolik faol, ishxona bloklanmagan,
 * parol token berilgandan keyin o'zgarmagan, rol panelga kira oladi) va yuzaga mos. Yo'q bo'lsa null.
 */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  const surface = await currentSurface();

  if (surface.kind === 'platform') {
    if (!claims.platform) return null;
    return withPlatform(async (tx) => {
      const [u] = await tx.select().from(users).where(eq(users.id, claims.sub)).limit(1);
      if (!u || !u.isActive || !u.isPlatformAdmin || u.passwordChangedAt.getTime() > claims.pwd + 1000) return null;
      return { id: u.id, name: u.name, phone: u.phone, isPlatformAdmin: true, tenantId: null, tenantName: null, tenantStatus: null, tenantTimezone: null, role: null };
    });
  }

  if (surface.kind === 'app') {
    if (!claims.tenantId) return null;
    const tenantId = claims.tenantId;
    return withTenant(tenantId, async (tx) => {
      const [r] = await tx
        .select({
          id: users.id, name: users.name, phone: users.phone, isActive: users.isActive, isPlatformAdmin: users.isPlatformAdmin,
          pwdAt: users.passwordChangedAt, role: memberships.role, memberActive: memberships.isActive,
          tenantName: tenants.name, tenantStatus: tenants.status, tz: tenants.timezone,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
        .where(and(eq(memberships.userId, claims.sub), eq(memberships.tenantId, tenantId)))
        .limit(1);
      if (!r || !r.isActive || !r.memberActive || !canUsePanel(r.role)) return null;
      if (r.pwdAt.getTime() > claims.pwd + 1000) return null;
      if (r.tenantStatus === 'blocked' || r.tenantStatus === 'archived') return null;
      return {
        id: r.id, name: r.name, phone: r.phone, isPlatformAdmin: r.isPlatformAdmin, tenantId, tenantName: r.tenantName,
        tenantStatus: r.tenantStatus, tenantTimezone: r.tz, role: r.role,
      };
    });
  }
  return null;
});

export async function requireUser(): Promise<TenantUser> {
  const user = await currentUser();
  if (!user || !user.tenantId || !user.role) redirect('/kirish');
  return user as TenantUser;
}

export async function requirePlatformUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user || !user.isPlatformAdmin) redirect('/kirish');
  return user;
}

export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await signSession(claims);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}
