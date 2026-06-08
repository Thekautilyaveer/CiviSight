import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Chatbot from './Chatbot';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const createCsvValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await api.get('/tasks');
      const allTasks = res.data || [];

      const header = [
        'County Name',
        'County Code',
        'Task Title',
        'Task Description',
        'Priority',
        'Status',
        'Assigned Date',
        'Deadline',
        'Completion Date'
      ];

      const rows = allTasks.map((task) => {
        const countyName = task.countyId?.name || '';
        const countyCode = task.countyId?.code || '';
        const assignedDate = task.createdAt ? new Date(task.createdAt).toISOString() : '';
        const deadline = task.deadline ? new Date(task.deadline).toISOString() : '';
        const completionDate =
          task.status === 'completed' && task.updatedAt
            ? new Date(task.updatedAt).toISOString()
            : '';

        return [
          countyName,
          countyCode,
          task.title,
          task.description || '',
          task.priority || '',
          task.status || '',
          assignedDate,
          deadline,
          completionDate
        ]
          .map(createCsvValue)
          .join(',');
      });

      const csvContent = [header.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `civisight-counties-tasks-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.response?.data?.message || 'Error exporting data');
    } finally {
      setExporting(false);
    }
  };

  const getLinkClasses = (path) => {
    const isActive = location.pathname === path;
    return isActive
      ? "border-blue-500 dark:border-blue-400 text-gray-900 dark:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
      : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium";
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <nav className="bg-white dark:bg-gray-800 shadow-lg transition-colors">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dashboard" className="flex items-center gap-2.5">
                  <img 
                    src="/logo.png" 
                    alt="CiviSight" 
                    className="h-9 w-auto"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span className="text-xl font-semibold text-gray-900 dark:text-white">
                    CiviSight
                  </span>
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {isAdmin ? (
                  <>
                    <Link
                      to="/dashboard"
                      className={getLinkClasses('/dashboard')}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/track-by-counties"
                      className={getLinkClasses('/track-by-counties')}
                    >
                      Track by Counties
                    </Link>
                    <Link
                      to="/reminders"
                      className={getLinkClasses('/reminders')}
                    >
                      Reminders
                    </Link>
                    <Link
                      to="/notifications"
                      className={getLinkClasses('/notifications')}
                    >
                      Notifications
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to={user?.countyId ? `/county/${user.countyId}` : '/dashboard'}
                      className={getLinkClasses(user?.countyId ? `/county/${user.countyId}` : '/dashboard')}
                    >
                      My Tasks
                    </Link>
                    {user?.countyId && (
                      <>
                        <Link
                          to={`/county/${user.countyId}/contacts`}
                          className={getLinkClasses(`/county/${user.countyId}/contacts`)}
                        >
                          Contacts
                        </Link>
                        <Link
                          to={`/county/${user.countyId}/formpilot`}
                          className={getLinkClasses(`/county/${user.countyId}/formpilot`)}
                        >
                          FormPilot
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/users')}
                    title="Manage Users"
                    aria-label="Manage Users"
                    className="hidden md:inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    title="Export to Excel"
                    aria-label="Export to Excel"
                    className="hidden md:inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {exporting ? (
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    )}
                  </button>
                </>
              )}
              <div className="flex-shrink-0">
                <span className="text-sm text-gray-700 dark:text-gray-300 mr-4">
                  {user?.username} ({user?.role === 'admin' ? 'Admin' : 'County User'})
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
      <Chatbot />
    </div>
  );
};

export default Layout;

