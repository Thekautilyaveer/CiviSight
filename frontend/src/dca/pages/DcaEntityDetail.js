import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import TypeBadge from '../components/TypeBadge';
import StatusPill from '../components/StatusPill';
import TaskCardDetails from '../../components/TaskCardDetails';
import { useDcaUI } from '../DcaUIContext';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntil = (deadline) => Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY_MS);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const dueTag = (d) => {
  if (d < 0) return `Overdue ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
};
const isDcaAgency = (s) => /\bDCA\b/i.test(s || '') || /community affairs/i.test(s || '');

const DcaEntityDetail = () => {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const { openModal, showToast } = useDcaUI();

  const [county, setCounty] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [remindingId, setRemindingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [c, t] = await Promise.all([
        api.get(`/counties/${entityId}`),
        api.get(`/tasks?countyId=${entityId}`)
      ]);
      setCounty(c.data);
      setTasks((t.data || []).filter((task) => isDcaAgency(task.submittedTo)));
    } catch (err) {
      setError(err.response?.data?.message || 'County not found.');
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => { load(); }, [load]);

  const { notDone, done } = useMemo(() => {
    const nd = tasks.filter((t) => t.status !== 'completed').sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const d = tasks.filter((t) => t.status === 'completed');
    return { notDone: nd, done: d };
  }, [tasks]);

  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const remind = async (task) => {
    setRemindingId(task._id);
    try {
      await api.post(`/tasks/${task._id}/reminder`);
      showToast(`Reminder sent for ${county?.name || 'county'}.`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send reminder.');
    } finally {
      setRemindingId(null);
    }
  };

  const viewSubmission = async (task) => {
    try {
      const res = await api.get(`/submissions?taskId=${task._id}`);
      const list = res.data || [];
      if (!list.length) { showToast('No submission on file for this filing yet.'); return; }
      navigate(`/dca/submissions/${list[0]._id}`);
    } catch (err) {
      showToast('Could not open the submission.');
    }
  };

  const backBtn = (
    <button onClick={() => navigate('/dca/entities')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Entities
    </button>
  );

  if (loading) {
    return (
      <div className="px-2 sm:px-4 py-2">
        {backBtn}
        <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>
      </div>
    );
  }
  if (error || !county) {
    return (
      <div className="px-2 sm:px-4 py-2">
        {backBtn}
        <p className="text-gray-500 dark:text-gray-400">{error || 'County not found.'}</p>
      </div>
    );
  }

  const total = tasks.length;
  const doneCount = done.length;

  const TaskRow = ({ task }) => {
    const days = daysUntil(task.deadline);
    const isDone = task.status === 'completed';
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate">{task.title}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Deadline {fmtDate(task.deadline)}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isDone && (
              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${days < 0 ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                {dueTag(days)}
              </span>
            )}
            <StatusPill status={task.status} />
            {isDone ? (
              <button onClick={() => viewSubmission(task)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
                View
              </button>
            ) : (
              <button onClick={() => remind(task)} disabled={remindingId === task._id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-sm font-medium transition-colors disabled:opacity-50">
                {remindingId === task._id ? 'Sending…' : 'Remind'}
              </button>
            )}
            <button onClick={() => toggleExpand(task._id)} aria-label="Toggle details" aria-expanded={expandedId === task._id} className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg className={`w-4 h-4 transition-transform ${expandedId === task._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>
        {expandedId === task._id && <TaskCardDetails task={task} />}
      </div>
    );
  };

  return (
    <div className="px-2 sm:px-4 py-2 max-w-4xl">
      {backBtn}

      {/* Header */}
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.08)] p-6 mb-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
        </div>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{county.name}</h1>
              <TypeBadge type="county" />
            </div>
            <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
              {county.code} · <span className="font-semibold text-gray-900 dark:text-white">{doneCount}</span> of <span className="font-semibold text-gray-900 dark:text-white">{total}</span> DCA filings done
            </p>
          </div>
          <button
            onClick={() => openModal('contacts', { entityName: county.name, entityType: 'county' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            Contacts
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">This county has no DCA filings.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {notDone.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Not Done
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{notDone.length}</span>
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {notDone.map((task) => <TaskRow key={task._id} task={task} />)}
              </div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Done
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{done.length}</span>
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {done.map((task) => <TaskRow key={task._id} task={task} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default DcaEntityDetail;
