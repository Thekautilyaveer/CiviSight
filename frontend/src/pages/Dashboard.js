import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import TaskCardDetails from '../components/TaskCardDetails';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (deadline) => Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);
const isoDay = (deadline) => new Date(deadline).toISOString().slice(0, 10);

const dueTag = (days) => {
  if (days < 0) return `Overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Due today';
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
};

const fmtDeadline = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Entity-type dropdown is UI-only: every real entity is a county today.
const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'county', label: 'Counties' },
  { value: 'city', label: 'Cities' },
  { value: 'authority', label: 'Authorities' }
];

// Flag the flagship RLGF form for the label.
const rlgfLabel = (title) =>
  /local government finance/i.test(title) && !/\(RLGF\)/i.test(title) ? `${title} (RLGF)` : title;

const Dashboard = () => {
  const navigate = useNavigate();
  const { isAccg, user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedForm, setSelectedForm] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(''); // '' = both | 'done' | 'notdone'
  const [deadlineFilter, setDeadlineFilter] = useState(''); // '' = all | ISO day

  const [remindingId, setRemindingId] = useState(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  useEffect(() => {
    // County users don't track all counties — send them to their own county page.
    if (!isAccg) {
      if (user?.countyId) navigate(`/county/${user.countyId}`);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/tasks');
        if (active) setTasks(res.data || []);
      } catch (err) {
        if (active) setError('Could not load tasks.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isAccg, user, navigate]);

  // Distinct forms = distinct task titles across every county.
  const forms = useMemo(
    () => [...new Set(tasks.map((t) => t.title))].sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  // Default to RLGF when it exists, otherwise the first form.
  useEffect(() => {
    if (!selectedForm && forms.length) {
      const rlgf = forms.find((f) => /local government finance/i.test(f));
      setSelectedForm(rlgf || forms[0]);
    }
  }, [forms, selectedForm]);

  const onSelectForm = (form) => {
    setSelectedForm(form);
    setPickerOpen(false);
    setDeadlineFilter('');
  };

  const formTasks = useMemo(() => tasks.filter((t) => t.title === selectedForm), [tasks, selectedForm]);

  const { total, undone, overdue } = useMemo(() => {
    const notDone = formTasks.filter((t) => t.status !== 'completed');
    return {
      total: formTasks.length,
      undone: notDone.length,
      overdue: notDone.filter((t) => daysUntil(t.deadline) < 0).length
    };
  }, [formTasks]);

  const fyLabel = useMemo(() => {
    const counts = {};
    formTasks.forEach((t) => {
      const y = new Date(t.deadline).getFullYear();
      if (y) counts[y] = (counts[y] || 0) + 1;
    });
    const years = Object.keys(counts);
    if (!years.length) return '';
    const y = Number(years.sort((a, b) => counts[b] - counts[a])[0]);
    return `FY ${y - 1}-${String(y).slice(2)}`;
  }, [formTasks]);

  const deadlineOptions = useMemo(() => {
    const map = new Map();
    formTasks.forEach((t) => {
      const key = isoDay(t.deadline);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([iso, count]) => ({ iso, count })).sort((a, b) => a.iso.localeCompare(b.iso));
  }, [formTasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return formTasks.filter((t) => {
      const name = (t.countyId?.name || '').toLowerCase();
      if (q && !name.includes(q)) return false;
      if (typeFilter !== 'all' && typeFilter !== 'county') return false; // UI-only: all real entities are counties
      if (deadlineFilter && isoDay(t.deadline) !== deadlineFilter) return false;
      return true;
    });
  }, [formTasks, search, typeFilter, deadlineFilter]);

  const notDoneRows = useMemo(
    () =>
      filtered
        .filter((t) => t.status !== 'completed')
        .map((t) => ({ task: t, days: daysUntil(t.deadline) }))
        .sort((a, b) => a.days - b.days),
    [filtered]
  );
  const doneRows = useMemo(() => filtered.filter((t) => t.status === 'completed'), [filtered]);

  const showNotDone = statusFilter === '' || statusFilter === 'notdone';
  const showDone = statusFilter === '' || statusFilter === 'done';

  const remindOne = async (task) => {
    setRemindingId(task._id);
    try {
      await api.post(`/tasks/${task._id}/reminder`);
      showToast(`Reminder sent for ${task.countyId?.name || 'county'}.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send reminder.');
    } finally {
      setRemindingId(null);
    }
  };

  const remindAll = async () => {
    const ids = notDoneRows.map((r) => r.task._id);
    if (!ids.length) return;
    setRemindingAll(true);
    try {
      const res = await api.post('/tasks/send-reminders', { taskIds: ids, message: '' });
      const n = res.data?.sent ?? ids.length;
      showToast(`Reminder sent to ${n} ${n === 1 ? 'county' : 'counties'}.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send reminders.');
    } finally {
      setRemindingAll(false);
    }
  };

  const viewCounty = (task) => {
    const cid = task.countyId?._id || task.countyId;
    if (cid) navigate(`/county/${cid}`);
  };

  if (loading || !isAccg) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-2 sm:px-4 py-2">
        <div className="text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  const inputCls =
    'w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-colors';

  return (
    <div className="px-2 sm:px-4 py-2">
      {/* Hero banner — form title + form picker + stat line */}
      <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-100/90 mb-1">
              Association of County Commissioners of Georgia — Selected form
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white break-words">
              {selectedForm ? rlgfLabel(selectedForm) : 'No forms found'}
            </h1>
            <p className="mt-3 text-blue-100 text-sm sm:text-base">
              <span className="font-semibold text-white">{undone}</span> of{' '}
              <span className="font-semibold text-white">{total}</span> undone
              <span className="mx-2 text-blue-200/70">·</span>
              <span className="font-semibold text-white">{overdue}</span> overdue
              {fyLabel && (
                <>
                  <span className="mx-2 text-blue-200/70">·</span>
                  <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {fyLabel}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Form picker ("…") */}
          <div className="relative shrink-0">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              title="Switch form"
              aria-label="Switch form"
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {pickerOpen && (
              <>
                <button
                  className="fixed inset-0 z-30 cursor-default"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setPickerOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 mt-2 z-40 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1"
                >
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Select a form
                  </div>
                  {forms.map((form) => (
                    <button
                      key={form}
                      role="menuitem"
                      onClick={() => onSelectForm(form)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        form === selectedForm
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {rlgfLabel(form)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search counties…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-10`}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} title="Entity type" className={inputCls}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} title="Status" className={inputCls}>
          <option value="">Done &amp; Not Done</option>
          <option value="notdone">Not Done</option>
          <option value="done">Done</option>
        </select>
        <select value={deadlineFilter} onChange={(e) => setDeadlineFilter(e.target.value)} title="Filter by deadline" className={inputCls}>
          <option value="">All deadlines</option>
          {deadlineOptions.map((d) => (
            <option key={d.iso} value={d.iso}>{fmtDeadline(d.iso)} ({d.count})</option>
          ))}
        </select>
      </div>

      {formTasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No counties owe this form.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {/* NOT DONE */}
          {showNotDone && (
            <section>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                  Not Done
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {notDoneRows.length}
                  </span>
                </h2>
                <button
                  onClick={remindAll}
                  disabled={remindingAll || notDoneRows.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {remindingAll ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></div>
                      Sending…
                    </>
                  ) : (
                    <>Remind All ({notDoneRows.length})</>
                  )}
                </button>
              </div>

              {notDoneRows.length === 0 ? (
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                  Every county in this view has completed the form.
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {notDoneRows.map(({ task, days }) => (
                    <div key={task._id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <button onClick={() => viewCounty(task)} className="min-w-0 text-left">
                          <div className="font-semibold text-gray-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400">
                            {task.countyId?.name || 'Unknown county'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Deadline {fmtDeadline(task.deadline)}
                          </div>
                        </button>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                              days < 0
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {dueTag(days)}
                          </span>
                          <button
                            onClick={() => remindOne(task)}
                            disabled={remindingId === task._id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {remindingId === task._id ? 'Sending…' : 'Remind'}
                          </button>
                          <button
                            onClick={() => toggleExpand(task._id)}
                            aria-label="Toggle details"
                            aria-expanded={expandedId === task._id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <svg className={`w-4 h-4 transition-transform ${expandedId === task._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {expandedId === task._id && <TaskCardDetails task={task} />}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* DONE */}
          {showDone && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Done
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  {doneRows.length}
                </span>
              </h2>

              {doneRows.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                  No counties have completed this form in the current view.
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  {doneRows.map((task) => (
                    <div key={task._id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {task.countyId?.name || 'Unknown county'}
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-400 mt-0.5">Completed</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => viewCounty(task)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => toggleExpand(task._id)}
                            aria-label="Toggle details"
                            aria-expanded={expandedId === task._id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <svg className={`w-4 h-4 transition-transform ${expandedId === task._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {expandedId === task._id && <TaskCardDetails task={task} />}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
