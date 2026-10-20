import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns';
import { tenants } from './platform';

/**
 * Platforma boti uchun tenant'dan TASHQARIDAGI jadvallar (adone_platform roli o'qiydi/yozadi):
 * webhook kelganda tenant hali noma'lum — Telegram user → tenant(lar) shu yerdan yechiladi (CLAUDE.md §1.1).
 * Ishxona ichki ma'lumoti (xodim ismi, davomat) bu yerda saqlanmaydi.
 */

/** Taklif kodi → ishxona va xodim. `/start inv_<code>`. Panel (tenant) yaratadi, bot (platforma) o'qiydi. */
export const invites = pgTable(
  'invites',
  {
    code: text().primaryKey(),
    tenantId: uuid().notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    /** employee — xodim taklifi; member — panel foydalanuvchisi Telegram'ini bog'lash (bildirishnomalar). */
    kind: text().notNull().default('employee'),
    refId: uuid().notNull(), // employees.id yoki users.id
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('invites_tenant_idx').on(t.tenantId)],
);

/** Telegram foydalanuvchisi qaysi ishxonada kim. Bir odam bir nechta ishxonada bo'lishi mumkin. */
export const tgLinks = pgTable(
  'tg_links',
  {
    id: id(),
    telegramUserId: bigint({ mode: 'number' }).notNull(),
    tenantId: uuid().notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    kind: text().notNull(), // employee | member
    refId: uuid().notNull(),
    chatId: bigint({ mode: 'number' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('tg_links_user_idx').on(t.telegramUserId), index('tg_links_tenant_idx').on(t.tenantId, t.kind)],
);

/** Suhbat holati (qaysi qadam kutilmoqda) — 1 Telegram foydalanuvchisiga bitta. */
export const botSessions = pgTable('bot_sessions', {
  telegramUserId: bigint({ mode: 'number' }).primaryKey(),
  tenantId: uuid().references(() => tenants.id, { onDelete: 'cascade' }),
  state: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Idempotentlik: Telegram bir update'ni qayta yuborsa ikki marta ishlanmaydi. */
export const tgUpdates = pgTable('tg_updates', {
  updateId: bigint({ mode: 'number' }).primaryKey(),
  attempts: integer().notNull().default(0),
  receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
