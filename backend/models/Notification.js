const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deadline', 'reminder', 'task_assigned', 'task_completed',
      'submission_received', 'submission_reviewed', 'submission_comment'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Database indexes for performance optimization
// Single field indexes
notificationSchema.index({ userId: 1 }); // For getting user notifications
notificationSchema.index({ taskId: 1 }); // For task-related notifications
notificationSchema.index({ read: 1 }); // For filtering unread notifications
notificationSchema.index({ createdAt: -1 }); // For sorting by date (descending)

// Compound indexes for common query patterns
notificationSchema.index({ userId: 1, read: 1 }); // User's unread notifications
notificationSchema.index({ userId: 1, createdAt: -1 }); // User notifications sorted by date

module.exports = mongoose.model('Notification', notificationSchema);

