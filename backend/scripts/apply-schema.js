// Applies backend/db/schema.sql to the Supabase Postgres database.
// Idempotent (schema.sql uses IF NOT EXISTS / CREATE OR REPLACE).
//
//   node scripts/apply-schema.js
//
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('SUPABASE_DB_URL missing in backend/.env');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected. Applying schema…');
    await client.query(sql);
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Schema apply FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
