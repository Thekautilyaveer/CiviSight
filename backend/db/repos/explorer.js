// Database-explorer repository (Supabase Postgres). Read-only analytics over the system of
// record: current-version filings (submissions where is_current) joined to entities, with
// any UCOA-coded value pulled from submission_values, plus the form-field catalog for the
// column picker and a filing's full version history. Powers routes/database.js.
const { query } = require('../pool');

// --- current filings for the grid, with optional pulled UCOA value columns ---
// filters: { entityTypes[], period, status, formSearch, entitySearch, ucoaCodes[], limit }
async function listFilings(filters = {}) {
  const where = ['s.is_current'];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };

  if (Array.isArray(filters.entityTypes) && filters.entityTypes.length) where.push(`e.type = any(${p(filters.entityTypes)}::text[])`);
  if (filters.period) where.push(`s.reporting_period = ${p(Number(filters.period))}`);
  if (filters.status) where.push(`s.status = ${p(filters.status)}`);
  if (filters.formSearch) where.push(`s.form_name ilike ${p(`%${filters.formSearch}%`)}`);
  if (filters.entitySearch) where.push(`e.name ilike ${p(`%${filters.entitySearch}%`)}`);

  const limit = Math.min(Number(filters.limit) || 500, 2000);
  const { rows } = await query(
    `select s.id as submission_id, s.filing_id, s.reporting_period, s.status, s.version,
            s.form_type, s.submitted_at, s.form_name,
            e.id as entity_id, e.name as entity_name, e.type as entity_type, e.gov_id
       from submissions s
       join entities e on e.id = s.county_id
      where ${where.join(' and ')}
      order by e.name asc, s.reporting_period desc
      limit ${limit}`,
    params
  );

  // Pull selected UCOA columns: sum each code's numeric values per filing (a code can span
  // several cells). Returned as row.values[ucoa] = number.
  const codes = (filters.ucoaCodes || []).filter(Boolean);
  const valuesBySub = new Map();
  if (codes.length && rows.length) {
    const subIds = rows.map((r) => r.submission_id);
    const { rows: vrows } = await query(
      `select submission_id, ucoa_code, sum(numeric_value) as v
         from submission_values
        where submission_id = any($1::text[]) and ucoa_code = any($2::text[])
        group by submission_id, ucoa_code`,
      [subIds, codes]
    );
    for (const v of vrows) {
      if (!valuesBySub.has(v.submission_id)) valuesBySub.set(v.submission_id, {});
      valuesBySub.get(v.submission_id)[v.ucoa_code] = v.v == null ? null : Number(v.v);
    }
  }

  return rows.map((r) => ({
    submissionId: r.submission_id,
    filingId: r.filing_id,
    entityId: r.entity_id,
    entityName: r.entity_name,
    entityType: r.entity_type,
    govId: r.gov_id,
    formName: r.form_name,
    formType: r.form_type,
    reportingPeriod: r.reporting_period,
    status: r.status,
    version: r.version,
    submittedAt: r.submitted_at,
    values: valuesBySub.get(r.submission_id) || {},
  }));
}

// Distinct reporting periods present (for the year filter).
async function distinctPeriods() {
  const { rows } = await query(`select distinct reporting_period from submissions where reporting_period is not null order by reporting_period desc`);
  return rows.map((r) => r.reporting_period);
}

// --- pullable field catalog: one entry per UCOA code (a code can map to many cells) ---
async function fieldCatalog(formCode = 'rlgf') {
  const { rows } = await query(
    `select fld.ucoa_code,
            min(fld.label) as label,
            count(*)::int as cells
       from form_fields fld
       join form_definitions d on d.id = fld.form_definition_id
      where d.code = $1 and fld.ucoa_code is not null and not fld.derived
      group by fld.ucoa_code
      order by fld.ucoa_code`,
    [String(formCode).toLowerCase()]
  );
  return rows.map((r) => ({ ucoaCode: r.ucoa_code, label: r.label, cells: r.cells }));
}

// --- full version history for a filing (every submission that shares filing_id) ---
async function filingVersions(filingId) {
  const { rows } = await query(
    `select s.id as submission_id, s.version, s.is_current, s.status, s.form_type,
            s.submitted_at, s.reviewed_at, s.review_note,
            sb.username as submitted_by, rb.username as reviewed_by
       from submissions s
       left join users sb on sb.id = s.submitted_by
       left join users rb on rb.id = s.reviewed_by
      where s.filing_id = $1
      order by s.version asc`,
    [filingId]
  );
  return rows.map((r) => ({
    submissionId: r.submission_id,
    version: r.version,
    isCurrent: r.is_current,
    status: r.status,
    formType: r.form_type,
    submittedAt: r.submitted_at,
    submittedBy: r.submitted_by,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewed_by,
    reviewNote: r.review_note,
  }));
}

module.exports = { listFilings, distinctPeriods, fieldCatalog, filingVersions };
