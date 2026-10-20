import type { Metadata } from 'next';
import { CalendarClock, Pencil, Plus } from 'lucide-react';
import { describeSchedule, localDate } from '@adone/core';
import { requireArea } from '@/lib/auth/guard';
import { listSchedules } from '@/server/structure';
import { archiveScheduleAction, saveScheduleAction } from '@/lib/actions/structure';
import { EmptyState, PageHeader } from '@/components/ui/page-header';
import { FormDrawer } from '@/components/ui/form-drawer';
import { ScheduleFields } from '@/components/structure/schedule-fields';

export const metadata: Metadata = { title: 'Jadvallar' };

export default async function SchedulesPage() {
  const user = await requireArea('schedules');
  const rows = await listSchedules(user.tenantId);
  const today = localDate(new Date(), user.tenantTimezone);
  const add = (
    <FormDrawer trigger={<><Plus size={16} /> Jadval qo&apos;shish</>} title="Yangi jadval" action={saveScheduleAction}>
      <ScheduleFields today={today} />
    </FormDrawer>
  );
  return (
    <>
      <PageHeader title="Jadvallar" count={rows.length} subtitle="Smena vaqti, tanaffus va kechikish chegarasi. Xodimga jadval «Xodimlar» bo'limida biriktiriladi.">{add}</PageHeader>
      {rows.length === 0 ? (
        <div className="card"><EmptyState text="Hali jadval yo'q. Masalan: «Asosiy smena», 6/1, 09:00–21:00.">{add}</EmptyState></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead className="bg-page text-left text-xs text-muted">
              <tr><th className="px-4 py-2.5 font-medium">Nomi</th><th className="px-4 py-2.5 font-medium">Grafik</th><th className="px-4 py-2.5 font-medium">Tanaffus</th><th className="px-4 py-2.5 font-medium">Kechikish chegarasi</th><th className="px-4 py-2.5 font-medium">Xodimlar</th><th className="px-4 py-2.5" /></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium"><span className="flex items-center gap-2"><CalendarClock size={16} className="text-primary" />{s.name}</span></td>
                  <td className="tnum px-4 py-3">{describeSchedule(s)}{s.kind !== 'free' && s.endTime <= s.startTime && <span className="ml-2 badge bg-info-tint text-info-text">tungi</span>}</td>
                  <td className="tnum px-4 py-3">{s.kind === 'free' ? '—' : `${s.breakMinutes} daq`}</td>
                  <td className="tnum px-4 py-3">{s.kind === 'free' ? '—' : `${s.graceMinutes} daq`}</td>
                  <td className="tnum px-4 py-3">{s.employees}</td>
                  <td className="px-4 py-3 text-right">
                    <FormDrawer trigger={<><Pencil size={14} /> Tahrirlash</>} triggerClass="btn-ghost btn-sm" title="Jadvalni tahrirlash" action={saveScheduleAction}
                      danger={s.employees === 0 ? <form action={archiveScheduleAction}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost text-danger-text">O&apos;chirish</button></form> : undefined}>
                      <ScheduleFields s={s} today={today} />
                    </FormDrawer>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
