import { Icon } from './icon';

/** Belgi: ko'k yumaloq kvadrat ichida «where_to_vote» (lokatsiya + tasdiq) + «adone» so'zi. */
export function Logo({ size = 28, text = 22, label = true }: { size?: number; text?: number; label?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex items-center justify-center bg-primary text-white" style={{ width: size, height: size, borderRadius: size * 0.32 }}>
        <Icon name="where_to_vote" fill size={Math.round(size * 0.64)} />
      </span>
      {label && <span style={{ fontSize: text }} className="font-extrabold leading-none tracking-[-0.04em] text-ink">adone</span>}
    </span>
  );
}
