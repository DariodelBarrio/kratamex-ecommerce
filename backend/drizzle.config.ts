import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number.parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'kratamex',
    user:     process.env.DB_USER     || 'kratamex',
    password: process.env.DB_PASSWORD,
  },
});
