import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://irb:irb_dev_2024@localhost:5432/irb_whatsapp';
const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log('Running pgvector migration...');

  const migrationPath = resolve(__dirname, 'postgres/migrations/0001_enable_pgvector.sql');
  const migration = readFileSync(migrationPath, 'utf-8');

  await sql.unsafe(migration);

  console.log('pgvector migration complete!');
  await sql.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
