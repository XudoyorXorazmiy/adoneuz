'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tgSetModeAction } from '@/lib/actions/miniapp';
import { Icon } from '@/components/ui/icon';

/** Rejimni saqlab bosh sahifaga o'tadi (server komponent cookie yoza olmaydi). */
export function ModeSwitch({ to }: { to: 'rahbar' | 'xodim' }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void tgSetModeAction(to).then((r) => (r.error ? setErr(r.error) : router.replace('/tg')));
  }, [to, router]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-page p-6 text-center">
      {err ? <><p className="m-0 text-sm font-semibold text-danger">{err}</p><Link href="/tg" className="btn-secondary h-11 px-5 text-sm">Bosh sahifa</Link></>
        : <><Icon name="sync" size={28} className="animate-spin text-primary" /><p className="m-0 text-sm text-muted">{to === 'rahbar' ? 'Rahbar rejimi…' : 'Xodim rejimi…'}</p></>}
    </div>
  );
}

/** Ikki rejimli boshliq uchun bosh sahifadagi almashtirgich. */
export function ModeLink({ to }: { to: 'rahbar' | 'xodim' }) {
  return (
    <Link href={`/tg/rejim?to=${to}`} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-card px-3 text-[12px] font-bold text-primary shadow-[var(--shadow-card)]">
      <Icon name={to === 'rahbar' ? 'supervisor_account' : 'badge'} size={17} />{to === 'rahbar' ? 'Rahbar rejimi' : 'Xodim rejimi'}
    </Link>
  );
}
