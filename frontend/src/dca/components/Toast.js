import React from 'react';

const Toast = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-colors">
      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
      </svg>
      {message}
    </div>
  );
};

export default Toast;
