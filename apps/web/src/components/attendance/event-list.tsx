import { formatDistance, formatTime } from '@adone/core';
import type { DayRow } from '@/server/attendance';
import { Icon } from '@/components/ui/icon';
import { CheckBadge, REASON_LABELS } from './badges';

const KIND: Record<string, string> = {
  check_in: 'Keldi', check_out: 'Ketdi', break_start: 'Tanaffus', break_end: 'Tanaffusdan qaytdi', auto_close: 'Avto-yopildi', correction: 'Tuzatish',
};
const ACTION: Record<string, string> = { add_in: "kirish qo'shildi", add_out: "chiqish qo'shildi", void: 'bekor qilindi', approve: 'tasdiqlandi' };
const SOURCE: Record<string, string> = { bot: 'Bot', miniapp: 'Mini App', admin: 'Admin' };

/** Isbot kartochkalari (dizayn: qator ochilganda Keldi / Ketdi — selfi, mini xarita, masofa, yuz, GPS) + tuzatishlar jurnali. */
export function EventList({ events, tz, radiusM, branchName }: { events: DayRow['events']; tz: string; radiusM: number | null; branchName: string | null }) {
  if (events.length === 0) return <p className="m-0 text-[13px] text-muted">Bu kunda hodisa yo&apos;q.</p>;
  const proofs = events.filter((e) => e.kind !== 'correction');
  const fixes = events.filter((e) => e.kind === 'correction');
  return (
    <div className="flex flex-col gap-3">
      {proofs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {proofs.map((e) => <Proof key={e.id} e={e} tz={tz} radiusM={radiusM} branchName={branchName} />)}
        </div>
      )}
      {fixes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {fixes.map((e) => {
            const m = e.meta as { action?: string; at?: string; reason?: string } | null;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-primary-soft px-3 py-2 text-[13px]">
                <Icon name="history" size={17} className="text-primary" />
                <span className="tnum font-bold">{formatTime(e.at, tz)}</span>
                <span className="font-semibold text-primary">Tuzatish: {ACTION[m?.action ?? ''] ?? ''}{m?.at ? ` · ${formatTime(m.at, tz)}` : ''}</span>
                {m?.reason && <span className="text-muted">«{m.reason}»</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Proof({ e, tz, radiusM, branchName }: { e: DayRow['events'][number]; tz: string; radiusM: number | null; branchName: string | null }) {
  // Mini xarita: doira — filial radiusi (72px), nuqta — markazdan masofaga mutanosib
  const ratio = e.distanceM != null && radiusM ? Math.min(2, e.distanceM / radiusM) : null;
  const r = ratio == null ? 0 : ratio * 36;
  const dot = { left: 75 + r * 0.8 - 6, top: 48 + r * 0.6 - 6 };
  const outside = ratio != null && ratio > 1;
  const face = e.faceScore != null ? Math.round(e.faceScore <= 1 ? e.faceScore * 100 : e.faceScore) : null;
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-card p-4 max-sm:flex-col">
      <div className="flex gap-4">
        <a href={e.mediaId ? `/api/media/${e.mediaId}` : undefined} target="_blank" rel="noreferrer" title={e.mediaId ? 'Videoni ochish' : undefined}
          className="relative flex size-16 shrink-0 items-end justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#DCE1EA] to-[#C5CCD8]">
          {e.mediaId ? (
            <>
              <video src={`/api/media/${e.mediaId}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
              <Icon name="play_circle" size={22} fill className="relative mb-1 text-white drop-shadow" />
            </>
          ) : <Icon name="person" fill size={52} className="-mb-1.5 text-[#A9B2C2]" />}
        </a>
        {e.lat != null && e.lng != null ? (
          <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" title="Xaritada ochish"
            className="relative h-24 w-[150px] shrink-0 overflow-hidden rounded-[14px] bg-[#EAEFF3]">
            <div className="absolute top-[58px] -right-2.5 -left-2.5 h-1.5 -rotate-[8deg] bg-white" />
            <div className="absolute -top-2.5 -bottom-2.5 left-[92px] w-[5px] rotate-[14deg] bg-white" />
            <div className="absolute top-6 left-3 h-5 w-[30px] rounded bg-[#DCE3EA]" />
            {radiusM != null && <div className="absolute top-3 left-[39px] size-[72px] rounded-full border-[1.5px] border-primary bg-primary/10" />}
            <div className={`absolute size-3 rounded-full border-2 border-white ${outside ? 'bg-warning shadow-[0_0_0_4px_rgba(240,122,26,.25)]' : 'bg-primary shadow-[0_0_0_4px_rgba(36,67,245,.2)]'}`} style={{ left: Math.min(134, dot.left), top: Math.min(80, dot.top) }} />
          </a>
        ) : (
          <div className="flex h-24 w-[150px] shrink-0 items-center justify-center rounded-[14px] bg-subtle text-xs text-muted">Lokatsiyasiz</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{KIND[e.kind] ?? e.kind}</span>
          <span className="tnum text-sm font-extrabold">{formatTime(e.at, tz)}</span>
          <span className="flex-1" />
          <CheckBadge status={e.checkStatus} />
        </div>
        <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-2.5 gap-y-1 text-xs">
          <span className="text-muted">Masofa</span><b className={outside ? 'text-warning' : ''}>{e.distanceM != null ? formatDistance(e.distanceM) : '—'}</b>
          <span className="text-muted">Yuz mos</span><b className={face == null ? 'text-placeholder' : face >= 80 ? 'text-success' : 'text-warning'}>{face == null ? '—' : `${face}%`}</b>
          <span className="text-muted">GPS</span><b>{e.accuracyM != null ? `±${e.accuracyM} m` : '—'}</b>
          <span className="text-muted">Lokatsiya</span><b className={e.isLive == null ? 'text-placeholder' : e.isLive ? 'text-success' : 'text-warning'}>{e.isLive == null ? '—' : e.isLive ? 'jonli' : 'oddiy'}</b>
        </div>
        {e.reasons.length > 0 && <div className="text-xs font-semibold text-warning">{e.reasons.map((x) => REASON_LABELS[x] ?? x).join(', ')}</div>}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-bold text-primary">{SOURCE[e.source] ?? e.source}</span>
          {branchName && <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-ink-2">{branchName}</span>}
        </div>
      </div>
    </div>
  );
}
