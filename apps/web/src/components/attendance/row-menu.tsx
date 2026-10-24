'use client';
import { useEffect, useRef, useState, type ComponentProps, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { correctAttendanceAction } from '@/lib/actions/attendance';
import { FormDrawer } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';
import { CorrectFields } from './correct-fields';

/**
 * Qatordagi «⋯» menyusi (dizayn): Tuzatish · Profil · Telegramda yozish. Qator `<summary>` ichida turadi —
 * bosish qatorni ochib-yopmasligi uchun `preventDefault`; drawer esa portal orqali.
 */
export function RowMenu({ employeeId, name, subtitle, telegram, fields }: {
  employeeId: string; name: string; subtitle: string; telegram: string | null; fields: ComponentProps<typeof CorrectFields>;
}) {
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!menu) return;
    const close = (e: globalThis.MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);
  const stop = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const item = 'flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-semibold hover:bg-primary-soft hover:text-primary';
  return (
    <>
    <div ref={ref} className="relative" onClick={stop}>
      <button type="button" title="Amallar" onClick={() => setMenu((v) => !v)}
        className={`flex size-8 items-center justify-center rounded-full border transition ${menu ? 'border-line-strong bg-subtle' : 'border-line bg-card hover:bg-page'}`}>
        <Icon name="more_horiz" size={18} />
      </button>
      {menu && (
        <div className="absolute top-10 right-0 z-20 w-[220px] rounded-2xl bg-card p-1.5 shadow-[0_2px_6px_rgba(16,24,40,.06),0_16px_40px_rgba(16,24,40,.14)]">
          <button type="button" className={item} onClick={() => { setMenu(false); setDrawer(true); }}><Icon name="edit" size={18} />Tuzatish</button>
          <button type="button" className={item} onClick={() => router.push(`/xodimlar/${employeeId}`)}><Icon name="person" size={18} className="text-muted" />Profil</button>
          {telegram && (
            <button type="button" className={item} onClick={() => { setMenu(false); window.open(`https://t.me/${telegram}`, '_blank', 'noopener'); }}>
              <Icon name="send" size={18} className="text-[#229ED9]" />Telegramda yozish
            </button>
          )}
        </div>
      )}
    </div>
    {/* Drawer — menyu o'rovchisidan tashqarida: React hodisalari portal orqali ham ota-onaga ko'tariladi, `stop` formani buzardi */}
      <FormDrawer open={drawer} onOpenChange={setDrawer} title="Davomatni tuzatish" subtitle={`${name} · ${subtitle}`} action={correctAttendanceAction}>
        <CorrectFields {...fields} />
      </FormDrawer>
    </>
  );
}
