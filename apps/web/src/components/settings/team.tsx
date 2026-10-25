'use client';
/** Sozlamalar → Jamoa (design/panel/Sozlamalar.dc.html: «Sozlamalar — Jamoa», «A'zo qo'shish», mobil). */
import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { unstable_rethrow } from 'next/navigation';
import { formatPhone } from '@adone/core';
import type { FormState } from '@/components/ui/form-drawer';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';
import {
  addMemberAction, lookupPhoneAction, resetMemberPasswordAction, setMemberActiveAction, updateMemberAction, type MemberFormState,
} from '@/lib/actions/settings';
import { TelegramConnect } from './client';

export interface TeamRow {
  membershipId: string;
  userId: string;
  name: string;
  phone: string;
  role: 'owner' | 'admin' | 'manager';
  scope: string;
  departmentIds: string[];
  branchIds: string[];
  active: boolean;
  last: string;
  telegram: boolean;
  manageable: boolean;
  self: boolean;
}

const ROLE: Record<TeamRow['role'], { label: string; cls: string }> = {
  owner: { label: 'Egasi', cls: 'bg-navy text-white border-navy' },
  admin: { label: 'Administrator', cls: 'bg-primary-tint text-primary border-primary-tint' },
  manager: { label: "Bo'lim boshlig'i", cls: 'bg-card text-primary border-primary' },
};

const PERMS: Record<'admin' | 'manager', Array<[string, boolean]>> = {
  manager: [["Davomatni ko'rish", true], ['Vazifa berish', true], ["So'rovlarni tasdiqlash", true], ["Ish haqini ko'rish", false], ['Sozlamalar', false], ["Tarif va to'lov", false]],
  admin: [["Davomatni ko'rish", true], ['Vazifa berish', true], ["So'rovlarni tasdiqlash", true], ["Ish haqini ko'rish", true], ['Sozlamalar', true], ["Tarif va to'lov", false]],
};

const STALE = 'Sahifa eskirgan yoki aloqa uzildi — sahifani yangilang.';
const GRID = 'grid grid-cols-[minmax(0,1.7fr)_1.1fr_1.1fr_1fr_0.9fr_0.7fr_40px] gap-3';

function RoleChip({ role }: { role: TeamRow['role'] }) {
  return <span className={`inline-flex h-6 items-center rounded-full border-[1.5px] px-2.5 text-xs font-bold whitespace-nowrap ${ROLE[role].cls}`}>{ROLE[role].label}</span>;
}

function Telegram({ m }: { m: TeamRow }) {
  return m.telegram ? (
    <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-success"><Icon name="check_circle" size={16} fill />Ulangan</span>
  ) : (
    <span className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap text-placeholder"><Icon name="link_off" size={16} />Ulanmagan</span>
      {m.active && (m.manageable || m.self) && <TelegramConnect userId={m.userId} compact />}
    </span>
  );
}

