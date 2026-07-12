// Shared pg connection pool for the Supabase Postgres store.
// Used by the repositories in backend/db/repos/*. Opened lazily on first query.
const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is required when DATA_DRIVER=supabase');
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => logger.error('Postgres pool error:', err));
  return pool;
}

// query(text, params) -> pg result. Thin wrapper so repos never touch the pool directly.
async function query(text, params) {
  return getPool().query(text, params);
}

// Run fn(client) inside a transaction, committing on success and rolling back on error.
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end().catch(() => {});
    pool = null;
  }
}

module.exports = { getPool, query, withTransaction, closePool };
