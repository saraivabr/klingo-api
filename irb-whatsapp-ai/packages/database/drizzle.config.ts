import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/postgres/schema.ts',
  out: './src/postgres/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://irb:irb_dev_2024@localhost:5432/irb_whatsapp',
  },
});
