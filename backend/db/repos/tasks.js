// Task repository (Supabase Postgres). Reproduces the Mongoose query + populate behavior
// of routes/tasks.js, counties stats, notifications/upcoming, and the reminder scheduler.
const { query } = require('../pool');
const usersRepo = require('./users');
const m = require('../mapper');

const COLS = `id,title,description,county_id,submitted_to,portal_link,status,priority,deadline,
  assigned_by,assigned_roles,assigned_contacts,reminders,form_file,filled_form_file,comments,
  completed_at,created_at,updated_at`;

// Task columns prefixed for joins, plus county/assignedBy populate columns.
const T = COLS.split(',').map((c) => 't.' + c.trim()).join(',');
const COUNTY_JOIN = `c.id as c_id, c.name as c_name, c.code as c_code, c.email as c_email`;
const USER_JOIN = `a.id as a_id, a.username as a_username, a.email as a_email`;
const countyFrom = (r) => (r.c_id ? { id: r.c_id, name: r.c_name, code: r.c_code, email: r.c_email } : null);
const userFrom = (r) => (r.a_id ? { id: r.a_id, username: r.a_username, email: r.a_email } : null);

// --- GET /tasks (list with filters, role visibility, populate, sort) ---
async function findList(filters = {}) {
  const where = [];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };

  if (filters.countyId) where.push(`t.county_id = ${p(filters.countyId)}`);
  if (filters.status) where.push(`t.status = ${p(filters.status)}`);
  if (filters.priority) where.push(`t.priority = ${p(filters.priority)}`);
  if (filters.deadlineFrom) where.push(`t.deadline >= ${p(filters.deadlineFrom)}`);
  if (filters.deadlineTo) where.push(`t.deadline <= ${p(filters.deadlineTo)}`);
  if (filters.assignedFrom) where.push(`t.created_at >= ${p(filters.assignedFrom)}`);
  if (filters.assignedTo) where.push(`t.created_at <= ${p(filters.assignedTo)}`);
  if (filters.search) {
    const s = p(`%${filters.search}%`);
    where.push(`(t.title ilike ${s} or t.description ilike ${s})`);
  }
  // Role-based visibility for county users: no assignedRoles OR overlap with the user's roles.
  if (Array.isArray(filters.visibleRoles) && filters.visibleRoles.length > 0) {
    where.push(`(jsonb_array_length(t.assigned_roles) = 0 or t.assigned_roles ?| ${p(filters.visibleRoles)}::text[])`);
  }

  const sql = `select ${T}, ${COUNTY_JOIN}, ${USER_JOIN}
      from tasks t
      left join counties c on c.id = t.county_id
      left join users a on a.id = t.assigned_by
      ${where.length ? 'where ' + where.join(' and ') : ''}
      order by t.deadline asc, t.created_at desc`;
  const { rows } = await query(sql, params);
  return rows.map((r) => m.task(r, { county: countyFrom(r), assignedBy: userFrom(r) }));
}

