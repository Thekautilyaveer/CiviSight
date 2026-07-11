import React, { useState } from 'react';
import ModalShell from '../components/ModalShell';
import TypeBadge from '../components/TypeBadge';
import { useDcaUI } from '../DcaUIContext';
import { entities, ENTITY_TYPES, ENTITY_TYPE_LABELS_PLURAL, tasksByEntityId } from '../mockData';

const FILTERS = ['all', ENTITY_TYPES.COUNTY, ENTITY_TYPES.CITY, ENTITY_TYPES.AUTHORITY];

const ManageEntitiesModal = () => {
  const { closeModal, openModal, showToast } = useDcaUI();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? entities : entities.filter((e) => e.type === filter);

  return (
    <ModalShell title="Manage Entities" onClose={closeModal} maxWidth="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          onClick={() => openModal('addEntity')}
          className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Entity
        </button>
        <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : ENTITY_TYPE_LABELS_PLURAL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {filtered.map((entity) => {
          const taskCount = tasksByEntityId(entity.id).length;
          return (
            <div
              key={entity.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h5 className="text-base font-semibold text-gray-900 dark:text-white truncate">{entity.name}</h5>
                  <TypeBadge type={entity.type} />
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium rounded">
                    {entity.code}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{taskCount} DCA {taskCount === 1 ? 'filing' : 'filings'} tracked</p>
              </div>
              <button
                onClick={() => showToast(`${entity.name} deleted (preview only — not saved)`)}
                className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
};

export default ManageEntitiesModal;