function Status({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success-tint px-2.5 text-xs font-bold whitespace-nowrap text-success"><span className="size-1.5 rounded-full bg-success" />Faol</span>
    : <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-subtle px-2.5 text-xs font-bold whitespace-nowrap text-muted"><span className="size-1.5 rounded-full bg-muted" />O&apos;chirilgan</span>;
}

export function TeamTab({ rows, departments, branches, canAddAdmin }: {
  rows: TeamRow[]; departments: Array<{ id: string; name: string }>; branches: Array<{ id: string; name: string }>; canAddAdmin: boolean;
}) {
  const [drawer, setDrawer] = useState<{ edit?: TeamRow } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<MemberFormState, { ok: true }> | null>(null);
  const [reset, setReset] = useState<TeamRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const toggle = (m: TeamRow) => start(async () => {
    try {
      const r = await setMemberActiveAction(m.membershipId, !m.active);
      setError(r.error ?? null);
    } catch {
      setError(STALE);
    }
  });

  const menuFor = (m: TeamRow) => (
    <div onClick={(e) => e.stopPropagation()} className="absolute top-[50px] right-0 z-10 w-[220px] rounded-2xl bg-card p-1.5 shadow-[0_2px_6px_rgba(16,24,40,.06),0_16px_40px_rgba(16,24,40,.14)]">
      {m.active && (
        <>
          <button type="button" onClick={() => { setMenu(null); setDrawer({ edit: m }); }} className="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-semibold hover:bg-primary-soft hover:text-primary"><Icon name="edit" size={18} />Tahrirlash</button>
          <button type="button" onClick={() => { setMenu(null); setReset(m); }} className="flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-semibold hover:bg-page"><Icon name="lock_reset" size={18} className="text-muted" />Parolni tiklash</button>
        </>
      )}
      <button type="button" onClick={() => { setMenu(null); toggle(m); }} className={`flex h-[38px] w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-semibold ${m.active ? 'border-t border-line-soft text-danger hover:bg-danger-tint' : 'text-primary hover:bg-primary-soft'}`}>
        <Icon name={m.active ? 'person_remove' : 'person_add'} size={18} />{m.active ? "O'chirish" : 'Qayta yoqish'}
      </button>
    </div>
  );

  const more = (m: TeamRow) => m.manageable ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(menu === m.membershipId ? null : m.membershipId); }}
      className={`flex size-8 items-center justify-center rounded-full border ${menu === m.membershipId ? 'border-line-strong bg-subtle' : 'border-line bg-card hover:bg-page'}`} title="Amallar">
      <Icon name="more_horiz" size={18} />
    </button>
  ) : <span />;

  return (
    <div className="flex flex-col gap-2">
      <section className="card px-6 pt-5 pb-3 max-md:px-4">
        <div className="flex flex-wrap items-center gap-3 pb-4">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-tint text-primary"><Icon name="group" fill /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-base font-bold">Jamoa a&apos;zolari</span><span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-bold text-primary">{rows.filter((r) => r.active).length}</span></div>
            <div className="text-[13px] text-muted">Panelga kiradigan rahbarlar — xodimlar emas</div>
          </div>
          <button type="button" onClick={() => setDrawer({})} className="btn-primary h-11 pr-[22px] pl-[18px] text-sm max-md:hidden"><Icon name="add" />A&apos;zo qo&apos;shish</button>
        </div>
        <div className="flex flex-wrap gap-2 rounded-[14px] bg-page p-3">
          {([['owner', "hammasi, tarif va to'lov"], ['admin', 'tarifdan tashqari hammasi'], ['manager', "faqat o'z bo'limi: davomat, so'rovlar, vazifalar"]] as const).map(([r, d]) => (
            <span key={r} className="flex items-center gap-2 pr-2.5 text-xs text-ink-2"><RoleChip role={r} />— {d}</span>
          ))}
        </div>
        {error && <div role="alert" className="mt-3 rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text">{error}</div>}

        {/* Desktop jadval */}
        <div className={`${GRID} border-b border-line-soft px-1 pt-4 pb-2.5 text-xs font-medium text-placeholder max-lg:hidden`}>
          <span>A&apos;zo</span><span>Rol</span><span>Mas&apos;ul</span><span>Telegram</span><span>Oxirgi kirish</span><span>Holat</span><span />
        </div>
        {rows.map((m, i) => (
          <div key={m.membershipId} className={`relative ${GRID} items-center px-1 py-3 text-[13px] max-lg:hidden ${i < rows.length - 1 ? 'border-b border-[#F4F5F7]' : ''} ${m.active ? '' : 'opacity-60'}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={m.name} size={36} />
              <div className="min-w-0"><div className="truncate font-bold">{m.name}{m.self && <span className="ml-1.5 text-xs font-medium text-placeholder">(siz)</span>}</div><div className="tnum text-xs text-muted">{formatPhone(m.phone)}</div></div>
            </div>
            <div><RoleChip role={m.role} /></div>
            <span className="truncate text-ink-2" title={m.scope}>{m.scope}</span>
            <Telegram m={m} />
            <span className="tnum text-ink-2">{m.last}</span>
            <div><Status active={m.active} /></div>
            {more(m)}
            {menu === m.membershipId && menuFor(m)}
          </div>
        ))}

        {/* Telefon/planshet: kartochkalar */}
        <div className="flex flex-col gap-2.5 pt-3 lg:hidden">
          {rows.map((m) => (
            <div key={m.membershipId} className={`relative flex flex-col gap-2.5 rounded-[20px] border border-line p-3.5 ${m.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2.5">
                <Avatar name={m.name} size={40} />
                <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold">{m.name}</div><div className="tnum text-xs text-muted">{formatPhone(m.phone)}</div></div>
                {more(m)}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <RoleChip role={m.role} />
                <span className="flex h-6 items-center rounded-full bg-subtle px-2.5 text-xs font-semibold text-ink-2">{m.scope}</span>
                <Telegram m={m} />
              </div>
              {menu === m.membershipId && menuFor(m)}
            </div>
          ))}
          <button type="button" onClick={() => setDrawer({})} className="btn-primary h-[52px] text-base"><Icon name="add" size={22} />A&apos;zo qo&apos;shish</button>
        </div>
      </section>

      {drawer && (
        <MemberDrawer
          key={drawer.edit?.membershipId ?? 'new'} edit={drawer.edit} departments={departments} branches={branches} canAddAdmin={canAddAdmin}
          onClose={() => setDrawer(null)} onAdded={(r) => { setDrawer(null); setDone(r); }}
        />
      )}
      {done && <AddedDialog r={done} onClose={() => setDone(null)} />}
      {reset && <ResetDialog m={reset} onClose={() => setReset(null)} />}
    </div>
  );
}

function genPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(7));
  const s = Array.from(r, (x) => a[x % a.length]).join('');
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

