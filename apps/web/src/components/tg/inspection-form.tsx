'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { InspectionCriterion } from '@adone/core';
import { tgInspectionAction } from '@/lib/actions/miniapp';
import { Icon } from '@/components/ui/icon';
import { haptic } from './webapp';

type Mark = { ok: boolean | null; note: string; photo: File | null; preview: string | null };

/**
 * «Nazorat» tekshiruv formasi (Mini App, egasi/admin): har mezonga ✓ / ✗; ✗ da ixtiyoriy izoh va kamera bilan rasm.
 * Saqlangach — natija: nechta ✗, javobgarga nechta vazifa ketdi.
 */
export function InspectionForm({ department, criteria, responsible }: { department: { id: string; name: string }; criteria: InspectionCriterion[]; responsible: string | null }) {
  const [marks, setMarks] = useState<Record<string, Mark>>(() => Object.fromEntries(criteria.map((c) => [c.id, { ok: null, note: '', photo: null, preview: null }])));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ fail: number; tasks: number; responsible: string | null } | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const marked = criteria.filter((c) => marks[c.id]?.ok != null).length;
  const set = (id: string, patch: Partial<Mark>) => setMarks((m) => ({ ...m, [id]: { ...m[id]!, ...patch } }));

  if (done) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className={`flex size-16 items-center justify-center rounded-full ${done.fail ? 'bg-warning-tint text-warning' : 'bg-success-tint text-success'}`}><Icon name={done.fail ? 'report' : 'check_circle'} size={36} fill /></span>
        <p className="m-0 text-lg font-bold">{done.fail ? `${done.fail} ta kamchilik belgilandi` : 'Hammasi joyida'}</p>
        <p className="m-0 text-sm text-muted">
          {done.fail === 0 ? `${department.name} — barcha mezonlar ✓.`
            : done.tasks ? `${done.responsible} ga ${done.tasks} ta vazifa yuborildi (muddat 1 soat, rasm bilan hisobot).`
              : done.responsible ? "Shu kamchiliklar bo'yicha ochiq vazifa allaqachon bor — yangisi ochilmadi." : "Bo'limga javobgar biriktirilmagan — vazifa ketmadi. Xodimlar → bo'lim → «Javobgar»."}
        </p>
        <Link href="/tg/nazorat" className="btn-primary mt-2 h-12 w-full text-sm shadow-none">Nazoratga qaytish</Link>
        <button type="button" onClick={() => { setDone(null); setMarks(Object.fromEntries(criteria.map((c) => [c.id, { ok: null, note: '', photo: null, preview: null }]))); }} className="btn-secondary h-12 w-full text-sm">Yana tekshirish</button>
      </div>
    );
  }

  const submit = () => {
    const fd = new FormData();
    fd.append('departmentId', department.id);
    for (const c of criteria) {
      const m = marks[c.id]!;
      if (m.ok == null) continue;
      fd.append(`ok_${c.id}`, m.ok ? '1' : '0');
      if (!m.ok) {
        if (m.note.trim()) fd.append(`note_${c.id}`, m.note.trim());
        if (m.photo) fd.append(`photo_${c.id}`, m.photo);
      }
    }
    setError(null);
    start(async () => {
      try {
        const r = await tgInspectionAction(fd);
        if (!r.ok) { haptic('error'); setError(r.error); return; }
        haptic('success');
        setDone({ fail: r.fail, tasks: r.tasks, responsible: r.responsible });
      } catch {
        haptic('error');
        setError("Saqlanmadi — internetni tekshirib qayta urining");
      }
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pt-3 pb-40">
      <div className="rounded-[20px] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="text-[15px] font-bold">{department.name}</div>
        <div className="text-xs text-muted">{responsible ? `Javobgar: ${responsible}` : 'Javobgar biriktirilmagan — ✗ bo‘yicha vazifa ketmaydi'}</div>
      </div>
      {criteria.map((c) => {
        const m = marks[c.id]!;
        return (
          <div key={c.id} className={`flex flex-col gap-3 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)] ${m.ok === false ? 'ring-2 ring-danger/30' : ''}`}>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{c.label}</span>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => set(c.id, { ok: true })} aria-label="Joyida"
                  className={`flex size-11 items-center justify-center rounded-full border ${m.ok === true ? 'border-success bg-success text-white' : 'border-line bg-page text-muted'}`}><Icon name="check" size={22} /></button>
                <button type="button" onClick={() => set(c.id, { ok: false })} aria-label="Kamchilik"
                  className={`flex size-11 items-center justify-center rounded-full border ${m.ok === false ? 'border-danger bg-danger text-white' : 'border-line bg-page text-muted'}`}><Icon name="close" size={22} /></button>
              </div>
            </div>
            {m.ok === false && (
              <div className="flex flex-col gap-2">
                <textarea value={m.note} onChange={(e) => set(c.id, { note: e.target.value })} maxLength={500} rows={2} placeholder="Nima noto'g'ri — qisqacha (ixtiyoriy)" className="input h-auto min-h-16 py-2.5 text-sm leading-normal" />
                <input ref={(el) => { inputs.current[c.id] = el; }} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0] ?? null; set(c.id, { photo: f, preview: f ? URL.createObjectURL(f) : null }); }} />
                {m.preview ? (
                  <div className="relative overflow-hidden rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.preview} alt="" className="h-40 w-full object-cover" />
                    <button type="button" onClick={() => set(c.id, { photo: null, preview: null })} className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"><Icon name="close" size={18} /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => inputs.current[c.id]?.click()} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-primary"><Icon name="photo_camera" size={20} />Rasmga olish</button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-line bg-card/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        {error && <p className="m-0 mx-auto flex w-full max-w-[488px] items-center gap-2 rounded-2xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text"><Icon name="error" size={18} fill />{error}</p>}
        <div className="mx-auto flex w-full max-w-[488px] items-center gap-3">
          <span className="tnum shrink-0 text-xs text-muted">{marked} / {criteria.length}</span>
          <button type="button" disabled={pending || marked === 0} onClick={submit} className="btn-primary h-12 flex-1 text-[15px] shadow-none disabled:opacity-50"><Icon name="save" size={18} />{pending ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        </div>
      </div>
    </div>
  );
}
