const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { auth, adminOnly, agencyOnly } = require('../middleware/auth');
const { hasAdminPowers } = require('../utils/roles');
const store = require('../db/store');
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
    const filters = {};

    if (!hasAdminPowers(req.user)) {
      if (!req.user.countyId) return res.json([]);
      filters.countyId = req.user.countyId.toString();
    }

    if (req.query.agency && req.query.agency !== 'all') filters.agency = req.query.agency;
    if (req.query.status && req.query.status !== 'all') filters.status = req.query.status;
    if (req.query.formName) filters.formName = req.query.formName;
    // Admins only — county users are locked to their own countyId above; honoring this
    // param for them would let one county read another's submissions.
    if (req.query.countyId && hasAdminPowers(req.user)) filters.countyId = req.query.countyId;
    if (req.query.taskId) filters.taskId = req.query.taskId;

    const submissions = await store.submissions.find(filters);
    res.json(submissions);
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/submissions/:id/comments
// @desc    Add a field-level review comment to a submitted form
// @access  Private (reviewing agency only — ACCG is a mediator and cannot review)
router.post('/:id/comments', auth, agencyOnly, async (req, res) => {
  try {
    const fieldId = String(req.body.fieldId || '').trim();
    const text = String(req.body.text || '').trim();
    if (!fieldId || !text) return res.status(400).json({ message: 'A field and comment are required' });

    const submission = await store.submissions.pushComment(req.params.id, {
      fieldId, text, createdBy: req.user._id, createdAt: new Date()
    });
    if (!submission) return res.status(404).json({ message: 'Submission not found' });

    // Notify the county that a review comment arrived (the message previously lied —
    // "Comment sent to county" — while sending nothing).
    try {
      const formName = submission.formName || submission.taskId?.title || 'your filing';
      const countyId = submission.countyId?._id || submission.countyId;
      const countyUsers = await store.users.findCountyUsers(countyId);
      for (const user of countyUsers) {
        await store.notifications.create({
          userId: user._id,
          type: 'submission_comment',
          title: 'New review comment',
          message: `The reviewer left a comment on "${formName}".`,
          taskId: submission.taskId?._id || submission.taskId
        });
      }
    } catch (notifyErr) {
      logger.error('Failed to create comment notifications:', notifyErr);
    }

    res.status(201).json({ message: 'Comment sent to county', submission });
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
    const filters = {};
    if (req.query.agency && req.query.agency !== 'all') filters.agency = req.query.agency;
    if (req.query.formName) filters.formName = req.query.formName;

    const submissions = await store.submissions.findForStats(filters);
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
    const submission = await store.submissions.findByIdPopulated(req.params.id);

    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== submission.countyId._id.toString()) {
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

// @route   GET /api/submissions/:id/export-workbook
// @desc    Download an online submission as the official RLGF workbook (.xlsx): the real
//          DCA template with the submitted answers written into their exact cells.
// @access  Private (agency/ACCG, or the owning county)
router.get('/:id/export-workbook', auth, async (req, res) => {
  try {
    const submission = await store.submissions.findByIdPopulated(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== submission.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (submission.formType !== 'online') {
      return res.status(400).json({ message: 'Only online submissions can be exported as a workbook' });
    }
    const fields = submission.metadata?.fields || {};
    if (!Object.keys(fields).length) {
      return res.status(400).json({ message: 'This submission has no field metadata to map into the workbook' });
    }

    const { buildFilledWorkbook } = require('../utils/rlgfExport');
    const { buffer, written, warnings } = buildFilledWorkbook(submission.answers || {}, fields);
    if (warnings.length) logger.warn(`export-workbook ${req.params.id}: ${warnings.length} warnings`, { warnings: warnings.slice(0, 5) });

    // DCA-style filename: {govid}_{year}_RLGF_{County}.xlsx
    const findAnswer = (page, cell) => {
      const id = Object.keys(fields).find((k) => fields[k]?.page === page && fields[k]?.cell === cell);
      return id ? submission.answers?.[id] : undefined;
    };
    const govId = String(findAnswer('Page 1', 'C12') || '').replace(/[^\d]/g, '') || 'RLGF';
    const year = String(findAnswer('Page 1', 'F17') || '').replace(/[^\d]/g, '') || new Date().getFullYear();
    const county = String(submission.countyId?.name || 'County').replace(/\s*county\s*$/i, '').replace(/[^\w]+/g, '');
    const filename = `${govId}_${year}_RLGF_${county}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Cells-Written', String(written));
    res.send(buffer);
  } catch (error) {
    logger.error('Error exporting workbook:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/submissions/:id/source-file
// @desc    Download the original county-uploaded file attached to a submission (e.g. the
//          imported RLGF workbook). Ownership-checked — replaces the old world-readable
//          /api/files static path for this file.
// @access  Private (agency/ACCG, or the owning county)
router.get('/:id/source-file', auth, async (req, res) => {
  try {
    const submission = await store.submissions.findByIdPopulated(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== submission.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const rel = submission.file?.filePath;
    if (!rel) return res.status(404).json({ message: 'No source file for this submission' });

    // Resolve under uploads/ and reject anything that escapes it (path traversal).
    const uploadsRoot = path.resolve(__dirname, '../uploads');
    const abs = path.resolve(uploadsRoot, rel.replace(/^\/?api\/files\//, ''));
    if (abs !== uploadsRoot && !abs.startsWith(uploadsRoot + path.sep)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });

    const name = submission.file.originalName || path.basename(abs);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(abs);
  } catch (error) {
    logger.error('Error downloading source file:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/submissions/:id
// @desc    Get one submitted form
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const submission = await store.submissions.findByIdPopulated(req.params.id);

    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== submission.countyId._id.toString()) {
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
// @access  Private (reviewing agency only — ACCG is a mediator and cannot review)
router.put('/:id/review', auth, agencyOnly, async (req, res) => {
  try {
    const allowed = ['submitted', 'under_review', 'accepted', 'needs_correction'];
    const { status, reviewNote } = req.body;
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid review status' });
    }

    const raw = await store.submissions.getRaw(req.params.id);
    if (!raw) return res.status(404).json({ message: 'Submission not found' });

    // Reflect the review outcome onto the county's task:
    //   accepted        -> completed (compliance satisfied)
    //   needs_correction -> in_progress (bounced back for the county to fix)
    //   under_review/submitted -> submitted (still with the agency)
    if (status === 'accepted') {
      await store.tasks.markCompleted(raw.taskId);
    } else if (status === 'needs_correction') {
      await store.tasks.updateFields(raw.taskId, { status: 'in_progress' });
    } else {
      await store.tasks.updateFields(raw.taskId, { status: 'submitted' });
    }

    const note = typeof reviewNote === 'string' ? reviewNote.trim() : raw.reviewNote;
    const populated = await store.submissions.updateReview(req.params.id, {
      status,
      reviewNote: note,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    });

    // Notify the county of the review outcome (closes the previously-silent return path).
    try {
      const MESSAGES = {
        accepted: (f) => ({ title: 'Filing accepted', message: `Your filing "${f}" was accepted.` }),
        needs_correction: (f) => ({ title: 'Filing returned for correction', message: `Your filing "${f}" was returned for correction${note ? `: ${note}` : '.'}` }),
        under_review: (f) => ({ title: 'Filing under review', message: `Your filing "${f}" is now under review.` }),
        submitted: (f) => ({ title: 'Filing received', message: `Your filing "${f}" was received.` })
      };
      const formName = populated.formName || populated.taskId?.title || 'your filing';
      const { title, message } = (MESSAGES[status] || MESSAGES.submitted)(formName);
      const countyId = populated.countyId?._id || populated.countyId || raw.countyId;
      const countyUsers = await store.users.findCountyUsers(countyId);
      for (const user of countyUsers) {
        await store.notifications.create({
          userId: user._id,
          type: 'submission_reviewed',
          title,
          message,
          taskId: raw.taskId
        });
      }
    } catch (notifyErr) {
      logger.error('Failed to create review notifications:', notifyErr);
    }

    res.json(populated);
  } catch (error) {
    logger.error('Error reviewing submission:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
