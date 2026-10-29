import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

/**
 * Runtime pool — ILOVA roli (adone_app, NOBYPASSRLS). Har so'rov RLS ostida.
 * Modullar `db`ni to'g'ridan-to'g'ri ishlatmaydi: withTenant / withPlatform / withAuth
 * (scoped.ts) tranzaksiyasi ichida ishlaydi — kontekst yo'q bo'lsa qator ham yo'q.
 */
declare global {
  // eslint-disable-next-line no-var
  var __adonePool: Pool | undefined;
}

function createPool(): Pool {
  // `next build` («collecting page data») route modullarini import qiladi — pool shu paytda yaratiladi, ulanmaydi.
  // Build muhitida DATABASE_URL bo'lmasa (Docker image sinovi) soxta manzil — ulanish faqat ishga tushgach kerak.
  const url = process.env.DATABASE_URL || (process.env.NEXT_PHASE === 'phase-production-build' ? 'postgres://build@localhost:5432/build' : '');
  if (!url) throw new Error('DATABASE_URL sozlanmagan');
  // sslmode=disable — o'z serverdagi ichki baza (TLS'siz)
  const local = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('sslmode=disable');
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
    // Bitta qotgan so'rov / qulf / ochiq qolgan tranzaksiya butun ilovani (pool'ni) to'xtatmasin
    statement_timeout: 15_000,
    lock_timeout: 5_000,
    idle_in_transaction_session_timeout: 30_000,
  });
  // Bo'sh turgan ulanish uzilsa (Postgres qayta ishga tushdi, tarmoq) — pg 'error' chiqaradi; tinglovchisiz jarayon o'ladi.
  // Ulanish pool'dan chiqariladi, keyingi so'rov yangisini ochadi.
  pool.on('error', (e) => console.error('[db] bo‘sh ulanish xatosi:', e.message));
  return pool;
}

export const pool: Pool = globalThis.__adonePool ?? createPool();
if (process.env.NODE_ENV !== 'production') globalThis.__adonePool = pool;

export const db = drizzle(pool, { schema, casing: 'snake_case' });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
