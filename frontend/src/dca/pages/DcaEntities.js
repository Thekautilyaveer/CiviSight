import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TypeBadge from '../components/TypeBadge';
import { useDcaUI } from '../DcaUIContext';
import { entities, tasks, ENTITY_TYPES, ENTITY_TYPE_LABELS_PLURAL, urgencyFor } from '../mockData';

const TYPE_FILTERS = ['all', ENTITY_TYPES.COUNTY, ENTITY_TYPES.CITY, ENTITY_TYPES.AUTHORITY];

const DcaEntities = () => {
  const navigate = useNavigate();
  const { openModal } = useDcaUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const initialType = searchParams.get('type');
  const [typeFilter, setTypeFilter] = useState(
    TYPE_FILTERS.includes(initialType) ? initialType : 'all'
  );

  useEffect(() => {
    const urlType = searchParams.get('type');
    if (urlType && TYPE_FILTERS.includes(urlType)) setTypeFilter(urlType);
  }, [searchParams]);

  const handleTypeFilter = (t) => {
    setTypeFilter(t);
    if (t === 'all') {
      searchParams.delete('type');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ type: t });
    }
  };

  const rows = useMemo(() => {
    return entities
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map((entity) => {
        const entityTasks = tasks.filter((t) => t.entityId === entity.id);
        const pending = entityTasks.filter((t) => t.status !== 'completed');
        const overdue = pending.filter((t) => urgencyFor(t.deadline, t.status).level === 'over');
        const nearestOverdue = overdue.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
        return { entity, pendingCount: pending.length, overdueCount: overdue.length, nearestOverdue };
      });
  }, [typeFilter, searchTerm]);

  const attention = rows.filter((r) => r.overdueCount > 0).sort((a, b) =>
    new Date(a.nearestOverdue.deadline) - new Date(b.nearestOverdue.deadline)
  );
  const upToDate = rows.filter((r) => r.overdueCount === 0);

  return (
    <div className="px-2 sm:px-4 py-2">
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Entities</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Counties, cities, and authorities that report to DCA.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2.5 items-center">
        <button
          onClick={() => openModal('manageEntities', {})}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          Manage Entities
        </button>
        <div className="relative flex-1 min-w-[220px]">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search for an entity…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 shrink-0">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                typeFilter === t
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t === 'all' ? 'All' : ENTITY_TYPE_LABELS_PLURAL[t]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400">No entities found.</p>
        </div>
      ) : (
        <>
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
            {attention.length === 0 ? (
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                </svg>
                Nothing needs attention right now — every entity is on track.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                {attention.map(({ entity, pendingCount, nearestOverdue }) => {
                  const u = urgencyFor(nearestOverdue.deadline, nearestOverdue.status);
                  return (
                    <button
                      key={entity.id}
                      onClick={() => navigate(`/dca/entities/${entity.id}`)}
                      className="text-left flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 border-l-[3px] border-l-red-500 bg-red-50/60 dark:bg-red-900/10 px-4 py-3 transition-all hover:shadow-md hover:border-red-300"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white flex-wrap">
                          <span className="truncate">{entity.name}</span>
                          <TypeBadge type={entity.type} />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                          </svg>
                          {pendingCount} DCA {pendingCount === 1 ? 'task' : 'tasks'} to do
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          {u.text}
                        </span>
                        <span className="text-gray-400 text-lg leading-none">›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

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
                {upToDate.map(({ entity }) => (
                  <button
                    key={entity.id}
                    onClick={() => navigate(`/dca/entities/${entity.id}`)}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-2 text-sm font-semibold hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                  >
                    <svg className="w-4 h-4 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                    </svg>
                    <span className="text-gray-900 dark:text-white">{entity.name}</span>
                    <TypeBadge type={entity.type} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default DcaEntities;
