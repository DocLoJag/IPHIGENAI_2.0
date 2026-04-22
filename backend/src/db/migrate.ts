import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db, closePostgres } from './postgres.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, 'migrations');

async function main() {
  console.log('[migrate] applico migration da', migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log('[migrate] done');
  await closePostgres();
}

main().catch(async (err) => {
  console.error('[migrate] errore', err);
  await closePostgres().catch(() => {});
  process.exit(1);
});
