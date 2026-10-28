'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isUuid } from '@adone/core';
import Link from 'next/link';
import { tgCheckAction, tgGeoPreviewAction } from '@/lib/actions/miniapp';
import type { CheckResult } from '@/server/checkin';
import { Icon } from '@/components/ui/icon';
import { TgHeader } from './tg-shell';
import { getCoords, haptic, shrinkImage, type Coords, actionError } from './webapp';

type Geo = { status: 'ok' | 'outside' | 'low_accuracy'; distanceM: number; branchName: string; radiusM: number } | { error: string };
const PROMPTS = ['Yuzingizni ramkaga joylang', 'Boshingizni chapga burang', "Endi o'ngga burang", 'Tayyor — yuboring'];
const SUS_TEXT: Record<string, string> = {
  face_mismatch: 'Yuz namunaga mos kelmadi', no_face: 'Yuz aniqlanmadi', many_faces: 'Kadrda boshqa odam bor', liveness_low: "Bosh burilmadi",
  face_unavailable: 'Yuz tekshiruvi vaqtincha ishlamadi', no_face_template: "Yuz namunasi yo'q", other_device: 'Boshqa telefondan',
};

/**
 * Keldim / Ketdim (dizayn): 1) lokatsiya — server masofani hisoblaydi; 2) jonli selfi (faqat kamera, galereya yo'q; faqat Keldim);
 * 3) natija. Yakuniy qaror serverda (tgCheckAction geofence'ni qayta hisoblaydi) — bu ekran faqat ko'rsatadi.
 */
