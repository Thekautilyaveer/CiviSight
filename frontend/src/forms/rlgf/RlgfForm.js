import React, { useMemo, useState } from 'react';
import schema from './rlgf_schema.json';
import jurisdictions from './jurisdiction_table.json';
import ucoa from './ucoa_codes.json';
import { makeEvaluator } from './formula.js';
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
  const t = p.title || p.page;
  const m = /Part\s+([IVXLC]+)/i.exec(t);
  return m ? `Part ${m[1].toUpperCase()}` : p.page;
}
function subTitle(p) {
  const t = p.title || p.page;
  return t.replace(/^Part\s+[IVXLC]+\s*[–-]*\s*/i, '').replace(/--/g, '—').trim();
}

function FieldRow({ field, value, derivedValue, isUnhandled, onChange, index }) {
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
        <select value={value ?? ''} onChange={(e) => onChange(id, e.target.value)}>
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
        <input type="number" min="0" step="any" inputMode="decimal"
          value={value ?? ''} onChange={(e) => onChange(id, e.target.value)} placeholder="0" />
      </div>
    );
  } else if (type === 'integer') {
    widget = (
      <input className="num" type="number" min="0" step="1" inputMode="numeric"
        value={value ?? ''} onChange={(e) => onChange(id, e.target.value)} placeholder="0" />
    );
  } else {
    widget = (
      <input className="txt" type="text" value={value ?? ''}
        onChange={(e) => onChange(id, e.target.value)} placeholder="—" />
    );
  }

  return (
    <div
      className={'row' + (is_derived ? ' is-derived' : '') + (needs_review ? ' is-flagged' : '')}
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
      <div className="row-widget">{widget}</div>
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

export default function RlgfForm({ subtitle = 'Report of Local Government Finance', onSubmit }) {
  const [values, setValues] = useState({});
  const [pageIdx, setPageIdx] = useState(0);
  const [query, setQuery] = useState('');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const onChange = (id, v) => setValues((prev) => ({ ...prev, [id]: v }));

  const { evaluators, derivedById, unhandledCount } = useMemo(() => {
    const evs = schema.pages.map((p) => makeEvaluator(p, values));
    const derived = {};
    let unhandled = 0;
    schema.pages.forEach((p, i) => {
      p.fields.forEach((f) => { if (f.is_derived) derived[f.id] = evs[i].valueForField(f); });
      unhandled += evs[i].unhandledIds.size;
    });
    return { evaluators: evs, derivedById: derived, unhandledCount: unhandled };
  }, [values]);

  const qa = useMemo(() => {
    const byType = { dollar: 0, integer: 0, text: 0, dropdown: 0 };
    let total = 0, derived = 0, needsReview = 0, unresolved = 0;
    for (const p of schema.pages) {
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

  const page = schema.pages[pageIdx];
  const q = query.trim().toLowerCase();
  const visibleFields = page.fields.filter((f) => {
    if (onlyFlagged && !f.needs_review) return false;
    if (!q) return true;
    return (
      (f.label || '').toLowerCase().includes(q) ||
      f.cell.toLowerCase().includes(q) ||
      (f.ucoa_code || '').toLowerCase().includes(q)
    );
  });

  const handleSubmit = () => {
    const payload = { form: schema.form, version: schema.version, answers: {} };
    schema.pages.forEach((p, i) => {
      p.fields.forEach((f) => {
        if (f.is_derived) payload.answers[f.id] = evaluators[i].valueForField(f);
        else if (values[f.id] !== undefined && values[f.id] !== '') payload.answers[f.id] = values[f.id];
      });
    });
    // eslint-disable-next-line no-console
    console.log('RLGF submit payload:', payload);
    if (onSubmit) onSubmit(payload);
    setSubmitted(Object.keys(payload.answers).length);
  };

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
            {schema.pages.map((p, i) => (
              <button key={p.page} className={'nav-item' + (i === pageIdx ? ' active' : '')}
                onClick={() => setPageIdx(i)}>
                <span className="nav-part">{shortTitle(p)}</span>
                <span className="nav-count">{p.fields.length}</span>
              </button>
            ))}
          </nav>

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
              <span className="ph-progress">Page {pageIdx + 1} of {schema.pages.length}</span>
            </div>
            <h1 className="ph-title">{subTitle(page) || page.page}</h1>

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

          <section className="sheet" key={pageIdx}>
            {visibleFields.length === 0 ? (
              <div className="empty">No fields match your filter.</div>
            ) : (
              visibleFields.map((f, idx) => (
                <FieldRow key={f.id} field={f} value={values[f.id]}
                  derivedValue={derivedById[f.id]}
                  isUnhandled={evaluators[pageIdx].unhandledIds.has(f.id)}
                  onChange={onChange} index={idx} />
              ))
            )}
          </section>

          <div className="pager">
            <button disabled={pageIdx === 0} onClick={() => setPageIdx((i) => Math.max(0, i - 1))}>← Previous</button>
            <span>{shortTitle(page)}</span>
            <button disabled={pageIdx === schema.pages.length - 1}
              onClick={() => setPageIdx((i) => Math.min(schema.pages.length - 1, i + 1))}>Next →</button>
          </div>

          <footer className="submit-bar">
            {submitted !== null ? (
              <div className="submit-ok">
                ✓ Submitted — payload with <b>{submitted}</b> answers logged to console.
                <button className="link" onClick={() => setSubmitted(null)}>dismiss</button>
              </div>
            ) : (
              <>
                <div className="sb-meta">
                  <span>This page: <b>{page.fields.filter((f) => !f.is_derived && f.type !== 'dropdown').length}</b> inputs</span>
                  <span><b>{page.fields.filter((f) => f.is_derived).length}</b> computed</span>
                  <span><b>{page.fields.filter((f) => f.needs_review).length}</b> flagged</span>
                </div>
                <button className="submit-btn" onClick={handleSubmit}>Submit form</button>
              </>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}
