/**
 * Server ishga tushganda bir marta (BARQARORLIK 3.3–3.4): muhim env'lar tekshiruvi (yo'q bo'lsa prod'da ishga tushmaydi —
 * Coolify healthcheck o'tmaydi va eski konteyner qoladi) va SIGTERM'da baza pool'ini toza yopish (Dockerfile:
 * NEXT_MANUAL_SIG_HANDLE=true, PID 1 — tini).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { checkEnv } = await import('./server/env-check');
  checkEnv();
  if (process.env.NEXT_MANUAL_SIG_HANDLE) {
    const { pool } = await import('@adone/db');
    const stop = async (sig: string) => {
      console.log(`[server] ${sig}: so'rovlar tugashi kutilmoqda, keyin baza yopiladi`);
      await new Promise((r) => setTimeout(r, 3000));
      await Promise.race([pool.end(), new Promise((r) => setTimeout(r, 7000))]).catch(() => undefined);
      process.exit(0);
    };
    process.once('SIGTERM', () => void stop('SIGTERM'));
    process.once('SIGINT', () => void stop('SIGINT'));
  }
}
