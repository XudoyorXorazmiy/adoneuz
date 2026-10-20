/** Monogramma: yumaloq kvadrat ichida lokatsiya belgisi va tasdiq (dizayn kelguncha vaqtinchalik). */
export function Logo({ size = 32, text = 22, label = true }: { size?: number; text?: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--color-primary)" />
        <path d="M16 6.5c-4.4 0-8 3.4-8 7.7 0 5.6 8 11.3 8 11.3s8-5.7 8-11.3c0-4.3-3.6-7.7-8-7.7Z" fill="#fff" />
        <path d="m12.6 14.2 2.4 2.4 4.4-4.6" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label && <span style={{ fontSize: text }} className="font-bold leading-none tracking-[-0.02em] text-ink">adone</span>}
    </span>
  );
}
