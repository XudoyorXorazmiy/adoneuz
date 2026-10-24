'use client';
import { useState, useTransition } from 'react';
import { Send } from 'lucide-react';
import { memberTelegramLinkAction } from '@/lib/actions/member';

/** Rahbar uchun: kechikkanlar, kelmaganlar, yangi xodimlar haqida Telegram'da xabar olish. */
export function TelegramLinkCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-info-tint bg-info-tint/40 px-4 py-3">
      <span className="flex items-center gap-2 text-[13px]"><Send size={16} className="text-info-text" /> Kechikkanlar, kelmaganlar va yangi xodimlar haqida Telegram&apos;da xabar oling.</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="btn-primary btn-sm">Botni ochish</a>
      ) : (
        <button disabled={pending} onClick={() => start(async () => setUrl((await memberTelegramLinkAction()).url))} className="btn-secondary btn-sm">Telegramni ulash</button>
      )}
    </div>
  );
}
