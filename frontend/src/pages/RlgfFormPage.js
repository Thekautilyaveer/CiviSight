import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import RlgfForm from '../forms/rlgf/RlgfForm';

// Full-page host for the RLGF online form. Renders inside CiviSight's <Layout>,
// so the CiviSight header/logo stays on top; the schema-driven form fills the
// area below, exactly as rendered standalone.
const RlgfFormPage = () => {
  const { id, taskId } = useParams();
  const [countyName, setCountyName] = useState('');
  const [task, setTask] = useState(null);
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get(`/counties/${id}`)
      .then((res) => { if (active) setCountyName(res.data?.name || ''); })
      .catch(() => {});
    if (taskId) {
      api
        .get(`/tasks/${taskId}`)
        .then((res) => { if (active) setTask(res.data || null); })
        .catch(() => {});
      api
        .get(`/submissions?taskId=${taskId}`)
        .then((res) => { if (active) setSubmission(res.data?.[0] || null); })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [id, taskId]);

  const handleSubmit = async (payload) => {
    const res = await api.post(`/tasks/${taskId}/submit-online`, {
      ...payload,
      formName: task?.title || 'Report of Local Government Finance',
      metadata: {
        ...(payload.metadata || {}),
        submittedFrom: 'rlgf_form'
      }
    });
    setSubmission(res.data?.submission || null);
    return res.data?.submission;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/county/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to tasks
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500">
            Report of Local Government Finance{countyName ? ` · ${countyName}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <a href="https://dca.georgia.gov/community-assistance/government-authority-reporting/report-local-government-finance-rlgf/rlgf" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            Official DCA RLGF page
          </a>
          <a href="https://dca.georgia.gov/document/publications/instructions-reports-covering-fiscal-year-ending-2016-or-future-years-pdf/download" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
            Instructions
          </a>
        </div>
      </div>

      {submission?.comments?.length > 0 && (
        <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Agency review comments</h2>
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold">{submission.comments.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {submission.comments.map((comment, index) => (
              <div key={`${comment.createdAt || 'comment'}-${index}`} className="border-t border-amber-200 pt-2 text-sm">
                <div className="font-semibold">{submission.metadata?.fields?.[comment.fieldId]?.label || comment.fieldId}</div>
                <div className="mt-0.5">{comment.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <RlgfForm
        subtitle={countyName ? `${countyName} · Report of Local Government Finance` : 'Report of Local Government Finance'}
        onSubmit={handleSubmit}
        fieldComments={(submission?.comments || []).reduce((grouped, comment) => {
          if (!grouped[comment.fieldId]) grouped[comment.fieldId] = [];
          grouped[comment.fieldId].push(comment);
          return grouped;
        }, {})}
      />
    </div>
  );
};

export default RlgfFormPage;
