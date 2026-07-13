import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import TypeBadge from '../components/TypeBadge';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (deadline) => Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);
const overdueText = (deadline) => {
  const d = daysUntil(deadline);
  if (d < 0) return `Overdue ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
};
// DCA only concerns forms addressed to DCA (mirrors DcaDashboard).
const isDcaAgency = (s) => /\bDCA\b/i.test(s || '') || /community affairs/i.test(s || '');

const DcaEntities = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/tasks');
        if (active) setTasks(res.data || []);
      } catch (err) {
        if (active) setError('Could not load entities.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Real counties that owe DCA filings, with their DCA task stats.
  const rows = useMemo(() => {
    const byCounty = new Map();
    tasks.filter((t) => isDcaAgency(t.submittedTo)).forEach((t) => {
      const id = t.countyId?._id || t.countyId;
      if (!id) return;
      if (!byCounty.has(id)) {
        byCounty.set(id, { id, name: t.countyId?.name || 'Unknown county', code: t.countyId?.code || '', tasks: [] });
      }
      byCounty.get(id).tasks.push(t);
    });
    return [...byCounty.values()]
      .map((c) => {
        const pending = c.tasks.filter((t) => t.status !== 'completed');
        const overdue = pending.filter((t) => daysUntil(t.deadline) < 0);
        const nearestOverdue = [...overdue].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
        return { ...c, pendingCount: pending.length, overdueCount: overdue.length, nearestOverdue };
      })
      .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, searchTerm]);

  const attention = rows
    .filter((r) => r.overdueCount > 0)
    .sort((a, b) => new Date(a.nearestOverdue.deadline) - new Date(b.nearestOverdue.deadline));
  const upToDate = rows.filter((r) => r.overdueCount === 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entities</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Counties that report DCA filings.</p>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search for a county…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
          />
        </div>
      </div>

      {error ? (
        <div className="text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No counties found.</p>
        </div>
      ) : (
        <>
          <section className="mb-7">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              Needs attention
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{attention.length}</span>
            </h2>
            {attention.length === 0 ? (
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Nothing needs attention right now — every county is on track.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {attention.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/dca/entities/${c.id}`)}
                    className="text-left flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 border-l-[3px] border-l-red-500 bg-red-50/60 dark:bg-red-900/10 px-4 py-3 transition-all hover:shadow-md hover:border-red-300"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white flex-wrap">
                        <span className="truncate">{c.name}</span>
                        <TypeBadge type="county" />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {c.pendingCount} DCA {c.pendingCount === 1 ? 'task' : 'tasks'} to do
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        {overdueText(c.nearestOverdue.deadline)}
                      </span>
                      <span className="text-gray-400 text-lg leading-none">›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {upToDate.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Up to date
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{upToDate.length}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {upToDate.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/dca/entities/${c.id}`)}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-2 text-sm font-semibold hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                  >
                    <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="text-gray-900 dark:text-white">{c.name}</span>
                    <TypeBadge type="county" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default DcaEntities;
