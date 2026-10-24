import { localDate } from '@adone/core';
import { withTenant } from '@adone/db';
import { currentTgUser } from '@/lib/tg/session';
import { selfTasksNeedApproval } from '@/server/tasks';
import { TgHeader } from '@/components/tg/tg-shell';
import { AddWork } from '@/components/tg/add-work';

export default async function TgAddWorkPage() {
  const u = (await currentTgUser())!;
  const needs = await withTenant(u.tenantId, (tx) => selfTasksNeedApproval(tx));
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-page">
      <TgHeader title="Ish qo'shish" />
      <AddWork today={localDate(new Date(), u.tz)} needsApproval={needs} />
    </div>
  );
}