function Chips({ name, items, selected }: { name: string; items: Array<{ id: string; name: string }>; selected: string[] }) {
  if (!items.length) return <span className="text-[13px] text-placeholder">Hali yo&apos;q</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((d) => (
        <label key={d.id} className="cursor-pointer">
          <input type="checkbox" name={name} value={d.id} defaultChecked={selected.includes(d.id)} className="peer sr-only" />
          <span className="inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-line bg-card px-3 text-[13px] font-semibold text-ink-2 peer-checked:border-primary peer-checked:bg-primary-tint peer-checked:text-primary [&>.icon]:hidden peer-checked:[&>.icon]:inline">
            <Icon name="check" size={15} />{d.name}
          </span>
        </label>
      ))}
    </div>
  );
}

function MemberDrawer({ edit, departments, branches, canAddAdmin, onClose, onAdded }: {
  edit?: TeamRow; departments: Array<{ id: string; name: string }>; branches: Array<{ id: string; name: string }>; canAddAdmin: boolean;
  onClose: () => void; onAdded: (r: Extract<MemberFormState, { ok: true }>) => void;
}) {
  const [role, setRole] = useState<'admin' | 'manager'>(edit?.role === 'admin' ? 'admin' : 'manager');
  const [method, setMethod] = useState<'password' | 'telegram'>('password');
  const [password, setPassword] = useState(genPassword);
  const [hint, setHint] = useState<{ employee: string | null; member: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<MemberFormState | FormState, FormData>(async (p, f) => {
    try {
      return edit ? await updateMemberAction(p as FormState, f) : await addMemberAction(p as MemberFormState, f);
    } catch (e) {
      unstable_rethrow(e);
      return { error: STALE };
    }
  }, undefined);
  useEffect(() => {
    if (!state || !('ok' in state) || !state.ok) return;
    if (state.ok === true) onAdded(state as Extract<MemberFormState, { ok: true }>);
    else onClose();
  }, [state]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const err = state && 'error' in state ? state.error : undefined;

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-navy/30" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col rounded-l-3xl bg-card shadow-[0_24px_80px_rgba(11,27,79,.3)]">
        <div className="flex items-center gap-3 border-b border-line-soft px-6 py-[22px]">
          <div className="flex-1"><div className="text-xl font-bold">{edit ? "A'zoni tahrirlash" : "A'zo qo'shish"}</div><div className="text-[13px] text-muted">{edit ? edit.name : 'Panelga kirish huquqi beriladi'}</div></div>
          <button type="button" onClick={onClose} className="btn-icon" title="Yopish"><Icon name="close" /></button>
        </div>
        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-[18px]">
          {edit && <input type="hidden" name="membershipId" value={edit.membershipId} />}
          <label className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Ism-familiya</span><input name="name" defaultValue={edit?.name} className="input" required minLength={3} /></label>
          {!edit ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Telefon</span>
              <span className="flex h-11 items-center overflow-hidden rounded-xl border border-line focus-within:border-[1.5px] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-tint">
                <span className="flex h-full items-center border-r border-line bg-page px-3 text-sm font-semibold">+998</span>
                <input name="phone" inputMode="tel" placeholder="90 123 45 67" required className="tnum min-w-0 flex-1 px-3 text-sm outline-none"
                  onBlur={async (e) => { const v = e.currentTarget.value; setHint(v.replace(/\D/g, '').length >= 9 ? await lookupPhoneAction(`+998${v}`).catch(() => null) : null); }} />
              </span>
              {hint?.employee && <span className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Icon name="info" size={16} />Bu raqam xodimlar ro&apos;yxatida ham bor — {hint.employee}</span>}
              {hint?.member && <span className="flex items-center gap-1.5 text-xs font-semibold text-danger-text"><Icon name="error" size={16} />Bu raqam jamoada allaqachon bor</span>}
            </label>
          ) : (
            <div className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold">Telefon</span><span className="tnum flex h-11 items-center rounded-xl border border-line bg-page px-3 text-sm text-muted">{formatPhone(edit.phone)}</span></div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Rol</span>
            <div className="flex gap-1 rounded-full bg-subtle p-1 text-[13px] font-semibold">
              {(['admin', 'manager'] as const).map((r) => (
                <label key={r} className={`flex-1 ${r === 'admin' && !canAddAdmin ? 'cursor-not-allowed' : 'cursor-pointer'}`} title={r === 'admin' && !canAddAdmin ? "Administratorni faqat egasi qo'shadi" : undefined}>
                  <input type="radio" name="role" value={r} checked={role === r} disabled={r === 'admin' && !canAddAdmin} onChange={() => setRole(r)} className="peer sr-only" />
                  <span className={`block rounded-full py-2 text-center transition peer-checked:bg-card peer-checked:text-ink peer-checked:shadow-[0_1px_2px_rgba(16,24,40,.08)] ${r === 'admin' && !canAddAdmin ? 'text-placeholder' : 'text-muted'}`}>{r === 'admin' ? 'Administrator' : "Bo'lim boshlig'i"}</span>
                </label>
              ))}
            </div>
          </div>
          {role === 'manager' && (
            <>
              <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Bo&apos;limlar</span><Chips name="departmentIds" items={departments} selected={edit?.departmentIds ?? []} /></div>
              <div className="flex flex-col gap-2"><span className="text-[13px] font-semibold">Filiallar <span className="font-medium text-placeholder">· ixtiyoriy</span></span><Chips name="branchIds" items={branches} selected={edit?.branchIds ?? []} /></div>
            </>
          )}
          {!edit && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">Kirish usuli</span>
              <input type="hidden" name="method" value={method} />
              <div onClick={() => setMethod('password')} className={`flex cursor-pointer flex-col gap-2 rounded-[14px] px-3.5 py-3 ${method === 'password' ? 'border-[1.5px] border-primary bg-primary-soft' : 'border border-line'}`}>
                <div className="flex items-center gap-2.5 text-sm font-bold"><Radio on={method === 'password'} />Vaqtinchalik parol</div>
                {method === 'password' && (
                  <>
                    <input type="hidden" name="password" value={password} />
                    <div className="ml-7 flex items-center gap-2">
                      <span className="flex h-9 items-center rounded-[10px] border border-primary-line bg-card px-3 font-mono text-[15px] font-bold tracking-[0.04em]">{password}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(password).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex size-9 items-center justify-center rounded-[10px] border border-primary-line bg-card text-primary" title="Nusxa"><Icon name={copied ? 'check' : 'content_copy'} size={18} /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setPassword(genPassword()); }} className="flex size-9 items-center justify-center rounded-[10px] border border-primary-line bg-card text-muted" title="Yangisi"><Icon name="refresh" size={18} /></button>
                    </div>
                    <span className="ml-7 text-xs text-muted">Birinchi kirishda o&apos;zgartirishi so&apos;raladi</span>
                  </>
                )}
              </div>
              <div onClick={() => setMethod('telegram')} className={`flex cursor-pointer flex-col gap-1.5 rounded-[14px] px-3.5 py-3 ${method === 'telegram' ? 'border-[1.5px] border-primary bg-primary-soft' : 'border border-line'}`}>
                <div className="flex items-center gap-2.5 text-sm font-semibold"><Radio on={method === 'telegram'} />Telegram orqali taklif<span className="flex-1" /><span className="text-xs font-medium text-muted">havola + QR</span></div>
                {method === 'telegram' && <span className="ml-7 text-xs text-muted">A&apos;zo havolani ochib «Start» bosadi — bot unga kirish parolini o&apos;zi yuboradi (siz ko&apos;rmaysiz).</span>}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 rounded-[14px] bg-page px-3.5 py-3">
            <span className="text-xs font-bold text-muted">{role === 'admin' ? 'Administrator' : "Bo'lim boshlig'i"} nimalarni qila oladi</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {PERMS[role].map(([l, ok]) => (
                <span key={l} className={`flex items-center gap-1.5 text-[13px] ${ok ? 'text-ink' : 'text-placeholder'}`}><Icon name={ok ? 'check_circle' : 'cancel'} size={17} className={ok ? 'text-success' : 'text-[#C4C9D2]'} />{l}</span>
              ))}
            </div>
          </div>
        </form>
        {err && <div role="alert" className="mx-6 mb-3 rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] font-semibold text-danger-text">{err}</div>}
        <div className="flex justify-end gap-2.5 border-t border-line-soft px-6 pt-4 pb-[22px]">
          <button type="button" onClick={onClose} className="btn-secondary h-11 px-5 text-sm">Bekor qilish</button>
          <button type="button" disabled={pending} onClick={() => formRef.current?.requestSubmit()} className="btn-primary h-11 px-6 text-sm">{pending ? 'Saqlanmoqda…' : edit ? 'Saqlash' : "Qo'shish"}</button>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function Radio({ on }: { on: boolean }) {
  return <span className={`size-[18px] shrink-0 rounded-full bg-card ${on ? 'border-[5px] border-primary' : 'border-[1.5px] border-[#C4C9D2]'}`} />;
}

function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-3xl bg-card p-6 shadow-[0_24px_80px_rgba(11,27,79,.3)]">{children}</div>
    </div>,
    document.body,
  );
}

function CredLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="rounded-xl bg-page px-3.5 py-3 font-mono text-sm font-semibold break-all text-[#1F2A5C]">{text}</div>
      <div className="text-xs text-muted">Birinchi kirishda parolni o&apos;zgartirish so&apos;raladi.</div>
      <button type="button" onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); }} className="btn-primary self-start pl-3.5"><Icon name={copied ? 'check' : 'content_copy'} size={18} />{copied ? 'Nusxalandi' : 'Nusxa olish'}</button>
    </>
  );
}

