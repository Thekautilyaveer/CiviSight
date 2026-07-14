import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import StatusPill from '../components/StatusPill';
import { useDcaUI } from '../DcaUIContext';

// The Database explorer: browse all submitted filing data as a grid — filter by entity,
// type, period, status; pull any UCOA field into a column; drill into version history;
// export clean. Runs on the versioned filings + submission_values projection.
const TYPE_LABELS = { county: 'County', city: 'City', authority: 'Authority' };
const fmtMoney = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

const DcaDatabase = () => {
  const navigate = useNavigate();
  const { showToast } = useDcaUI();

  const [mode, setMode] = useState('filings'); // 'filings' | 'compliance'
  const [compliance, setCompliance] = useState(null);
  const [meta, setMeta] = useState({ fields: [], periods: [], statuses: [] });
  const [filters, setFilters] = useState({ type: '', period: '', status: '', q: '' });
  const [selectedFields, setSelectedFields] = useState([]); // [ucoaCode]
  const [fieldToAdd, setFieldToAdd] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null); // filingId whose history is open
  const [versions, setVersions] = useState({}); // filingId -> [versions]
  const [exporting, setExporting] = useState(false);

  const fieldLabel = useMemo(() => {
    const m = {};
    meta.fields.forEach((f) => { m[f.ucoaCode] = f.label; });
    return m;
  }, [meta.fields]);

  useEffect(() => {
    api.get('/database/meta').then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type); // (server scopes types by role too)
      if (filters.period) params.set('period', filters.period);
      if (filters.status) params.set('status', filters.status);
      if (filters.q) params.set('q', filters.q);
      if (selectedFields.length) params.set('fields', selectedFields.join(','));
      const res = await api.get(`/database/filings?${params.toString()}`);
      let data = res.data.rows;
      // client-side type filter (server enforces the role-level scope; this is the UI facet)
      if (filters.type) data = data.filter((r) => r.entityType === filters.type);
      setRows(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load filings.');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedFields]);

  useEffect(() => { if (mode === 'filings') load(); }, [load, mode]);

  useEffect(() => {
    if (mode !== 'compliance' || compliance) return;
    api.get('/database/compliance').then((res) => setCompliance(res.data)).catch(() => setCompliance({ years: [], rows: [], summary: {} }));
  }, [mode, compliance]);

  const addField = () => {
    if (fieldToAdd && !selectedFields.includes(fieldToAdd)) setSelectedFields((s) => [...s, fieldToAdd]);
    setFieldToAdd('');
  };
  const removeField = (code) => setSelectedFields((s) => s.filter((c) => c !== code));

  const toggleHistory = async (filingId) => {
    if (expanded === filingId) { setExpanded(null); return; }
    setExpanded(filingId);
    if (!versions[filingId]) {
      try {
        const res = await api.get(`/database/filings/${filingId}/versions`);
        setVersions((v) => ({ ...v, [filingId]: res.data.versions }));
      } catch { /* ignore */ }
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.period) params.set('period', filters.period);
      if (filters.status) params.set('status', filters.status);
      if (filters.q) params.set('q', filters.q);
      if (selectedFields.length) params.set('fields', selectedFields.join(','));
      const res = await api.get(`/database/export?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civisight-filings-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Could not export.');
    } finally {
      setExporting(false);
    }
  };

  const selCls = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100';

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Database</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every submitted filing — validated, unified, and queryable across entities, types, and years.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[['filings', 'Filings'], ['compliance', 'Compliance']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === m ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'filings' && (
            <button onClick={exportCsv} disabled={exporting || !rows.length}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {mode === 'compliance' ? (
        <ComplianceView data={compliance} />
      ) : (
      <>


      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Search entity…"
          className={`${selCls} w-48`}
        />
        <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} className={selCls}>
          <option value="">All types</option>
          <option value="county">Counties</option>
          <option value="city">Cities</option>
          <option value="authority">Authorities</option>
        </select>
        <select value={filters.period} onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))} className={selCls}>
          <option value="">All years</option>
          {meta.periods.map((p) => <option key={p} value={p}>FY{p}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className={selCls}>
          <option value="">All statuses</option>
          {meta.statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <select value={fieldToAdd} onChange={(e) => setFieldToAdd(e.target.value)} className={`${selCls} max-w-xs`}>
            <option value="">Add a field column…</option>
            {meta.fields.filter((f) => !selectedFields.includes(f.ucoaCode)).map((f) => (
              <option key={f.ucoaCode} value={f.ucoaCode}>{f.ucoaCode} — {f.label}</option>
            ))}
          </select>
          <button onClick={addField} disabled={!fieldToAdd} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40">Add</button>
        </div>
      </div>

      {/* Selected value columns as chips */}
      {selectedFields.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedFields.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full pl-2.5 pr-1.5 py-1">
              {c} · {fieldLabel[c]?.slice(0, 28)}
              <button onClick={() => removeField(c)} className="hover:text-blue-900 dark:hover:text-blue-100" aria-label="Remove column">✕</button>
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-2">{loading ? 'Loading…' : `${rows.length} filing${rows.length === 1 ? '' : 's'}`}</p>

      {error ? (
        <div className="text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">{error}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {['Entity', 'Type', 'Gov ID', 'Period', 'Status', 'Ver', 'Submitted'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                  {selectedFields.map((c) => (
                    <th key={c} className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap" title={fieldLabel[c]}>{c}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((r) => (
                  <React.Fragment key={r.submissionId}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap cursor-pointer" onClick={() => navigate(`/dca/submissions/${r.submissionId}`)}>{r.entityName}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{TYPE_LABELS[r.entityType] || r.entityType}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{r.govId || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">FY{r.reportingPeriod}</td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">v{r.version}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(r.submittedAt)}</td>
                      {selectedFields.map((c) => (
                        <td key={c} className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">{fmtMoney(r.values[c])}</td>
                      ))}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => toggleHistory(r.filingId)} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800">
                          {expanded === r.filingId ? 'Hide' : 'History'}
                        </button>
                      </td>
                    </tr>
                    {expanded === r.filingId && (
                      <tr className="bg-gray-50 dark:bg-gray-900/40">
                        <td colSpan={8 + selectedFields.length} className="px-6 py-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Version history</div>
                          <div className="space-y-1">
                            {(versions[r.filingId] || []).map((v) => (
                              <div key={v.submissionId} className="flex items-center gap-3 text-sm">
                                <span className="font-semibold text-gray-700 dark:text-gray-300 w-8">v{v.version}</span>
                                <StatusPill status={v.status} />
                                {v.isCurrent && <span className="text-[11px] font-bold text-green-600 dark:text-green-400">CURRENT</span>}
                                <span className="text-gray-500 dark:text-gray-400">filed {fmtDate(v.submittedAt)} by {v.submittedBy || 'county'}</span>
                                {v.reviewedBy && <span className="text-gray-400">· reviewed by {v.reviewedBy}</span>}
                                <button onClick={() => navigate(`/dca/submissions/${v.submissionId}`)} className="ml-auto text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800">Open →</button>
                              </div>
                            ))}
                            {!versions[r.filingId] && <div className="text-sm text-gray-400">Loading…</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={8 + selectedFields.length} className="px-4 py-16 text-center text-gray-500 dark:text-gray-400">No filings match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
};

// Compliance grid: per entity, is the required form filed & accepted for each of the last
// 3 reporting years? (Anchored on the latest year present.)
const CELL = {
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  under_review: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  needs_correction: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  missing: 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
};
const ComplianceView = ({ data }) => {
  if (!data) return <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  const { years = [], rows = [], summary = {} } = data;
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.compliant ?? 0}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Compliant</div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.nonCompliant ?? 0}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Not compliant</div>
        </div>
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          RLGF filed &amp; accepted for FY{years[0]}–FY{years[years.length - 1]}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                {years.map((y) => <th key={y} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">FY{y}</th>)}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((r) => (
                <tr key={r.entityId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{r.entityName}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">{r.entityType}</td>
                  {years.map((y) => (
                    <td key={y} className="px-4 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-semibold ${CELL[r.byYear[y]] || CELL.missing}`}>
                        {(r.byYear[y] || 'missing').replace('_', ' ')}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {r.compliant
                      ? <span className="text-green-600 dark:text-green-400 font-bold">✓ Compliant</span>
                      : <span className="text-red-500 dark:text-red-400 font-semibold">Not compliant</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DcaDatabase;
