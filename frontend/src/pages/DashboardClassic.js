import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [counties, setCounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCounty, setUserCounty] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [assignedFrom, setAssignedFrom] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedPresets, setSavedPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [showAddCounty, setShowAddCounty] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [countyForm, setCountyForm] = useState({
    name: '',
    code: '',
    description: '',
    email: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingCounty, setDeletingCounty] = useState(null);
  const { isAccg, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAccg) {
      fetchCounties();
      loadSavedPresets();
      loadFiltersFromStorage();
    } else {
      fetchUserCounty();
      loadFiltersFromStorage();
    }
  }, [isAccg, user]);

  useEffect(() => {
    saveFiltersToStorage();
  }, [statusFilter, priorityFilter, deadlineFrom, deadlineTo, assignedFrom, assignedTo, searchTerm]);

  const fetchCounties = async () => {
    try {
      setLoading(true);
      const res = await api.get('/counties');
      setCounties(res.data);
    } catch (error) {
      console.error('Error fetching counties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCounty = async () => {
    setLoading(true);
    try {
      if (user?.countyId) {
        const res = await api.get(`/counties/${user.countyId}`);
        setUserCounty(res.data);
        navigate(`/county/${user.countyId}`);
      } else {
        console.warn('County user has no assigned countyId.');
      }
    } catch (error) {
      console.error('Error fetching user county:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem('dashboardFilters');
      if (saved) {
        const filters = JSON.parse(saved);
        setStatusFilter(filters.statusFilter || 'all');
        setPriorityFilter(filters.priorityFilter || 'all');
        setDeadlineFrom(filters.deadlineFrom || '');
        setDeadlineTo(filters.deadlineTo || '');
        setAssignedFrom(filters.assignedFrom || '');
        setAssignedTo(filters.assignedTo || '');
        setSearchTerm(filters.searchTerm || '');
      }
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const saveFiltersToStorage = () => {
    try {
      const filters = {
        statusFilter,
        priorityFilter,
        deadlineFrom,
        deadlineTo,
        assignedFrom,
        assignedTo,
        searchTerm
      };
      localStorage.setItem('dashboardFilters', JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const loadSavedPresets = () => {
    try {
      const presets = localStorage.getItem('filterPresets');
      if (presets) {
        setSavedPresets(JSON.parse(presets));
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const savePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }

    const preset = {
      id: Date.now().toString(),
      name: presetName,
      filters: {
        statusFilter,
        priorityFilter,
        deadlineFrom,
        deadlineTo,
        assignedFrom,
        assignedTo,
        searchTerm
      }
    };

    const updatedPresets = [...savedPresets, preset];
    setSavedPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
    setPresetName('');
    setShowSavePreset(false);
  };

  const loadPreset = (preset) => {
    setStatusFilter(preset.filters.statusFilter || 'all');
    setPriorityFilter(preset.filters.priorityFilter || 'all');
    setDeadlineFrom(preset.filters.deadlineFrom || '');
    setDeadlineTo(preset.filters.deadlineTo || '');
    setAssignedFrom(preset.filters.assignedFrom || '');
    setAssignedTo(preset.filters.assignedTo || '');
    setSearchTerm(preset.filters.searchTerm || '');
  };

  const deletePreset = (presetId) => {
    const updatedPresets = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updatedPresets);
    localStorage.setItem('filterPresets', JSON.stringify(updatedPresets));
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setDeadlineFrom('');
    setDeadlineTo('');
    setAssignedFrom('');
    setAssignedTo('');
    setSearchTerm('');
  };

  const handleAddCounty = async (e) => {
    e.preventDefault();
    try {
      await api.post('/counties', countyForm);
      const countyCode = countyForm.code.toLowerCase();
      const userEmail = `${countyCode}county@civisight.org`;
      setCountyForm({ name: '', code: '', description: '', email: '' });
      setShowAddForm(false);
      fetchCounties();
      alert(`County created successfully!\n\nCounty user credentials:\nEmail: ${userEmail}\nPassword: county123`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating county');
    }
  };

  const handleDeleteCounty = async (countyId, countyName) => {
    if (!window.confirm(`Are you sure you want to delete "${countyName}"? This will also delete all associated tasks.`)) {
      return;
    }
    
    setDeletingCounty(countyId);
    try {
      await api.delete(`/counties/${countyId}`);
      fetchCounties();
      alert('County deleted successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting county');
    } finally {
      setDeletingCounty(null);
    }
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
      const tasks = res.data || [];

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

      const rows = tasks.map((task) => {
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
      link.setAttribute(
        'download',
        `civisight-counties-tasks-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(error.response?.data?.message || 'Error exporting data');
    } finally {
      setExporting(false);
      setShowOptionsMenu(false);
    }
  };

  const filteredCounties = counties.filter((county) => {
    const matchesSearch = county.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      county.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    const stats = county.taskStats || { total: 0, pending: 0, inProgress: 0, completed: 0 };
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'pending' && stats.pending > 0) return matchesSearch;
    if (statusFilter === 'in_progress' && stats.inProgress > 0) return matchesSearch;
    if (statusFilter === 'completed' && stats.completed > 0) return matchesSearch;
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isAccg ? 'Association of County Commissioners of Georgia' : (userCounty?.name || 'Dashboard')}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isAccg ? 'County Management and Compliance Portal' : 'Your Task Management Dashboard'}
          </p>
        </div>
        {isAccg && (
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/users')}
              className="px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-700 text-sm font-medium text-purple-700 dark:text-purple-400 bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-600 flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manage Users
            </button>
            <button
              onClick={() => setShowAddCounty(true)}
              className="px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-700 text-sm font-medium text-blue-700 dark:text-blue-400 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600 flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Manage Counties
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                title="More options"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
              {showOptionsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 transition-colors">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    disabled={exporting}
                  >
                    {exporting ? 'Exporting…' : 'Export to Excel'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      {isAccg && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 transition-colors">
          <div className="flex flex-col gap-4">
            {/* Basic Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search counties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {showAdvancedFilters ? 'Hide' : 'Advanced'} Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="border-t border-gray-200 pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Deadline Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deadline Date Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={deadlineFrom}
                        onChange={(e) => setDeadlineFrom(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        placeholder="From"
                      />
                      <input
                        type="date"
                        value={deadlineTo}
                        onChange={(e) => setDeadlineTo(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        placeholder="To"
                      />
                    </div>
                  </div>

                  {/* Assigned Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assigned Date Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={assignedFrom}
                        onChange={(e) => setAssignedFrom(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        placeholder="From"
                      />
                      <input
                        type="date"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                        placeholder="To"
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Presets */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Saved Filter Presets
                    </label>
                    <button
                      onClick={() => setShowSavePreset(!showSavePreset)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      {showSavePreset ? 'Cancel' : '+ Save Current Filters'}
                    </button>
                  </div>

                  {showSavePreset && (
                    <div className="mb-3 flex gap-2">
                      <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Enter preset name..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                      />
                      <button
                        onClick={savePreset}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {savedPresets.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {savedPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors"
                        >
                          <button
                            onClick={() => loadPreset(preset)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="text-red-600 hover:text-red-800 text-xs"
                            title="Delete preset"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No saved presets</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* County Cards - Only show for admin */}
      {isAccg ? (
        filteredCounties.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No counties found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCounties.map((county) => {
              const stats = county.taskStats || { total: 0, pending: 0, inProgress: 0, completed: 0, unreadComments: 0 };
              const hasUnreadComments = stats.unreadComments > 0;
              return (
                <div
                  key={county._id}
                  onClick={() => navigate(`/county/${county._id}`)}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all cursor-pointer relative"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{county.name}</h3>
                    {hasUnreadComments && (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{county.code}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Total Tasks</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{stats.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                      <div className="flex gap-2">
                        {stats.pending > 0 && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor('pending')}`}>
                            {stats.pending} Pending
                          </span>
                        )}
                        {stats.inProgress > 0 && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor('in_progress')}`}>
                            {stats.inProgress} In Progress
                          </span>
                        )}
                        {stats.completed > 0 && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor('completed')}`}>
                            {stats.completed} Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* County User - Redirecting to their county page */
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
          </div>
        </div>
      )}

      {/* Manage Counties Modal */}
      {showAddCounty && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl p-8 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Counties</h3>
              <button
                onClick={() => {
                  setShowAddCounty(false);
                  setShowAddForm(false);
                  setCountyForm({ name: '', code: '', description: '', email: '' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Add County Button */}
            <div className="mb-6">
              {!showAddForm ? (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New County
                </button>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-gray-50 dark:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Add New County</h4>
                    <button
                      onClick={() => {
                        setShowAddForm(false);
                        setCountyForm({ name: '', code: '', description: '', email: '' });
                      }}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <form onSubmit={handleAddCounty} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        County Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={countyForm.name}
                        onChange={(e) => setCountyForm({ ...countyForm, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        placeholder="e.g., Fulton County"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        County Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={countyForm.code}
                        onChange={(e) => setCountyForm({ ...countyForm, code: e.target.value.toUpperCase() })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        placeholder="e.g., FULTON"
                        maxLength={20}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique code for the county (uppercase)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={countyForm.description}
                        onChange={(e) => setCountyForm({ ...countyForm, description: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        rows="3"
                        placeholder="Brief description of the county"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={countyForm.email}
                        onChange={(e) => setCountyForm({ ...countyForm, email: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        placeholder="county@example.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email address for task reminders (optional)</p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 font-medium transition-colors shadow-sm"
                      >
                        Create County
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setCountyForm({ name: '', code: '', description: '', email: '' });
                        }}
                        className="flex-1 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Counties List */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Existing Counties</h4>
              {counties.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No counties found. Add your first county above.</p>
              ) : (
                <div className="space-y-3">
                  {counties.map((county) => {
                    const stats = county.taskStats || { total: 0, pending: 0, inProgress: 0, completed: 0 };
                    return (
                      <div
                        key={county._id}
                        className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h5 className="text-lg font-semibold text-gray-900 dark:text-white">{county.name}</h5>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {county.code}
                            </span>
                          </div>
                          {county.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{county.description}</p>
                          )}
                          {county.email && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              <span className="font-medium">Email:</span> {county.email}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="text-gray-500 dark:text-gray-400">Total Tasks: <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.total}</span></span>
                            {stats.pending > 0 && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">
                                {stats.pending} Pending
                              </span>
                            )}
                            {stats.inProgress > 0 && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                                {stats.inProgress} In Progress
                              </span>
                            )}
                            {stats.completed > 0 && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">
                                {stats.completed} Completed
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteCounty(county._id, county.name)}
                          disabled={deletingCounty === county._id}
                          className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {deletingCounty === county._id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

