import React, { useEffect, useMemo, useRef, useState } from 'react';
import schema from './rlgf_schema.json';
import jurisdictions from './jurisdiction_table.json';
import ucoa from './ucoa_codes.json';
import { makeEvaluator } from './formula.js';
import api from '../../utils/api';
import './rlgf-form.css';

// Schema-driven RLGF form renderer, embedded inside CiviSight. Identical logic to
// the standalone render-check: state keyed by field id, per-page cell->value
// resolver for formulas, safe evaluator, type->widget mapping, live derived totals.
// All markup lives under `.rlgf-root` so its styles never touch the rest of the app.

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const fmtMoney = (n) => (n === null || n === undefined ? '—' : money.format(n));
const EMPTY_VALUES = {};

const presentationOverrides = {
  'Page 1:F12': { hidden: true },
  'Page 1:F16': { hidden: true },
  'Page 1:F18': { hidden: true },
  'Page 1:D15': {
    label: 'Fiscal year-end month changed from the previous report?',
  },
  'Page 1:F15': {
    label: 'Fiscal year-end month',
    options_source: 'inline:January 31,February 28,March 31,April 30,May 31,June 30,July 31,August 31,September 30,October 31,November 30,December 31',
  },
  'Page 1:D17': {
    label: 'Fiscal period length',
  },
  'Page 1:F17': {
    label: 'Fiscal year reported',
    options_source: 'inline:2020,2021,2022,2023,2024,2025',
  },
};

function displayField(field) {
  const override = presentationOverrides[`${field.page}:${field.cell}`];
  if (!override) return field;
  return { ...field, ...override };
}

function resolveOptions(field) {
  const src = field.options_source || '';
  if (src === 'jurisdiction_table') {
    return {
      resolved: true,
      options: jurisdictions.entries.map((e) => ({
        value: e.gov_id,
        label: `${e.gov_id} — ${e.name}`,
      })),
    };
  }
  if (src.startsWith('inline:')) {
    return {
      resolved: true,
      options: src
        .slice('inline:'.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => ({ value: s, label: s })),
    };
  }
  return { resolved: false, options: [] };
}

function shortTitle(p) {
  if (p.nav_label) return p.nav_label;
  const t = p.title || p.page;
  const m = /Part\s+([IVXLC]+)/i.exec(t);
  return m ? `Part ${m[1].toUpperCase()}` : p.page;
}
function subTitle(p) {
  const t = p.title || p.page;
  return t.replace(/^Part\s+[IVXLC]+\s*(\([^)]*\))?\s*[–—-]*\s*/i, '').replace(/--/g, '—').trim();
}

// One navigable section per RLGF reporting Part. The schema itself is organized by
// Part (General Info, Parts I–XV, Attachments), mirroring the official workbook.
// Each page keeps its original worksheet name in `page.page`, and every field keeps
// its original worksheet cell ref — so same-sheet formulas resolve within a page and
// cross-sheet formulas ('Page 3'!C28) resolve through the external resolver below.
// NOTE: continuation parts (V cont., XI cont.) are intentionally NOT merged into
// their parents: the two worksheets reuse the same cell refs (e.g. D11 exists on
// both Page 3 and Page 4), so merging them would collide cell->field resolution.
const pages = schema.pages;

// Cross-sheet formula support: index every field by (worksheet, cell) so an
// evaluator can resolve refs like 'Page 1'!F80 that live on another page.
const fieldIndex = {};
pages.forEach((p, pi) => {
  p.fields.forEach((f) => {
    (fieldIndex[f.page] = fieldIndex[f.page] || {})[f.cell] = { field: f, pi };
  });
});

