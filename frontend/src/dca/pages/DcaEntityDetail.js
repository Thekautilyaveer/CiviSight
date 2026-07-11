import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TypeBadge from '../components/TypeBadge';
import StatusPill from '../components/StatusPill';
import PriorityPill from '../components/PriorityPill';
import { useDcaUI } from '../DcaUIContext';
import {
  entitiesById,
  tasks as allTasks,
  submissions,
  ENTITY_TYPE_LABELS,
  formatDate,
  urgencyFor
} from '../mockData';

const DAY_MS = 24 * 60 * 60 * 1000;

const MOCK_COMMENTS = [
  { id: 'c1', author: 'DCA Reviewer', role: 'State Agency', text: 'Please confirm the fiscal year-end date before submitting.', when: 'Jul 2, 2026' },
  { id: 'c2', author: 'Dana Whitfield', role: 'Finance Director', text: 'Confirmed — FYE is June 30, 2026.', when: 'Jul 3, 2026' }
];

const DcaEntityDetail = () => {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const { openModal, showToast } = useDcaUI();
  const entity = entitiesById[entityId];

  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [collapsedSections, setCollapsedSections] = useState({ done: true });
  const [expandedTask, setExpandedTask] = useState(null);
  const [infoTask, setInfoTask] = useState(null);

  const entityTasks = useMemo(
    () => allTasks.filter((t) => t.entityId === entityId),
    [entityId]
  );

  // For "Review" targets: prefer a submission matching this entity+filing, then any
  // submission from this entity, then any submission at all, so the button always leads
  // to a coherent submission-detail page in this UI preview.
  const submissionByFiling = useMemo(() => {
    const map = {};
    submissions
      .filter((s) => s.entityId === entityId)
      .forEach((s) => { map[s.filingId] = s; });
    return map;
  }, [entityId]);

  const fallbackSubmission = useMemo(
    () => submissions.find((s) => s.entityId === entityId) || submissions[0],
    [entityId]
  );

  const filteredTasks = useMemo(() => {
    return entityTasks.filter((task) => {
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [entityTasks, searchTerm, priorityFilter]);

  const daysToDeadline = (t) => Math.ceil((new Date(t.deadline) - new Date()) / DAY_MS);
  const dueSoon = filteredTasks
    .filter((t) => t.status !== 'completed' && daysToDeadline(t) <= 90)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const dueLater = filteredTasks
    .filter((t) => t.status !== 'completed' && daysToDeadline(t) > 90)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const completed = filteredTasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.deadline) - new Date(a.deadline));

  const sections = [
    { key: 'soon', label: 'Due in the next 90 days', tasks: dueSoon },
    { key: 'later', label: 'Due later than 90 days', tasks: dueLater },
    { key: 'done', label: 'Completed', tasks: completed }
  ];

  if (!entity) {
    return (
      <div className="px-4 py-6">
        <button onClick={() => navigate('/dca/entities')} className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Entities
        </button>
        <p className="text-gray-500 dark:text-gray-400">Entity not found.</p>
      </div>
    );
  }

  const typeLabel = ENTITY_TYPE_LABELS[entity.type].toLowerCase();

  const TaskRow = ({ task }) => {
    const u = urgencyFor(task.deadline, task.status);
    const isOverdue = u.level === 'over';
    const reviewTarget = submissionByFiling[task.filingId] || fallbackSubmission;
    const canReview = task.status === 'submitted' || task.status === 'under_review';

    return (
      <div className={`p-6 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${isOverdue ? 'bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500' : ''}`}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{task.title}</h3>
                <button
                  type="button"
                  onClick={() => setInfoTask(infoTask === task.id ? null : task.id)}
                  title="About this filing"
                  aria-label="About this filing"
                  className="shrink-0 w-5 h-5 inline-flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 text-[11px] font-bold leading-none"
                >
                  i
                </button>
              </span>
              <PriorityPill priority={task.priority} />
              <StatusPill status={task.status} />
              {u.text && (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${isOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {u.text}
                </span>
              )}
            </div>

            {infoTask === task.id && (
              <div className="mb-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2">
                Filing tracked by DCA. This is placeholder detail text for the {typeLabel}’s {task.title}.
              </div>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Submitted to <span className="font-medium text-gray-700 dark:text-gray-300">{task.agency}</span>
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Deadline: {formatDate(task.deadline)}</span>
              </div>
              {task.status !== 'completed' && (
                <div className={`flex items-center gap-2 font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{u.text}</span>
                </div>
              )}
            </div>

            {/* Comments expander */}
            <div className="mt-4">
              <button
                onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>{task.commentCount} {task.commentCount === 1 ? 'comment' : 'comments'}</span>
                <svg className={`w-4 h-4 transition-transform ${expandedTask === task.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedTask === task.id && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="space-y-4 mb-4">
                    {MOCK_COMMENTS.map((comment) => (
                      <div key={comment.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 dark:text-blue-300 font-semibold text-sm">{comment.author.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{comment.author}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{comment.role}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{comment.when}</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                    <textarea
                      placeholder="Add a comment…"
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setExpandedTask(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                        Cancel
                      </button>
                      <button
                        onClick={() => { setExpandedTask(null); showToast('Comment added (preview only — not saved)'); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
                      >
                        Add Comment
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 lg:justify-end lg:flex-col lg:items-end shrink-0">
            {canReview && reviewTarget && (
              <button
                onClick={() => navigate(`/dca/submissions/${reviewTarget.id}`)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Review
              </button>
            )}
            <button
              onClick={() => openModal('addFormOwners', { taskTitle: task.title })}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-300 dark:border-gray-600"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 18.72a9.094 9.094 0 003.75.78 8.963 8.963 0 00-3.06-6.76M15 11.25a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
              </svg>
              Add form owners
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => openModal('addEditTask', { mode: 'edit', entityName: entity.name, task })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => showToast('Reminder sent (preview only)')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Remind
              </button>
              <button
                onClick={() => openModal('deleteConfirm', { label: `${task.title} (${entity.name})` })}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="px-2 sm:px-4 py-2">
      <button onClick={() => navigate('/dca/entities')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Entities
      </button>

      {/* Gradient hero */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-4xl font-bold text-white">{entity.name}</h1>
              <TypeBadge type={entity.type} className="bg-white/20 !text-white !border-white/30" />
            </div>
            <p className="text-blue-100 text-lg">DCA filings for this {typeLabel}</p>
          </div>
          <button
            onClick={() => openModal('contacts', { entityName: entity.name })}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Contacts
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search tasks…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={() => openModal('addEditTask', { mode: 'add', entityName: entity.name })}
            title="Add a task"
            aria-label="Add a task"
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((sec) => (
            <div key={sec.key}>
              <button
                type="button"
                onClick={() => setCollapsedSections((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {sec.key === 'soon' && (
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                )}
                {sec.key === 'later' && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                  </svg>
                )}
                {sec.key === 'done' && (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {sec.label}
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${sec.key === 'soon' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : sec.key === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {sec.tasks.length}
                </span>
                <svg
                  className={`w-4 h-4 ml-1 text-gray-400 transition-transform ${collapsedSections[sec.key] ? '' : 'rotate-180'}`}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {!collapsedSections[sec.key] && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {sec.tasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 dark:text-gray-500 text-sm">Nothing in this section</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {sec.tasks.map((task) => <TaskRow key={task.id} task={task} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DcaEntityDetail;
