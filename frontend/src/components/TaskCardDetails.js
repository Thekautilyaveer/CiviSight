import React, { useEffect, useState } from 'react';
import api from '../utils/api';

// Expandable detail panel for a task row on the ACCG / DCA dashboards.
// Shows the fiscal-year deadline, when/by whom it was assigned, the form owner(s),
// and wires up the existing task comment feature (GET/POST /tasks/:id/comments).
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const roleLabel = (r) => (r === 'accg' ? 'ACCG' : r === 'dca' ? 'DCA' : 'County');

const TaskCardDetails = ({ task }) => {
  const [comments, setComments] = useState(null); // null = loading
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/tasks/${task._id}/comments`);
        if (active) setComments(res.data.comments || []);
      } catch (err) {
        if (active) { setComments([]); setError('Could not load comments.'); }
      }
    })();
    return () => { active = false; };
  }, [task._id]);

  const addComment = async () => {
    if (!text.trim()) return;
    setPosting(true);
    setError('');
    try {
      const res = await api.post(`/tasks/${task._id}/comments`, { text: text.trim() });
      setComments((c) => [...(c || []), res.data.comment]);
      setText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add comment.');
    } finally {
      setPosting(false);
    }
  };

  const owners = Array.isArray(task.assignedContacts) ? task.assignedContacts : [];

  return (
    <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
      {/* Detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Fiscal-year deadline</div>
          <div className="mt-0.5 text-gray-900 dark:text-gray-100">{fmtDate(task.deadline)}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Assigned</div>
          <div className="mt-0.5 text-gray-900 dark:text-gray-100">
            {fmtDate(task.createdAt)}
            {task.assignedBy?.username ? <span className="text-gray-500"> · by {task.assignedBy.username}</span> : null}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Form owner{owners.length === 1 ? '' : 's'}
          </div>
          <div className="mt-0.5">
            {owners.length === 0 ? (
              <span className="text-gray-400">None assigned</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {owners.map((o, i) => (
                  <span
                    key={o.contactId || o._id || o.email || i}
                    title={[o.name, o.role, o.email, o.phone].filter(Boolean).join(' · ')}
                    className="inline-flex rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300"
                  >
                    {o.name || o.role || o.email || 'Owner'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments (existing task comment feature) */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Comments</div>
        <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
          {comments === null ? (
            <div className="text-sm text-gray-400">Loading comments…</div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-gray-400">No comments yet.</div>
          ) : (
            comments.map((c, idx) => (
              <div key={idx} className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {c.createdBy?.username || 'User'}
                    <span className="ml-1.5 font-normal text-gray-400">{roleLabel(c.createdBy?.role)}</span>
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.text}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex items-start gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows="2"
            placeholder="Add a comment…"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
          />
          <button
            onClick={addComment}
            disabled={posting || !text.trim()}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {posting ? '…' : 'Post'}
          </button>
        </div>
        {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
      </div>
    </div>
  );
};

export default TaskCardDetails;
