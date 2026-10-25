import 'server-only';
/**
 * Landing arizalari: yozish — adone_auth (faqat INSERT, RLS 0013), o'qish va holat — platforma.
 * Egasiga Telegram xabari — `PLATFORM_OWNER_CHAT_ID` bo'lsa (javobdan keyin, `after`).
 */
import { desc, eq, sql } from 'drizzle-orm';
import { leads, withAuth, withPlatform } from '@adone/db';
import { formatPhone } from '@adone/core';
import { escHtml as esc } from '@/lib/task-text';
import { send } from './telegram/api';

export const LEAD_STATUSES = ['new', 'contacted', 'won', 'rejected'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = { new: 'Yangi', contacted: "Bog'lanildi", won: 'Mijoz bo‘ldi', rejected: 'Rad' };

export async function createLead(v: { name: string; phone: string; staffSize: string | null; source: string; utm: Record<string, string> }) {
  await withAuth((tx) => tx.insert(leads).values(v));
}

export async function notifyOwner(v: { name: string; phone: string; staffSize: string | null; source: string }) {
  const chat = Number(process.env.PLATFORM_OWNER_CHAT_ID);
  if (!chat || !process.env.PLATFORM_BOT_TOKEN) return;
  await send(chat, `📝 <b>Yangi ariza</b> · adone.uz\n${esc(v.name)} · ${formatPhone(v.phone)}\nXodimlar: ${esc(v.staffSize ?? '—')} · ${esc(v.source)}`).catch(() => undefined);
}

export async function listLeads(status: LeadStatus | 'all') {
  return withPlatform(async (tx) => {
    const rows = await tx.select().from(leads).where(status === 'all' ? undefined : eq(leads.status, status)).orderBy(desc(leads.createdAt)).limit(300);
    const counts = await tx.select({ s: leads.status, n: sql<number>`count(*)::int` }).from(leads).groupBy(leads.status);
    return { rows, counts: Object.fromEntries(counts.map((c) => [c.s, c.n])) as Partial<Record<LeadStatus, number>> };
  });
}

export async function setLeadStatus(id: string, status: LeadStatus) {
  await withPlatform((tx) => tx.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, id)));
}
