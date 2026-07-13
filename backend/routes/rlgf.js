const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

// Parse an uploaded RLGF workbook (.xls or .xlsx) and return its cell values so the
// frontend (which owns the schema/cell mapping) can prefill the online form. The
// original file is saved so it can be attached to the eventual submission for audit.

const IMPORT_DIR = path.join(__dirname, '../uploads/rlgf-imports');
fs.mkdirSync(IMPORT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMPORT_DIR),
  filename: (req, file, cb) => {
    // Prefix with the uploader's id so submit-time ownership can be verified.
    const safe = file.originalname.replace(/[^\w.-]+/g, '_').slice(0, 80);
    cb(null, `${req.user._id}_${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xls' || ext === '.xlsx') return cb(null, true);
    cb(new Error('Only .xls or .xlsx workbooks are accepted'));
  },
}).single('workbook');

// The RLGF workbook fingerprint: sheet names + Part header anchors. If these don't
// match, the file is a different workbook (or a shifted version) — refuse rather than
// import misaligned data.
const REQUIRED_SHEETS = ['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5', 'Page 6'];
const ANCHORS = [
  ['Page 1', 'A21', /part\s+i\b/i],
  ['Page 2', 'A3', /part\s+ii\b/i],
  ['Page 2', 'A19', /part\s+iii\b/i],
  ['Page 2', 'A57', /part\s+iv\b/i],
  ['Page 3', 'A3', /part\s+v\b/i],
  ['Page 4', 'A26', /part\s+vi\b/i],
  ['Page 5', 'A30', /part\s+xi\b/i],
  ['Page 6', 'A53', /part\s+xv\b/i],
];

function validateWorkbook(wb) {
  const missing = REQUIRED_SHEETS.filter((s) => !wb.SheetNames.includes(s));
  if (missing.length) return `Missing worksheet(s): ${missing.join(', ')}`;
  for (const [sheet, cell, re] of ANCHORS) {
    const c = wb.Sheets[sheet][cell];
    const v = c && c.v != null ? String(c.v) : '';
    if (!re.test(v)) return `Unexpected layout: ${sheet}!${cell} should be a "${re.source.replace(/\\s\+|\\b/g, ' ').trim()}" header but reads "${v.slice(0, 60) || '(blank)'}"`;
  }
  return null;
}

// @route   POST /api/rlgf/parse
// @desc    Parse a filled RLGF workbook; returns per-sheet cell values + the saved file
//          reference (for attaching to the submission on submit).
// @access  Private
router.post('/parse', auth, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ message: 'No workbook uploaded' });

    const cleanup = () => fs.promises.unlink(req.file.path).catch(() => {});
    try {
      const wb = XLSX.readFile(req.file.path);
      const problem = validateWorkbook(wb);
      if (problem) {
        await cleanup();
        return res.status(400).json({ message: `This doesn't look like the current RLGF workbook. ${problem}` });
      }

      // Values only (formula cells contribute their cached results); skip the LOAD1
      // reference sheet. Keyed sheet -> cellRef -> value.
      const cells = {};
      for (const sheetName of [...REQUIRED_SHEETS, 'Attachment(s)']) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const out = {};
        for (const ref of Object.keys(ws)) {
          if (ref[0] === '!') continue;
          const v = ws[ref].v;
          if (v === undefined || v === null || v === '') continue;
          out[ref] = v;
        }
        // "Attachment(s)" -> "Page 7" to match the schema's page naming.
        cells[sheetName === 'Attachment(s)' ? 'Page 7' : sheetName] = out;
      }

      res.json({
        cells,
        sourceFile: {
          originalName: req.file.originalname,
          fileName: req.file.filename,
          filePath: `rlgf-imports/${req.file.filename}`,
          uploadedAt: new Date(),
        },
      });
    } catch (e) {
      await cleanup();
      logger.error('RLGF parse failed:', e);
      res.status(400).json({ message: 'Could not read that workbook. Make sure it is a valid .xls/.xlsx RLGF file.' });
    }
  });
});

module.exports = router;
