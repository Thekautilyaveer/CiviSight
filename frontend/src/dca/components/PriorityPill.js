import React from 'react';

const PRIORITY_CLASSES = {
  low: 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
  medium: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  high: 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
};

const PriorityPill = ({ priority, className = '' }) => (
  <span
    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${PRIORITY_CLASSES[priority] || PRIORITY_CLASSES.medium} ${className}`}
  >
    {priority}
  </span>
);

export default PriorityPill;
