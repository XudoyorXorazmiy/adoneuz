'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tgChecklistAction, tgTaskAction } from '@/lib/actions/miniapp';
import { Icon } from '@/components/ui/icon';
import { actionError, getCoords, haptic, shrinkImage, STALE_APP, uploadFile } from './webapp';

const MAX_VIDEO = 100 * 1024 * 1024;

type Clip = { key: string; url: string; pct: number; id?: string; error?: string; abort?: () => void };

/**
 * Vazifa (dizayn: «Vazifa va hisobot», «Qaytarilgan vazifa»): checklist, hisobot — kamera bilan rasm (capture), video, lokatsiya, izoh.
 * Video tanlangan zahoti /api/tg/upload ga oqim bilan yuklanadi (progress) — «Topshirish» faqat id'larni yuboradi.
 * Talab qilingan isbot yetmasa server rad etadi (missingProofs), xabar shu yerda ko'rinadi.
 */
export function TaskReport({ taskId, status, checklist, checklistDone, proofs, doneHref = '/tg/vazifalar?yuborildi=1' }: {
  taskId: string; status: string; checklist: string[]; checklistDone: boolean[]; proofs: string[]; doneHref?: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState<boolean[]>(checklist.map((_, i) => !!checklistDone[i]));
  const [shots, setShots] = useState<Array<{ blob: Blob; url: string }>>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const needPhoto = proofs.includes('photo');
  const needVideo = proofs.includes('video');
  const needLoc = proofs.includes('location');
  const uploading = clips.some((c) => !c.id && !c.error);
  useEffect(() => () => clips.forEach((c) => c.abort?.()), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addVideo = (f: File) => {
    if (f.size > MAX_VIDEO) { setErr('Video 100 MB dan katta — qisqaroq (1 daqiqagacha) yozing'); haptic('error'); return; }
    setErr(null);
    const key = crypto.randomUUID();
    const patch = (p: Partial<Clip>) => setClips((cs) => cs.map((c) => (c.key === key ? { ...c, ...p } : c)));
    const up = uploadFile(`/api/tg/upload?task=${taskId}`, f, (pct) => patch({ pct }));
    setClips((cs) => [...cs, { key, url: URL.createObjectURL(f), pct: 0, abort: up.abort }]);
    up.done.then(({ id }) => { patch({ id, abort: undefined }); haptic('success'); }, (e: Error) => { patch({ error: e.message, abort: undefined }); haptic('error'); });
  };
  const editable = ['accepted', 'in_progress', 'revision'].includes(status);

  const send = async (to: 'accepted' | 'in_progress' | 'submitted') => {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set('taskId', taskId); fd.set('to', to);
    if (to === 'submitted') {
      shots.forEach((s, i) => fd.append('photo', new File([s.blob], `r${i}.jpg`, { type: 'image/jpeg' })));
      clips.forEach((c) => c.id && fd.append('media', c.id));
      if (loc) { fd.set('lat', String(loc.lat)); fd.set('lng', String(loc.lng)); if (loc.accuracy != null) fd.set('accuracy', String(loc.accuracy)); }
      fd.set('text', text);
    }
    const r = await tgTaskAction(fd).catch((e: unknown) => ({ error: actionError(e) }));
    setBusy(false);
    if (r.error) { setErr(r.error); haptic('error'); return; }
    haptic('success');
    router.refresh();
    if (to === 'submitted') router.push(doneHref);
  };

  if (status === 'new') {
    return <Bottom><button disabled={busy} onClick={() => send('accepted')} className="btn-primary h-[52px] w-full text-base">✅ Qabul qildim</button>{err && <Err t={err} />}</Bottom>;
  }
  return (
    <>
      {checklist.length > 0 && (
        <section className="flex flex-col rounded-[20px] bg-card px-4 py-1.5 shadow-[var(--shadow-card)]">
          {checklist.map((c, i) => (
            <label key={i} className="flex items-center gap-3 border-b border-line-soft py-3 text-[15px] last:border-0">
              <input type="checkbox" checked={done[i]} disabled={!editable}
                onChange={(e) => { const v = e.target.checked; setDone((d) => d.map((x, j) => (j === i ? v : x))); void tgChecklistAction(taskId, i, v); }}
                className="size-[22px] accent-success" />
              {c}
            </label>
          ))}
        </section>
      )}
      {editable && (
        <section className="flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-bold">Hisobot</h2>
            {(needPhoto || needVideo || needLoc) && <span className="flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-xs font-bold text-primary"><Icon name={needVideo ? 'videocam' : needPhoto ? 'photo_camera' : 'location_on'} size={15} />{[needPhoto && 'Rasm', needVideo && 'Video', needLoc && 'Lokatsiya'].filter(Boolean).join(' + ')} · majburiy</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shots.map((s, i) => (
              <div key={s.url} className="relative aspect-square overflow-hidden rounded-2xl bg-subtle">
                <img src={s.url} alt="" className="size-full object-cover" />
                <button onClick={() => setShots((x) => x.filter((_, j) => j !== i))} className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink/60 text-white"><Icon name="close" size={16} /></button>
              </div>
            ))}
            {clips.map((c) => (
              <div key={c.key} className="relative aspect-square overflow-hidden rounded-2xl bg-ink">
                <video src={`${c.url}#t=0.1`} muted playsInline preload="metadata" className="size-full object-cover opacity-80" />
                <span className={`absolute inset-x-1.5 bottom-1.5 rounded-lg px-1.5 py-0.5 text-center text-[11px] font-bold ${c.error ? 'bg-danger text-white' : c.id ? 'bg-success text-white' : 'bg-ink/70 text-white'}`}>
                  {c.error ? 'Xato' : c.id ? '✓ Yuklandi' : `${c.pct}%`}
                </span>
                {!c.id && !c.error && <span className="absolute inset-x-0 top-0 h-1 bg-primary transition-[width]" style={{ width: `${c.pct}%` }} />}
                <button onClick={() => { c.abort?.(); setClips((x) => x.filter((y) => y.key !== c.key)); }} className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink/60 text-white"><Icon name="close" size={16} /></button>
              </div>
            ))}
            {shots.length < 10 && (
              <button onClick={() => input.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-line-strong text-xs font-semibold text-primary">
                <Icon name="photo_camera" size={26} />Suratga olish
              </button>
            )}
            {clips.length < 3 && (needVideo || clips.length > 0 || !needPhoto) && (
              <button onClick={() => videoInput.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-line-strong text-xs font-semibold text-primary">
                <Icon name="videocam" size={26} />Video yozish
              </button>
            )}
          </div>
          {clips.some((c) => c.error) && <p className="m-0 text-xs font-semibold text-danger">{clips.find((c) => c.error)!.error} — videoni o&apos;chirib, qayta yozing.</p>}
          {uploading && <p className="m-0 text-xs text-muted">Video yuklanmoqda — tugashini kuting (oynani yopmang).</p>}
          <input ref={videoInput} type="file" accept="video/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addVideo(f); }} />
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const b = await shrinkImage(f); setShots((x) => [...x, { blob: b, url: URL.createObjectURL(b) }]); }} />
          {needLoc && (
            <button onClick={async () => { try { setLoc(await getCoords()); haptic('success'); } catch (er) { setErr((er as Error).message); } }}
              className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold ${loc ? 'bg-success-tint text-success' : 'bg-subtle'}`}>
              <Icon name={loc ? 'check_circle' : 'my_location'} size={20} />{loc ? `Lokatsiya qo'shildi (±${loc.accuracy ?? '?'} m)` : "Lokatsiyani qo'shish"}
            </button>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} placeholder="Izoh yozing…" className="input h-auto min-h-[88px] py-3 text-[15px] leading-normal" />
        </section>
      )}
      {editable && (
        <Bottom>
          {err && <Err t={err} />}
          <button disabled={busy || uploading} onClick={() => send('submitted')} className="btn-primary h-[52px] w-full text-base">{busy ? 'Yuborilmoqda…' : uploading ? 'Video yuklanmoqda…' : status === 'revision' ? 'Qayta topshirish' : 'Topshirish'}</button>
          {status === 'accepted' && <button disabled={busy} onClick={() => send('in_progress')} className="h-11 w-full text-sm font-bold text-primary">▶️ Boshladim</button>}
        </Bottom>
      )}
    </>
  );
}

function Bottom({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 mt-auto -mx-4 flex flex-col gap-2 bg-gradient-to-t from-page via-page to-page/0 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),16px)]">{children}</div>;
}
function Err({ t }: { t: string }) {
  return (
    <p className="m-0 flex items-center gap-2 rounded-xl bg-danger-tint px-3 py-2.5 text-sm font-semibold text-danger">
      <span className="flex-1">{t}</span>
      {t === STALE_APP && <button onClick={() => window.location.reload()} className="shrink-0 rounded-full bg-danger px-3 py-1.5 text-xs font-bold text-white">Yangilash</button>}
    </p>
  );
}
