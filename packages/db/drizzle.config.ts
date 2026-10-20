import './src/load-env';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit EGA ulanishi bilan ishlaydi (DDL); ilova roli DDL qila olmaydi va RLS'ni chetlab o'tmaydi.
const url = process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_MIGRATE sozlanmagan');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: { url },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
