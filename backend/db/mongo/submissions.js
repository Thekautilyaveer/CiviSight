// Mongoose-backed Submission repo (DATA_DRIVER=mongo). Interface mirrors db/repos/submissions.js.
const Submission = require('../../models/Submission');

const POP = (q) => q
  .populate('taskId', 'title deadline status submittedTo')
  .populate('countyId', 'name code')
  .populate('submittedBy', 'username email role')
  .populate('reviewedBy', 'username email role')
  .populate('comments.createdBy', 'username email role');

async function find(filters = {}) {
  const query = {};
  if (filters.countyId) query.countyId = filters.countyId;
  if (filters.agency) query.agency = filters.agency;
  if (filters.status) query.status = filters.status;
  if (filters.formName) query.formName = filters.formName;
  if (filters.taskId) query.taskId = filters.taskId;
  return POP(Submission.find(query)).sort({ submittedAt: -1 });
}

async function findByIdPopulated(id) {
  return POP(Submission.findById(id));
}

async function getRaw(id) {
  return Submission.findById(id);
}

async function findForStats(filters = {}) {
  const query = {};
  if (filters.agency) query.agency = filters.agency;
  if (filters.formName) query.formName = filters.formName;
  return Submission.find(query)
    .populate('taskId', 'title submittedTo')
    .populate('countyId', 'name code');
}

async function create(data) {
  return Submission.create(data);
}

async function pushComment(id, { fieldId, text, createdBy, createdAt }) {
  const submission = await Submission.findById(id);
  if (!submission) return null;
  submission.comments.push({ fieldId, text, createdBy, createdAt: createdAt || new Date() });
  await submission.save();
  return POP(Submission.findById(id));
}

async function updateReview(id, { status, reviewNote, reviewedBy, reviewedAt }) {
  const submission = await Submission.findById(id);
  if (!submission) return null;
  submission.status = status;
  submission.reviewNote = reviewNote;
  submission.reviewedBy = reviewedBy;
  submission.reviewedAt = reviewedAt;
  await submission.save();
  return POP(Submission.findById(id));
}

module.exports = { find, findByIdPopulated, getRaw, findForStats, create, pushComment, updateReview };
