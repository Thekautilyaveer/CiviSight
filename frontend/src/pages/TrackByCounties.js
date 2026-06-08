import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const DAY_MS = 24 * 60 * 60 * 1000;

const TrackByCounties = () => {
  const [counties, setCounties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCounty, setShowAddCounty] = useState(false);
  const [countyForm, setCountyForm] = useState({
    name: '',
    code: '',
    description: '',
    email: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingCounty, setDeletingCounty] = useState(null);
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    } else {
      fetchUserCounty();
    }
  }, [isAdmin, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Counties carry the task counts; tasks let us compute each county's nearest deadline.
      const [countiesRes, tasksRes] = await Promise.all([
        api.get('/counties'),
        api.get('/tasks')
      ]);
      setCounties(countiesRes.data);
      setTasks(tasksRes.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCounty = async () => {
    setLoading(true);
    try {
      if (user?.countyId) {
        navigate(`/county/${user.countyId}`);
      } else {
        console.warn('County user has no assigned countyId.');
      }
    } catch (error) {
      console.error('Error fetching user county:', error);
    } finally {
      setLoading(false);
    }
  };

  // Earliest deadline among each county's not-yet-completed tasks.
  const nearestDeadline = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (t.status === 'completed' || !t.deadline) return;
      const cid = t.countyId?._id || t.countyId;
      if (!cid) return;
      const dl = new Date(t.deadline).getTime();
      if (!(cid in map) || dl < map[cid]) map[cid] = dl;
    });
    return map;
  }, [tasks]);

  const urgencyFor = (countyId) => {
    const dl = nearestDeadline[countyId];
    if (dl == null) return null;
    const diff = Math.ceil((dl - Date.now()) / DAY_MS);
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

  const handleAddCounty = async (e) => {
    e.preventDefault();
    try {
      await api.post('/counties', countyForm);
      const countyCode = countyForm.code.toLowerCase();
      const userEmail = `${countyCode}county@civisight.org`;
      setCountyForm({ name: '', code: '', description: '', email: '' });
      setShowAddForm(false);
      fetchData();
      alert(`County created successfully!\n\nCounty user credentials:\nEmail: ${userEmail}\nPassword: county123`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating county');
    }
  };

  const handleDeleteCounty = async (countyId, countyName) => {
    if (!window.confirm(`Are you sure you want to delete "${countyName}"? This will also delete all associated tasks.`)) {
      return;
    }

    setDeletingCounty(countyId);
    try {
      await api.delete(`/counties/${countyId}`);
      fetchData();
      alert('County deleted successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting county');
    } finally {
      setDeletingCounty(null);
    }
  };

  const filteredCounties = counties.filter((county) => {
    const term = searchTerm.toLowerCase();
    return county.name.toLowerCase().includes(term) || county.code.toLowerCase().includes(term);
  });

  // "Needs attention" = has not-yet-started (pending) tasks; sorted most urgent first.
  const attention = filteredCounties
    .filter((c) => (c.taskStats?.pending || 0) > 0)
    .sort((a, b) => (nearestDeadline[a._id] ?? Infinity) - (nearestDeadline[b._id] ?? Infinity));
  const upToDate = filteredCounties.filter((c) => (c.taskStats?.pending || 0) === 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // County users are redirected to their own county page.
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 py-6">
      {/* Title */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Counties</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Select a county to view and manage its tasks.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap gap-2.5 items-center">
        <button
          onClick={() => setShowAddCounty(true)}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          Manage Counties
        </button>
        <div className="relative flex-1 min-w-[220px]">
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

      {filteredCounties.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No counties found.</p>
        </div>
      ) : (
        <>
          {/* Needs attention */}
          {attention.length > 0 ? (
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {attention.map((county) => {
                  const u = urgencyFor(county._id) || { level: 'todo', text: 'Open tasks' };
                  const pending = county.taskStats?.pending || 0;
                  const unread = county.taskStats?.unreadComments || 0;
                  const isOver = u.level === 'over';
                  return (
                    <button
                      key={county._id}
                      onClick={() => navigate(`/county/${county._id}`)}
                      className={`text-left flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 border-l-[3px] px-4 py-3 transition-all hover:shadow-md ${
                        isOver
                          ? 'border-l-red-500 bg-red-50/60 dark:bg-red-900/10 hover:border-red-300'
                          : 'border-l-amber-500 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                          <span className="truncate">{county.name}</span>
                          {unread > 0 && (
                            <span className="shrink-0 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              new comments
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                          </svg>
                          {pending} {pending === 1 ? 'task' : 'tasks'} to do
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={chipClass(u.level)}>{u.text}</span>
                        <span className="text-gray-400 text-lg leading-none">›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="mb-7">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Nothing needs attention right now — every county is on track.
              </div>
            </section>
          )}

          {/* Up to date */}
          {upToDate.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Up to date
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
                  {upToDate.length}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {upToDate.map((county) => (
                  <button
                    key={county._id}
                    onClick={() => navigate(`/county/${county._id}`)}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-2 text-sm font-semibold hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                  >
                    <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="text-gray-900 dark:text-white">{county.name}</span>
                    <span className="text-[11.5px] text-gray-400 font-semibold tracking-wide">{county.code}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Manage Counties Modal */}
      {showAddCounty && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Counties</h3>
              <button
                onClick={() => {
                  setShowAddCounty(false);
                  setShowAddForm(false);
                  setCountyForm({ name: '', code: '', description: '', email: '' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Add County Button / Form */}
            <div className="mb-6">
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New County
                </button>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Add New County</h4>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setCountyForm({ name: '', code: '', description: '', email: '' });
                      }}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleAddCounty} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        County Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={countyForm.name}
                        onChange={(e) => setCountyForm({ ...countyForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        placeholder="e.g., Fulton County"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        County Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={countyForm.code}
                        onChange={(e) => setCountyForm({ ...countyForm, code: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        placeholder="e.g., FULTON"
                        maxLength={20}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique code for the county (uppercase)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        value={countyForm.description}
                        onChange={(e) => setCountyForm({ ...countyForm, description: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all resize-none"
                        rows="3"
                        placeholder="Brief description of the county"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={countyForm.email}
                        onChange={(e) => setCountyForm({ ...countyForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        placeholder="county@example.com"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email address for task reminders (optional)</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium transition-colors shadow-sm"
                      >
                        Create County
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setCountyForm({ name: '', code: '', description: '', email: '' });
                        }}
                        className="flex-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Counties List */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Existing Counties</h4>
              {counties.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No counties found. Add your first county above.</p>
              ) : (
                <div className="space-y-3">
                  {counties.map((county) => {
                    const stats = county.taskStats || { total: 0, pending: 0, inProgress: 0, completed: 0 };
                    return (
                      <div
                        key={county._id}
                        className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="text-lg font-semibold text-gray-900 dark:text-white">{county.name}</h5>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {county.code}
                            </span>
                          </div>
                          {county.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{county.description}</p>
                          )}
                          {county.email && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span className="font-medium">Email:</span> {county.email}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="text-gray-500 dark:text-gray-400">Total Tasks: <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.total}</span></span>
                            {stats.pending > 0 && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                                {stats.pending} Pending
                              </span>
                            )}
                            {stats.inProgress > 0 && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                {stats.inProgress} In Progress
                              </span>
                            )}
                            {stats.completed > 0 && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                {stats.completed} Completed
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCounty(county._id, county.name)}
                          disabled={deletingCounty === county._id}
                          className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {deletingCounty === county._id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackByCounties;
