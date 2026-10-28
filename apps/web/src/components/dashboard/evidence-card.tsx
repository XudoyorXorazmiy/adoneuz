import Link from 'next/link';
import { formatDistance, formatTime } from '@adone/core';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { REASON_LABELS } from '@/components/attendance/badges';
import { resolveSuspiciousAction } from '@/lib/actions/attendance';

/** Shubhali kirish isboti (dizayn: «Qaror kutmoqda» kartasi) — selfi/video, mini xarita, masofa, sabab, qaror. */
export function EvidenceCard(p: {
  employeeId: string; workDate: string; eventId: string; name: string; sub: string; at: Date; tz: string;
  distanceM: number | null; radiusM: number | null; face: number | null; source: string; mediaId: string | null; reasons: string[];
}) {
  const outside = p.reasons.includes('outside') || (p.distanceM != null && p.radiusM != null && p.distanceM > p.radiusM);
  // Mini xarita: doira — filial radiusi, nuqta — masofaga mutanosib (doiradan chiqsa chetga)
  const ratio = p.distanceM != null && p.radiusM ? Math.min(2.2, p.distanceM / p.radiusM) : 0;
  const px = 34 + 26 + ratio * 26 - 5;
  const reason = p.reasons.map((r) => REASON_LABELS[r] ?? r).join(', ') || 'Shubhali';
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-warning-line bg-warning-soft p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name={p.name} size={36} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{p.name}</div><div className="truncate text-xs text-muted">{p.sub}</div></div>
        <span className="badge border-[1.5px] border-warning pl-1.5 text-warning-text"><Icon name="warning" size={15} />Shubhali</span>
      </div>
      <div className="flex gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#DCE1EA] to-[#C5CCD8]">
          {p.mediaId ? (
            p.source === 'miniapp' ? <img src={`/api/media/${p.mediaId}?w=320`} alt="Selfi" className="size-full object-cover" /> : <video src={`/api/media/${p.mediaId}`} muted playsInline preload="metadata" className="size-full object-cover" />
          ) : (
            <Icon name="person" fill size={52} className="absolute bottom-[-6px] left-1.5 text-[#A9B2C2]" />
          )}
          <span className="absolute top-1 left-1 rounded bg-ink/70 px-1 text-[9px] font-bold text-white">selfi</span>
        </div>
        <div className="relative h-16 w-[120px] shrink-0 overflow-hidden rounded-[14px] bg-[#EAEFF3] max-sm:hidden">
          <div className="absolute top-[38px] -right-2.5 -left-2.5 h-[5px] -rotate-[8deg] bg-white" />
          <div className="absolute -top-2.5 -bottom-2.5 left-[62px] w-1 rotate-12 bg-white" />
          <div className="absolute top-1.5 left-[34px] size-[52px] rounded-full border-[1.5px] border-primary bg-primary/10" />
          <div className={`absolute top-[25px] size-2.5 rounded-full border-2 border-white ${outside ? 'bg-warning shadow-[0_0_0_3px_rgba(240,122,26,.25)]' : 'bg-primary'}`} style={{ left: Math.min(110, px) }} />
        </div>
        <div className="grid flex-1 grid-cols-[auto_1fr] content-center gap-x-2.5 gap-y-1 text-xs">
          <span className="text-muted">Masofa</span><b className={outside ? 'text-warning' : 'text-success'}>{p.distanceM != null ? formatDistance(p.distanceM) : '—'}</b>
          <span className="text-muted">Yuz mos</span><b className={p.face == null ? 'text-placeholder' : p.face >= 80 ? 'text-success' : 'text-warning'}>{p.face == null ? '—' : `${p.face}%`}</b>
          <span className="text-muted">Manba</span><b>{p.source === 'miniapp' ? 'Mini App' : p.source === 'bot' ? 'Bot' : 'Admin'}</b>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-warning-tint px-3 py-2 text-[13px] font-semibold text-[#B4540C]">
        <Icon name={outside ? 'wrong_location' : 'face_retouching_off'} size={18} />{reason}{outside && p.radiusM ? ` (radius ${p.radiusM} m)` : ''}
      </div>
      <form action={resolveSuspiciousAction} className="flex items-center gap-2">
        <input type="hidden" name="employeeId" value={p.employeeId} /><input type="hidden" name="workDate" value={p.workDate} /><input type="hidden" name="target" value={p.eventId} />
        <button name="decision" value="approve" className="btn-primary h-[38px] shadow-none"><Icon name="check" size={18} />Tasdiqlash</button>
        <button name="decision" value="reject" className="btn-danger h-[38px]"><Icon name="close" size={18} />Rad etish</button>
        <Link href={`/davomat?sana=${p.workDate}&holat=suspicious`} className="btn-ghost ml-auto h-[38px] text-muted">Batafsil<Icon name="arrow_outward" size={16} /></Link>
      </form>
      <span className="sr-only">{formatTime(p.at, p.tz)}</span>
    </div>
  );
}
