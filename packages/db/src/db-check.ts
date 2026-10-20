import './load-env';
import { Pool } from 'pg';

/** Ikkala ulanishni va ilova roli RLS'ni chetlab o'tolmasligini tekshiradi. */
async function check(label: string, url: string | undefined) {
  if (!url) throw new Error(`${label} sozlanmagan`);
  const pool = new Pool({ connectionString: url, max: 1, ssl: /localhost|127\.0\.0\.1|sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } });
  const { rows } = await pool.query<{ db: string; usr: string; bypassrls: boolean; superuser: boolean; version: string }>(
    `select current_database() as db, current_user as usr,
            (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls,
            (select rolsuper from pg_roles where rolname = current_user) as superuser,
            split_part(version(), ',', 1) as version`,
  );
  await pool.end();
  const r = rows[0]!;
  console.log(`${label}: db=${r.db} user=${r.usr} bypassrls=${r.bypassrls} superuser=${r.superuser} (${r.version})`);
  return r;
}
async function main() {
  const app = await check('DATABASE_URL        ', process.env.DATABASE_URL);
  await check('DATABASE_URL_MIGRATE', process.env.DATABASE_URL_MIGRATE);
  if (app.bypassrls || app.superuser) {
    console.error("XATO: ilova roli superuser yoki RLS'ni chetlab o'tadi");
    process.exit(1);
  }
  console.log('OK: ilova roli RLS ostida');
}
main().catch((e) => { console.error(e); process.exit(1); });
