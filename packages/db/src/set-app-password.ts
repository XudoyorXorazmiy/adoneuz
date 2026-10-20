import './load-env';
import { Pool } from 'pg';

/**
 * Ilova roli (adone_app) parolini DATABASE_URL dagi parolga tenglaydi — migratsiya rolni parolsiz yaratadi.
 * Birinchi deploy'da bir marta (ega ulanishi bilan): pnpm --filter @adone/db set-app-password
 */
async function main() {
  const migrate = process.env.DATABASE_URL_MIGRATE;
  const app = process.env.DATABASE_URL;
  if (!migrate || !app) throw new Error('DATABASE_URL va DATABASE_URL_MIGRATE kerak');
  const u = new URL(app);
  if (decodeURIComponent(u.username) !== 'adone_app') throw new Error('DATABASE_URL foydalanuvchisi adone_app bo‘lishi kerak');
  const password = decodeURIComponent(u.password);
  if (password.length < 12 && !/localhost|127\.0\.0\.1/.test(u.hostname)) throw new Error('Parol kamida 12 belgi');
  const pool = new Pool({ connectionString: migrate, max: 1, ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(migrate) ? undefined : { rejectUnauthorized: false } });
  const { rows } = await pool.query<{ q: string }>(`select format('ALTER ROLE adone_app WITH LOGIN PASSWORD %L', $1::text) as q`, [password]);
  await pool.query(rows[0]!.q);
  await pool.end();
  console.log('adone_app paroli o‘rnatildi');
}
main().catch((e) => { console.error(e.message); process.exit(1); });
