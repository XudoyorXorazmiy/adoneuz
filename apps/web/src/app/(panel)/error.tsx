'use client';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/icon';

/** Panel sahifasida kutilmagan xato — qobiq (menyu) joyida qoladi, o'rtada o'zbekcha xabar va «Qayta urinish». */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[panel] sahifa xatosi', error.digest ?? error.message); }, [error]);
  return (
    <section className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-tint text-danger"><Icon name="error" size={30} /></span>
      <h1 className="m-0 text-xl font-bold">Sahifa ochilmadi</h1>
      <p className="m-0 max-w-md text-sm text-muted">Server bir zum javob bermadi yoki aloqa uzildi. Ma&apos;lumotlaringiz saqlangan — qayta urinib ko&apos;ring.</p>
      <div className="flex gap-2.5">
        <button onClick={() => reset()} className="btn-primary h-11 px-6 text-sm">Qayta urinish</button>
        <button onClick={() => window.location.reload()} className="btn-secondary h-11 px-5 text-sm">Sahifani yangilash</button>
      </div>
      {error.digest && <p className="m-0 text-xs text-placeholder">Kod: {error.digest}</p>}
    </section>
  );
}
