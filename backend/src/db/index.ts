import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number.parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'kratamex',
  user:     process.env.DB_USER     || 'kratamex',
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export const db   = drizzle(pool, { schema });
export { pool };
