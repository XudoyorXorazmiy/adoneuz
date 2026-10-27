/**
 * Mini App sahifalari orasida o'tish: server javobi (Germaniya → O'zbekiston) kelguncha darhol skelet — bosilgan zahoti
 * ekran o'zgaradi. Next dinamik sahifalar uchun shu chegaragacha oldindan yuklaydi (prefetch).
 */
export default function TgLoading() {
  const block = 'animate-pulse rounded-[20px] bg-card shadow-[var(--shadow-card)]';
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3 bg-page px-4 pt-4" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="flex items-center gap-3">
        <span className="size-12 animate-pulse rounded-full bg-subtle" />
        <div className="flex flex-1 flex-col gap-2"><span className="h-3 w-24 animate-pulse rounded bg-subtle" /><span className="h-5 w-44 animate-pulse rounded bg-subtle" /></div>
      </div>
      <div className={`${block} h-44`} />
      <div className={`${block} h-20`} />
      <div className={`${block} h-20`} />
      <div className={`${block} h-20`} />
    </div>
  );
}
