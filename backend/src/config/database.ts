import pg from 'pg';
const { Pool } = pg;

// Create PostgreSQL connection pool from DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

// Test connection on startup
pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
  process.exit(-1);
});

export { pool };
