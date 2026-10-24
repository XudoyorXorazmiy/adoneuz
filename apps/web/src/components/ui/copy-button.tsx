'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';

export function CopyButton({ text, label = 'Nusxa', className = 'btn-secondary btn-sm' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Icon name="check" size={14}/> : <Icon name="content_copy" size={14}/>} {done ? 'Nusxalandi' : label}
    </button>
  );
}
