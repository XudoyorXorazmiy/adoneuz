import './load-env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** ./migrations ni EGA ulanishi bilan qo'llaydi (DDL, RLS'ni chetlab o'tadi). */
async function main() {
  const url = process.env.DATABASE_URL_MIGRATE;
  if (!url) throw new Error('DATABASE_URL_MIGRATE sozlanmagan');
  const pool = new Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } });
  const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
  await migrate(drizzle(pool), { migrationsFolder: folder });
  await pool.end();
  console.log("Migratsiyalar qo'llandi");
}
main().catch((e) => { console.error(e); process.exit(1); });
