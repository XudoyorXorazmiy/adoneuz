import type { Metadata } from 'next';
import { LoginForm } from '@/app/kirish/login-form';

export const metadata: Metadata = { title: 'Super admin — kirish' };

export default function PlatformLoginPage() {
  return <LoginForm mode="platform" />;
}
