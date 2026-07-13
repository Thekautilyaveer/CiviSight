// Submission repository (Supabase Postgres). Reproduces the Mongoose populate behavior of
// routes/submissions.js: taskId/countyId/submittedBy/reviewedBy and comments[].createdBy.
const { query } = require('../pool');
const usersRepo = require('./users');
const m = require('../mapper');

const COLS = `id,task_id,county_id,agency,form_name,form_type,status,submitted_by,submitted_at,
  answers,metadata,comments,file,reviewed_by,reviewed_at,review_note,created_at,updated_at`;
const S = COLS.split(',').map((c) => 's.' + c.trim()).join(',');

const TASK_JOIN = `t.id as t_id, t.title as t_title, t.deadline as t_deadline, t.status as t_status, t.submitted_to as t_submitted_to`;
const COUNTY_JOIN = `c.id as c_id, c.name as c_name, c.code as c_code`;
const SUB_JOIN = `sb.id as sb_id, sb.username as sb_username, sb.email as sb_email, sb.role as sb_role`;
const REV_JOIN = `rb.id as rb_id, rb.username as rb_username, rb.email as rb_email, rb.role as rb_role`;
const JOINS = `
  left join tasks t on t.id = s.task_id
  left join entities c on c.id = s.county_id
  left join users sb on sb.id = s.submitted_by
  left join users rb on rb.id = s.reviewed_by`;

const taskFrom = (r) => (r.t_id ? { id: r.t_id, title: r.t_title, deadline: r.t_deadline, status: r.t_status, submittedTo: r.t_submitted_to } : null);
const countyFrom = (r) => (r.c_id ? { id: r.c_id, name: r.c_name, code: r.c_code } : null);
const subByFrom = (r) => (r.sb_id ? { id: r.sb_id, username: r.sb_username, email: r.sb_email, role: r.sb_role } : null);
const revByFrom = (r) => (r.rb_id ? { id: r.rb_id, username: r.rb_username, email: r.rb_email, role: r.rb_role } : null);

// Populate comments[].createdBy for a set of submission rows in one users lookup.
async function populateCommentsFor(rows) {
  const ids = [];
  for (const r of rows) for (const c of r.comments || []) if (c && c.createdBy) ids.push(c.createdBy);
  const refs = await usersRepo.findRefsByIds(ids);
  const map = new Map();
  for (const r of rows) {
    map.set(r.id, (r.comments || []).map((c) => ({ ...c, createdBy: refs.get(String(c.createdBy)) || c.createdBy })));
  }
  return map;
}

function shape(r, commentsMap) {
  return m.submission(r, {
    task: taskFrom(r),
    county: countyFrom(r),
    submittedBy: subByFrom(r),
    reviewedBy: revByFrom(r),
    comments: commentsMap ? commentsMap.get(r.id) : undefined,
  });
}

// GET /submissions — filtered, fully populated, sorted submittedAt desc.
async function find(filters = {}) {
  const where = [];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (filters.countyId) where.push(`s.county_id = ${p(filters.countyId)}`);
  if (filters.agency) where.push(`s.agency = ${p(filters.agency)}`);
  if (filters.status) where.push(`s.status = ${p(filters.status)}`);
  if (filters.formName) where.push(`s.form_name = ${p(filters.formName)}`);
  if (filters.taskId) where.push(`s.task_id = ${p(filters.taskId)}`);
  const sql = `select ${S}, ${TASK_JOIN}, ${COUNTY_JOIN}, ${SUB_JOIN}, ${REV_JOIN}
      from submissions s ${JOINS}
      ${where.length ? 'where ' + where.join(' and ') : ''}
      order by s.submitted_at desc`;
  const { rows } = await query(sql, params);
  const commentsMap = await populateCommentsFor(rows);
  return rows.map((r) => shape(r, commentsMap));
}

async function findByIdPopulated(id) {
  const { rows } = await query(
    `select ${S}, ${TASK_JOIN}, ${COUNTY_JOIN}, ${SUB_JOIN}, ${REV_JOIN}
       from submissions s ${JOINS} where s.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const commentsMap = await populateCommentsFor(rows);
  return shape(rows[0], commentsMap);
}

// Raw (unpopulated) for existence checks and reading task_id in the review flow.
async function getRaw(id) {
  const { rows } = await query(`select ${COLS} from submissions where id = $1`, [id]);
  return rows[0] ? m.submission(rows[0]) : null;
}

// Stats source — task + county populated, no comment populate needed.
async function findForStats(filters = {}) {
  const where = [];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (filters.agency) where.push(`s.agency = ${p(filters.agency)}`);
  if (filters.formName) where.push(`s.form_name = ${p(filters.formName)}`);
  const { rows } = await query(
    `select ${S}, ${TASK_JOIN}, ${COUNTY_JOIN}
       from submissions s
       left join tasks t on t.id = s.task_id
       left join entities c on c.id = s.county_id
       ${where.length ? 'where ' + where.join(' and ') : ''}`,
    params
  );
  return rows.map((r) => m.submission(r, { task: taskFrom(r), county: countyFrom(r) }));
}

async function create(data) {
  const id = m.newId();
  const { rows } = await query(
    `insert into submissions
       (id,task_id,county_id,agency,form_name,form_type,status,submitted_by,submitted_at,
        answers,metadata,file)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb)
     returning ${COLS}`,
    [
      id, data.taskId, data.countyId, data.agency || '', data.formName, data.formType,
      data.status || 'submitted', data.submittedBy, data.submittedAt || new Date(),
      data.answers == null ? null : JSON.stringify(data.answers),
      JSON.stringify(data.metadata || {}),
      data.file == null ? null : JSON.stringify(data.file),
    ]
  );
  return m.submission(rows[0]);
}

// POST /submissions/:id/comments — append a field-level comment (with _id + empty readBy).
async function pushComment(id, { fieldId, text, createdBy, createdAt }) {
  const el = {
    fieldId, text, createdBy: String(createdBy),
    createdAt: m.iso(createdAt) || new Date().toISOString(), readBy: [], _id: m.newId(),
  };
  const { rowCount } = await query(
    `update submissions set comments = comments || $2::jsonb where id = $1`,
    [id, JSON.stringify([el])]
  );
  if (!rowCount) return null;
  return findByIdPopulated(id);
}

// PUT /submissions/:id/review
async function updateReview(id, { status, reviewNote, reviewedBy, reviewedAt }) {
  const { rowCount } = await query(
    `update submissions set status = $2, review_note = $3, reviewed_by = $4, reviewed_at = $5 where id = $1`,
    [id, status, reviewNote, reviewedBy, reviewedAt]
  );
  if (!rowCount) return null;
  return findByIdPopulated(id);
}

module.exports = {
  find,
  findByIdPopulated,
  getRaw,
  findForStats,
  create,
  pushComment,
  updateReview,
};
