import type { Metadata } from 'next';
import { formatDateTime } from '@adone/core';
import { recentJobs } from '@/server/platform';
import { pingJobsAction } from '@/lib/actions/platform';

export const metadata: Metadata = { title: 'Navbat' };

const TONE: Record<string, string> = {
  queued: 'bg-info-tint text-info-text',
  running: 'bg-warning-tint text-warning-text',
  done: 'bg-success-tint text-success-text',
  failed: 'bg-danger-tint text-danger-text',
};

export default async function JobsPage() {
  const rows = await recentJobs();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Navbat</h1>
        <form action={pingJobsAction}><button className="btn-secondary">Tekshirish (ping)</button></form>
      </div>
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="m-0 p-10 text-center text-muted">Navbat bo&apos;sh.</p>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead className="bg-page text-left text-xs text-muted">
              <tr><th className="px-4 py-2.5 font-medium">Tur</th><th className="px-4 py-2.5 font-medium">Ishxona</th><th className="px-4 py-2.5 font-medium">Holat</th><th className="px-4 py-2.5 font-medium">Urinish</th><th className="px-4 py-2.5 font-medium">Vaqt</th><th className="px-4 py-2.5 font-medium">Xato</th></tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-mono text-xs">{j.type}</td>
                  <td className="px-4 py-2.5">{j.tenant ?? '—'}</td>
                  <td className="px-4 py-2.5"><span className={`badge ${TONE[j.status] ?? ''}`}>{j.status}</span></td>
                  <td className="tnum px-4 py-2.5">{j.attempts}</td>
                  <td className="tnum px-4 py-2.5">{formatDateTime(j.run_at)}</td>
                  <td className="max-w-[320px] truncate px-4 py-2.5 text-muted">{j.last_error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
