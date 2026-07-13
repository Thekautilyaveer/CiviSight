import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import StatusPill from '../components/StatusPill';
import TypeBadge from '../components/TypeBadge';

// Real submissions received from counties (GET /api/submissions).
const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Received' },
  { value: 'under_review', label: 'Under review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'needs_correction', label: 'Needs correction' }
];

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const DcaSubmissions = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusTab, setStatusTab] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/submissions');
        if (active) setSubmissions(res.data || []);
      } catch (err) {
        if (active) setError('Could not load submissions.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(
    () => (statusTab === 'all' ? submissions : submissions.filter((s) => s.status === statusTab)),
    [submissions, statusTab]
  );

  const counts = useMemo(() => {
    const c = { all: submissions.length };
    submissions.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [submissions]);

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Submissions</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Filings received from counties, ready for agency review.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusTab(tab.value)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              statusTab === tab.value
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            {counts[tab.value] ? <span className="ml-1.5 text-xs text-gray-400">{counts[tab.value]}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No submissions in this view.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">County</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Form</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitter</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((s) => (
                  <tr
                    key={s._id}
                    onClick={() => navigate(`/dca/submissions/${s._id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{s.countyId?.name || 'Unknown county'}</span>
                        <TypeBadge type="county" />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{s.formName || s.taskId?.title || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{fmtDate(s.submittedAt)}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{s.submittedBy?.username || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap"><StatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DcaSubmissions;
