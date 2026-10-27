'use client';
import { useMemo, useState } from 'react';
import { TASK_PRIORITY_LABELS, TASK_PROOF_LABELS, type TaskPriority, type TaskProof } from '@adone/core';
import { Field } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';
import { avatarColors } from '@/components/ui/avatar';
import { dueLabel, taskCardText } from '@/lib/task-text';

/** `id` — xodim uuid yoki panel a'zosi `u:<userId>`; `role` — rahbar yorlig'i («Administrator», «Bo'lim boshlig'i»). */
export type AssignOption = { id: string; name: string; departmentId: string | null; department: string | null; branchId: string | null; branch: string | null; linked: boolean; role?: string | null };

const PROOF_ICON: Record<TaskProof, string> = { button: 'touch_app', photo: 'photo_camera', video: 'videocam', location: 'location_on' };
const PRIORITY_DOT: Record<TaskPriority, string> = { low: 'bg-placeholder', medium: 'bg-warning', high: 'bg-danger' };
const WD = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function initials(n: string) {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

/** Telegram HTML → oddiy ko'rinish (preview): <b> qalin, qolgani matn. */
function PreviewText({ html }: { html: string }) {
  const parts = html.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('<b>') ? <b key={i}>{decode(p.slice(3, -4))}</b> : <span key={i}>{decode(p)}</span>))}
    </>
  );
}
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * «Vazifa berish» (dizayn): Kimga (xodim chiplari + «Bo'lim: …», «Filial: …» tezkor qo'shish), sarlavha, tavsif, muddat, muhimlik,
 * hisobot talabi, bosqichlar, takrorlash va xodim Telegram'da ko'radigan xabar.
 */
