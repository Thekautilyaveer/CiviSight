const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  countyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'County',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  deadline: {
    type: Date,
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reminders: [{
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  formFile: {
    originalName: String,
    fileName: String,
    filePath: String,
    uploadedAt: Date
  },
  filledFormFile: {
    originalName: String,
    fileName: String,
    filePath: String,
    uploadedAt: Date,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  comments: [{
    text: {
      type: String,
      required: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    readBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Database indexes for performance optimization
// Single field indexes
taskSchema.index({ countyId: 1 }); // For filtering by county
taskSchema.index({ status: 1 }); // For filtering by status
taskSchema.index({ priority: 1 }); // For filtering by priority
taskSchema.index({ deadline: 1 }); // For date range queries and sorting
taskSchema.index({ createdAt: 1 }); // For date range queries and sorting
taskSchema.index({ assignedBy: 1 }); // For finding tasks by assigner

// Compound indexes for common query patterns
taskSchema.index({ countyId: 1, status: 1 }); // Most common: filter by county + status
taskSchema.index({ countyId: 1, deadline: 1 }); // County tasks sorted by deadline
taskSchema.index({ status: 1, deadline: 1 }); // For reminder scheduler queries
taskSchema.index({ countyId: 1, priority: 1 }); // County + priority filtering
taskSchema.index({ countyId: 1, createdAt: 1 }); // County + assigned date filtering

// Text search index for title and description searches
taskSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Task', taskSchema);

