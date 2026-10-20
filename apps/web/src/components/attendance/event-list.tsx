import { ExternalLink, Video } from 'lucide-react';
import { formatDistance, formatTime } from '@adone/core';
import type { DayRow } from '@/server/attendance';
import { CheckBadge, REASON_LABELS } from './badges';

const KIND: Record<string, string> = {
  check_in: 'Keldi', check_out: 'Ketdi', break_start: 'Tanaffus', break_end: 'Tanaffusdan qaytdi', auto_close: 'Avto-yopildi', correction: 'Tuzatish',
};
const ACTION: Record<string, string> = { add_in: "kirish qo'shildi", add_out: "chiqish qo'shildi", void: 'bekor qilindi', approve: 'tasdiqlandi' };

/** Isbot: vaqt, masofa, aniqlik, jonli lokatsiya, video, xarita (dizayn: «check-in evidence card»). */
export function EventList({ events, tz }: { events: DayRow['events']; tz: string }) {
  if (events.length === 0) return <p className="m-0 text-[13px] text-muted">Bu kunda hodisa yo&apos;q.</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {events.map((e) => {
        const m = e.meta as { action?: string; at?: string; reason?: string } | null;
        return (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-card px-3 py-2 text-[13px]">
            <span className="tnum w-12 font-semibold">{formatTime(e.at, tz)}</span>
            <span className="w-28">{KIND[e.kind] ?? e.kind}</span>
            {e.kind === 'correction' ? (
              <span className="text-muted">{ACTION[m?.action ?? ''] ?? ''}{m?.at ? ` · ${formatTime(m.at, tz)}` : ''}{m?.reason ? ` — «${m.reason}»` : ''}</span>
            ) : (
              <>
                <CheckBadge status={e.checkStatus} />
                {e.distanceM != null && <span className="tnum text-muted">{formatDistance(e.distanceM)}{e.accuracyM != null ? ` (±${e.accuracyM} m)` : ''}</span>}
                {e.isLive != null && <span className={e.isLive ? 'text-success-text' : 'text-warning-text'}>{e.isLive ? 'jonli lokatsiya' : 'oddiy lokatsiya'}</span>}
                <span className="text-xs text-muted">{e.source === 'bot' ? 'Bot' : e.source === 'miniapp' ? 'Mini App' : 'Admin'}</span>
                {e.reasons.length > 0 && <span className="text-warning-text">{e.reasons.map((r) => REASON_LABELS[r] ?? r).join(', ')}</span>}
                <span className="ml-auto flex gap-1">
                  {e.mediaId && <a href={`/api/media/${e.mediaId}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Video"><Video size={14} /></a>}
                  {e.lat != null && e.lng != null && <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Xaritada"><ExternalLink size={14} /></a>}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
