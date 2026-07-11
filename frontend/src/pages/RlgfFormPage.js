import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import RlgfForm from '../forms/rlgf/RlgfForm';

// Full-page host for the RLGF online form. Renders inside CiviSight's <Layout>,
// so the CiviSight header/logo stays on top; the schema-driven form fills the
// area below, exactly as rendered standalone.
const RlgfFormPage = () => {
  const { id } = useParams();
  const [countyName, setCountyName] = useState('');

  useEffect(() => {
    let active = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    api
      .get(`/counties/${id}`)
      .then((res) => { if (active) setCountyName(res.data?.name || ''); })
      .catch(() => {});
    return () => { active = false; };
  }, [id]);

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
      </div>

      <RlgfForm subtitle={countyName ? `${countyName} · Report of Local Government Finance` : 'Report of Local Government Finance'} />
    </div>
  );
};

export default RlgfFormPage;
