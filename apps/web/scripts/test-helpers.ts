import { addDays, isWorkday, localDate, zonedTime, type ScheduleRule } from '@adone/core';
import { employeeRule, withTenant } from '@adone/db';

export { addDays, isWorkday, localDate, zonedTime };

export async function toRuleSafe(tenantId: string, employeeId: string): Promise<ScheduleRule> {
  const r = await withTenant(tenantId, (tx) => employeeRule(tx, employeeId));
  if (!r) throw new Error('jadval yo‘q');
  return r;
}