export function AssignFields({ options, from, today, defaultDue = today, preselect = [] }: { options: AssignOption[]; from: string; today: string; defaultDue?: string; preselect?: string[] }) {
  const [picked, setPicked] = useState<string[]>(preselect);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState(defaultDue);
  const [dueTime, setDueTime] = useState('18:00');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [proofs, setProofs] = useState<TaskProof[]>(['button']);
  const [steps, setSteps] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [kind, setKind] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const found = q ? options.filter((o) => !picked.includes(o.id) && `${o.name} ${o.department ?? ''} ${o.branch ?? ''} ${o.role ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const groups = useMemo(() => {
    const deps = new Map<string, { label: string; ids: string[] }>();
    const brs = new Map<string, { label: string; ids: string[] }>();
    for (const o of options) {
      if (o.departmentId) { const g = deps.get(o.departmentId) ?? { label: `Bo'lim: ${o.department}`, ids: [] }; g.ids.push(o.id); deps.set(o.departmentId, g); }
      if (o.branchId) { const g = brs.get(o.branchId) ?? { label: `Filial: ${o.branch}`, ids: [] }; g.ids.push(o.id); brs.set(o.branchId, g); }
    }
    const heads = options.filter((o) => o.id.startsWith('u:')).map((o) => o.id);
    return [...(heads.length > 1 ? [{ label: 'Rahbarlar', ids: heads }] : []), ...deps.values(), ...brs.values()];
  }, [options]);
  const add = (ids: string[]) => setPicked((p) => [...new Set([...p, ...ids])]);
  const toggleProof = (p: TaskProof) => {
    if (p === 'button') return setProofs(['button']);
    setProofs((cur) => {
      const next = cur.filter((x) => x !== 'button');
      const res = next.includes(p) ? next.filter((x) => x !== p) : [...next, p];
      return res.length ? res : ['button'];
    });
  };
  const unlinked = picked.filter((id) => byId.get(id) && !byId.get(id)!.linked).length;
  const preview = taskCardText({
    title: title || 'Sarlavha', description: desc || null, from, due: repeat ? `har safar ${dueTime}` : dueDate ? dueLabel(dueDate, dueTime, today) : null,
    priority, proofs, checklist: steps.filter(Boolean),
  });

  return (
    <>
      {picked.map((id) => <input key={id} type="hidden" name="assignee" value={id} />)}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Kimga<span className="text-danger"> *</span></span>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border-[1.5px] border-primary p-1.5 shadow-[0_0_0_4px_var(--color-primary-tint)]">
          {picked.map((id) => {
            const o = byId.get(id);
            if (!o) return null;
            const [bg, fg] = avatarColors(o.name);
            return (
              <span key={id} className="flex h-8 items-center gap-1.5 rounded-full bg-subtle pr-2 pl-1 text-[13px] font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: bg, color: fg }}>{initials(o.name)}</span>
                {o.name}{o.role && <span className="text-xs font-medium text-muted">· {o.role}</span>}
                <button type="button" onClick={() => setPicked((p) => p.filter((x) => x !== id))} className="text-placeholder hover:text-ink" title="Olib tashlash"><Icon name="close" size={16} /></button>
              </span>
            );
          })}
          <div className="relative min-w-[160px] flex-1">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki bo'lim…" className="h-8 w-full bg-transparent px-2 text-[13px] outline-none placeholder:text-placeholder"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (found[0]) { add([found[0].id]); setQ(''); } } }} />
            {found.length > 0 && (
              <div className="absolute top-9 left-0 z-10 w-full min-w-[260px] rounded-xl bg-card p-1 shadow-[0_8px_30px_rgba(16,24,40,.14)]">
                {found.map((o) => (
                  <button key={o.id} type="button" onClick={() => { add([o.id]); setQ(''); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-primary-soft">
                    <span className="font-semibold">{o.name}</span><span className="truncate text-xs text-muted">{[o.role, o.department ?? o.branch].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {groups.slice(0, 6).map((g) => (
              <button key={g.label} type="button" onClick={() => add(g.ids)} className="flex h-8 items-center gap-1 rounded-full border border-line px-3 text-xs font-semibold hover:bg-page">
                <Icon name="add" size={16} className="text-primary" />{g.label}
              </button>
            ))}
          </div>
        )}
        <span className="flex items-center gap-1.5 text-xs text-muted"><Icon name="info" size={15} />Har bir kishiga alohida nusxa yaratiladi{unlinked ? ` · ${unlinked} kishi botga ulanmagan — xabar bormaydi` : ''}</span>
      </div>

      <Field label="Sarlavha" required>
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder="Yangi kolleksiyani vitrinaga terish" className="input" />
      </Field>
      <Field label="Tavsif">
        <textarea name="description" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} rows={3} className="input h-auto min-h-24 py-3 leading-normal" placeholder="Nima, qayerda, qanday — qisqacha" />
        <span className="tnum self-end text-xs text-placeholder">{desc.length} / 1000</span>
      </Field>

      {!repeat && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Muddat">
            <input name="dueDate" type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className="input tnum" />
          </Field>
          <Field label="Vaqt">
            <input name="dueTime" value={dueTime} onChange={(e) => setDueTime(e.target.value)} placeholder="18:00" inputMode="numeric" maxLength={5} pattern="[0-2][0-9]:[0-5][0-9]" className="input tnum" />
          </Field>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Muhimlik</span>
        <input type="hidden" name="priority" value={priority} />
        <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
          {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 ${priority === p ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>
              <span className={`size-1.5 rounded-full ${PRIORITY_DOT[p]}`} />{TASK_PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Hisobot talabi</span>
        {proofs.map((p) => <input key={p} type="hidden" name="proof" value={p} />)}
        <div className="flex flex-wrap gap-2">
          {(['button', 'photo', 'video', 'location'] as TaskProof[]).map((p) => {
            const on = proofs.includes(p);
            return (
              <button key={p} type="button" onClick={() => toggleProof(p)} className={`flex h-10 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold ${on ? 'border-primary bg-primary-tint text-primary' : 'border-line hover:bg-page'}`}>
                <Icon name={PROOF_ICON[p]} size={18} />{TASK_PROOF_LABELS[p]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Bosqichlar (checklist)</span>
        {steps.map((s, i) => (
          <div key={i} className="flex h-11 items-center gap-2.5 rounded-xl bg-page px-3">
            <span className="size-[18px] shrink-0 rounded-[5px] border-[1.5px] border-line-strong bg-card" />
            <input name="step" value={s} onChange={(e) => setSteps((x) => x.map((v, j) => (j === i ? e.target.value : v)))} placeholder={`${i + 1}-bosqich`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button type="button" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} className="text-placeholder hover:text-ink" title="O'chirish"><Icon name="close" size={18} /></button>
          </div>
        ))}
        {steps.length < 20 && <button type="button" onClick={() => setSteps((x) => [...x, ''])} className="flex w-fit items-center gap-1 text-[13px] font-bold text-primary"><Icon name="add" size={18} />Band qo&apos;shish</button>}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line p-3.5">
        <input type="hidden" name="repeat" value={repeat ? '1' : ''} />
        <label className="flex cursor-pointer items-center gap-3">
          <Icon name="repeat" className="text-muted" />
          <span className="flex-1"><span className="block text-sm font-bold">Takrorlash</span><span className="block text-xs text-muted">Har kuni · Hafta kunlari · Har oy</span></span>
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="peer sr-only" />
          <span className="relative h-6 w-10 rounded-full bg-line-strong transition peer-checked:bg-primary after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
        </label>
        {repeat && (
          <>
            <input type="hidden" name="repeatKind" value={kind} />
            <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
              {([['daily', 'Har kuni'], ['weekly', 'Hafta kunlari'], ['monthly', 'Har oy']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`flex-1 rounded-full py-1.5 ${kind === k ? 'bg-card shadow-[0_1px_2px_rgba(16,24,40,.08)]' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
            {kind === 'weekly' && (
              <div className="flex gap-1.5">
                {weekdays.map((d) => <input key={d} type="hidden" name="weekday" value={d} />)}
                {WD.map((w, i) => {
                  const d = i + 1;
                  const on = weekdays.includes(d);
                  return <button key={w} type="button" onClick={() => setWeekdays((x) => (on ? x.filter((v) => v !== d) : [...x, d]))} className={`size-9 rounded-full text-xs font-bold ${on ? 'bg-primary text-white' : 'border border-line text-muted'}`}>{w}</button>;
                })}
              </div>
            )}
            {kind === 'monthly' && <Field label="Oyning kuni"><input name="monthDay" type="number" min={1} max={31} defaultValue={1} className="input w-28" /></Field>}
            <Field label="Har nusxaning muddati (o'sha kuni)">
              <input name="dueTime" value={dueTime} onChange={(e) => setDueTime(e.target.value)} placeholder="18:00" inputMode="numeric" maxLength={5} pattern="[0-2][0-9]:[0-5][0-9]" className="input tnum w-32" />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold"><Icon name="send" size={17} className="text-[#229ED9]" />Xodim Telegramda shunday ko&apos;radi</span>
        <div className="rounded-2xl bg-[#D8E2EC] p-4">
          <div className="max-w-[280px] rounded-2xl rounded-bl-md bg-card px-3 py-2.5 text-[13px] leading-[1.45] whitespace-pre-line shadow-sm">
            <div className="mb-0.5 text-xs font-bold text-[#229ED9]">adone</div>
            <PreviewText html={preview} />
          </div>
          <div className="mt-1.5 grid max-w-[280px] grid-cols-2 gap-1.5 text-center text-xs font-semibold text-white">
            <span className="rounded-lg bg-[#8FA5B9] py-2">✅ Qabul qildim</span><span className="rounded-lg bg-[#8FA5B9] py-2">❓ Savol</span>
          </div>
        </div>
      </div>
      <p className="m-0 text-xs text-muted">{picked.length > 1 ? `${picked.length} ta nusxa yaratiladi` : picked.length === 1 ? '1 ta vazifa yaratiladi' : 'Ijrochi tanlanmagan'}{repeat ? ' · jadval bo‘yicha takrorlanadi' : ''}</p>
    </>
  );
}