function AddedDialog({ r, onClose }: { r: Extract<MemberFormState, { ok: true }>; onClose: () => void }) {
  const host = typeof window !== 'undefined' ? window.location.host : 'app.adone.uz';
  return (
    <Dialog onClose={onClose}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-success-tint text-success"><Icon name="check" size={24} /></span>
        <div><div className="text-lg font-bold">A&apos;zo qo&apos;shildi</div><div className="text-[13px] text-muted">{r.name} · {r.roleLabel}</div></div>
      </div>
      {r.password && <CredLine text={`${host} · ${formatPhone(r.phone)} · parol: ${r.password}`} />}
      {r.existing && !r.telegramUrl && <div className="rounded-xl bg-page px-3.5 py-3 text-sm">Bu raqamning hisobi bor — o&apos;z paroli bilan <b>{host}</b> ga kiradi (parol o&apos;zgarmadi).</div>}
      {r.telegramUrl && (
        <>
          <div className="text-sm">Havolani a&apos;zoga yuboring. U «Start» bosgach, bot {r.existing ? "Telegram'ini bog'laydi" : 'unga kirish parolini yuboradi'}:</div>
          <div className="rounded-xl bg-page px-3.5 py-3 font-mono text-[13px] font-semibold break-all text-[#1F2A5C]">{r.telegramUrl}</div>
          <button type="button" onClick={() => navigator.clipboard.writeText(r.telegramUrl!).catch(() => {})} className="btn-primary self-start pl-3.5"><Icon name="content_copy" size={18} />Havolani nusxalash</button>
        </>
      )}
      <button type="button" onClick={onClose} className="btn-secondary self-end">Yopish</button>
    </Dialog>
  );
}

