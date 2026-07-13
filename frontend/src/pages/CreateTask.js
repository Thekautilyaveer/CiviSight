import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { DEPARTMENT_ROLES } from '../constants/departmentRoles';

const CreateTask = () => {
  const [counties, setCounties] = useState([]);
  const submittedToOptions = [
    'Georgia Department of Community Affairs (DCA)',
    'Georgia Department of Audits and Accounts (DOAA)',
    'Federal Audit Clearinghouse (FAC)',
    'Georgia Office of Planning and Budget (OPB)',
    'State Records Committee',
    'Other'
  ];
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    countyIds: [],
    deadline: '',
    priority: 'medium',
    submittedToSelect: '',
    submittedToOther: '',
    portalLink: '',
    assignedRoles: []
  });
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [deadlineMode, setDeadlineMode] = useState('date');
  const [deadlinePreset, setDeadlinePreset] = useState(null);
  const [formFile, setFormFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchCounties();
  }, []);

  const fetchCounties = async () => {
    try {
      const res = await api.get('/counties');
      setCounties(res.data);
    } catch (error) {
      console.error('Error fetching counties:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (taskForm.countyIds.length === 0) {
      showToast('Please select at least one county', 'error');
      return;
    }

    const finalSubmittedTo =
      taskForm.submittedToSelect === 'Other'
        ? taskForm.submittedToOther.trim()
        : taskForm.submittedToSelect;

    if (!finalSubmittedTo) {
      showToast('Please select who this task is submitted to.', 'error');
      return;
    }

    const useFiscalPreset = deadlineMode === 'fiscal_preset' && deadlinePreset != null;
    if (!useFiscalPreset && !taskForm.deadline) {
      showToast('Please choose a deadline (specific date or fiscal year preset).', 'error');
      return;
    }

    setUploading(true);
    try {
      const payload = {
        ...taskForm,
        submittedTo: finalSubmittedTo,
        portalLink: (taskForm.portalLink && taskForm.portalLink.trim()) || undefined,
        assignedRoles: Array.isArray(taskForm.assignedRoles) ? taskForm.assignedRoles : []
      };
      if (useFiscalPreset) {
        payload.deadlineType = 'fiscal_year_offset';
        payload.deadlineOffsetDays = deadlinePreset;
        delete payload.deadline;
      } else {
        payload.deadline = new Date(taskForm.deadline).toISOString();
      }
      const response = await api.post('/tasks/bulk', payload);

      // Upload form file if provided (to all tasks)
      if (formFile && response.data.tasks && response.data.tasks.length > 0) {
        const formData = new FormData();
        formData.append('formFile', formFile);
        
        const token = localStorage.getItem('token');
        let uploadSuccessCount = 0;
        let uploadErrors = [];
        
        // Upload to all tasks
        for (let i = 0; i < response.data.tasks.length; i++) {
          try {
            const uploadResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/tasks/${response.data.tasks[i]._id}/upload-form`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });
            
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json().catch(() => ({ message: 'Upload failed' }));
              uploadErrors.push(`Task ${i + 1}: ${errorData.message || 'Upload failed'}`);
              // console.error(`Failed to upload form for task ${response.data.tasks[i]._id}:`, errorData);
            } else {
              uploadSuccessCount++;
            }
          } catch (uploadError) {
            uploadErrors.push(`Task ${i + 1}: ${uploadError.message || 'Network error'}`);
            // console.error(`Error uploading form for task ${response.data.tasks[i]._id}:`, uploadError);
          }
        }
        
        if (uploadErrors.length > 0) {
          showToast(`Tasks created successfully! However, ${uploadErrors.length} file upload(s) failed. ${uploadSuccessCount} upload(s) succeeded.`, 'error');
        } else {
          showToast('Tasks created and files uploaded successfully!', 'success');
        }
      } else {
        showToast('Tasks created successfully!', 'success');
      }
      
      navigate('/dashboard');
    } catch (error) {
      showToast(error.response?.data?.message || 'Error creating tasks', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCountyToggle = (countyId) => {
    setTaskForm((prev) => ({
      ...prev,
      countyIds: prev.countyIds.includes(countyId)
        ? prev.countyIds.filter((id) => id !== countyId)
        : [...prev.countyIds, countyId],
    }));
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create Task</h1>
        <p className="mt-2 text-sm text-gray-600">Assign a new task to one or more counties</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="4"
              placeholder="Enter task description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Counties *
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
              {counties.length === 0 ? (
                <p className="text-gray-500 text-sm">No counties available</p>
              ) : (
                counties.map((county) => (
                  <label
                    key={county._id}
                    className="flex items-center space-x-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={taskForm.countyIds.includes(county._id)}
                      onChange={() => handleCountyToggle(county._id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-900">{county.name}</span>
                  </label>
                ))
              )}
            </div>
            {taskForm.countyIds.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                {taskForm.countyIds.length} county{taskForm.countyIds.length !== 1 ? 'ies' : ''} selected
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline *
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deadlineMode"
                    checked={deadlineMode === 'date'}
                    onChange={() => setDeadlineMode('date')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Specific date</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deadlineMode"
                    checked={deadlineMode === 'fiscal_preset'}
                    onChange={() => setDeadlineMode('fiscal_preset')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">Based on fiscal year end</span>
                </label>
              </div>
              {deadlineMode === 'date' ? (
                <input
                  type="datetime-local"
                  value={taskForm.deadline}
                  onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <select
                  value={deadlinePreset ?? ''}
                  onChange={(e) => setDeadlinePreset(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select option</option>
                  <option value="60">60 days after fiscal year ends</option>
                  <option value="90">Three months after fiscal year ends</option>
                  <option value="180">Six months after fiscal year ends</option>
                  <option value="270">Nine months after fiscal year ends</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority *
              </label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link to portal (Optional)
            </label>
            <input
              type="url"
              value={taskForm.portalLink}
              onChange={(e) => setTaskForm({ ...taskForm, portalLink: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Link where counties can fill the form online if no PDF is uploaded
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visible to roles (optional)
            </label>
            <p className="mb-2 text-xs text-gray-500">
              Only county users with at least one of these roles will see this task. Leave empty for all county users.
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleDropdown((prev) => !prev)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <span className="text-sm text-gray-900">
                  {taskForm.assignedRoles.length === 0
                    ? 'All county users'
                    : taskForm.assignedRoles.length === 1
                    ? DEPARTMENT_ROLES.find((r) => r.slug === taskForm.assignedRoles[0])?.label || '1 role selected'
                    : `${taskForm.assignedRoles.length} roles selected`}
                </span>
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showRoleDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {DEPARTMENT_ROLES.map(({ slug, label }) => {
                    const checked = taskForm.assignedRoles.includes(slug);
                    return (
                      <label
                        key={slug}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setTaskForm((prev) => ({
                              ...prev,
                              assignedRoles: e.target.checked
                                ? [...prev.assignedRoles, slug]
                                : prev.assignedRoles.filter((r) => r !== slug)
                            }));
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-900">{label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Submitted To *
            </label>
            <select
              value={taskForm.submittedToSelect}
              onChange={(e) =>
                setTaskForm((prev) => ({
                  ...prev,
                  submittedToSelect: e.target.value,
                  // Clear custom text when switching away from Other
                  submittedToOther:
                    e.target.value === 'Other' ? prev.submittedToOther : ''
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select Agency</option>
              {submittedToOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {taskForm.submittedToSelect === 'Other' && (
              <input
                type="text"
                value={taskForm.submittedToOther}
                onChange={(e) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    submittedToOther: e.target.value
                  }))
                }
                className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter the agency or recipient"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Form File (Optional)
            </label>
            <input
              type="file"
              onChange={(e) => setFormFile(e.target.files[0])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
            />
            <p className="mt-1 text-xs text-gray-500">
              Upload a form file that counties can download and fill out
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={uploading || taskForm.countyIds.length === 0}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTask;

