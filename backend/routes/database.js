// Database explorer API — read-only analytics over the system of record. The reviewing
// agency browses all submitted filing data: current-version filings filtered by entity,
// type, period, and status, with any UCOA field pulled into view, drill-in to a filing's
// full version history, and a clean one-click CSV export.
// @access  Private (agency operators; ACCG is scoped to counties via entityTypesFor)
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { hasAdminPowers, entityTypesFor } = require('../utils/roles');
const store = require('../db/store');
const logger = require('../utils/logger');

// Only agency operators (ACCG/DCA) get the explorer; county users do not.
function agencyGate(req, res, next) {
  if (!hasAdminPowers(req.user)) return res.status(403).json({ message: 'Access denied' });
  next();
}

const parseCodes = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 30);

function buildFilters(req) {
  return {
    entityTypes: entityTypesFor(req.user), // ACCG -> ['county'], DCA -> all types
    period: req.query.period || null,
    status: req.query.status || null,
    formSearch: req.query.form || null,
    entitySearch: req.query.q || null,
    ucoaCodes: parseCodes(req.query.fields),
    limit: req.query.limit,
  };
}

// Filter metadata for the UI (available value fields + the periods/statuses present).
router.get('/meta', auth, agencyGate, async (req, res) => {
  try {
    const [fields, periods] = await Promise.all([
      store.explorer.fieldCatalog(req.query.form || 'rlgf'),
      store.explorer.distinctPeriods(),
    ]);
    res.json({ fields, periods, statuses: ['submitted', 'under_review', 'accepted', 'needs_correction'] });
  } catch (error) {
    logger.error('Explorer meta error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// The grid: current filings + any pulled UCOA value columns.
router.get('/filings', auth, agencyGate, async (req, res) => {
  try {
    const rows = await store.explorer.listFilings(buildFilters(req));
    res.json({ rows, count: rows.length });
  } catch (error) {
    logger.error('Explorer filings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Drill-in: a filing's full version history.
router.get('/filings/:filingId/versions', auth, agencyGate, async (req, res) => {
  try {
    const versions = await store.explorer.filingVersions(req.params.filingId);
    res.json({ versions });
  } catch (error) {
    logger.error('Explorer versions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// One-click clean CSV export (respects filters + selected value columns).
router.get('/export', auth, agencyGate, async (req, res) => {
  try {
    const filters = buildFilters(req);
    const rows = await store.explorer.listFilings({ ...filters, limit: 2000 });
    const codes = filters.ucoaCodes;

    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Entity', 'Type', 'Gov ID', 'Form', 'Reporting Period', 'Status', 'Version', 'Submitted', ...codes];
    const lines = [header.map(esc).join(',')];
    for (const r of rows) {
      const base = [r.entityName, r.entityType, r.govId, r.formName, r.reportingPeriod, r.status, r.version,
        r.submittedAt ? new Date(r.submittedAt).toISOString().slice(0, 10) : ''];
      const vals = codes.map((c) => (r.values[c] == null ? '' : r.values[c]));
      lines.push([...base, ...vals].map(esc).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="civisight-filings-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  } catch (error) {
    logger.error('Explorer export error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
