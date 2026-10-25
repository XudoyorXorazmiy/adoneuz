import Link from 'next/link';
import { formatPhone } from '@adone/core';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

export function UserBox({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 pt-2">
      <Link href="/sozlamalar?tab=profil" title="Profilim" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl hover:opacity-80">
        <Avatar name={name} size={40} online />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{name}</span>
          <span className="tnum truncate text-xs text-muted">{formatPhone(phone)}</span>
        </span>
      </Link>
      <form action="/chiqish" method="post">
        <button title="Chiqish" className="flex size-7 items-center justify-center rounded-lg border border-line text-muted hover:bg-page hover:text-ink">
          <Icon name="logout" size={16} />
        </button>
      </form>
    </div>
  );
}
