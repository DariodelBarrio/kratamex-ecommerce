const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'kratamex',
  user:     process.env.DB_USER     || 'kratamex',
  password: process.env.DB_PASSWORD || 'kratamex_dev',
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = pool;
