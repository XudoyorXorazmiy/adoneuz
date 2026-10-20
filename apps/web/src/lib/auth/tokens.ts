import { jwtVerify, SignJWT } from 'jose';
import type { MemberRole } from '@adone/core';
import { SESSION_TTL_SECONDS } from './constants';

/**
 * Cookie ichidagi da'volar. Edge-xavfsiz (faqat jose): proxy bazasiz tekshiradi.
 * `pwd` — users.password_changed_at (ms). Parol almashsa eski token currentUser() da rad etiladi.
 */
export interface SessionClaims {
  sub: string;
  name: string;
  tenantId: string | null;
  role: MemberRole | null;
  platform: boolean;
  pwd: number;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET sozlanmagan');
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  const { sub, ...rest } = claims;
  return new SignJWT({ ...rest })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ''),
      tenantId: (payload.tenantId as string | null) ?? null,
      role: (payload.role as MemberRole | null) ?? null,
      platform: payload.platform === true,
      pwd: Number(payload.pwd ?? 0),
    };
  } catch {
    return null;
  }
}
