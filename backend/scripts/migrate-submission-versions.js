// One-time migration: give existing submissions a reporting period + form-version pin +
// an immutable version chain (filing_id / version / is_current / supersedes_id).
// ADDITIVE and idempotent: adds columns if missing, backfills nulls, never deletes rows.
//
//   node scripts/migrate-submission-versions.js
//
// A "filing" = (entity × form × reporting period). Submissions sharing that triple become
// versions of one filing, ordered by submitted_at; the latest is is_current.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ObjectId } = require('mongodb');
const { getPool, closePool } = require('../db/pool');

const newId = () => new ObjectId().toString();

// Reporting fiscal year for a submission: prefer the year the filer stated on the RLGF
// (Page 1 / cell F17), else fall back to the submission's own year.
function reportingPeriodFor(sub) {
  const fields = sub.metadata?.fields || {};
  const answers = sub.answers || {};
  // find the field whose Excel address is Page 1 / F17 (the RLGF report year)
  let key = Object.keys(fields).find((k) => fields[k]?.page === 'Page 1' && fields[k]?.cell === 'F17');
  if (!key && answers.fiscalYear != null) key = 'fiscalYear';
  const raw = key ? answers[key] : null;
  const yr = parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
  if (yr >= 1990 && yr <= 2100) return yr;
  return sub.submitted_at ? new Date(sub.submitted_at).getFullYear() : null;
}

const isRlgf = (sub) =>
  sub.metadata?.form === 'rlgf' || /local government finance/i.test(sub.form_name || '');

async function main() {
  const pool = getPool();
  // 1) add columns + indexes (idempotent)
  await pool.query('alter table submissions add column if not exists reporting_period int');
  await pool.query('alter table submissions add column if not exists form_definition_id text references form_definitions(id) on delete set null');
  await pool.query('alter table submissions add column if not exists filing_id text');
  await pool.query('alter table submissions add column if not exists version int not null default 1');
  await pool.query('alter table submissions add column if not exists is_current boolean not null default true');
  await pool.query('alter table submissions add column if not exists supersedes_id text references submissions(id) on delete set null');
  await pool.query('create index if not exists idx_submissions_filing on submissions(filing_id)');
  await pool.query('create index if not exists idx_submissions_period on submissions(reporting_period)');

  // 2) resolve the RLGF form definition to pin
  const rlgf = (await pool.query("select id from form_definitions where code='rlgf' order by version desc limit 1")).rows[0];
  const rlgfId = rlgf ? rlgf.id : null;

  // 3) load every submission (only those not yet assigned a filing_id get (re)grouped)
  const subs = (await pool.query(
    `select id, county_id, form_name, form_type, submitted_at, answers, metadata, filing_id
       from submissions order by submitted_at asc`
  )).rows;

  // 4) group by (county_id, form-key, reporting_period)
  const groups = new Map();
  const computed = subs.map((s) => {
    const period = reportingPeriodFor(s);
    const formDefId = isRlgf(s) ? rlgfId : null;
    const formKey = formDefId || s.form_name;
    const gk = `${s.county_id}|${formKey}|${period}`;
    return { ...s, period, formDefId, gk };
  });
  for (const s of computed) {
    if (!groups.has(s.gk)) groups.set(s.gk, []);
    groups.get(s.gk).push(s);
  }

  // 5) assign filing_id / version / is_current / supersedes_id and UPDATE
  let updated = 0, filings = 0;
  for (const [, members] of groups) {
    members.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
    const filingId = newId();
    filings++;
    let prevId = null;
    for (let i = 0; i < members.length; i++) {
      const s = members[i];
      const version = i + 1;
      const isCurrent = i === members.length - 1;
      await pool.query(
        `update submissions
            set reporting_period = $2, form_definition_id = $3, filing_id = $4,
                version = $5, is_current = $6, supersedes_id = $7
          where id = $1`,
        [s.id, s.period, s.formDefId, filingId, version, isCurrent, prevId]
      );
      prevId = s.id;
      updated++;
    }
  }

  // 6) enforce one-current-per-filing now that filing_ids are set
  await pool.query('create unique index if not exists idx_submissions_one_current on submissions(filing_id) where is_current and filing_id is not null');

  console.log(`Migrated ${updated} submissions into ${filings} filings (RLGF pinned to ${rlgfId || 'none'}).`);
  await closePool();
}

if (require.main === module) main().catch((e) => { console.error('Migration FAILED:', e.message); process.exit(1); });

module.exports = { reportingPeriodFor, isRlgf };
