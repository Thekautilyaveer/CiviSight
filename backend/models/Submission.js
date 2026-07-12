const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  countyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'County',
    required: true
  },
  agency: {
    type: String,
    trim: true,
    default: ''
  },
  formName: {
    type: String,
    trim: true,
    required: true
  },
  formType: {
    type: String,
    enum: ['online', 'file'],
    required: true
  },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'accepted', 'needs_correction'],
    default: 'submitted'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  comments: [{
    fieldId: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  file: {
    originalName: String,
    fileName: String,
    filePath: String,
    uploadedAt: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNote: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

submissionSchema.index({ taskId: 1, submittedAt: -1 });
submissionSchema.index({ countyId: 1, submittedAt: -1 });
submissionSchema.index({ agency: 1, status: 1 });
submissionSchema.index({ formName: 1, agency: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
