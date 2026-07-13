// Mongoose-backed Task repo (DATA_DRIVER=mongo). Interface mirrors db/repos/tasks.js.
// Returns native Mongoose docs so serialization matches the app's historical behavior.
const Task = require('../../models/Task');

// Translate the normalized filter object (built by the route) into a Mongo query.
function buildQuery(filters = {}) {
  const query = {};
  if (filters.countyId) query.countyId = filters.countyId;
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.deadlineFrom || filters.deadlineTo) {
    query.deadline = {};
    if (filters.deadlineFrom) query.deadline.$gte = new Date(filters.deadlineFrom);
    if (filters.deadlineTo) query.deadline.$lte = new Date(filters.deadlineTo);
  }
  if (filters.assignedFrom || filters.assignedTo) {
    query.createdAt = {};
    if (filters.assignedFrom) query.createdAt.$gte = new Date(filters.assignedFrom);
    if (filters.assignedTo) query.createdAt.$lte = new Date(filters.assignedTo);
  }
  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }
  if (Array.isArray(filters.visibleRoles) && filters.visibleRoles.length > 0) {
    query.$and = (query.$and || []).concat([
      {
        $or: [
          { assignedRoles: { $exists: false } },
          { assignedRoles: { $size: 0 } },
          { assignedRoles: { $in: filters.visibleRoles } },
        ],
      },
    ]);
  }
  return query;
}

async function findList(filters = {}) {
  return Task.find(buildQuery(filters))
    .populate('countyId', 'name code')
    .populate('assignedBy', 'username email')
    .sort({ deadline: 1, createdAt: -1 });
}

async function findByIdPopulated(id, { countyEmail = false } = {}) {
  return Task.findById(id)
    .populate('countyId', countyEmail ? 'name code email' : 'name code')
    .populate('assignedBy', 'username email');
}

async function findByIdsPopulated(ids, { countyEmail = false } = {}) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return Task.find({ _id: { $in: ids } })
    .populate('countyId', countyEmail ? 'name code email' : 'name code')
    .populate('assignedBy', 'username email');
}

async function getRaw(id) {
  return Task.findById(id);
}

async function create(data) {
  const task = new Task(data);
  await task.save();
  return task;
}

async function insertMany(dataArray) {
  return Task.insertMany(dataArray);
}

async function updateFields(id, fields) {
  const task = await Task.findById(id);
  if (!task) return;
  if (fields.title !== undefined) task.title = fields.title;
  if (fields.description !== undefined) task.description = fields.description;
  if (fields.status !== undefined) task.status = fields.status;
  if (fields.priority !== undefined) task.priority = fields.priority;
  if (fields.deadline !== undefined) task.deadline = new Date(fields.deadline);
  if (fields.submittedTo !== undefined) task.submittedTo = fields.submittedTo;
  if (fields.portalLink !== undefined) task.portalLink = fields.portalLink;
  if (fields.assignedRoles !== undefined) task.assignedRoles = fields.assignedRoles;
  if (fields.assignedContacts !== undefined) task.assignedContacts = fields.assignedContacts;
  await task.save();
}

async function deleteById(id) {
  return Task.findByIdAndDelete(id);
}

async function deleteByCountyId(countyId) {
  await Task.deleteMany({ countyId });
}

async function pushReminder(id, { sentAt, sentBy }) {
  const task = await Task.findById(id);
  if (!task) return;
  task.reminders.push({ sentAt: sentAt || new Date(), sentBy: sentBy || null });
  await task.save();
}

async function setFormFile(id, formFile) {
  const task = await Task.findById(id);
  if (!task) return;
  task.formFile = formFile;
  await task.save();
}

// Attach uploaded filled form; task -> 'submitted' (awaiting review), not 'completed'.
async function setFilledFormFile(id, filledFormFile) {
  const task = await Task.findById(id);
  if (!task) return;
  task.filledFormFile = filledFormFile;
  task.status = 'submitted';
  task.completedAt = undefined;
  await task.save();
}

async function markCompleted(id) {
  const task = await Task.findById(id);
  if (!task) return;
  task.status = 'completed';
  task.completedAt = new Date();
  await task.save();
}

// County submitted a filing online; awaits agency review (not yet "done").
async function markSubmitted(id) {
  const task = await Task.findById(id);
  if (!task) return;
  task.status = 'submitted';
  task.completedAt = undefined;
  await task.save();
}

async function pushComment(id, { text, createdBy, createdAt }) {
  const task = await Task.findById(id);
  if (!task) return null;
  task.comments.push({ text, createdBy, createdAt: createdAt || new Date() });
  await task.save();
  return task.comments[task.comments.length - 1];
}

async function findCommentsPopulated(id) {
  const task = await Task.findById(id)
    .populate('comments.createdBy', 'username email role')
    .select('comments');
  if (!task) return null;
  return { comments: task.comments };
}

async function markCommentRead(id, index, userId) {
  const task = await Task.findById(id);
  if (!task) return null;
  if (index < 0 || index >= task.comments.length) return 'OOB';
  const comment = task.comments[index];
  if (!comment.readBy) comment.readBy = [];
  const already = comment.readBy.some((u) => u.toString() === userId.toString());
  if (!already) {
    comment.readBy.push(userId);
    await task.save();
  }
  return comment;
}

async function findForCountyStats(countyId) {
  return Task.find({ countyId }).populate('comments.createdBy', '_id');
}

async function findDueForReminder(now, until) {
  return Task.find({ status: { $ne: 'completed' }, deadline: { $gte: now, $lte: until } })
    .populate('countyId', 'name email');
}

async function findUpcoming({ countyId, from, to }) {
  const query = { deadline: { $gte: from, $lte: to }, status: { $ne: 'completed' } };
  if (countyId) query.countyId = countyId;
  return Task.find(query).populate('countyId', 'name code').sort({ deadline: 1 }).limit(10);
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
  markCompleted,
  markSubmitted,
  pushComment,
  findCommentsPopulated,
  markCommentRead,
  findForCountyStats,
  findDueForReminder,
  findUpcoming,
};
