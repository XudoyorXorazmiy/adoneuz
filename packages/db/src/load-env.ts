import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Bitta .env — repo ildizida. Skriptlar (drizzle-kit, migrate, seed) uni o'zi yuklaydi;
// Next ilovasi apps/web/next.config.ts orqali yuklaydi.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet: true });