export function CheckFlow({ action, branchName, radiusM }: { action: 'check_in' | 'check_out'; branchName: string | null; radiusM: number | null }) {
  const [step, setStep] = useState<'locate' | 'selfie' | 'result'>('locate');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const title = action === 'check_in' ? 'Keldim' : 'Ketdim';
  const steps = action === 'check_in' ? 3 : 2;
  const idx = step === 'locate' ? 1 : step === 'selfie' ? 2 : steps;
  const stepName = step === 'locate' ? 'Lokatsiya' : step === 'selfie' ? 'Selfi' : 'Natija';

  const locate = useCallback(async () => {
    setGeo(null);
    try {
      const c = await getCoords();
      setCoords(c);
      const fd = new FormData();
      fd.set('lat', String(c.lat)); fd.set('lng', String(c.lng)); if (c.accuracy != null) fd.set('accuracy', String(c.accuracy));
      const r = await tgGeoPreviewAction(fd);
      setGeo(r as Geo);
      haptic('status' in r && r.status === 'ok' ? 'success' : 'error');
    } catch (e) {
      setGeo({ error: (e as Error).message });
    }
  }, []);
  useEffect(() => { void locate(); }, [locate]);

  const submit = async (photos?: Blob[]) => {
    if (!coords) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('action', action); fd.set('lat', String(coords.lat)); fd.set('lng', String(coords.lng));
    if (coords.accuracy != null) fd.set('accuracy', String(coords.accuracy));
    photos?.forEach((p, i) => fd.append('photo', new File([p], `selfie${i}.jpg`, { type: 'image/jpeg' })));
    const dev = deviceInfo();
    fd.set('deviceId', dev.id); fd.set('deviceLabel', dev.label);
    try {
      const r = await tgCheckAction(fd);
      setResult(r);
      haptic(r.ok ? 'success' : 'error');
    } catch (e) {
      setResult({ ok: false, reason: 'state', message: actionError(e) });
    }
    setBusy(false);
    setStep('result');
  };

  const okGeo = geo && 'status' in geo && geo.status === 'ok';
  return (
    <div className={`mx-auto flex min-h-dvh max-w-[520px] flex-col ${step === 'selfie' ? 'bg-[#0F1218] text-white' : 'bg-card'}`}>
      <TgHeader title={title} sub={`${idx} / ${steps} · ${stepName}`} dark={step === 'selfie'} />
      <div className="flex gap-1.5 px-4 pt-2">
        {Array.from({ length: steps }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < idx ? (step === 'selfie' ? 'bg-white' : 'bg-primary') : step === 'selfie' ? 'bg-white/20' : 'bg-line'}`} />)}
      </div>

      {step === 'locate' && (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-5 pb-5">
          <div>
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{geo ? 'Lokatsiya tekshirildi' : 'Lokatsiya tekshirilmoqda…'}</h1>
            <div className="mt-0.5 text-sm text-muted">{branchName ?? 'Filial'}{radiusM ? ` · radius ${radiusM} m` : ''}</div>
          </div>
          <MapCard geo={geo} accuracy={coords?.accuracy ?? null} />
          {geo && ('error' in geo ? (
            <Banner tone="danger" icon="location_disabled" title={geo.error} />
          ) : geo.status === 'ok' ? (
            <Banner tone="success" icon="check_circle" title={`Siz zonadasiz · ${geo.distanceM} m`} sub={action === 'check_in' ? 'Endi selfi orqali yuzingizni tasdiqlang' : 'Ketishni tasdiqlang'} />
          ) : geo.status === 'outside' ? (
            <Banner tone="danger" icon="wrong_location" title={`Zonadan tashqaridasiz: ${geo.distanceM} m`} sub="Filialga yaqinroq boring." />
          ) : (
            <Banner tone="warning" icon="gps_not_fixed" title={`GPS aniqligi past (±${coords?.accuracy ?? '?'} m)`} sub="Ochiq joyga chiqib qayta tekshiring." />
          ))}
          <div className="mt-auto">
            {okGeo ? (
              <button disabled={busy} onClick={() => (action === 'check_in' ? setStep('selfie') : submit())} className="btn-primary h-[52px] w-full text-base">{action === 'check_in' ? 'Davom etish' : busy ? 'Yuborilmoqda…' : 'Ketdim — tasdiqlash'}</button>
            ) : (
              <button disabled={!geo} onClick={locate} className="btn-primary h-[52px] w-full text-base">Qayta tekshirish</button>
            )}
          </div>
        </div>
      )}

      {step === 'selfie' && <Selfie busy={busy} onShot={submit} onCancel={() => setStep('locate')} />}

      {step === 'result' && result && <Result r={result} action={action} onRetry={() => { setResult(null); setStep('locate'); void locate(); }} />}
    </div>
  );
}

function MapCard({ geo, accuracy }: { geo: Geo | null; accuracy: number | null }) {
  const ok = geo && 'status' in geo;
  const ratio = ok ? Math.min(2.2, geo.distanceM / Math.max(geo.radiusM, 1)) : 0;
  const inside = ok && geo.status === 'ok';
  // Doira radiusi 70px; nuqta — masofaga mutanosib (tashqarida — doiradan chiqadi)
  const dx = ratio * 70 * 0.7, dy = -ratio * 70 * 0.7;
  return (
    <div className="relative h-[280px] overflow-hidden rounded-[20px] bg-[#EAEFF3]">
      <div className="absolute top-[150px] -right-4 -left-4 h-2.5 -rotate-[8deg] bg-white" />
      <div className="absolute -top-4 -bottom-4 left-[62%] w-2 rotate-[14deg] bg-white" />
      <div className="absolute top-[70px] left-[8%] h-14 w-16 rounded-xl bg-[#DCE3EA]" />
      <div className="absolute right-[6%] bottom-[30px] h-16 w-24 rounded-xl bg-[#DCE3EA]" />
      <div className="absolute bottom-[10px] left-[18%] h-20 w-14 rounded-xl bg-[#D7E9DC]" />
      <div className="absolute top-1/2 left-1/2 size-[140px] -translate-1/2 rounded-full border-[1.5px] border-primary bg-primary/10" />
      <span className="absolute top-1/2 left-1/2 flex size-8 -translate-1/2 items-center justify-center rounded-[10px] bg-primary text-white shadow"><Icon name="storefront" size={18} fill /></span>
      {ok && (
        <span className={`absolute top-1/2 left-1/2 size-4 rounded-full border-[3px] border-white ${inside ? 'bg-success shadow-[0_0_0_8px_rgba(22,163,74,.2)]' : 'bg-danger shadow-[0_0_0_8px_rgba(229,72,77,.2)]'}`}
          style={{ transform: `translate(calc(-50% + ${Math.max(-150, Math.min(150, dx + 18))}px), calc(-50% + ${Math.max(-120, Math.min(120, dy))}px))` }} />
      )}
      {!geo && <span className="absolute inset-0 flex items-center justify-center"><span className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></span>}
      {accuracy != null && <span className="absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold shadow-sm">GPS aniqligi ±{accuracy} m</span>}
    </div>
  );
}

function Banner({ tone, icon, title, sub }: { tone: 'success' | 'danger' | 'warning'; icon: string; title: string; sub?: string }) {
  const t = { success: 'bg-success-tint text-success', danger: 'bg-danger-tint text-danger', warning: 'bg-warning-tint text-warning' }[tone];
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3.5 ${t}`}>
      <Icon name={icon} size={30} fill />
      <div><div className="text-[15px] font-bold">{title}</div>{sub && <div className="text-[13px] text-ink-2">{sub}</div>}</div>
    </div>
  );
}

