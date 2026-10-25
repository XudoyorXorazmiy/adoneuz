import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDateTime, formatPhone } from '@adone/core';
import { LEAD_STATUS_LABELS, LEAD_STATUSES, listLeads, type LeadStatus } from '@/server/leads';
import { setLeadStatusAction } from '@/lib/actions/leads';

export const metadata: Metadata = { title: 'Arizalar' };

const TONE: Record<LeadStatus, string> = { new: 'bg-info-tint text-info-text', contacted: 'bg-warning-tint text-warning-text', won: 'bg-success-tint text-success-text', rejected: 'bg-subtle text-muted' };

/** Landing (adone.uz) arizalari — faqat platforma admini (`withPlatform`). */
export default async function LeadsPage({ searchParams }: PageProps<'/platforma/arizalar'>) {
  const sp = await searchParams;
  const tab = ([...LEAD_STATUSES, 'all'] as string[]).includes(String(sp.holat)) ? (String(sp.holat) as LeadStatus | 'all') : 'new';
  const { rows, counts } = await listLeads(tab);
  return (
    <>
      <h1 className="page-title">Arizalar {counts.new ? <span className="tnum text-placeholder">{counts.new}</span> : null}</h1>
      <div className="flex flex-wrap gap-1">
        {[...LEAD_STATUSES, 'all' as const].map((k) => (
          <Link key={k} href={k === 'new' ? '/arizalar' : `/arizalar?holat=${k}`} className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] ${tab === k ? 'bg-card font-bold text-ink shadow-[var(--shadow-card)]' : 'font-medium text-muted hover:text-ink'}`}>
            {k === 'all' ? 'Barchasi' : LEAD_STATUS_LABELS[k]}{k !== 'all' && counts[k] ? <span className="tnum text-[11px] text-muted">{counts[k]}</span> : null}
          </Link>
        ))}
      </div>
      <div className="card overflow-hidden">
        {rows.length === 0 ? <p className="m-0 p-10 text-center text-muted">Ariza yo&apos;q.</p> : (
          <>
            <ul className="m-0 flex list-none flex-col p-0 sm:hidden">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 border-t border-line-soft p-4 first:border-t-0">
                  <div className="flex items-center justify-between gap-2"><b>{r.name}</b><span className={`badge ${TONE[r.status as LeadStatus]}`}>{LEAD_STATUS_LABELS[r.status as LeadStatus]}</span></div>
                  <a href={`tel:+${r.phone}`} className="tnum text-primary">{formatPhone(r.phone)}</a>
                  <span className="text-xs text-muted">{r.staffSize ?? '—'} xodim · {formatDateTime(r.createdAt)}</span>
                  <StatusForm id={r.id} status={r.status as LeadStatus} />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] border-collapse text-[13px]">
                <thead className="bg-page text-left text-xs text-muted">
                  <tr><th className="px-4 py-2.5 font-medium">Ism</th><th className="px-4 py-2.5 font-medium">Telefon</th><th className="px-4 py-2.5 font-medium">Xodimlar</th><th className="px-4 py-2.5 font-medium">Qayerdan</th><th className="px-4 py-2.5 font-medium">Vaqt</th><th className="px-4 py-2.5 font-medium">Holat</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line-soft">
                      <td className="px-4 py-3 font-bold">{r.name}</td>
                      <td className="tnum px-4"><a href={`tel:+${r.phone}`} className="text-primary">{formatPhone(r.phone)}</a></td>
                      <td className="px-4">{r.staffSize ?? '—'}</td>
                      <td className="px-4 text-muted">{[r.source, ...Object.values(r.utm)].join(' · ')}</td>
                      <td className="tnum px-4 text-muted">{formatDateTime(r.createdAt)}</td>
                      <td className="px-4"><StatusForm id={r.id} status={r.status as LeadStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatusForm({ id, status }: { id: string; status: LeadStatus }) {
  return (
    <form action={setLeadStatusAction} className="flex gap-1">
      <input type="hidden" name="id" value={id} />
      {LEAD_STATUSES.filter((s) => s !== status).map((s) => (
        <button key={s} name="status" value={s} className="h-7 cursor-pointer rounded-full border border-line bg-card px-2.5 text-[11px] font-semibold text-ink-2 hover:bg-page">{LEAD_STATUS_LABELS[s]}</button>
      ))}
    </form>
  );
}
