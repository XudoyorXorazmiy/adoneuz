import Link from 'next/link';
import { formatPhone } from '@adone/core';
import { requireUser } from '@/lib/auth/session';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';

/** Sarlavhaning o'ng tomoni (dizayn): qo'ng'iroq, qidiruv, filial, foydalanuvchi chipi. */
/** `compact` — sahifa o'z tugmalarini qo'yganda (dizayn: Davomat): faqat qo'ng'iroq va qidiruv. */
export async function TopControls({ alert, compact }: { alert?: boolean; compact?: boolean }) {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-2.5">
      <Link href="/#qaror" className="btn-icon relative" title="Qaror kutmoqda">
        <Icon name="notifications" />
        {alert && <span className="absolute top-[9px] right-2.5 size-2 rounded-full border-2 border-white bg-danger" />}
      </Link>
      <Link href="/xodimlar" className="flex h-10 items-center gap-2 rounded-full border border-line bg-card pr-2 pl-3 text-muted max-sm:hidden" title="Xodim qidirish">
        <Icon name="search" className="text-ink" />
        <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold">⌘K</span>
      </Link>
      {!compact && <>
      <Link href="/filiallar" className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-[13px] font-semibold max-lg:hidden">
        <Icon name="location_on" size={18} className="text-primary" />
        Barcha filiallar
        <Icon name="expand_more" size={18} className="text-muted" />
      </Link>
      <div className="ml-1 flex h-12 items-center gap-2.5 rounded-full pr-2.5 pl-1 max-md:hidden">
        <Avatar name={user.name} size={40} />
        <div>
          <div className="text-sm font-bold">{user.name}</div>
          <div className="tnum text-xs text-muted">{formatPhone(user.phone)}</div>
        </div>
      </div>
      </>}
    </div>
  );
}