/** Shu qurilmaning doimiy identifikatori (Telegram webview localStorage) — qurilmani bog'lash uchun. */
function deviceInfo(): { id: string; label: string } {
  let id = '';
  try {
    id = localStorage.getItem('adone_device') ?? '';
    if (!isUuid(id)) { id = crypto.randomUUID(); localStorage.setItem('adone_device', id); }
  } catch { id = crypto.randomUUID(); }
  const ua = navigator.userAgent;
  const label = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Android[^;]*;\s*([^;)]+)/.exec(ua)?.[1]?.trim() ?? 'Android') : 'Kompyuter';
  return { id, label };
}

/**
 * Jonli kamera (getUserMedia, old kamera; galereya yo'q). Uch kadr: to'g'ri, chapga, o'ngga — yuz servisi
 * bosh burilishini (yaw) o'lchaydi: rasmni kameraga tutib aldash qiyinlashadi (liveness).
 */
function Selfie({ busy, onShot, onCancel }: { busy: boolean; onShot: (b: Blob[]) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [ready, setReady] = useState(false);
  const shots = useRef<Blob[]>([]);
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Bu Telegram versiyasida kamera ishlamaydi. Telegram'ni yangilang yoki botda «✅ Keldim» (jonli lokatsiya + dumaloq video) orqali qiling.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; void video.current.play(); } setReady(true); })
      .catch((e: DOMException) => setErr(
        e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? "Old kamera topilmadi. Botda «✅ Keldim» (dumaloq video) orqali qiling."
          : e?.name === 'NotReadableError' ? "Kamera boshqa ilovada band. Uni yoping va qayta urinib ko'ring."
            : "Kameraga ruxsat berilmadi. Telegram sozlamalarida kamerani yoqing va qayta urinib ko'ring.",
      ));
    return () => { stream?.getTracks().forEach((x) => x.stop()); };
  }, []);
  const grab = async (): Promise<Blob | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const g = c.getContext('2d')!;
    g.translate(c.width, 0); g.scale(-1, 1); // oynadagi kabi
    g.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? shrinkImage(blob, 960) : null;
  };
  // Har ko'rsatma ~1.8 s: oxirida kadr olinadi
  useEffect(() => {
    if (!ready || phase >= 3) return;
    const t = setTimeout(async () => {
      const b = await grab();
      if (b) shots.current[phase] = b;
      setPhase((p) => p + 1);
    }, 1800);
    return () => clearTimeout(t);
  }, [ready, phase]);
  const restart = () => { shots.current = []; setPhase(0); };
  const prompt = phase < 3 ? PROMPTS[phase === 0 ? 0 : phase === 1 ? 1 : 2] : PROMPTS[3];
  return (
    <div className="flex flex-1 flex-col items-center gap-5 px-4 pt-6 pb-5">
      <h1 className="m-0 text-center text-[22px] font-bold">{PROMPTS[0]}</h1>
      <div className={`relative h-[330px] w-[250px] overflow-hidden rounded-[50%] border-[3px] ${ready ? 'border-success' : 'border-white/30'} bg-[#2A2F38]`}>
        <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" />
        {!ready && <Icon name="person" fill size={150} className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-white/25" />}
      </div>
      {err ? <p className="m-0 rounded-2xl bg-danger/20 p-3 text-center text-sm">{err}</p> : (
        <>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-[15px] font-semibold"><Icon name={phase === 1 ? 'turn_left' : phase === 2 ? 'turn_right' : 'face'} />{prompt}</div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            {ready && <span className="flex items-center gap-1 text-success"><Icon name="check_circle" size={15} />Kamera tayyor</span>}
            <span>· Jonlilik {Math.min(phase, 3)}/3</span>
          </div>
        </>
      )}
      <p className="m-0 text-center text-xs text-white/50">Faqat jonli kamera. Galereyadan rasm yuklab bo&apos;lmaydi.</p>
      <div className="mt-auto flex w-full flex-col gap-2.5">
        <button disabled={phase < 3 || busy || shots.current.filter(Boolean).length === 0} onClick={() => onShot(shots.current.filter(Boolean))}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold disabled:opacity-40">
          <Icon name="send" />{busy ? 'Tekshirilmoqda…' : 'Yuborish'}
        </button>
        {phase >= 3 && !busy && <button onClick={restart} className="h-11 w-full text-sm font-bold text-white/80">Qayta olish</button>}
        <button onClick={onCancel} className="h-[52px] w-full rounded-full bg-white/10 text-base font-bold">Bekor qilish</button>
      </div>
    </div>
  );
}

