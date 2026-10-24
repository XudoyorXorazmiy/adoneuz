/** Kichik o'zgarish belgisi (dizayn): ↗ 4.2% yashil / ↘ 1.8% to'q sariq. `goodWhenUp=false` — kamayish yaxshi (kechikish). */
export function Delta({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value == null || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={`delta ${good ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning'}`}>
      {up ? '↗' : '↘'} {Math.abs(value).toString().replace('.', ',')}%
    </span>
  );
}
