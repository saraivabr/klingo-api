import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://irb:irb_dev_2024@localhost:5432/irb_whatsapp';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
