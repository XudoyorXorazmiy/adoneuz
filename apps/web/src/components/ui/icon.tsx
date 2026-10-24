/** Material Symbols Rounded (dizayndagi ikonkalar). `fill` — to'ldirilgan variant. */
export function Icon({ name, size = 20, fill, className = '' }: { name: string; size?: number; fill?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`icon ${fill ? 'icon-fill' : ''} ${className}`} style={{ fontSize: size }}>
      {name}
    </span>
  );
}
