import 'server-only';
import { redirect } from 'next/navigation';
import { can, homeFor, type Area } from '@adone/core';
import { requireUser, type TenantUser } from './session';

/** Sahifa darajasidagi ruxsat: bo'lim rolga yopiq bo'lsa rolning bosh sahifasiga. */
export async function requireArea(area: Area): Promise<TenantUser> {
  const user = await requireUser();
  if (!can(user.role, area)) redirect(homeFor(user.role));
  return user;
}

/** Server action ichida: ruxsat bo'lmasa xato (yo'naltirish emas). */
export async function assertArea(area: Area): Promise<TenantUser> {
  const user = await requireUser();
  if (!can(user.role, area)) throw new Error("Bu amal uchun ruxsat yo'q");
  return user;
}
