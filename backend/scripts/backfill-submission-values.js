// Backfill the submission_values query projection from existing submissions' answers.
// ADDITIVE + idempotent: ensures the table exists, then projects each submission's answered
// non-derived fields into flat, UCOA-keyed rows. Re-runnable (on conflict do nothing per
// (submission_id, field_key)); never deletes submissions.
//
//   node scripts/backfill-submission-values.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getPool, closePool } = require('../db/pool');
const submissions = require('../db/repos/submissions');

async function ensureTable(pool) {
  await pool.query(`create table if not exists submission_values (
    id text primary key,
    submission_id text not null references submissions(id) on delete cascade,
    field_key text not null, ucoa_code text, data_type text,
    numeric_value numeric, text_value text,
    created_at timestamptz not null default now(),
    unique (submission_id, field_key))`);
  await pool.query('create index if not exists idx_submission_values_submission on submission_values(submission_id)');
  await pool.query('create index if not exists idx_submission_values_ucoa on submission_values(ucoa_code)');
  await pool.query('create index if not exists idx_submission_values_ucoa_num on submission_values(ucoa_code, numeric_value)');
}

async function main() {
  const pool = getPool();
  await ensureTable(pool);

  const subs = (await pool.query('select id, answers, metadata from submissions')).rows;
  let projected = 0, withValues = 0;
  for (const s of subs) {
    const fields = s.metadata && s.metadata.fields;
    const n = await submissions.insertProjection(pool, s.id, s.answers, fields);
    if (n > 0) { projected += n; withValues++; }
  }
  const total = (await pool.query('select count(*)::int n from submission_values')).rows[0].n;
  console.log(`Backfilled submission_values: ${projected} rows from ${withValues}/${subs.length} submissions (table total: ${total}).`);
  await closePool();
}

if (require.main === module) main().catch((e) => { console.error('Backfill FAILED:', e.message); process.exit(1); });
