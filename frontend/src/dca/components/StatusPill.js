import React from 'react';

const STATUS_CLASSES = {
  completed: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  in_progress: 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  pending: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  submitted: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  under_review: 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
  received: 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
  accepted: 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  returned: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
};

const StatusPill = ({ status, className = '' }) => (
  <span
    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${STATUS_CLASSES[status] || STATUS_CLASSES.pending} ${className}`}
  >
    {status.replace('_', ' ')}
  </span>
);

export default StatusPill;