function Result({ r, action, onRetry }: { r: CheckResult; action: 'check_in' | 'check_out'; onRetry: () => void }) {
  if (!r.ok) {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 px-4 pt-10 pb-5 text-center">
        <span className="flex size-[104px] items-center justify-center rounded-full bg-danger-tint"><span className="flex size-20 items-center justify-center rounded-full bg-danger text-white"><Icon name="close" size={44} /></span></span>
        <h1 className="m-0 text-2xl font-bold">Qabul qilinmadi</h1>
        <p className="m-0 max-w-xs text-sm text-ink-2">{r.message}</p>
        <div className="mt-auto flex w-full flex-col gap-2.5">
          {r.reason !== 'state' && r.reason !== 'inactive' && <button onClick={onRetry} className="btn-primary h-[52px] w-full text-base">Qayta urinish</button>}
          <Link href="/tg" className="btn-secondary h-[52px] w-full text-base">Bosh sahifaga</Link>
        </div>
      </div>
    );
  }
  const sus = r.status === 'suspicious';
  return (
    <div className="flex flex-1 flex-col items-center gap-3 px-4 pt-10 pb-5 text-center">
      {sus ? (
        <span className="flex size-[104px] items-center justify-center rounded-full bg-warning-tint"><span className="flex size-20 items-center justify-center rounded-full bg-warning text-white"><Icon name="hourglass_top" fill size={44} /></span></span>
      ) : (
        <span className="flex size-[104px] items-center justify-center rounded-full bg-success-tint"><span className="flex size-20 items-center justify-center rounded-full bg-success text-white"><Icon name="check" size={46} /></span></span>
      )}
      <h1 className="m-0 mt-2 text-2xl font-bold">{sus ? 'Qabul qilindi, rahbar tekshiradi' : action === 'check_in' ? 'Qabul qilindi' : 'Ketish qayd etildi'}</h1>
      <div className="tnum text-[40px] leading-none font-extrabold tracking-[-0.03em]">{r.time}</div>
      {sus && <div className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-warning-tint px-4 py-3 text-left text-sm font-semibold text-warning-text"><Icon name="face_retouching_off" size={20} />{r.reasons.map((x) => SUS_TEXT[x] ?? x).join(' · ')}</div>}
      {r.lateMinutes > 0 && <div className="mt-2 flex w-full items-center gap-2 rounded-2xl bg-warning-tint px-4 py-3 text-sm font-semibold text-warning-text"><Icon name="schedule" size={20} />Kechikdingiz: {r.lateMinutes} daqiqa</div>}
      <div className="mt-1 w-full divide-y divide-line-soft rounded-2xl border border-line text-left text-sm">
        {[
          ...(r.facePercent != null ? [['Yuz mos', `${r.facePercent}%`, sus && r.reasons.includes('face_mismatch') ? 'text-warning' : 'text-success']] : []),
          ['Masofa', `${r.distanceM} m`, 'text-success'],
          ['Filial', r.branchName, ''],
          ...(action === 'check_out' ? [['Bugun ishladingiz', `${Math.floor(r.workedMinutes / 60)} soat ${r.workedMinutes % 60} daq`, '']] : []),
          ['Manba', 'Mini App', ''],
        ].map(([k, v, c]) => <div key={k} className="flex items-center justify-between px-4 py-3"><span className="text-muted">{k}</span><b className={c}>{v}</b></div>)}
      </div>
      <Link href="/tg" className="btn-primary mt-auto h-[52px] w-full text-base">Bosh sahifaga</Link>
    </div>
  );
}
