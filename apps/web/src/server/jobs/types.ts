/** `type` (interface emas) — tx.execute<T> generigi Record<string, unknown> talab qiladi */
export type JobRow = {
  id: string;
  tenant_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  run_at: string | Date;
  created_at: string | Date;
};
export type JobOutcome = { skip?: string };
/** Qayta urinib bo'lmaydigan xato (noto'g'ri token, o'chirilgan xodim). */
export class PermanentError extends Error {}

export function needTenant(job: JobRow): string {
  if (!job.tenant_id) throw new PermanentError('tenant_id yo‘q');
  return job.tenant_id;
}
export const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