function FieldRow({ field, value, derivedValue, isUnhandled, isInvalid, errorText, onChange, index, readOnly = false, comments = [], commentingField, commentDraft = '', onStartComment, onCommentDraftChange, onAddComment }) {
  const { id, cell, label, type, is_derived, needs_review, ucoa_code } = field;

  let widget;
  if (is_derived) {
    widget = (
      <div className="derived" title={field.formula}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
        </svg>
        {isUnhandled ? (
          <span className="warn-tag">⚠ unhandled formula</span>
        ) : (
          <span className="derived-val">{type === 'dollar' ? fmtMoney(derivedValue) : derivedValue ?? '—'}</span>
        )}
      </div>
    );
  } else if (type === 'dropdown') {
    const { resolved, options } = resolveOptions(field);
    widget = (
      <div className={'select-wrap' + (resolved ? '' : ' unresolved')}>
        <select value={value ?? ''} onChange={(e) => onChange(id, e.target.value)} disabled={readOnly}>
          <option value="">{resolved ? 'Select…' : '⚠ unresolved source'}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  } else if (type === 'dollar') {
    widget = (
      <div className="money-wrap">
        <span className="adorn">$</span>
        <input type="text" inputMode="decimal" autoComplete="off"
          value={value ?? ''} onChange={(e) => onChange(id, e.target.value)} placeholder="0" readOnly={readOnly} />
      </div>
    );
  } else if (type === 'integer') {
    widget = (
      <input className="num" type="text" inputMode="numeric" autoComplete="off"
        value={value ?? ''} onChange={(e) => onChange(id, e.target.value)} placeholder="0" readOnly={readOnly} />
    );
  } else {
    widget = (
      <input className="txt" type="text" value={value ?? ''}
        onChange={(e) => onChange(id, e.target.value)} placeholder="—" readOnly={readOnly} />
    );
  }

  return (
    <div
      className={
        'row' +
        (is_derived ? ' is-derived' : '') +
        (needs_review ? ' is-flagged' : '') +
        (isInvalid ? ' is-invalid' : '')
      }
      style={{ animationDelay: `${Math.min(index * 12, 400)}ms` }}
    >
      <div className="row-main">
        <div className="label">
          {label || <em className="nolabel">(no label)</em>}
        </div>
        <div className="chips">
          <span className="chip chip-cell">{cell}</span>
          {ucoa_code && <span className="chip chip-ucoa">{ucoa_code}</span>}
          <span className="chip chip-type">{is_derived ? 'derived' : type}</span>
          {needs_review && <span className="chip chip-review">needs review</span>}
        </div>
      </div>
      <div className="row-widget">
        <div className="widget-wrap">
          {widget}
          {isInvalid && errorText && <div className="field-error">{errorText}</div>}
          {comments.length > 0 && (
            <div className="field-comments">
              {comments.map((comment, commentIndex) => (
                <div className="field-comment" key={`${comment.createdAt || 'comment'}-${commentIndex}`}>
                  <b>{comment.createdBy?.username || 'Reviewer'}</b>
                  <span>{comment.text}</span>
                </div>
              ))}
            </div>
          )}
          {onAddComment && (
            commentingField === id ? (
              <div className="field-comment-compose">
                <textarea value={commentDraft} onChange={(e) => onCommentDraftChange(id, e.target.value)} placeholder="Comment on this field..." rows="2" />
                <div className="field-comment-actions">
                  <button type="button" onClick={() => onAddComment(id)} disabled={!commentDraft.trim()}>Send to county</button>
                  <button type="button" onClick={() => onStartComment(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="field-comment-trigger" onClick={() => onStartComment(id)}>Add comment</button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={'stat' + (tone ? ' stat-' + tone : '')}>
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function RlgfForm({ subtitle = 'Report of Local Government Finance', onSubmit, initialValues = EMPTY_VALUES, readOnly = false, fieldComments = {}, commentingField = null, commentDraft = '', onStartComment, onCommentDraftChange, onAddComment }) {
  const [values, setValues] = useState(initialValues);
  const [pageIdx, setPageIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const questionsRef = useRef(null);

  // Excel import: upload a filled RLGF workbook and prefill the form from it.
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null); // { imported, warnings[] }
  const [pendingImport, setPendingImport] = useState(null); // parse result awaiting overwrite choice
  const [sourceFile, setSourceFile] = useState(null); // saved workbook ref, attached on submit

  // Normalize a raw workbook cell value for a schema field. Returns undefined to skip,
  // { warn } to record a warning, or the normalized value.
  const normalizeImported = (field, raw) => {
    if (raw === undefined || raw === null) return undefined;
    const disp = displayField(field);
    if (disp.hidden) return undefined;
    if (field.type === 'dollar' || field.type === 'integer') {
      if (typeof raw === 'number') return raw;
      let s = String(raw).trim().replace(/[$,\s]/g, '');
      let neg = false;
      const m = /^\((.*)\)$/.exec(s);
      if (m) { neg = true; s = m[1]; }
      if (s === '' || s === '-') return undefined;
      const n = Number(s);
      if (Number.isNaN(n)) return { warn: `"${String(raw).slice(0, 24)}" is not a number` };
      return neg ? -n : n;
    }
    if (field.type === 'dropdown') {
      const { resolved, options } = resolveOptions(disp);
      const sv = String(raw).trim();
      if (!resolved) return sv;
      const svl = sv.toLowerCase();
      const hit = options.find(
        (o) =>
          String(o.value).toLowerCase() === svl ||
          String(o.label).toLowerCase() === svl ||
          String(o.label).toLowerCase().split('—').pop().trim() === svl
      );
      if (hit) return String(hit.value);
      return { warn: `"${sv.slice(0, 30)}" is not one of the options` };
    }
    return String(raw);
  };

  const applyImport = (data, mode) => {
    const next = { ...values };
    let imported = 0;
    const warnings = [];
    for (const p of pages) {
      for (const f of p.fields) {
        if (f.is_derived) continue;
        const raw = data.cells?.[f.page]?.[f.cell];
        if (raw === undefined) continue;
        const norm = normalizeImported(f, raw);
        if (norm === undefined) continue;
        if (norm && typeof norm === 'object' && norm.warn) {
          warnings.push(`${f.page}!${f.cell} — ${(displayField(f).label || '').slice(0, 40)}: ${norm.warn}`);
          continue;
        }
        const cur = next[f.id];
        if (mode === 'fill-empty' && cur !== undefined && cur !== null && String(cur).trim() !== '') continue;
        next[f.id] = norm;
        imported++;
      }
    }
    setValues(next);
    setSourceFile(data.sourceFile || null);
    setImportSummary({ imported, warnings });
    setPendingImport(null);
    setFieldErrors({});
  };

  const startImport = async (file) => {
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const fd = new FormData();
      fd.append('workbook', file);
      const res = await api.post('/rlgf/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const hasValues = Object.values(values).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
      if (hasValues) setPendingImport(res.data);
      else applyImport(res.data, 'overwrite');
    } catch (err) {
      setImportSummary({ imported: 0, warnings: [err?.response?.data?.message || 'Import failed. Make sure the file is the official RLGF workbook (.xls or .xlsx).'] });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    setValues(initialValues || {});
    setPageIdx(0);
  }, [initialValues]);

  const onChange = (id, v) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setFieldErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const { evaluators, derivedById, unhandledCount } = useMemo(() => {
    // resolveExternal handles cross-sheet refs ('Page 3'!C28): non-derived fields read
    // straight from values; derived ones recurse into their own page's evaluator.
    const registry = { evs: [] };
    const resolveExternal = (pageName, cell) => {
      const entry = (fieldIndex[pageName] || {})[cell];
      if (!entry) return 0; // blank / label cell on that sheet
      const { field, pi } = entry;
      if (!field.is_derived) {
        const v = values[field.id];
        const n = Number(v);
        return v === null || v === undefined || v === '' || Number.isNaN(n) ? 0 : n;
      }
      return registry.evs[pi] ? registry.evs[pi].valueForField(field) : 0;
    };
    const evs = pages.map((p) => makeEvaluator(p, values, resolveExternal));
    registry.evs = evs;
    const derived = {};
    let unhandled = 0;
    pages.forEach((p, i) => {
      p.fields.forEach((f) => { if (f.is_derived) derived[f.id] = evs[i].valueForField(f); });
      unhandled += evs[i].unhandledIds.size;
    });
    return { evaluators: evs, derivedById: derived, unhandledCount: unhandled };
  }, [values]);

  const qa = useMemo(() => {
    const byType = { dollar: 0, integer: 0, text: 0, dropdown: 0 };
    let total = 0, derived = 0, needsReview = 0, unresolved = 0;
    for (const p of pages) {
      for (const f of p.fields) {
        total++;
        byType[f.type] = (byType[f.type] || 0) + 1;
        if (f.is_derived) derived++;
        if (f.needs_review) needsReview++;
        if (f.type === 'dropdown' && !resolveOptions(f).resolved) unresolved++;
      }
    }
    return { total, byType, derived, needsReview, unresolved, inputs: total - derived - byType.dropdown };
  }, []);

  const page = pages[pageIdx];
  useEffect(() => {
    questionsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageIdx]);

  const q = query.trim().toLowerCase();
  const visibleFields = page.fields.map(displayField).filter((f) => {
    if (f.hidden) return false;
    if (onlyFlagged && !f.needs_review) return false;
    if (!q) return true;
    return (
      (f.label || '').toLowerCase().includes(q) ||
      f.cell.toLowerCase().includes(q) ||
      (f.ucoa_code || '').toLowerCase().includes(q)
    );
  });

  const validateForm = () => {
    const errors = {};
    pages.forEach((p) => {
      p.fields.forEach((f) => {
        if (f.is_derived) return;
        const raw = values[f.id];
        const text = raw === null || raw === undefined ? '' : String(raw).trim();
        const validation = f.validation || {};
        if (validation.required && !text) {
          errors[f.id] = 'This field is required.';
          return;
        }
        if ((f.type === 'dollar' || f.type === 'integer') && text) {
          const parsed = Number(text);
          const integerOk = f.type !== 'integer' || Number.isInteger(parsed);
          if (Number.isNaN(parsed) || !Number.isFinite(parsed) || !integerOk) {
            errors[f.id] = f.type === 'integer'
              ? 'Enter a whole number.'
              : 'Enter a valid number.';
          }
        }
      });
    });
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    setFieldErrors(errors);
    setSubmitError('');
    if (Object.keys(errors).length > 0) {
      const firstId = Object.keys(errors)[0];
      const firstPage = pages.findIndex((p) => p.fields.some((f) => f.id === firstId));
      if (firstPage >= 0) setPageIdx(firstPage);
      return;
    }

    const payload = { form: schema.form, version: schema.version, answers: {}, metadata: { fields: {} } };
    if (sourceFile) payload.sourceFile = sourceFile; // original imported workbook (audit)
    pages.forEach((p, i) => {
      p.fields.forEach((f) => {
        const display = displayField(f);
        const hasValue = f.is_derived || (values[f.id] !== undefined && values[f.id] !== '');
        if (!hasValue) return;

        if (f.is_derived) payload.answers[f.id] = evaluators[i].valueForField(f);
        else payload.answers[f.id] = values[f.id];

        payload.metadata.fields[f.id] = {
          label: display.label || '',
          page: f.page || p.page,
          cell: f.cell,
          type: f.type,
          ucoaCode: f.ucoa_code || '',
          needsReview: Boolean(f.needs_review),
          derived: Boolean(f.is_derived)
        };
      });
    });
    try {
      setSubmitting(true);
      const result = onSubmit ? await onSubmit(payload) : null;
      setSubmitted({
        answers: Object.keys(payload.answers).length,
        flags: pages.flatMap((p) => p.fields).filter((f) => f.needs_review).length,
        pages: pages.length,
        timestamp: result?.submittedAt ? new Date(result.submittedAt) : new Date(),
        agency: result?.agency || 'the receiving agency',
        confirmation: result?._id || result?.id || '',
      });
    } catch (error) {
      setSubmitError(error?.response?.data?.message || error?.message || 'Could not submit the form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const filledCount = Object.values(values).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;

  return (
    <div className="rlgf-root">
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">GA</div>
            <div>
              <div className="brand-title">{schema.form}</div>
              <div className="brand-sub">{subtitle}</div>
            </div>
          </div>

          <nav className="nav">
            {pages.map((p, i) => (
              <button type="button" key={`${p.page}-${i}`} className={'nav-item' + (i === pageIdx ? ' active' : '')}
                onClick={() => setPageIdx(i)}>
                <span className="nav-part">{shortTitle(p)}</span>
                <span className="nav-count">{p.fields.length}</span>
              </button>
            ))}
          </nav>

          {!readOnly && (
            <div className="panel">
              <div className="panel-head">Import</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => startImport(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {importing ? 'Reading workbook…' : 'Import from Excel'}
              </button>
              <p className="mt-2 text-[11px] leading-snug text-gray-400">
                Upload your filled RLGF workbook (.xls / .xlsx) to prefill this form. You can review everything before submitting.
              </p>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">Form summary</div>
            <div className="stats">
              <Stat label="fields" value={qa.total} />
              <Stat label="inputs" value={qa.inputs} />
              <Stat label="derived" value={qa.derived} />
              <Stat label="dropdowns" value={qa.byType.dropdown} />
              <Stat label="needs review" value={qa.needsReview} tone="gold" />
              <Stat label="unresolved" value={qa.unresolved} tone={qa.unresolved ? 'bad' : 'ok'} />
            </div>
            <div className="panel-foot">
              <span className={unhandledCount ? 'flag bad' : 'flag ok'}>
                {unhandledCount} unhandled formula{unhandledCount === 1 ? '' : 's'}
              </span>
              <span className="muted">{ucoa.codes.length} UCOA · {jurisdictions.entries.length} govts</span>
            </div>
          </div>
        </aside>

        <main className="main">
          <header className="page-head">
            <div className="ph-eyebrow">
              <span>{shortTitle(page)}</span>
              <span className="ph-progress">Page {pageIdx + 1} of {pages.length}</span>
            </div>
            <h1 className="ph-title">{subTitle(page) || page.page}</h1>

            {importSummary && (
              <div className={`mt-3 rounded-lg border px-4 py-3 text-sm ${importSummary.imported > 0 ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">
                    {importSummary.imported > 0
                      ? `Imported ${importSummary.imported} field${importSummary.imported === 1 ? '' : 's'} from the workbook.`
                      : 'Nothing was imported.'}
                    {importSummary.warnings.length > 0 && ` ${importSummary.warnings.length} warning${importSummary.warnings.length === 1 ? '' : 's'}.`}
                  </span>
                  <button type="button" onClick={() => setImportSummary(null)} className="shrink-0 text-xs font-semibold opacity-60 hover:opacity-100">Dismiss</button>
                </div>
                {importSummary.warnings.length > 0 && (
                  <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-xs opacity-90">
                    {importSummary.warnings.slice(0, 6).map((w, i) => (<li key={i}>{w}</li>))}
                    {importSummary.warnings.length > 6 && <li>…and {importSummary.warnings.length - 6} more</li>}
                  </ul>
                )}
              </div>
            )}

            <div className="toolbar">
              <div className="search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search label, cell, or UCOA code…" />
                {query && <button className="clear" onClick={() => setQuery('')}>×</button>}
              </div>
              <label className={'toggle' + (onlyFlagged ? ' on' : '')}>
                <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                Only flagged
              </label>
              <div className="showing">{visibleFields.length} shown</div>
            </div>
          </header>

          <div className="questions-scroll" ref={questionsRef}>
            <section className="sheet" key={pageIdx}>
              {visibleFields.length === 0 ? (
                <div className="empty">No fields match your filter.</div>
              ) : (
                visibleFields.map((f, idx) => (
                  <FieldRow key={f.id} field={f} value={values[f.id]}
                    derivedValue={derivedById[f.id]}
                    isUnhandled={evaluators[pageIdx].unhandledIds.has(f.id)}
                    isInvalid={Boolean(fieldErrors[f.id])}
                    errorText={fieldErrors[f.id]}
                    onChange={onChange} index={idx} readOnly={readOnly}
                    comments={fieldComments[f.id] || []}
                    commentingField={commentingField}
                    commentDraft={commentDraft}
                    onStartComment={onStartComment}
                    onCommentDraftChange={onCommentDraftChange}
                    onAddComment={onAddComment}
                  />
                ))
              )}
            </section>

            <div className="pager">
              <button type="button" disabled={pageIdx === 0} onClick={() => setPageIdx((i) => Math.max(0, i - 1))}>← Previous</button>
              <span>{shortTitle(page)}</span>
              <button type="button" disabled={pageIdx === pages.length - 1}
                onClick={() => setPageIdx((i) => Math.min(pages.length - 1, i + 1))}>Next →</button>
            </div>
          </div>

          {!readOnly && <footer className="submit-bar">
            <div className="sb-meta">
              <span>This page: <b>{page.fields.filter((f) => !f.is_derived && f.type !== 'dropdown').length}</b> inputs</span>
              <span><b>{page.fields.filter((f) => f.is_derived).length}</b> computed</span>
              <span><b>{page.fields.filter((f) => f.needs_review).length}</b> flagged</span>
            </div>
            {submitError && <div className="submit-error">{submitError}</div>}
            <button type="button" className="submit-btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit form'}
            </button>
          </footer>}
        </main>
      </div>
      {submitted !== null && (
        <div className="submit-success-overlay" role="presentation">
          <div
            className="submit-success-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rlgf-submit-title"
          >
            <div className="submit-success-icon" aria-hidden>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 7L10 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="submit-success-kicker">Submission complete</div>
            <h2 id="rlgf-submit-title">RLGF form submitted</h2>
            <p>
              {submitted.answers} answers were sent to {submitted.agency}. The submitted form is now available for state-agency review.
            </p>
            <div className="submit-success-stats">
              <div><b>{filledCount}</b><span>filled</span></div>
              <div><b>{submitted.flags}</b><span>review</span></div>
              <div><b>{submitted.pages}</b><span>pages</span></div>
            </div>
            <div className="submit-success-actions">
              <span className="submit-success-time">
                Submitted {submitted.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
              <button className="submit-success-close" onClick={() => setSubmitted(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Import conflict: the form already has values — overwrite or fill blanks only? */}
      {pendingImport && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Import from workbook</h3>
            <p className="text-sm text-gray-600 mb-6">
              This form already has some values. How should the workbook data be applied?
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => applyImport(pendingImport, 'overwrite')}
                className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors text-left"
              >
                Overwrite with workbook values
                <span className="block text-xs font-normal opacity-80">Workbook wins wherever it has data</span>
              </button>
              <button
                type="button"
                onClick={() => applyImport(pendingImport, 'fill-empty')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 text-sm font-semibold transition-colors text-left"
              >
                Fill empty fields only
                <span className="block text-xs font-normal text-gray-500">Keep everything you have typed</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="w-full px-4 py-2 rounded-lg text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
