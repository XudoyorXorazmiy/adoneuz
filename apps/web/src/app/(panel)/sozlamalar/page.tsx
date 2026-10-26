import type { Metadata } from 'next';
import Link from 'next/link';
import { can, formatDate } from '@adone/core';
import { withTenant } from '@adone/db';
import { requireUser } from '@/lib/auth/session';
import { PageHeader } from '@/components/ui/page-header';
import { Icon } from '@/components/ui/icon';
import { myAccount } from '@/server/account';
import { billingInfo, getSettings, lastChanges, lastClosedPeriod, TIMEZONES } from '@/server/settings';
import { listTeam } from '@/server/team';
import { listBranches, listDepartments } from '@/server/structure';
import { loadPayRules } from '@/server/payroll';
import { AttendanceTab, BillingTab, NotificationsTab, PayTab, ProfileTab, TasksTab, TenantTab, whenLabel } from '@/components/settings/tabs';
import { TeamTab, type TeamRow } from '@/components/settings/team';

export const metadata: Metadata = { title: 'Sozlamalar' };

const TABS = [
  { id: 'profil', label: 'Profilim', icon: 'person' },
  { id: 'ishxona', label: 'Ishxona', icon: 'storefront' },
  { id: 'jamoa', label: 'Jamoa', icon: 'group' },
  { id: 'davomat', label: 'Davomat', icon: 'how_to_reg' },
  { id: 'vazifalar', label: 'Vazifalar', icon: 'task_alt' },
  { id: 'ish-haqi', label: 'Ish haqi', icon: 'payments' },
  { id: 'bildirishnomalar', label: 'Bildirishnomalar', icon: 'notifications' },
  { id: 'tarif', label: 'Tarif', icon: 'workspace_premium' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Sozlamalar (design/panel/Sozlamalar.dc.html). Profilim — har panel foydalanuvchisi; qolgani `settings` (egasi, admin); Tarif — `billing` (egasi). */
export default async function SettingsPage({ searchParams }: PageProps<'/sozlamalar'>) {
  const user = await requireUser();
  const sp = await searchParams;
  const allowed = TABS.filter((t) => t.id === 'profil' || (t.id === 'tarif' ? can(user.role, 'billing') : can(user.role, 'settings')));
  const picked = allowed.find((t) => t.id === sp.tab);
  const tab: TabId = picked?.id ?? 'profil';
  const tz = user.tenantTimezone;

  return (
    <>
      <PageHeader title="Sozlamalar" subtitle="Ishxona, jamoa va qoidalar" />
      <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-5 max-lg:grid-cols-1">
        <nav className={`card flex flex-col gap-0.5 p-2.5 max-lg:p-0 max-lg:py-1 ${picked ? 'max-lg:hidden' : ''}`}>
          {allowed.map((t, i) => {
            const active = t.id === tab;
            return (
              <Link key={t.id} href={`/sozlamalar?tab=${t.id}`}
                className={`flex items-center gap-3 rounded-xl px-3 text-sm lg:h-[42px] max-lg:mx-4 max-lg:h-14 max-lg:rounded-none max-lg:px-0 max-lg:text-[15px] max-lg:font-semibold ${i < allowed.length - 1 ? 'max-lg:border-b max-lg:border-line-soft' : ''} ${active ? 'lg:bg-primary-tint lg:font-bold lg:text-primary' : 'font-medium text-ink-2 lg:hover:bg-page'}`}>
                <span className="flex items-center justify-center max-lg:size-[34px] max-lg:rounded-[10px] max-lg:bg-primary-tint max-lg:text-primary"><Icon name={t.icon} className={active ? 'lg:text-primary' : 'lg:text-muted'} /></span>
                <span className="flex-1">{t.label}</span>
                {t.id === 'tarif' && <span className="text-[10px] font-bold text-placeholder max-lg:hidden">egasi</span>}
                <Icon name="chevron_right" className="text-placeholder lg:hidden" />
              </Link>
            );
          })}
          {allowed.length > 1 && <div className="mx-1 mt-2 mb-1 border-t border-line-soft pt-2.5 text-[11px] leading-normal text-placeholder max-lg:hidden">Administrator Tarifni ko&apos;rmaydi. Bo&apos;lim boshlig&apos;i faqat Profilim&apos;ni ko&apos;radi.</div>}
        </nav>
        <div className={`flex min-w-0 flex-col gap-5 ${picked ? '' : 'max-lg:hidden'}`}>
          <Link href="/sozlamalar" className="flex items-center gap-2 text-sm font-semibold text-muted lg:hidden"><Icon name="arrow_back" />{TABS.find((t) => t.id === tab)!.label}</Link>
          <TabContent tab={tab} user={user} tz={tz} />
        </div>
      </div>
    </>
  );
}

async function TabContent({ tab, user, tz }: { tab: TabId; user: Awaited<ReturnType<typeof requireUser>>; tz: string }) {
  switch (tab) {
    case 'profil': {
      const [acc, audit] = await Promise.all([myAccount(user), lastChanges(user.tenantId, ['account.name', 'account.password', 'account.telegram', 'auth.login'], user.id)]);
      return <ProfileTab acc={acc} mustChange={user.mustChangePassword} audit={audit} tz={tz} />;
    }
    case 'ishxona': {
      const audit = await lastChanges(user.tenantId, ['settings.tenant', 'tenant.archive']);
      return <TenantTab name={user.tenantName} timezone={tz} timezones={TIMEZONES} isOwner={user.role === 'owner'} audit={audit} tz={tz} />;
    }
    case 'jamoa': {
      const [team, departments, branches, audit] = await Promise.all([
        listTeam(user.tenantId), listDepartments(user.tenantId), listBranches(user.tenantId),
        lastChanges(user.tenantId, ['member.create', 'member.update', 'member.password_reset', 'member.activate', 'member.deactivate']),
      ]);
      const dName = new Map(departments.map((d) => [d.id, d.name]));
      const bName = new Map(branches.map((b) => [b.id, b.name]));
      const rows: TeamRow[] = team.map((m) => ({
        membershipId: m.membershipId, userId: m.userId, name: m.name, phone: m.phone, role: m.role as TeamRow['role'],
        // Menejer mas'uliyati: a'zolikdagi bo'lim/filiallar + bo'lim sahifasida boshliq qilib qo'yilgan bo'limlar
        scope: m.role === 'manager'
          ? [...new Set([...m.departmentIds, ...departments.filter((d) => d.managerUserId === m.userId).map((d) => d.id)])].map((id) => dName.get(id))
            .concat(m.branchIds.map((id) => bName.get(id))).filter(Boolean).join(', ') || '—'
          : "Barcha bo'limlar",
        departmentIds: m.departmentIds, branchIds: m.branchIds, active: m.active, last: whenLabel(m.lastLoginAt, tz), telegram: m.telegram,
        self: m.userId === user.id,
        manageable: m.userId !== user.id && m.role !== 'owner' && (user.role === 'owner' || (user.role === 'admin' && m.role === 'manager')),
      }));
      const last = Object.values(audit).sort((a, b) => b.at.getTime() - a.at.getTime())[0];
      return (
        <div className="flex flex-col gap-2">
          <TeamTab rows={rows} departments={departments.map((d) => ({ id: d.id, name: d.name }))} branches={branches.map((b) => ({ id: b.id, name: b.name }))} canAddAdmin={user.role === 'owner'} />
          <div className="pl-2 text-xs text-placeholder">Oxirgi o&apos;zgarish: {last ? `${last.name} · ${formatDate(last.at, tz)}` : '—'}</div>
        </div>
      );
    }
    case 'davomat': {
      const [s, audit] = await Promise.all([getSettings(user.tenantId), lastChanges(user.tenantId, ['settings.attendance', 'settings.face', 'settings.notifications'])]);
      return <AttendanceTab s={s} audit={audit} tz={tz} />;
    }
    case 'vazifalar': {
      const [s, rules, audit] = await Promise.all([getSettings(user.tenantId), withTenant(user.tenantId, loadPayRules), lastChanges(user.tenantId, ['settings.tasks', 'settings.reminders'])]);
      return <TasksTab s={s} countSelfTasks={rules.task.countSelfTasks} audit={audit} tz={tz} />;
    }
    case 'ish-haqi': {
      const [rules, closed, audit] = await Promise.all([withTenant(user.tenantId, loadPayRules), lastClosedPeriod(user.tenantId), lastChanges(user.tenantId, ['payroll.rules'])]);
      return <PayTab rules={rules} closed={closed} audit={audit} tz={tz} />;
    }
    case 'bildirishnomalar': {
      const [s, audit] = await Promise.all([getSettings(user.tenantId), lastChanges(user.tenantId, ['settings.notifications'])]);
      return <NotificationsTab s={s} audit={audit} tz={tz} />;
    }
    case 'tarif': {
      const b = await billingInfo(user.tenantId);
      return <BillingTab b={b} tz={tz} support={process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM || null} />;
    }
  }
}
