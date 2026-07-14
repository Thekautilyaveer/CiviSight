// Additive demo enrichment: give entities that already have an ACCEPTED latest-year RLGF
// two prior accepted years, so the compliance view shows a real mix of compliant and
// non-compliant. Idempotent (skips a year already filed) and non-destructive.
//
//   node scripts/seed-compliance-history.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ObjectId } = require('mongodb');
const { getPool, closePool } = require('../db/pool');
const submissions = require('../db/repos/submissions');

const newId = () => new ObjectId().toString();
const seededUnit = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };

const FIELDS = {
  yr: { page: 'Page 1', cell: 'F17', label: 'Fiscal year', type: 'integer' },
  realPropertyTax: { page: 'Page 2', cell: 'F38', label: 'Real property taxes', ucoaCode: '31.1100', type: 'dollar' },
  localOptionSalesTax: { page: 'Page 2', cell: 'F48', label: 'Local option sales tax', ucoaCode: '31.3100', type: 'dollar' },
  debtService: { page: 'Page 5', cell: 'F200', label: 'Total debt service', ucoaCode: '58.1000', type: 'dollar' },
};
const answersFor = (code, year) => {
  const s = 0.3 + seededUnit(code + year) * 3;
  return { yr: year, realPropertyTax: Math.round(2_000_000 * s), localOptionSalesTax: Math.round(1_200_000 * s), debtService: Math.round(300_000 * seededUnit(code + 'd' + year)) };
};

async function main() {
  const pool = getPool();
  const rlgf = (await pool.query("select id from form_definitions where code='rlgf' order by version desc limit 1")).rows[0];
  const dca = (await pool.query("select id from users where role='dca' limit 1")).rows[0];
  if (!rlgf || !dca) { console.error('Need an rlgf form_definition and a dca user.'); process.exit(1); }

  const latest = (await pool.query("select max(reporting_period) mx from filing_compliance where form_code='rlgf'")).rows[0].mx;
  const targets = (await pool.query(
    `select s.county_id as entity_id, e.name, e.code, s.task_id, s.submitted_by
       from submissions s join entities e on e.id = s.county_id
      where s.is_current and s.form_definition_id = $1 and s.reporting_period = $2 and s.status = 'accepted'
      order by e.name limit 8`,
    [rlgf.id, latest]
  )).rows;

  let inserted = 0;
  for (const t of targets) {
    for (const year of [latest - 1, latest - 2]) {
      const exists = (await pool.query(
        `select 1 from submissions where county_id=$1 and form_definition_id=$2 and reporting_period=$3 limit 1`,
        [t.entity_id, rlgf.id, year]
      )).rowCount;
      if (exists) continue;
      const id = newId();
      const answers = answersFor(t.code, year);
      const submittedAt = new Date(year + 1, 2, 15); // filed the following spring
      await pool.query(
        `insert into submissions
          (id,task_id,county_id,agency,form_name,form_type,status,submitted_by,submitted_at,
           answers,metadata,reviewed_by,reviewed_at,review_note,reporting_period,form_definition_id,
           filing_id,version,is_current)
         values ($1,$2,$3,$4,$5,'online','accepted',$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,1,true)`,
        [id, t.task_id, t.entity_id, 'Dept. of Community Affairs (DCA)', 'Report of Local Government Finances',
         t.submitted_by, submittedAt, JSON.stringify(answers),
         JSON.stringify({ source: 'online_form', form: 'rlgf', fields: FIELDS, historical: true }),
         dca.id, new Date(year + 1, 4, 1), 'Accepted.', year, rlgf.id, newId()]
      );
      await submissions.insertProjection(pool, id, answers, FIELDS);
      inserted++;
    }
  }
  console.log(`Compliance history: ${inserted} prior-year accepted RLGF filings across ${targets.length} entities (anchor FY${latest}).`);
  await closePool();
}

if (require.main === module) main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
