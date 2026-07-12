// Supabase port of cleanup-rlgf-demo-completions.js.
// RLGF tasks were seeded as "completed" for demo purposes, but with the online-submission
// workflow an RLGF task should only be completed once a real Submission exists. This resets
// any RLGF task that is completed (or has completedAt) but has NO submission back to pending,
// while leaving RLGF tasks that carry an actual submission untouched. Idempotent.
//
//   node scripts/cleanup-rlgf-demo-completions-supabase.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

// Matches the Mongo RLGF regex: \brlgf\b | report of local government financ
const RLGF_WHERE = `(title ~* '(^|[^a-z])rlgf([^a-z]|$)' or title ~* 'report of local government financ')`;

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('SUPABASE_DB_URL missing in backend/.env'); process.exit(1); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const kept = await client.query(
      `select count(*)::int n from tasks t
        where ${RLGF_WHERE} and exists (select 1 from submissions s where s.task_id = t.id)`
    );
    const reset = await client.query(
      `update tasks set status = 'pending', completed_at = null
        where ${RLGF_WHERE}
          and (status = 'completed' or completed_at is not null)
          and not exists (select 1 from submissions s where s.task_id = tasks.id)
        returning id`
    );
    console.log(`RLGF cleanup complete. Reset ${reset.rowCount} fake completions; kept ${kept.rows[0].n} tasks with actual submissions.`);
  } catch (err) {
    console.error('Cleanup FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
