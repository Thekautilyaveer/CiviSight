// Mongoose-backed Notification repo (DATA_DRIVER=mongo). Mirrors db/repos/notifications.js.
const Notification = require('../../models/Notification');

async function create({ userId, type, title, message, taskId = null }) {
  const n = new Notification({ userId, type, title, message, taskId: taskId || null });
  await n.save();
  return n;
}

async function findForUser(userId) {
  return Notification.find({ userId })
    .populate('taskId', 'title deadline status')
    .sort({ createdAt: -1 })
    .limit(50);
}

async function findById(id) {
  return Notification.findById(id);
}

async function markRead(id) {
  const n = await Notification.findById(id);
  if (!n) return null;
  n.read = true;
  await n.save();
  return n;
}

async function markAllRead(userId) {
  await Notification.updateMany({ userId, read: false }, { read: true });
}

async function deleteByTaskId(taskId) {
  await Notification.deleteMany({ taskId });
}

module.exports = { create, findForUser, findById, markRead, markAllRead, deleteByTaskId };
