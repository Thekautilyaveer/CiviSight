// Row -> Mongoose-compatible JSON shaping. Every repo returns objects shaped exactly
// like the current Mongoose `res.json()` output so the frontend sees no difference.
//
// Universal rules (see SUPABASE_MIGRATION_PLAN.md §6):
//   - `_id` is the string PK (from `id`).
//   - snake_case columns -> camelCase.
//   - jsonb columns pass through with their preserved camelCase keys.
//   - timestamptz -> ISO strings (createdAt/updatedAt/deadline/completedAt).
//   - `__v` is omitted (frontend never reads it; parity harness normalizes it away).
//   - Optional single objects (formFile/filledFormFile) and completedAt are OMITTED when
//     null, matching Mongoose (which drops unset paths).
const { ObjectId } = require('mongodb');

const newId = () => new ObjectId().toString();

// timestamptz column (Date from pg) -> ISO string, matching Mongoose JSON.
const iso = (v) => {
  if (v == null) return v;
  if (v instanceof Date) return v.toISOString();
  return new Date(v).toISOString();
};

// --- County ---
function county(row) {
  if (!row) return null;
  return {
    _id: row.id,
    govId: row.gov_id,
    type: row.type,
    name: row.name,
    code: row.code,
    description: row.description,
    email: row.email,
    fiscalYearStartMonth: row.fiscal_year_start_month,
    fiscalYearStartDay: row.fiscal_year_start_day,
    fiscalYearEndMonth: row.fiscal_year_end_month,
    fiscalYearEndDay: row.fiscal_year_end_day,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// Minimal populated county: {_id, name, code} (+ email when fields includes it).
function countyRef(row, { withEmail = false } = {}) {
  if (!row || row.id == null) return null;
  const ref = { _id: row.id, name: row.name, code: row.code };
  if (withEmail) ref.email = row.email;
  return ref;
}

// --- User ---
// countyRef: when populated, pass the joined county columns to embed {_id,name,code};
// otherwise countyId serializes as the id string (or null).
function user(row, { populatedCounty = null } = {}) {
  if (!row) return null;
  const out = {
    _id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    countyId: populatedCounty
      ? countyRef(populatedCounty)
      : (row.county_id != null ? row.county_id : null),
    departmentRoles: row.department_roles || [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  return out;
}

// Minimal populated user: {_id, username, email} (+ role when withRole).
function userRef(row, { withRole = false } = {}) {
  if (!row || row.id == null) return null;
  const ref = { _id: row.id, username: row.username, email: row.email };
  if (withRole) ref.role = row.role;
  return ref;
}

// --- Task ---
// countyId / assignedBy can be populated (pass joined columns) or left as id strings.
// jsonb arrays pass through untouched (their camelCase keys were preserved on migration).
function task(row, { county = null, assignedBy = null, countyEmail = false } = {}) {
  if (!row) return null;
  const out = {
    _id: row.id,
    title: row.title,
    description: row.description,
    countyId: county
      ? countyRef(county, { withEmail: countyEmail })
      : row.county_id,
    submittedTo: row.submitted_to,
    portalLink: row.portal_link,
    status: row.status,
    priority: row.priority,
    deadline: iso(row.deadline),
    assignedBy: assignedBy ? userRef(assignedBy) : row.assigned_by,
    assignedRoles: row.assigned_roles || [],
    assignedContacts: row.assigned_contacts || [],
    reminders: row.reminders || [],
    comments: row.comments || [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  // Optional paths: present only when set (matches Mongoose dropping unset paths).
  if (row.form_file != null) out.formFile = row.form_file;
  if (row.filled_form_file != null) out.filledFormFile = row.filled_form_file;
  if (row.completed_at != null) out.completedAt = iso(row.completed_at);
  return out;
}

// Minimal populated task ref for submissions: {_id, title[, deadline, status, submittedTo]}.
function taskRef(t) {
  if (!t || t.id == null) return null;
  const ref = { _id: t.id, title: t.title };
  if (t.deadline !== undefined) ref.deadline = iso(t.deadline);
  if (t.status !== undefined) ref.status = t.status;
  if (t.submittedTo !== undefined) ref.submittedTo = t.submittedTo;
  return ref;
}

// --- Submission ---
// Optional populated refs (task/county/submittedBy/reviewedBy) and pre-populated comments
// pass through; otherwise ids/jsonb are emitted as stored.
function submission(row, { task = null, county = null, submittedBy = null, reviewedBy = null, comments } = {}) {
  if (!row) return null;
  const out = {
    _id: row.id,
    taskId: task ? taskRef(task) : row.task_id,
    countyId: county ? countyRef(county) : row.county_id,
    agency: row.agency,
    formName: row.form_name,
    formType: row.form_type,
    status: row.status,
    submittedBy: submittedBy ? userRef(submittedBy, { withRole: true }) : row.submitted_by,
    submittedAt: iso(row.submitted_at),
    answers: row.answers === undefined ? null : row.answers,
    metadata: row.metadata || {},
    comments: comments !== undefined ? comments : (row.comments || []),
    file: row.file != null ? row.file : undefined,
    reviewedBy: reviewedBy ? userRef(reviewedBy, { withRole: true }) : (row.reviewed_by != null ? row.reviewed_by : null),
    reviewedAt: row.reviewed_at != null ? iso(row.reviewed_at) : null,
    reviewNote: row.review_note,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
  if (row.file == null) delete out.file; // matches Mongoose dropping the unset nested path
  return out;
}

// --- Contact ---
function contact(row) {
  if (!row) return null;
  return {
    _id: row.id,
    countyId: row.county_id,
    contacts: row.contacts || [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// --- Notification ---
// taskId populated (pass joined task columns) -> {_id,title,deadline,status}, else id/null.
function notification(row, { populatedTask = undefined } = {}) {
  if (!row) return null;
  let taskId;
  if (populatedTask === undefined) {
    taskId = row.task_id != null ? row.task_id : null;
  } else if (populatedTask && populatedTask.id != null) {
    taskId = {
      _id: populatedTask.id,
      title: populatedTask.title,
      deadline: iso(populatedTask.deadline),
      status: populatedTask.status,
    };
  } else {
    taskId = null;
  }
  return {
    _id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    taskId,
    read: row.read,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

module.exports = {
  newId,
  iso,
  county,
  countyRef,
  user,
  userRef,
  task,
  taskRef,
  submission,
  contact,
  notification,
};
