import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ChatPanel from './components/ChatPanel';
import { useDcaUI } from './DcaUIContext';

const NAV_LINKS = [
  { to: '/dca', label: 'Dashboard' },
  { to: '/dca/entities', label: 'Entities' },
  { to: '/dca/submissions', label: 'Submissions' },
  { to: '/dca/reminders', label: 'Reminders' },
  { to: '/dca/add-report', label: 'Add Report' }
];

const DcaLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useDcaUI();
  const [chatOpen, setChatOpen] = useState(false);

  const getLinkClasses = (path) => {
    // /dca/entities/:id should keep the Entities tab highlighted.
    const isActive = path === '/dca' ? location.pathname === '/dca' : location.pathname.startsWith(path);
    return isActive
      ? 'border-blue-500 dark:border-blue-400 text-gray-900 dark:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
      : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <nav className="bg-white dark:bg-gray-800 shadow-lg transition-colors">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dca" className="flex items-center gap-2.5">
                  <img
                    src="/logo.png"
                    alt="CiviSight"
                    className="h-9 w-auto"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span
                    className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight"
                    style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
                  >
                    CiviSight
                  </span>
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {NAV_LINKS.map((link) => (
                  <Link key={link.to} to={link.to} className={getLinkClasses(link.to)}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dca/users')}
                title="User management"
                aria-label="User management"
                className="hidden md:inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </button>
              <button
                onClick={() => showToast('Export CSV (preview only — not wired up)')}
                title="Export to CSV"
                aria-label="Export to CSV"
                className="hidden md:inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-4">dca (State Agency)</span>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="py-6 px-4 sm:px-6 lg:px-8">{children}</main>

      <button
        onClick={() => setChatOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
        aria-label="Open chatbot"
      >
        {chatOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </div>
  );
};

export default DcaLayout;