// --- Single task, populated (countyId name/code[/email], assignedBy username/email) ---
async function findByIdPopulated(id, { countyEmail = false } = {}) {
  const { rows } = await query(
    `select ${T}, ${COUNTY_JOIN}, ${USER_JOIN}
       from tasks t
       left join counties c on c.id = t.county_id
       left join users a on a.id = t.assigned_by
      where t.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  return m.task(rows[0], { county: countyFrom(rows[0]), assignedBy: userFrom(rows[0]), countyEmail });
}

async function findByIdsPopulated(ids, { countyEmail = false } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const { rows } = await query(
    `select ${T}, ${COUNTY_JOIN}, ${USER_JOIN}
       from tasks t
       left join counties c on c.id = t.county_id
       left join users a on a.id = t.assigned_by
      where t.id = any($1::text[])
      order by t.created_at asc`,
    [ids]
  );
  return rows.map((r) => m.task(r, { county: countyFrom(r), assignedBy: userFrom(r), countyEmail }));
}

// --- Raw single task (unpopulated: countyId as id string) for permission checks/mutation ---
async function getRaw(id) {
  const { rows } = await query(`select ${COLS} from tasks where id = $1`, [id]);
  return rows[0] ? m.task(rows[0]) : null;
}

// --- Create ---
function buildInsertParams(data) {
  const id = m.newId();
  return [
    id,
    data.title,
    data.description || '',
    data.countyId,
    data.submittedTo || '',
    data.portalLink || '',
    data.status || 'pending',
    data.priority || 'medium',
    data.deadline,
    data.assignedBy,
    JSON.stringify(data.assignedRoles || []),
    JSON.stringify(data.assignedContacts || []),
  ];
}

async function create(data) {
  const values = buildInsertParams(data);
  const { rows } = await query(
    `insert into tasks
       (id,title,description,county_id,submitted_to,portal_link,status,priority,deadline,assigned_by,
        assigned_roles,assigned_contacts)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
     returning ${COLS}`,
    values
  );
  return m.task(rows[0]);
}

// Mirrors insertMany; returns created tasks (raw shape, with ids), in input order.
async function insertMany(dataArray) {
  const created = [];
  for (const data of dataArray) {
    created.push(await create(data));
  }
  return created;
}

// --- Update arbitrary scalar/jsonb fields (PUT). Only provided keys are written. ---
async function updateFields(id, fields) {
  const sets = [];
  const params = [id];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  const map = {
    title: 'title', description: 'description', status: 'status', priority: 'priority',
    deadline: 'deadline', submittedTo: 'submitted_to', portalLink: 'portal_link',
  };
  for (const [k, col] of Object.entries(map)) {
    if (fields[k] !== undefined) sets.push(`${col} = ${p(fields[k])}`);
  }
  if (fields.assignedRoles !== undefined) sets.push(`assigned_roles = ${p(JSON.stringify(fields.assignedRoles))}::jsonb`);
  if (fields.assignedContacts !== undefined) sets.push(`assigned_contacts = ${p(JSON.stringify(fields.assignedContacts))}::jsonb`);
  if (sets.length === 0) return;
  await query(`update tasks set ${sets.join(', ')} where id = $1`, params);
}

async function deleteById(id) {
  const { rows } = await query(`delete from tasks where id = $1 returning ${COLS}`, [id]);
  return rows[0] ? m.task(rows[0]) : null;
}

async function deleteByCountyId(countyId) {
  await query(`delete from tasks where county_id = $1`, [countyId]);
}

// --- Reminders: append {sentAt, sentBy, _id} to the jsonb array ---
async function pushReminder(id, { sentAt, sentBy }) {
  const el = { sentAt: m.iso(sentAt) || new Date().toISOString(), sentBy: sentBy || null, _id: m.newId() };
  await query(`update tasks set reminders = reminders || $2::jsonb where id = $1`, [id, JSON.stringify([el])]);
}

// --- Form files ---
async function setFormFile(id, formFile) {
  await query(`update tasks set form_file = $2::jsonb where id = $1`, [id, JSON.stringify(formFile)]);
}

async function setFilledFormFile(id, filledFormFile) {
  await query(
    `update tasks set filled_form_file = $2::jsonb, status = 'completed', completed_at = now() where id = $1`,
    [id, JSON.stringify(filledFormFile)]
  );
}

// --- Comments ---
async function pushComment(id, { text, createdBy, createdAt }) {
  const el = {
    text,
    createdBy: String(createdBy),
    createdAt: m.iso(createdAt) || new Date().toISOString(),
    readBy: [],
    _id: m.newId(),
  };
  await query(`update tasks set comments = comments || $2::jsonb where id = $1`, [id, JSON.stringify([el])]);
  return el;
}

// GET /:id/comments — comments with createdBy populated {_id,username,email,role}.
// Returns { comments } or null if the task doesn't exist.
async function findCommentsPopulated(id) {
  const { rows } = await query(`select comments from tasks where id = $1`, [id]);
  if (!rows[0]) return null;
  const comments = rows[0].comments || [];
  const refs = await usersRepo.findRefsByIds(comments.map((c) => c.createdBy));
  const populated = comments.map((c) => ({
    ...c,
    createdBy: refs.get(String(c.createdBy)) || c.createdBy,
  }));
  return { comments: populated };
}

// Mark comment [index] read by userId (append to readBy if absent). Returns raw comment or
// a sentinel: null => task missing, 'OOB' => index out of range.
async function markCommentRead(id, index, userId) {
  const { rows } = await query(`select comments from tasks where id = $1`, [id]);
  if (!rows[0]) return null;
  const comments = rows[0].comments || [];
  if (index < 0 || index >= comments.length) return 'OOB';
  const comment = comments[index];
  if (!Array.isArray(comment.readBy)) comment.readBy = [];
  const uid = String(userId);
  if (!comment.readBy.some((x) => String(x) === uid)) {
    comment.readBy.push(uid);
    await query(`update tasks set comments = $2::jsonb where id = $1`, [id, JSON.stringify(comments)]);
  }
  return comment;
}

// --- Counties stats: minimal task rows (status + comments) for a county ---
async function findForCountyStats(countyId) {
  const { rows } = await query(`select status, comments from tasks where county_id = $1`, [countyId]);
  return rows.map((r) => ({ status: r.status, comments: r.comments || [] }));
}

// --- Reminder scheduler: not-completed tasks due within [now, until], county populated ---
async function findDueForReminder(now, until) {
  const { rows } = await query(
    `select ${T}, ${COUNTY_JOIN}
       from tasks t
       left join counties c on c.id = t.county_id
      where t.status <> 'completed' and t.deadline >= $1 and t.deadline <= $2`,
    [now, until]
  );
  return rows.map((r) => m.task(r, { county: countyFrom(r), countyEmail: true }));
}

// --- Notifications/upcoming: deadline in [now, until], not completed, optional county ---
async function findUpcoming({ countyId, from, to }) {
  const where = [`t.deadline >= $1`, `t.deadline <= $2`, `t.status <> 'completed'`];
  const params = [from, to];
  if (countyId) { params.push(countyId); where.push(`t.county_id = $${params.length}`); }
  const { rows } = await query(
    `select ${T}, ${COUNTY_JOIN}
       from tasks t
       left join counties c on c.id = t.county_id
      where ${where.join(' and ')}
      order by t.deadline asc
      limit 10`,
    params
  );
  return rows.map((r) => m.task(r, { county: countyFrom(r) }));
}

module.exports = {
  findList,
  findByIdPopulated,
  findByIdsPopulated,
  getRaw,
  create,
  insertMany,
  updateFields,
  deleteById,
  deleteByCountyId,
  pushReminder,
  setFormFile,
  setFilledFormFile,
  pushComment,
  findCommentsPopulated,
  markCommentRead,
  findForCountyStats,
  findDueForReminder,
  findUpcoming,
};
