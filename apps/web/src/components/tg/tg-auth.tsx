'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { Logo } from '@/components/ui/logo';
import { webApp } from './webapp';

/**
 * Mini App'ga kirish: Telegram initData → /api/tg/auth (imzo serverda) → cookie → server qismi yangilanadi (to'liq qayta yuklash
 * emas — JS va telegram-web-app.js qayta yuklanmaydi).
 * Telegram tashqarisida ochilsa — «bot orqali oching».
 */
export function TgAuth() {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; pick?: Array<{ tenantId: string; name: string }>; loading: boolean; retry?: string }>({ loading: true });
  const login = async (tenantId?: string) => {
    const initData = webApp()?.initData ?? '';
    if (!initData) return setState({ loading: false, error: "Bu sahifa Telegram ichida ochiladi: botdagi «Ochish» tugmasini bosing." });
    setState({ loading: true });
    // Internet sekin/uzilgan bo'lsa «Yuklanmoqda…» abadiy qolmasin — 10 s dan keyin xato va «Qayta urinish»
    try {
      const r = await fetch('/api/tg/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, tenantId }), signal: AbortSignal.timeout(10_000) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; pick?: Array<{ tenantId: string; name: string }> };
      if (j.ok) return router.refresh();
      setState({ loading: false, error: j.error ?? (r.status >= 500 ? 'Server javob bermadi — birozdan keyin qayta urinib ko‘ring.' : undefined), pick: j.pick, retry: !j.pick && r.status !== 403 ? tenantId ?? '' : undefined });
    } catch {
      setState({ loading: false, error: 'Internet sekin yoki uzilgan — ulanishni tekshirib, qayta urinib ko‘ring.', retry: tenantId ?? '' });
    }
  };
  useEffect(() => {
    // telegram-web-app.js afterInteractive yuklanadi — biroz kutamiz
    let n = 0;
    const t = setInterval(() => {
      if (webApp()?.initData || ++n > 20) { clearInterval(t); webApp()?.ready(); void login(); }
    }, 100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-page px-6 text-center">
      <Logo />
      {state.loading && <p className="m-0 text-sm text-muted">Yuklanmoqda…</p>}
      {state.pick && (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <p className="m-0 text-sm font-semibold">Qaysi ishxona?</p>
          {state.pick.map((p) => <button key={p.tenantId} onClick={() => login(p.tenantId)} className="btn-secondary h-12 w-full justify-between text-sm">{p.name}<Icon name="chevron_right" /></button>)}
        </div>
      )}
      {state.error && <p className="m-0 max-w-sm rounded-2xl bg-card p-4 text-sm text-ink-2 shadow-[var(--shadow-card)]">{state.error}</p>}
      {state.retry !== undefined && <button onClick={() => login(state.retry || undefined)} className="btn-primary h-12 px-6 text-sm">Qayta urinish</button>}
    </div>
  );
}
