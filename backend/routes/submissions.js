const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const Submission = require('../models/Submission');
const Task = require('../models/Task');
const logger = require('../utils/logger');

function buildSubmissionStats(submissions) {
  const byForm = new Map();
  const byAgency = new Map();
  const statusCounts = {
    submitted: 0,
    under_review: 0,
    accepted: 0,
    needs_correction: 0
  };

  submissions.forEach((submission) => {
    const formName = submission.formName || submission.taskId?.title || 'Unknown form';
    const agency = submission.agency || submission.taskId?.submittedTo || 'Unassigned agency';
    const status = submission.status || 'submitted';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (!byForm.has(formName)) {
      byForm.set(formName, {
        formName,
        agency,
        total: 0,
        submitted: 0,
        under_review: 0,
        accepted: 0,
        needs_correction: 0,
        counties: new Set()
      });
    }
    const formStats = byForm.get(formName);
    formStats.total += 1;
    formStats[status] = (formStats[status] || 0) + 1;
    if (submission.countyId?._id || submission.countyId) {
      formStats.counties.add(String(submission.countyId?._id || submission.countyId));
    }

    if (!byAgency.has(agency)) {
      byAgency.set(agency, {
        agency,
        total: 0,
        submitted: 0,
        under_review: 0,
        accepted: 0,
        needs_correction: 0
      });
    }
    const agencyStats = byAgency.get(agency);
    agencyStats.total += 1;
    agencyStats[status] = (agencyStats[status] || 0) + 1;
  });

  return {
    total: submissions.length,
    statusCounts,
    byAgency: [...byAgency.values()].sort((a, b) => b.total - a.total || a.agency.localeCompare(b.agency)),
    byForm: [...byForm.values()]
      .map((entry) => ({ ...entry, counties: entry.counties.size }))
      .sort((a, b) => b.total - a.total || a.formName.localeCompare(b.formName))
  };
}

// @route   GET /api/submissions
// @desc    Get submitted forms visible to the current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const query = {};

    if (req.user.role !== 'admin') {
      if (!req.user.countyId) return res.json([]);
      query.countyId = req.user.countyId;
    }

    if (req.query.agency && req.query.agency !== 'all') query.agency = req.query.agency;
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.formName) query.formName = req.query.formName;
    if (req.query.countyId) query.countyId = req.query.countyId;
    if (req.query.taskId) query.taskId = req.query.taskId;

    const submissions = await Submission.find(query)
      .populate('taskId', 'title deadline status submittedTo')
      .populate('countyId', 'name code')
      .populate('submittedBy', 'username email role')
      .populate('reviewedBy', 'username email role')
      .populate('comments.createdBy', 'username email role')
      .sort({ submittedAt: -1 });

    res.json(submissions);
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/submissions/:id/comments
// @desc    Add a field-level review comment to a submitted form
// @access  Private (Admin only)
router.post('/:id/comments', auth, adminOnly, async (req, res) => {
  try {
    const fieldId = String(req.body.fieldId || '').trim();
    const text = String(req.body.text || '').trim();
    if (!fieldId || !text) return res.status(400).json({ message: 'A field and comment are required' });

    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    submission.comments.push({ fieldId, text, createdBy: req.user._id, createdAt: new Date() });
    await submission.save();

    const populated = await Submission.findById(submission._id)
      .populate('countyId', 'name code')
      .populate('submittedBy', 'username email role')
      .populate('comments.createdBy', 'username email role');
    res.status(201).json({ message: 'Comment sent to county', submission: populated });
  } catch (error) {
    logger.error('Error adding submission comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/submissions/stats
// @desc    Get state-agency submission stats
// @access  Private (Admin only)
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const query = {};
    if (req.query.agency && req.query.agency !== 'all') query.agency = req.query.agency;
    if (req.query.formName) query.formName = req.query.formName;

    const submissions = await Submission.find(query)
      .populate('taskId', 'title submittedTo')
      .populate('countyId', 'name code');

    res.json(buildSubmissionStats(submissions));
  } catch (error) {
    logger.error('Error fetching submission stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

function escapeExcel(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// @route   GET /api/submissions/:id/export
// @desc    Download a submitted online form in an Excel-compatible format
// @access  Private
router.get('/:id/export', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('taskId', 'title')
      .populate('countyId', 'name code');

    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== submission.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (submission.formType !== 'online') {
      return res.status(400).json({ message: 'Only online submissions can be exported as Excel' });
    }

    const fields = submission.metadata?.fields || {};
    const rows = Object.entries(submission.answers || {}).map(([key, value]) => {
      const field = fields[key] || {};
      return `<tr><td>${escapeExcel(field.page)}</td><td>${escapeExcel(field.cell || key)}</td><td>${escapeExcel(field.label || key)}</td><td>${escapeExcel(field.type)}</td><td>${escapeExcel(field.ucoaCode)}</td><td>${escapeExcel(value)}</td><td>${field.needsReview ? 'Yes' : 'No'}</td><td>${field.derived ? 'Yes' : 'No'}</td></tr>`;
    });
    const title = escapeExcel(submission.formName || submission.taskId?.title || 'Submitted form');
    const county = escapeExcel(submission.countyId?.name || 'Unknown county');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#17251f}h1{font-size:18px}p{font-size:12px;color:#53645b}
      table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5d1;padding:7px;text-align:left;vertical-align:top;font-size:11px}
      th{background:#dcebe4;font-weight:bold}td:nth-child(6){mso-number-format:"\\@"}
    </style></head><body><h1>${title}</h1><p>County: ${county}<br>Submitted: ${escapeExcel(new Date(submission.submittedAt).toLocaleString())}</p>
      <table><thead><tr><th>Page</th><th>Cell</th><th>Question</th><th>Type</th><th>UCOA</th><th>Submitted value</th><th>Needs review</th><th>Derived</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    </body></html>`;
    const filename = `${(submission.formName || 'submitted-form').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'submitted-form'}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (error) {
    logger.error('Error exporting submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/submissions/:id
// @desc    Get one submitted form
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('taskId', 'title deadline status submittedTo')
      .populate('countyId', 'name code')
      .populate('submittedBy', 'username email role')
      .populate('reviewedBy', 'username email role')
      .populate('comments.createdBy', 'username email role');

    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== submission.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(submission);
  } catch (error) {
    logger.error('Error fetching submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/submissions/:id/review
// @desc    Update state-agency review status
// @access  Private (Admin only)
router.put('/:id/review', auth, adminOnly, async (req, res) => {
  try {
    const allowed = ['submitted', 'under_review', 'accepted', 'needs_correction'];
    const { status, reviewNote } = req.body;
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid review status' });
    }

    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    submission.status = status;
    submission.reviewNote = typeof reviewNote === 'string' ? reviewNote.trim() : submission.reviewNote;
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    await submission.save();

    const task = await Task.findById(submission.taskId);
    if (task && status === 'needs_correction') {
      task.status = 'in_progress';
      await task.save();
    }

    const populated = await Submission.findById(submission._id)
      .populate('taskId', 'title deadline status submittedTo')
      .populate('countyId', 'name code')
      .populate('submittedBy', 'username email role')
      .populate('reviewedBy', 'username email role');

    res.json(populated);
  } catch (error) {
    logger.error('Error reviewing submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
