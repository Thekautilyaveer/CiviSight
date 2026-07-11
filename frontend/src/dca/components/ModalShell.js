import React from 'react';

// Shared modal chrome — matches the existing app's fixed-overlay + centered white card pattern.
const ModalShell = ({ title, onClose, children, maxWidth = 'max-w-2xl' }) => (
  <div className="fixed inset-0 bg-gray-900 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
    <div className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto p-8 transition-colors`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h3>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default ModalShell;
