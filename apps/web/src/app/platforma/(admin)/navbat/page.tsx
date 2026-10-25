import type { Metadata } from 'next';
import { formatDateTime } from '@adone/core';
import { recentJobs } from '@/server/platform';
import { pingJobsAction } from '@/lib/actions/platform';
import { Icon } from '@/components/ui/icon';

export const metadata: Metadata = { title: 'Navbat' };

const TONE: Record<string, string> = {
  queued: 'bg-info-tint text-info-text',
  running: 'bg-warning-tint text-warning-text',
  done: 'bg-success-tint text-success-text',
  failed: 'bg-danger-tint text-danger-text',
};

export default async function JobsPage() {
  const rows = await recentJobs();
  const COLS = 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_100px_70px_130px_minmax(0,1.6fr)]';
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Navbat</h1>
        <form action={pingJobsAction}><button className="btn-secondary h-11 text-sm"><Icon name="network_ping" />Tekshirish (ping)</button></form>
      </div>
      <section className="card px-6 pt-2 pb-2 max-sm:px-4">
        {rows.length === 0 ? (
          <p className="m-0 p-10 text-center text-muted">Navbat bo&apos;sh.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className={`grid ${COLS} gap-3 border-b border-line-soft px-1 pt-3.5 pb-2.5 text-xs font-medium text-placeholder`}>
                <span>Tur</span><span>Ishxona</span><span>Holat</span><span>Urinish</span><span>Vaqt</span><span>Xato</span>
              </div>
              {rows.map((j) => (
                <div key={j.id} className={`grid ${COLS} items-center gap-3 border-b border-[#F4F5F7] px-1 py-2.5 text-[13px] last:border-b-0`}>
                  <span className="truncate font-mono text-xs font-semibold">{j.type}</span>
                  <span className="truncate">{j.tenant ?? <span className="text-placeholder">—</span>}</span>
                  <span><span className={`badge ${TONE[j.status] ?? ''}`}><span className="badge-dot" />{j.status}</span></span>
                  <span className="tnum">{j.attempts}</span>
                  <span className="tnum text-muted">{formatDateTime(j.run_at)}</span>
                  <span className="truncate font-mono text-xs text-danger-text" title={j.last_error ?? undefined}>{j.last_error ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
