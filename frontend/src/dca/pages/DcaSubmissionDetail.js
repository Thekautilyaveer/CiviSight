import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import StatusPill from '../components/StatusPill';
import TypeBadge from '../components/TypeBadge';
import { useDcaUI } from '../DcaUIContext';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');
const roleLabel = (r) => (r === 'accg' ? 'ACCG' : r === 'dca' ? 'DCA' : 'County');

const DcaSubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { openModal, showToast } = useDcaUI();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/submissions/${submissionId}`);
      setSubmission(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission not found.');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const review = async (status) => {
    setReviewing(true);
    try {
      await api.put(`/submissions/${submissionId}/review`, { status });
      showToast(status === 'accepted' ? 'Submission accepted.' : status === 'under_review' ? 'Marked under review.' : 'Review updated.');
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update review.');
    } finally {
      setReviewing(false);
    }
  };

  const postComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      await api.post(`/submissions/${submissionId}/comments`, { fieldId: 'general', text: commentText.trim() });
      setCommentText('');
      setShowComment(false);
      showToast('Comment sent to county.');
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not send comment.');
    } finally {
      setPosting(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const res = await api.get(`/submissions/${submissionId}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(submission?.formName || 'submission').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xls`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Could not export this submission.');
    }
  };

  const backBtn = (
    <button onClick={() => navigate('/dca/submissions')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      Back to Submissions
    </button>
  );

  if (loading) {
    return (
      <div className="px-2 sm:px-4 py-2">
        {backBtn}
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  if (error || !submission) {
    return (
      <div className="px-2 sm:px-4 py-2">
        {backBtn}
        <p className="text-gray-500 dark:text-gray-400">{error || 'Submission not found.'}</p>
      </div>
    );
  }

  const s = submission;
  const online = s.formType === 'online';
  const answerRows = online
    ? Object.entries(s.answers || {}).map(([key, value]) => {
        const f = (s.metadata?.fields || {})[key] || {};
        return { key, label: f.label || key, value, page: f.page, cell: f.cell };
      })
    : [];

  return (
    <div className="px-2 sm:px-4 py-2 max-w-4xl">
      {backBtn}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{s.countyId?.name || 'Unknown county'}</h1>
              <TypeBadge type="county" />
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{s.formName || s.taskId?.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Submitted by {s.submittedBy?.username || 'county user'} · {fmtDateTime(s.submittedAt)}
              {' · '}{online ? 'Online form' : 'Uploaded file'}
            </p>
          </div>
          <StatusPill status={s.status} />
        </div>
        {s.reviewNote && (
          <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Review note</div>
            <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{s.reviewNote}</p>
          </div>
        )}
      </div>

      {/* Submitted data */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Submitted Data</h2>
          {online && (
            <button onClick={downloadExcel} className="text-sm font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400">
              Download Excel
            </button>
          )}
        </div>
        {online ? (
          answerRows.length === 0 ? (
            <p className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">No answers recorded.</p>
          ) : (
            <dl className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[28rem] overflow-y-auto">
              {answerRows.map((f) => (
                <div key={f.key} className="px-6 py-3 flex items-center justify-between gap-4">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {f.label}
                    {(f.cell || f.page) && (
                      <span className="ml-2 text-[10.5px] uppercase tracking-wide text-gray-400">{[f.page, f.cell].filter(Boolean).join(' · ')}</span>
                    )}
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900 dark:text-white text-right break-words">{String(f.value ?? '')}</dd>
                </div>
              ))}
            </dl>
          )
        ) : (
          <div className="px-6 py-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{s.file?.originalName || 'Submitted file'}</div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The uploaded form is stored with the task submission record.</p>
          </div>
        )}
      </div>

      {/* Comments (real, field-level) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Comments to county</h2>
        </div>
        <div className="p-6">
          {(!s.comments || s.comments.length === 0) ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No comments sent yet.</p>
          ) : (
            <div className="space-y-3">
              {s.comments.map((c, idx) => (
                <div key={c._id || idx} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {c.createdBy?.username || 'User'}
                      <span className="ml-1.5 font-normal text-gray-400">{roleLabel(c.createdBy?.role)}</span>
                      {c.fieldId && c.fieldId !== 'general' && (
                        <span className="ml-2 text-[10.5px] uppercase tracking-wide text-gray-400">on {c.fieldId}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDateTime(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
            </div>
          )}

          {showComment && (
            <div className="mt-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows="3"
                placeholder="Write a note to the county about this submission…"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setShowComment(false); setCommentText(''); }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                  Cancel
                </button>
                <button onClick={postComment} disabled={posting || !commentText.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
                  {posting ? 'Sending…' : 'Send to county'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review actions (agency only — DCA) */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => review('accepted')}
          disabled={reviewing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
          </svg>
          Accept
        </button>
        <button
          onClick={() => review('under_review')}
          disabled={reviewing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors border border-gray-300 dark:border-gray-600 disabled:opacity-50"
        >
          Mark under review
        </button>
        <button
          onClick={() => openModal('returnForCorrection', {
            submissionId,
            submissionLabel: `${s.countyId?.name || 'County'} — ${s.formName || s.taskId?.title || ''}`,
            onReturned: load
          })}
          disabled={reviewing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4" />
          </svg>
          Return for correction
        </button>
        <button
          onClick={() => setShowComment((v) => !v)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors border border-gray-300 dark:border-gray-600"
        >
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Add comment
        </button>
      </div>
    </div>
  );
};

export default DcaSubmissionDetail;
