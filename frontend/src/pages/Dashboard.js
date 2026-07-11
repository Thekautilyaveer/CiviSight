import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const DAY_MS = 24 * 60 * 60 * 1000;

const Dashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [agency, setAgency] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // County users don't track all counties — send them to their own county page.
    if (!isAdmin) {
      if (user?.countyId) navigate(`/county/${user.countyId}`);
      setLoading(false);
      return;
    }
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const res = await api.get('/tasks');
        setTasks(res.data || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [isAdmin, user, navigate]);

  const urgencyFor = (deadline) => {
    if (!deadline) return { level: 'todo', text: 'Not done' };
    const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);
    if (diff < 0) {
      const n = Math.abs(diff);
      return { level: 'over', text: `Overdue by ${n} day${n === 1 ? '' : 's'}` };
    }
    if (diff === 0) return { level: 'over', text: 'Due today' };
    if (diff <= 7) return { level: 'todo', text: `Due in ${diff} day${diff === 1 ? '' : 's'}` };
    return { level: 'none', text: `Due in ${diff} days` };
  };

  const chipClass = (level) => {
    const base = 'inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ';
    if (level === 'over') return base + 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    if (level === 'todo') return base + 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    return base + 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  };

  // Group every task by its filing title -> one entry per filing, listing its counties.
  const filings = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      const key = t.title;
      if (!map.has(key)) map.set(key, { title: key, submittedTo: t.submittedTo || '', counties: [] });
      map.get(key).counties.push({
        id: t.countyId?._id || t.countyId,
        name: t.countyId?.name || 'Unknown county',
        code: t.countyId?.code || '',
        status: t.status,
        deadline: t.deadline,
        assignedContacts: Array.isArray(t.assignedContacts) ? t.assignedContacts : []
      });
    });
    const now = Date.now();
    const arr = [...map.values()].map((f) => {
      const done = f.counties.filter((c) => c.status === 'completed');
      const notDone = f.counties
        .filter((c) => c.status !== 'completed')
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      const overdueCount = notDone.filter((c) => new Date(c.deadline).getTime() < now).length;
      return { ...f, total: f.counties.length, done, notDone, overdueCount };
    });
    // Most-attention-needed first: by overdue count, then by how many are still outstanding.
    arr.sort(
      (a, b) =>
        b.overdueCount - a.overdueCount ||
        b.notDone.length - a.notDone.length ||
        a.title.localeCompare(b.title)
    );
    return arr;
  }, [tasks]);

  // Distinct submitting agencies for the filter strip.
  const agencies = useMemo(
    () => [...new Set(filings.map((f) => f.submittedTo).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [filings]
  );

  const filtered = filings.filter(
    (f) =>
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (agency === 'all' || f.submittedTo === agency)
  );
  const attention = filtered.filter((f) => f.notDone.length > 0);
  const complete = filtered.filter((f) => f.notDone.length === 0);

  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const toggle = (title) => setExpanded((cur) => (cur === title ? null : title));

  const FilingCard = ({ filing }) => {
    const isOpen = expanded === filing.title;
    const { total, done, notDone, overdueCount } = filing;
    const accent =
      overdueCount > 0
        ? 'border-l-red-500'
        : notDone.length > 0
        ? 'border-l-amber-500'
        : 'border-l-green-500';
    return (
      <div className={`rounded-lg border border-gray-200 dark:border-gray-700 border-l-[3px] ${accent} bg-white dark:bg-gray-800 overflow-hidden`}>
        {/* Header */}
        <button
          onClick={() => toggle(filing.title)}
          className="w-full text-left flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="min-w-0">
            <div className="font-bold text-gray-900 dark:text-white truncate">{filing.title}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {done.length} of {total} done
              {overdueCount > 0 && <span className="text-red-600 dark:text-red-400 font-semibold"> · {overdueCount} overdue</span>}
              {filing.submittedTo && <span className="hidden sm:inline"> · {filing.submittedTo}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {overdueCount > 0 ? (
              <span className={chipClass('over')}>{overdueCount} overdue</span>
            ) : notDone.length > 0 ? (
              <span className={chipClass('todo')}>{notDone.length} not done</span>
            ) : (
              <span className={chipClass('done').replace('bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300')}>
                All done
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </button>

        {/* Expanded breakdown */}
        {isOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
            {notDone.length > 0 && (
              <div className="mt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Not done yet ({notDone.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {notDone.map((c) => {
                    const u = urgencyFor(c.deadline);
                    return (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/county/${c.id}`)}
                        className={`text-left flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all hover:shadow-sm ${
                          u.level === 'over'
                            ? 'border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-900/10'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm truncate block">
                            {c.name}
                            {c.status === 'in_progress' && (
                              <span className="ml-2 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                in progress
                              </span>
                            )}
                          </span>
                          {c.assignedContacts.length > 0 && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {c.assignedContacts.map((contact, idx) => (
                                <span
                                  key={`${contact.contactId || contact.email || contact.role || idx}`}
                                  className="inline-flex rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:text-blue-300"
                                  title={[contact.name, contact.role, contact.email].filter(Boolean).join(' · ')}
                                >
                                  {contact.name || contact.role || contact.email || 'Form owner'}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <span className={chipClass(u.level)}>{u.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div className="mt-4">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                  Completed ({done.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {done.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/county/${c.id}`)}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5 text-sm font-semibold hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                      title={
                        c.assignedContacts?.length > 0
                          ? `Form owners: ${c.assignedContacts.map((contact) => contact.name || contact.role || contact.email).filter(Boolean).join(', ')}`
                          : undefined
                      }
                    >
                      <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="text-gray-900 dark:text-white">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-2 sm:px-4 py-6">
      {/* Title */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Pick a filing to see which counties have completed it and which still owe it.
        </p>
      </div>

      {/* Search · Agency filter · Create Task shortcut on one row */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search for a filing…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
          />
        </div>
        <select
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          title="Filter by agency"
          className="shrink-0 max-w-[200px] px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        >
          <option value="all">All agencies</option>
          {agencies.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button
          onClick={() => navigate('/create-task')}
          title="Create a new task"
          aria-label="Create a new task"
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No filings found.</p>
        </div>
      ) : (
        <>
          {attention.length > 0 && (
            <section className="mb-7">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                </svg>
                Needs attention
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {attention.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {attention.map((f) => (
                  <FilingCard key={f.title} filing={f} />
                ))}
              </div>
            </section>
          )}

          {complete.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Completed by every county
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  {complete.length}
                </span>
              </h2>
              <div className="flex flex-col gap-2.5">
                {complete.map((f) => (
                  <FilingCard key={f.title} filing={f} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
