import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TypeBadge from '../components/TypeBadge';
import StatusPill from '../components/StatusPill';
import {
  submissions,
  entitiesById,
  filingTypesById,
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS_PLURAL,
  formatDate
} from '../mockData';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'under_review', label: 'Under review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'returned', label: 'Returned' }
];

const TYPE_FILTERS = ['all', ENTITY_TYPES.COUNTY, ENTITY_TYPES.CITY, ENTITY_TYPES.AUTHORITY];

const DcaSubmissions = () => {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const entity = entitiesById[s.entityId];
      if (statusTab !== 'all' && s.status !== statusTab) return false;
      if (typeFilter !== 'all' && entity.type !== typeFilter) return false;
      return true;
    });
  }, [statusTab, typeFilter]);

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Submissions</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Filings received from counties, cities, and authorities.
        </p>
      </div>

      {/* Filter tabs + entity-type filter */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                statusTab === tab.value
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t === 'all' ? 'All types' : ENTITY_TYPE_LABELS_PLURAL[t]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No submissions in this view.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entity</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Form</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitter</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((s) => {
                  const entity = entitiesById[s.entityId];
                  const filing = filingTypesById[s.filingId];
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/dca/submissions/${s.id}`)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{entity.name}</span>
                          <TypeBadge type={entity.type} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{filing.title}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(s.submittedAt)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{s.submitter}</td>
                      <td className="px-5 py-4 whitespace-nowrap"><StatusPill status={s.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DcaSubmissions;