function ResetDialog({ m, onClose }: { m: TeamRow; onClose: () => void }) {
  const [res, setRes] = useState<{ password: string; phone: string } | { error: string } | null>(null);
  const [pending, start] = useTransition();
  const host = typeof window !== 'undefined' ? window.location.host : 'app.adone.uz';
  return (
    <Dialog onClose={onClose}>
      <span className="flex size-11 items-center justify-center rounded-full bg-warning-tint text-warning"><Icon name="lock_reset" size={22} /></span>
      <div>
        <div className="text-lg font-bold">Parolni tiklash</div>
        <div className="mt-1 text-sm leading-normal text-muted">{m.name} uchun yangi vaqtinchalik parol yaratiladi. Eski parol va barcha kirishlar bekor bo&apos;ladi.</div>
      </div>
      {res && 'password' in res && <CredLine text={`${host} · ${formatPhone(res.phone)} · parol: ${res.password}`} />}
      {res && 'error' in res && <div role="alert" className="text-[13px] font-semibold text-danger-text">{res.error}</div>}
      <div className="flex justify-end gap-2.5">
        <button type="button" onClick={onClose} className="btn-secondary h-11 px-5 text-sm">{res && 'password' in res ? 'Yopish' : 'Bekor qilish'}</button>
        {!(res && 'password' in res) && (
          <button type="button" disabled={pending} onClick={() => start(async () => { try { setRes(await resetMemberPasswordAction(m.membershipId)); } catch { setRes({ error: STALE }); } })} className="btn-primary h-11 px-5 text-sm">Yangi parol</button>
        )}
      </div>
    </Dialog>
  );
}
