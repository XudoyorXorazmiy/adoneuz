'use client';
import { useState, useTransition } from 'react';
import { Icon } from '@/components/ui/icon';
import { memberTelegramLinkAction } from '@/lib/actions/member';

/** Rahbar uchun: kechikkanlar, kelmaganlar, yangi xodimlar haqida Telegram'da xabar olish. */
export function TelegramLinkCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary-soft px-4 py-3">
      <span className="flex items-center gap-2.5 text-[13px] font-medium">
        <span className="card-icon bg-card"><Icon name="send" fill size={18} /></span>
        Kechikkanlar, kelmaganlar va yangi xodimlar haqida Telegram&apos;da xabar oling.
      </span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="btn-primary h-9 px-4">Botni ochish<Icon name="arrow_outward" size={16} /></a>
      ) : (
        <button disabled={pending} onClick={() => start(async () => setUrl((await memberTelegramLinkAction()).url))} className="btn-secondary h-9 px-4">Telegramni ulash</button>
      )}
    </div>
  );
}
