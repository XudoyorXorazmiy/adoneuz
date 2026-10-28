'use client';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/icon';

/** Mini App sahifasida kutilmagan xato: inglizcha «Application error» o'rniga o'zbekcha va «Qayta urinish». */
export default function TgError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[tg] sahifa xatosi', error.digest ?? error.message); }, [error]);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-4 bg-page px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-danger-tint text-danger"><Icon name="error" size={30} /></span>
      <h1 className="m-0 text-lg font-bold">Sahifa ochilmadi</h1>
      <p className="m-0 max-w-sm text-sm text-muted">Internet sekin bo&apos;lishi yoki server bir zum javob bermagan bo&apos;lishi mumkin. Qayta urinib ko&apos;ring.</p>
      <div className="flex gap-2.5">
        <button onClick={() => reset()} className="btn-primary h-12 px-6 text-sm">Qayta urinish</button>
        <button onClick={() => window.location.reload()} className="btn-secondary h-12 px-5 text-sm">Yangilash</button>
      </div>
      {error.digest && <p className="m-0 text-[11px] text-placeholder">Kod: {error.digest}</p>}
    </div>
  );
}
