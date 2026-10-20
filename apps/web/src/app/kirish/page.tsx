import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { homeFor } from '@adone/core';
import { currentUser } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Kirish' };

export default async function LoginPage({ searchParams }: PageProps<'/kirish'>) {
  const user = await currentUser();
  if (user?.role) redirect(homeFor(user.role));
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  return <LoginForm mode="tenant" next={next} />;
}
