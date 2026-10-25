import Link from 'next/link';
import { formatPhone } from '@adone/core';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

/** `profileHref` — ism bosilganda (panelda Sozlamalar → Profilim); null — havolasiz (super admin). */
export function UserBox({ name, phone, profileHref = '/sozlamalar?tab=profil' }: { name: string; phone: string; profileHref?: string | null }) {
  const who = (
    <>
      <Avatar name={name} size={40} online />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-bold">{name}</span>
        <span className="tnum truncate text-xs text-muted">{formatPhone(phone)}</span>
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2.5 px-1 pt-2">
      {profileHref
        ? <Link href={profileHref} title="Profilim" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl hover:opacity-80">{who}</Link>
        : <span className="flex min-w-0 flex-1 items-center gap-2.5">{who}</span>}
      <form action="/chiqish" method="post">
        <button title="Chiqish" className="flex size-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-page hover:text-ink">
          <Icon name="logout" size={16} />
        </button>
      </form>
    </div>
  );
}
