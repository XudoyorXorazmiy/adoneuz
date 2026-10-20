import { LogOut } from 'lucide-react';
import { initials } from '@adone/core';

export function UserBox({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">{initials(name)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-white">{name}</span>
        <span className="truncate text-xs text-white/55">{subtitle}</span>
      </span>
      <form action="/chiqish" method="post">
        <button title="Chiqish" className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
          <LogOut size={16} />
        </button>
      </form>
    </div>
  );
}
