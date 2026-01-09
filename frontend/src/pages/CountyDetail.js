import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const CountyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [county, setCounty] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [assignedFrom, setAssignedFrom] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    deadline: '',
    status: 'pending',
    priority: 'medium',
  });
  const [formFile, setFormFile] = useState(null);
  const [filledFormFile, setFilledFormFile] = useState(null);
  const [uploadingForm, setUploadingForm] = useState(null);
  const [uploadingFilledForm, setUploadingFilledForm] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [taskComments, setTaskComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(null);
  const [loadingComments, setLoadingComments] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchCounty();
    loadFiltersFromStorage();
  }, [id]);

  useEffect(() => {
    fetchTasks();
    saveFiltersToStorage();
  }, [id, statusFilter, priorityFilter, deadlineFrom, deadlineTo, assignedFrom, assignedTo, searchTerm]);

  // Update countdown timer every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

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
      localStorage.setItem(`countyFilters_${id}`, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem(`countyFilters_${id}`);
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

  const fetchCounty = async () => {
    try {
      const res = await api.get(`/counties/${id}`);
      setCounty(res.data);
    } catch (error) {
      console.error('Error fetching county:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      params.append('countyId', id);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (deadlineFrom) params.append('deadlineFrom', deadlineFrom);
      if (deadlineTo) params.append('deadlineTo', deadlineTo);
      if (assignedFrom) params.append('assignedFrom', assignedFrom);
      if (assignedTo) params.append('assignedTo', assignedTo);
      if (searchTerm) params.append('search', searchTerm);

      const res = await api.get(`/tasks?${params.toString()}`);
      setTasks(res.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/tasks', {
        ...taskForm,
        countyId: id,
        deadline: new Date(taskForm.deadline).toISOString(),
      });
      
      // Upload form file if provided
      if (formFile && response.data && response.data._id) {
        await handleUploadForm(response.data._id, formFile);
      }
      
      setShowAddTask(false);
      setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium' });
      setFormFile(null);
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating task');
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/tasks/${showEditTask._id}`, {
        ...taskForm,
        deadline: new Date(taskForm.deadline).toISOString(),
      });
      
      if (formFile) {
        await handleUploadForm(showEditTask._id, formFile);
      }
      
      setShowEditTask(null);
      setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium' });
      setFormFile(null);
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting task');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating task status');
    }
  };

  const handleUploadForm = async (taskId, file) => {
    if (!file) return;
    
    setUploadingForm(taskId);
    try {
      const formData = new FormData();
      formData.append('formFile', file);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/tasks/${taskId}/upload-form`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      alert('Form uploaded successfully');
      fetchTasks();
    } catch (error) {
      alert(error.message || 'Error uploading form');
    } finally {
      setUploadingForm(null);
    }
  };

  const handleUploadFilledForm = async (taskId, file) => {
    if (!file) return;
    
    setUploadingFilledForm(taskId);
    try {
      const formData = new FormData();
      formData.append('filledFormFile', file);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/tasks/${taskId}/upload-filled-form`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      alert('Filled form uploaded successfully');
      fetchTasks();
    } catch (error) {
      alert(error.message || 'Error uploading filled form');
    } finally {
      setUploadingFilledForm(null);
    }
  };

  const handleDownloadForm = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/tasks/${taskId}/download-form`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(error.message || 'Download failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'form.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Error downloading form');
    }
  };

  const handleDownloadFilledForm = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/tasks/${taskId}/download-filled-form`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(error.message || 'Download failed');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'filled-form.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Error downloading filled form');
    }
  };

  const handleSendReminder = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/reminder`);
      alert('Reminder sent successfully');
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error sending reminder');
    }
  };

  const toggleTaskExpansion = async (taskId) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      setNewComment('');
    } else {
      setExpandedTask(taskId);
      // Load comments if not already loaded
      if (!taskComments[taskId]) {
        await fetchTaskComments(taskId);
      }
    }
  };

  const fetchTaskComments = async (taskId) => {
    try {
      setLoadingComments(prev => ({ ...prev, [taskId]: true }));
      const res = await api.get(`/tasks/${taskId}/comments`);
      setTaskComments(prev => ({ ...prev, [taskId]: res.data.comments }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      alert(error.response?.data?.message || 'Error loading comments');
    } finally {
      setLoadingComments(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleAddComment = async (taskId) => {
    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    try {
      setAddingComment(taskId);
      const res = await api.post(`/tasks/${taskId}/comments`, { text: newComment.trim() });
      
      // Update comments for this task
      setTaskComments(prev => ({
        ...prev,
        [taskId]: [...(prev[taskId] || []), res.data.comment]
      }));
      
      setNewComment('');
      // Refresh tasks to show updated comment count
      fetchTasks();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert(error.response?.data?.message || 'Error adding comment');
    } finally {
      setAddingComment(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Calculate time remaining until deadline
  const getTimeRemaining = (deadline) => {
    const now = currentTime;
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;
    
    if (diff < 0) {
      // Overdue
      const daysOverdue = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
      const hoursOverdue = Math.floor((Math.abs(diff) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        overdue: true,
        days: daysOverdue,
        hours: hoursOverdue,
        totalHours: Math.floor(Math.abs(diff) / (1000 * 60 * 60)),
        totalMinutes: Math.floor(Math.abs(diff) / (1000 * 60))
      };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      overdue: false,
      days,
      hours,
      minutes,
      totalHours: Math.floor(diff / (1000 * 60 * 60)),
      totalMinutes: Math.floor(diff / (1000 * 60))
    };
  };

  // Get urgency level and styling
  const getDeadlineUrgency = (deadline, status) => {
    if (status === 'completed') {
      return { level: 'completed', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    }
    
    const timeRemaining = getTimeRemaining(deadline);
    
    if (timeRemaining.overdue) {
      return { 
        level: 'overdue', 
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        border: 'border-red-200',
        label: 'Overdue'
      };
    }
    
    if (timeRemaining.totalHours < 24) {
      // Due within 24 hours
      return { 
        level: 'urgent', 
        color: 'text-red-600', 
        bg: 'bg-red-50', 
        border: 'border-red-200',
        label: 'Due Soon'
      };
    } else if (timeRemaining.days <= 1) {
      // Due within 1 day
      return { 
        level: 'very-soon', 
        color: 'text-orange-600', 
        bg: 'bg-orange-50', 
        border: 'border-orange-200',
        label: 'Due Tomorrow'
      };
    } else if (timeRemaining.days <= 3) {
      // Due within 3 days
      return { 
        level: 'soon', 
        color: 'text-yellow-600', 
        bg: 'bg-yellow-50', 
        border: 'border-yellow-200',
        label: 'Due Soon'
      };
    }
    
    return { 
      level: 'normal', 
      color: 'text-gray-600', 
      bg: 'bg-gray-50', 
      border: 'border-gray-200',
      label: null
    };
  };

  // Format countdown timer text
  const formatCountdown = (deadline, status) => {
    if (status === 'completed') {
      return 'Completed';
    }
    
    const timeRemaining = getTimeRemaining(deadline);
    
    if (timeRemaining.overdue) {
      if (timeRemaining.days > 0) {
        return `${timeRemaining.days}d ${timeRemaining.hours}h overdue`;
      } else if (timeRemaining.hours > 0) {
        return `${timeRemaining.hours}h overdue`;
      } else {
        return `${timeRemaining.totalMinutes}m overdue`;
      }
    }
    
    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}d ${timeRemaining.hours}h remaining`;
    } else if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m remaining`;
    } else {
      return `${timeRemaining.minutes}m remaining`;
    }
  };

  const handleMarkAsRead = async (taskId, commentIndex) => {
    try {
      await api.post(`/tasks/${taskId}/comments/${commentIndex}/mark-read`);
      
      // Update the comment in local state to mark it as read
      setTaskComments(prev => {
        const updated = { ...prev };
        if (updated[taskId] && user) {
          const comments = [...updated[taskId]];
          if (!comments[commentIndex].readBy) {
            comments[commentIndex].readBy = [];
          }
          const userId = user._id || user.id;
          if (userId) {
            const alreadyRead = comments[commentIndex].readBy.some(
              readUserId => {
                const readId = readUserId._id ? readUserId._id.toString() : readUserId.toString();
                return readId === userId.toString();
              }
            );
            if (!alreadyRead) {
              comments[commentIndex].readBy.push(userId);
            }
          }
          updated[taskId] = comments;
        }
        return updated;
      });
      
      // Refresh tasks to update unread count
      fetchTasks();
    } catch (error) {
      console.error('Error marking comment as read:', error);
      alert(error.response?.data?.message || 'Error marking comment as read');
    }
  };

  const isCommentUnread = (comment) => {
    if (!isAdmin || !user) return false;
    // Comment is unread if:
    // 1. It wasn't created by the current admin
    // 2. The current admin hasn't read it yet
    const userId = user._id || user.id;
    if (!userId) return false;
    
    const createdByAdmin = comment.createdBy?._id?.toString() === userId.toString();
    const readByAdmin = comment.readBy?.some(
      readUserId => {
        const readId = readUserId._id ? readUserId._id.toString() : readUserId.toString();
        return readId === userId.toString();
      }
    );
    return !createdByAdmin && !readByAdmin;
  };

  const openEditModal = (task) => {
    setShowEditTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      deadline: new Date(task.deadline).toISOString().slice(0, 16),
      status: task.status,
      priority: task.priority || 'medium',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'pending':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const priorityColors = {
    low: 'bg-gray-100 text-gray-800 border border-gray-200',
    medium: 'bg-blue-100 text-blue-800 border border-blue-200',
    high: 'bg-red-100 text-red-800 border border-red-200'
  };

  const filteredTasks = tasks.filter((task) => {
    if (searchTerm) {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
    }
    return true;
  });

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => new Date(t.deadline) < new Date() && t.status !== 'completed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header Section */}
      <div className="mb-8">
        {isAdmin && (
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        )}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                {county?.name || 'County Details'}
              </h1>
              <p className="text-blue-100 text-lg">
                {isAdmin ? 'Manage tasks for this county' : 'Your Task Management Dashboard'}
              </p>
            </div>
            <Link
              to={`/county/${id}/contacts`}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Contacts
            </Link>
          </div>
        </div>

        {/* Task Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Tasks</p>
                <p className="text-3xl font-bold text-blue-600">{taskStats.total}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
                <p className="text-3xl font-bold text-red-600">{taskStats.pending}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-yellow-600">{taskStats.inProgress}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{taskStats.completed}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Overdue</p>
                <p className="text-3xl font-bold text-orange-600">{taskStats.overdue}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddTask(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Add Task
            </button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No tasks found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTasks.map((task) => {
              const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
              const urgency = getDeadlineUrgency(task.deadline, task.status);
              const timeRemaining = getTimeRemaining(task.deadline);
              const countdownText = formatCountdown(task.deadline, task.status);
              
              return (
                <div key={task._id} className={`p-6 hover:bg-gray-50 transition-colors ${urgency.level === 'overdue' ? 'bg-red-50 border-l-4 border-red-500' : urgency.level === 'urgent' ? 'bg-red-50 border-l-4 border-red-400' : urgency.level === 'very-soon' ? 'bg-orange-50 border-l-4 border-orange-400' : urgency.level === 'soon' ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${priorityColors[task.priority] || priorityColors.medium}`}>
                              {task.priority}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(task.status)}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                            {urgency.label && (
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${urgency.bg} ${urgency.color} border ${urgency.border}`}>
                                {urgency.label}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className={`flex items-center gap-2 ${urgency.color}`}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="font-medium">
                                Deadline: {new Date(task.deadline).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </span>
                            </div>
                            {task.status !== 'completed' && (
                              <div className={`flex items-center gap-2 ${urgency.color} font-semibold`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{countdownText}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Files Section */}
                      <div className="mt-4 flex flex-wrap gap-3">
                        {/* Form File */}
                        {task.formFile ? (
                          <button
                            onClick={() => handleDownloadForm(task._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors border border-blue-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Download Form
                            <span className="text-xs text-blue-600">({task.formFile.originalName})</span>
                          </button>
                        ) : (
                          isAdmin && (
                            <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors border border-blue-200 cursor-pointer">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files[0]) {
                                    handleUploadForm(task._id, e.target.files[0]);
                                  }
                                }}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                              />
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              {uploadingForm === task._id ? 'Uploading...' : 'Upload Form'}
                            </label>
                          )
                        )}
                        
                        {/* Filled Form File */}
                        {task.filledFormFile ? (
                          <button
                            onClick={() => handleDownloadFilledForm(task._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors border border-green-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            View Submitted Form
                            <span className="text-xs text-green-600">({task.filledFormFile.originalName})</span>
                          </button>
                        ) : (
                          <label className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors border border-green-200 cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  handleUploadFilledForm(task._id, e.target.files[0]);
                                }
                              }}
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                            />
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {uploadingFilledForm === task._id ? 'Uploading...' : 'Upload Filled Form'}
                          </label>
                        )}
                        
                        {(uploadingForm === task._id || uploadingFilledForm === task._id) && (
                          <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            Uploading...
                          </span>
                        )}
                      </div>
                      
                      {/* Comments Section */}
                      <div className="mt-4">
                        <button
                          onClick={() => toggleTaskExpansion(task._id)}
                          className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>
                            {task.comments?.length || 0} {task.comments?.length === 1 ? 'comment' : 'comments'}
                          </span>
                          <svg 
                            className={`w-4 h-4 transition-transform ${expandedTask === task._id ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedTask === task._id && (
                          <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                            {/* Comments List */}
                            <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                              {loadingComments[task._id] ? (
                                <div className="text-center py-4">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                                  <p className="text-sm text-gray-500 mt-2">Loading comments...</p>
                                </div>
                              ) : taskComments[task._id]?.length > 0 ? (
                                taskComments[task._id].map((comment, idx) => {
                                  const unread = isCommentUnread(comment);
                                  return (
                                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                            <span className="text-blue-600 font-semibold text-sm">
                                              {comment.createdBy?.username?.charAt(0).toUpperCase() || 'U'}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {comment.createdBy?.username || 'Unknown User'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {comment.createdBy?.role === 'admin' ? 'Admin' : 'County User'}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                          {formatDate(comment.createdAt)}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{comment.text}</p>
                                      {isAdmin && unread && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <button
                                            onClick={() => handleMarkAsRead(task._id, idx)}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                          >
                                            Mark as read
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-sm text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
                              )}
                            </div>

                            {/* Add Comment Form */}
                            <div className="border-t border-gray-200 pt-4">
                              <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows="3"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  onClick={() => {
                                    setExpandedTask(null);
                                    setNewComment('');
                                  }}
                                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleAddComment(task._id)}
                                  disabled={addingComment === task._id || !newComment.trim()}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {addingComment === task._id ? 'Adding...' : 'Add Comment'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Status Update (for county users) */}
                    {!isAdmin && (
                      <div className="flex flex-col gap-2 lg:min-w-[200px]">
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateTaskStatus(task._id, e.target.value)}
                          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    )}
                    
                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(task)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleSendReminder(task._id)}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Remind
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add New Task</h3>
              <button
                onClick={() => {
                  setShowAddTask(false);
                  setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium' });
                  setFormFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="4"
                  placeholder="Enter task description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Priority *
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Form File (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFormFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTask(false);
                    setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium' });
                    setFormFile(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTask && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Edit Task</h3>
              <button
                onClick={() => {
                  setShowEditTask(null);
                  setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium' });
                  setFormFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditTask} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="4"
                  placeholder="Enter task description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Priority *
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Update Form File (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setFormFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  Update Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTask(null);
                    setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium' });
                    setFormFile(null);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountyDetail;
