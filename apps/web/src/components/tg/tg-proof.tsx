import { formatDistance, formatTime } from '@adone/core';
import type { DayRow } from '@/server/attendance';
import { Icon } from '@/components/ui/icon';
import { REASON_LABELS } from '@/components/attendance/badges';

const KIND: Record<string, string> = { check_in: 'Keldi', check_out: 'Ketdi', break_start: 'Tanaffus', break_end: 'Tanaffusdan qaytdi', auto_close: 'Avto-yopildi' };
const SOURCE: Record<string, string> = { bot: 'Bot', miniapp: 'Mini App', admin: 'Admin' };

/** Isbot kartochkasi — Mini App o'lchamida (panel `EventList`ning ixchami): selfi/video, vaqt, masofa, yuz, GPS, sabablar. */
export function TgProof({ e, tz, radiusM }: { e: DayRow['events'][number]; tz: string; radiusM: number | null }) {
  const outside = e.distanceM != null && radiusM != null && e.distanceM > radiusM;
  const face = e.faceScore != null ? Math.round(e.faceScore <= 1 ? e.faceScore * 100 : e.faceScore) : null;
  const tone = e.checkStatus === 'ok' ? 'bg-success-tint text-success' : e.checkStatus === 'suspicious' ? 'bg-warning-tint text-warning' : 'bg-danger-tint text-danger';
  return (
    <div className="flex gap-3 rounded-2xl bg-page p-3">
      <a href={e.mediaId ? `/api/media/${e.mediaId}` : undefined} target="_blank" rel="noreferrer" className="relative flex size-[72px] shrink-0 items-end justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#DCE1EA] to-[#C5CCD8]">
        {e.mediaId ? (
          e.source === 'miniapp'
            ? <img src={`/api/media/${e.mediaId}?w=320`} alt="Selfi" className="absolute inset-0 size-full object-cover" />
            : <><video src={`/api/media/${e.mediaId}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" /><Icon name="play_circle" size={22} fill className="relative mb-1 text-white drop-shadow" /></>
        ) : <Icon name="person" fill size={52} className="-mb-1.5 text-[#A9B2C2]" />}
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{KIND[e.kind] ?? e.kind}</span>
          <span className="tnum text-sm font-extrabold">{formatTime(e.at, tz)}</span>
          <span className="flex-1" />
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{e.checkStatus === 'ok' ? 'Tasdiq' : e.checkStatus === 'suspicious' ? 'Shubhali' : 'Rad'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <span className="text-muted">Masofa <b className={outside ? 'text-warning' : 'text-ink'}>{e.distanceM != null ? formatDistance(e.distanceM) : '—'}</b></span>
          <span className="text-muted">Yuz <b className={face == null ? 'text-placeholder' : face >= 80 ? 'text-success' : 'text-warning'}>{face == null ? '—' : `${face}%`}</b></span>
          <span className="text-muted">GPS <b className="text-ink">{e.accuracyM != null ? `±${e.accuracyM} m` : '—'}</b></span>
          <span className="text-muted">{SOURCE[e.source] ?? e.source}{e.isLive != null ? ` · ${e.isLive ? 'jonli' : 'oddiy'}` : ''}</span>
        </div>
        {e.reasons.length > 0 && <div className="text-xs font-semibold text-warning">{e.reasons.map((x) => REASON_LABELS[x] ?? x).join(', ')}</div>}
        {e.lat != null && e.lng != null && <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1 text-xs font-semibold text-primary"><Icon name="location_on" size={14} fill />Xaritada</a>}
      </div>
    </div>
  );
}
