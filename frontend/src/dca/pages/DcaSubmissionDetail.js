import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TypeBadge from '../components/TypeBadge';
import StatusPill from '../components/StatusPill';
import { useDcaUI } from '../DcaUIContext';
import { submissionsById, entitiesById, filingTypesById, formatDate } from '../mockData';

const DcaSubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { openModal, showToast } = useDcaUI();
  const submission = submissionsById[submissionId];
  const [showCommentBox, setShowCommentBox] = useState(false);

  if (!submission) {
    return (
      <div className="px-4 py-6">
        <button onClick={() => navigate('/dca/submissions')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Submissions
        </button>
        <p className="text-gray-500 dark:text-gray-400">Submission not found.</p>
      </div>
    );
  }

  const entity = entitiesById[submission.entityId];
  const filing = filingTypesById[submission.filingId];

  return (
    <div className="px-2 sm:px-4 py-2 max-w-4xl">
      <button onClick={() => navigate('/dca/submissions')} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Submissions
      </button>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{entity.name}</h1>
              <TypeBadge type={entity.type} />
            </div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{filing.title}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Submitted by {submission.submitter} · {formatDate(submission.submittedAt)}
            </p>
          </div>
          <StatusPill status={submission.status} />
        </div>
      </div>

      {/* Submitted data panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Submitted Data</h2>
        </div>
        <dl className="divide-y divide-gray-100 dark:divide-gray-700">
          {submission.fields.map((field) => (
            <div key={field.label} className="px-6 py-3 flex items-center justify-between gap-4">
              <dt className="text-sm text-gray-500 dark:text-gray-400">{field.label}</dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white text-right">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Validation flags panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Validation Flags</h2>
        </div>
        <div className="p-6">
          {submission.flags.length === 0 ? (
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
              No flags — this submission passed all Tier-1 checks.
            </div>
          ) : (
            <div className="space-y-3">
              {submission.flags.map((flag, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                    flag.level === 'red'
                      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50'
                      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50'
                  }`}
                >
                  <svg className={`w-5 h-5 shrink-0 ${flag.level === 'red' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                  <p className={`text-sm ${flag.level === 'red' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {flag.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline comment box (toggled by Add comment) */}
      {showCommentBox && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 p-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Add a comment</label>
          <textarea
            rows="3"
            placeholder="Write a note about this submission…"
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setShowCommentBox(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
            <button
              onClick={() => { setShowCommentBox(false); showToast('Comment added (preview only — not saved)'); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              Post Comment
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => showToast('Submission accepted (preview only)')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
          </svg>
          Accept
        </button>
        <button
          onClick={() => openModal('returnForCorrection', { submissionLabel: `${entity.name} — ${filing.title}` })}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4" />
          </svg>
          Return for correction
        </button>
        <button
          onClick={() => setShowCommentBox((v) => !v)}
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
