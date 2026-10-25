/** Hisobotlar havolasi: joriy so'rov + o'zgarish → `/hisobotlar?…` (bo'sh qiymatlar tushib qoladi). Server va client bir xil. */
export function reportUrl(base: string, query: Record<string, string | undefined>, patch: Record<string, string | undefined> = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...query, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
