import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentTgMember, currentTgUser } from '@/lib/tg/session';
import { myTasks } from '@/server/miniapp';
import { Icon } from '@/components/ui/icon';
import { TgPage } from '@/components/tg/tg-shell';
import { TaskRow } from '@/components/tg/task-row';

export default async function TgTasksPage({ searchParams }: PageProps<'/tg/vazifalar'>) {
  const u = await currentTgUser();
  if (!u) return (await currentTgMember()) ? redirect('/tg') : null; // rahbar sessiyasi — Bugun ekrani; sessiya yo'q — layout avtorizatsiya ekranini ko'rsatadi
  const sp = await searchParams;
  const rows = await myTasks(u);
  const groups: Array<[string, typeof rows]> = [
    ['Ochiq', rows.filter((r) => ['new', 'accepted', 'in_progress', 'revision'].includes(r.status))],
    ['Tekshiruvda', rows.filter((r) => r.status === 'submitted')],
    ['Bajarilgan (14 kun)', rows.filter((r) => r.status === 'approved')],
  ];
  return (
    <TgPage>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Vazifalar</h1>
          <Link href="/tg/ish" className="flex h-9 items-center gap-1 rounded-full bg-card px-3.5 text-[13px] font-bold shadow-[var(--shadow-card)]"><Icon name="add" size={18} className="text-primary" />Ish qo&apos;shish</Link>
        </div>
        {(sp.yuborildi || sp.qoshildi) && <p className="m-0 flex items-center gap-2 rounded-2xl bg-success-tint p-3.5 text-sm font-semibold text-success"><Icon name="check_circle" fill />{sp.yuborildi ? 'Hisobot yuborildi — rahbar tekshiradi.' : 'Ish qayd etildi.'}</p>}
        {rows.length === 0 && <p className="m-0 rounded-2xl bg-card p-5 text-center text-sm text-muted shadow-[var(--shadow-card)]">Hozircha vazifa yo&apos;q.</p>}
        {groups.filter(([, g]) => g.length).map(([l, g]) => (
          <div key={l} className="flex flex-col gap-2.5">
            <h2 className="m-0 mt-1 text-sm font-bold text-muted">{l} · {g.length}</h2>
            {g.map((t) => <TaskRow key={t.id} t={t} tz={u.tz} />)}
          </div>
        ))}
      </div>
    </TgPage>
  );
}
