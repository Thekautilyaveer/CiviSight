import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENT_ROLES } from '../constants/departmentRoles';

// Tasks whose title identifies the RLGF filing open the in-app schema-driven form
// instead of the generic "fill online" stub.
const isRlgfTask = (task) => /\brlgf\b|report of local government financ/i.test(task?.title || '');

const CountyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAccg, user } = useAuth();
  const [county, setCounty] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(null);
  const [showOwnerTask, setShowOwnerTask] = useState(null);
  const [ownerContactIds, setOwnerContactIds] = useState([]);
  const [savingOwners, setSavingOwners] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [assignedFrom, setAssignedFrom] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
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
    deadline: '',
    status: 'pending',
    priority: 'medium',
    submittedToSelect: '',
    submittedToOther: '',
    portalLink: '',
    assignedRoles: [],
    assignedContactIds: []
  });
  const [showAddRoleDropdown, setShowAddRoleDropdown] = useState(false);
  const [showEditRoleDropdown, setShowEditRoleDropdown] = useState(false);
  const [deadlineMode, setDeadlineMode] = useState('date');
  const [deadlinePreset, setDeadlinePreset] = useState(null);
  const [formFile, setFormFile] = useState(null);
  const [filledFormFile, setFilledFormFile] = useState(null);
  const [uploadingForm, setUploadingForm] = useState(null);
  const [uploadingFilledForm, setUploadingFilledForm] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({ done: true }); // Completed starts collapsed
  const [agencyFilter, setAgencyFilter] = useState('all');
  const [infoTask, setInfoTask] = useState(null);
  const [taskComments, setTaskComments] = useState({});
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(null);
  const [loadingComments, setLoadingComments] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchCounty();
    fetchContacts();
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

  const fetchContacts = async () => {
    try {
      const res = await api.get(`/contacts/${id}`);
      setContacts(Array.isArray(res.data?.contacts) ? res.data.contacts : []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
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
    const finalSubmittedTo =
      taskForm.submittedToSelect === 'Other'
        ? taskForm.submittedToOther.trim()
        : taskForm.submittedToSelect;

    if (!finalSubmittedTo) {
      alert('Please select who this task is submitted to.');
      return;
    }
    const useFiscalPreset = deadlineMode === 'fiscal_preset' && deadlinePreset != null;
    if (!useFiscalPreset && !taskForm.deadline) {
      alert('Please choose a deadline (specific date or fiscal year preset).');
      return;
    }
    try {
      const payload = {
        ...taskForm,
        countyId: id,
        submittedTo: finalSubmittedTo,
        portalLink: (taskForm.portalLink && taskForm.portalLink.trim()) || undefined,
        assignedRoles: Array.isArray(taskForm.assignedRoles) ? taskForm.assignedRoles : [],
        assignedContactIds: Array.isArray(taskForm.assignedContactIds) ? taskForm.assignedContactIds : []
      };
      if (useFiscalPreset) {
        payload.deadlineType = 'fiscal_year_offset';
        payload.deadlineOffsetDays = deadlinePreset;
        delete payload.deadline;
      } else {
        payload.deadline = new Date(taskForm.deadline).toISOString();
      }
      const response = await api.post('/tasks', payload);
      
      // Upload form file if provided
      if (formFile && response.data && response.data._id) {
        await handleUploadForm(response.data._id, formFile);
      }
      
      setShowAddTask(false);
      setTaskForm({
        title: '',
        description: '',
        deadline: '',
        status: 'pending',
        priority: 'medium',
        submittedToSelect: '',
        submittedToOther: '',
        portalLink: '',
        assignedRoles: [],
        assignedContactIds: []
      });
      setDeadlineMode('date');
      setDeadlinePreset(null);
      setFormFile(null);
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating task');
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    const finalSubmittedTo =
      taskForm.submittedToSelect === 'Other'
        ? taskForm.submittedToOther.trim()
        : taskForm.submittedToSelect;

    if (!finalSubmittedTo) {
      alert('Please select who this task is submitted to.');
      return;
    }
    try {
      await api.put(`/tasks/${showEditTask._id}`, {
        ...taskForm,
        submittedTo: finalSubmittedTo,
        deadline: new Date(taskForm.deadline).toISOString(),
        portalLink: (taskForm.portalLink && taskForm.portalLink.trim()) || '',
        assignedRoles: Array.isArray(taskForm.assignedRoles) ? taskForm.assignedRoles : [],
        assignedContactIds: Array.isArray(taskForm.assignedContactIds) ? taskForm.assignedContactIds : []
      });
      
      if (formFile) {
        await handleUploadForm(showEditTask._id, formFile);
      }
      
      setShowEditTask(null);
      setTaskForm({
        title: '',
        description: '',
        deadline: '',
        status: 'pending',
        priority: 'medium',
        submittedToSelect: '',
        submittedToOther: '',
        portalLink: '',
        assignedRoles: [],
        assignedContactIds: []
      });
      setDeadlineMode('date');
      setDeadlinePreset(null);
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

      // Uploading the completed form marks the filing as done.
      try {
        await api.put(`/tasks/${taskId}`, { status: 'completed' });
      } catch (statusErr) {
        console.error('Could not update status after upload:', statusErr);
      }
      alert('Filled form uploaded — filing marked as completed');
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
    if (!isAccg || !user) return false;
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

  const getContactDisplayName = (contact) => {
    if (!contact) return 'Contact';
    const name = contact.name?.trim();
    const role = contact.role?.trim();
    if (name && role) return `${name} · ${role}`;
    return name || role || contact.email || 'Contact';
  };

  const openOwnerModal = (task) => {
    setShowOwnerTask(task);
    setOwnerContactIds(
      Array.isArray(task.assignedContacts)
        ? task.assignedContacts.map((contact) => String(contact.contactId || contact._id || '')).filter(Boolean)
        : []
    );
  };

  const toggleOwnerContact = (contactId, checked) => {
    setOwnerContactIds((prev) => (
      checked
        ? [...new Set([...prev, contactId])]
        : prev.filter((id) => id !== contactId)
    ));
  };

  const handleSaveOwners = async () => {
    if (!showOwnerTask) return;
    setSavingOwners(true);
    try {
      await api.put(`/tasks/${showOwnerTask._id}`, {
        assignedContactIds: ownerContactIds
      });
      setShowOwnerTask(null);
      setOwnerContactIds([]);
      fetchTasks();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating form owners');
    } finally {
      setSavingOwners(false);
    }
  };

  const openEditModal = (task) => {
    setShowEditTask(task);
    const isPredefinedSubmittedTo = submittedToOptions.includes(task.submittedTo);
    setTaskForm({
      title: task.title,
      description: task.description,
      deadline: new Date(task.deadline).toISOString().slice(0, 16),
      status: task.status,
      priority: task.priority || 'medium',
      submittedToSelect: isPredefinedSubmittedTo
        ? task.submittedTo
        : task.submittedTo
        ? 'Other'
        : '',
      submittedToOther: isPredefinedSubmittedTo ? '' : (task.submittedTo || ''),
      portalLink: task.portalLink || '',
      assignedRoles: Array.isArray(task.assignedRoles) ? [...task.assignedRoles] : [],
      assignedContactIds: Array.isArray(task.assignedContacts)
        ? task.assignedContacts.map((contact) => String(contact.contactId || contact._id || '')).filter(Boolean)
        : []
    });
  };

  const handleOpenPortalLink = async (task) => {
    if (!task.portalLink) return;
    if (task.status === 'pending') {
      try {
        await api.put(`/tasks/${task._id}`, { status: 'in_progress' });
        fetchTasks();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to update status');
        return;
      }
    }
    window.open(task.portalLink, '_blank');
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

  // A destination is "Other" (not a specific state agency) when it's a publication
  // requirement rather than an agency filing.
  const isOtherDestination = (submittedTo) =>
    !submittedTo || /newspaper|locally|website/i.test(submittedTo);

  // State agencies present in this county's filings (for the filter dropdown).
  const agencyOptions = [
    ...new Set(tasks.map((t) => t.submittedTo).filter((s) => s && !isOtherDestination(s)))
  ].sort((a, b) => a.localeCompare(b));
  const hasOther = tasks.some((t) => isOtherDestination(t.submittedTo));

  const filteredTasks = tasks.filter((task) => {
    if (searchTerm) {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
    }
    if (agencyFilter === 'other') return isOtherDestination(task.submittedTo);
    if (agencyFilter !== 'all') return task.submittedTo === agencyFilter;
    return true;
  });

  const currentUserEmail = (user?.email || '').trim().toLowerCase();
  const contactMatchesCurrentUser = (contact) =>
    Boolean(currentUserEmail && (contact?.email || '').trim().toLowerCase() === currentUserEmail);
  const taskAssignedToCurrentUser = (task) =>
    Array.isArray(task.assignedContacts) && task.assignedContacts.some(contactMatchesCurrentUser);
  const myAssignedTasks = !isAccg && currentUserEmail
    ? filteredTasks
        .filter(taskAssignedToCurrentUser)
        .sort((a, b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return new Date(a.deadline) - new Date(b.deadline);
        })
    : [];

  // Group filings into three sections: due within 90 days, due later, completed.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysToDeadline = (t) => Math.ceil((new Date(t.deadline) - new Date()) / DAY_MS);
  const dueSoonTasks = filteredTasks
    .filter((t) => t.status !== 'completed' && daysToDeadline(t) <= 90)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const dueLaterTasks = filteredTasks
    .filter((t) => t.status !== 'completed' && daysToDeadline(t) > 90)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const completedTasks = filteredTasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
  const taskSections = [
    { key: 'soon', label: 'Due in the next 90 days', tasks: dueSoonTasks },
    { key: 'later', label: 'Due later than 90 days', tasks: dueLaterTasks },
    { key: 'done', label: 'Completed', tasks: completedTasks }
  ];

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
        {isAccg && (
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
            <div className="flex items-center gap-4">
              {county?.code && (
                <div className="bg-white rounded-xl p-2 shrink-0 shadow-sm">
                  <img
                    src={`/${county.code.toLowerCase()}_logo.png`}
                    alt={`${county.name} logo`}
                    className="h-14 w-14 object-contain"
                    onError={(e) => { e.target.parentNode.style.display = 'none'; }}
                  />
                </div>
              )}
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {county?.name || 'County Details'}
                </h1>
                <p className="text-blue-100 text-lg">
                  {isAccg ? 'Manage tasks for this county' : 'Your Task Management Dashboard'}
                </p>
              </div>
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
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All agencies</option>
              {agencyOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              {hasOther && <option value="other">Other</option>}
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
          <button
            onClick={() => setShowAddTask(true)}
            title="Add a form"
            aria-label="Add a form"
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {!isAccg && currentUserEmail && (
        <section className="mb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 1115 0" />
            </svg>
            My assigned forms
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-800">
              {myAssignedTasks.length}
            </span>
          </div>
          {myAssignedTasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4">
              <p className="text-sm text-gray-500">
                No forms are assigned to {user?.email}. Use <span className="font-medium text-gray-700">Add form owners</span> on a form to assign yourself.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200 overflow-hidden">
              {myAssignedTasks.map((task) => {
                const urgency = getDeadlineUrgency(task.deadline, task.status);
                return (
                  <div key={task._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-900">{task.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {urgency.label && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${urgency.bg} ${urgency.color} border ${urgency.border}`}>
                            {urgency.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Due {new Date(task.deadline).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        {task.submittedTo && <span> · {task.submittedTo}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => openOwnerModal(task)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                      >
                        Edit form owners
                      </button>
                      {task.status !== 'completed' && !task.formFile && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isRlgfTask(task)) {
                              navigate(`/county/${id}/rlgf/${task._id}`);
                            } else if (task.portalLink) {
                              handleOpenPortalLink(task);
                            } else {
                              handleUpdateTaskStatus(task._id, 'in_progress');
                            }
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Fill form online
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tasks grouped into three sections */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
          <p className="text-gray-500">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {taskSections.map((sec) => (
            <div key={sec.key}>
              <button
                type="button"
                onClick={() => setCollapsedSections((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))}
                className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 hover:text-gray-700 transition-colors"
              >
                {sec.key === 'soon' && (
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                  </svg>
                )}
                {sec.key === 'later' && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                  </svg>
                )}
                {sec.key === 'done' && (
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {sec.label}
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${sec.key === 'soon' ? 'bg-amber-100 text-amber-800' : sec.key === 'done' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {sec.tasks.length}
                </span>
                <svg
                  className={`w-4 h-4 ml-1 text-gray-400 transition-transform ${collapsedSections[sec.key] ? '' : 'rotate-180'}`}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {!collapsedSections[sec.key] && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {sec.tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm">Nothing in this section</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {sec.tasks.map((task) => {
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
                            <span className="inline-flex items-center gap-1.5">
                              <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                              <button
                                type="button"
                                onClick={() => setInfoTask(task)}
                                title="About this filing"
                                aria-label="About this filing"
                                className="shrink-0 w-5 h-5 inline-flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[11px] font-bold leading-none"
                              >
                                i
                              </button>
                            </span>
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
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-600 mb-3">
                                Submitted to <span className="font-medium text-gray-700">{task.submittedTo || '—'}</span>
                              </p>
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
                            {/* Actions — same level as the description's first line */}
                            <div className="flex flex-wrap gap-2 justify-end shrink-0">
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
                        ) : null}
                        {/* Secondary portal link for upload-type filings that also have a portal */}
                        {task.formFile && task.portalLink && (
                          <button
                            type="button"
                            onClick={() => handleOpenPortalLink(task)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open form portal
                          </button>
                        )}

                        {/* Submission action: form filings get upload, everything else fills online */}
                        {task.filledFormFile ? (
                          <button
                            onClick={() => handleDownloadFilledForm(task._id)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors border border-green-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            View submission
                            <span className="text-xs text-green-600">({task.filledFormFile.originalName})</span>
                          </button>
                        ) : task.formFile ? (
                          !isAccg && task.status !== 'completed' && (
                            <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer">
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
                              {uploadingFilledForm === task._id ? 'Uploading...' : 'Upload filled form'}
                            </label>
                          )
                        ) : (
                          !isAccg && task.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isRlgfTask(task)) {
                                  navigate(`/county/${id}/rlgf/${task._id}`);
                                } else if (task.portalLink) {
                                  handleOpenPortalLink(task);
                                } else {
                                  handleUpdateTaskStatus(task._id, 'in_progress');
                                }
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Fill form online
                            </button>
                          )
                        )}
                        
                        {(uploadingForm === task._id || uploadingFilledForm === task._id) && (
                          <span className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            Uploading...
                          </span>
                        )}
                        <div className="basis-full flex flex-col items-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openOwnerModal(task)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-300"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 18.72a9.094 9.094 0 003.75.78 8.963 8.963 0 00-3.06-6.76M15 11.25a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
                            </svg>
                            {task.assignedContacts?.length > 0 ? 'Edit form owners' : 'Add form owners'}
                          </button>
                          {task.assignedContacts?.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1.5 max-w-sm">
                              {task.assignedContacts.map((contact, idx) => (
                                <span
                                  key={`${contact.contactId || contact.email || contact.role || idx}`}
                                  className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800"
                                  title={[contact.name, contact.role, contact.email].filter(Boolean).join(' · ')}
                                >
                                  {contact.name || contact.role || contact.email || 'Contact'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                            </div>
                          </div>
                        </div>
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
                                              {comment.createdBy?.role === 'accg' ? 'ACCG' : 'County User'}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                          {formatDate(comment.createdAt)}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{comment.text}</p>
                                      {isAccg && unread && (
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
                    
                    {/* Admin Actions */}
                    {isAccg && (
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
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add New Task</h3>
              <button
                onClick={() => {
                  setShowAddTask(false);
                  setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium', submittedToSelect: '', submittedToOther: '', portalLink: '' });
                  setDeadlineMode('date');
                  setDeadlinePreset(null);
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Deadline *
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addDeadlineMode"
                        checked={deadlineMode === 'date'}
                        onChange={() => setDeadlineMode('date')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">Specific date</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="addDeadlineMode"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <select
                      value={deadlinePreset ?? ''}
                      onChange={(e) => setDeadlinePreset(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  Submitted To *
                </label>
                <select
                  value={taskForm.submittedToSelect}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      submittedToSelect: e.target.value,
                      submittedToOther:
                        e.target.value === 'Other' ? prev.submittedToOther : ''
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="mt-2 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter the agency or recipient"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Link to portal (Optional)
                </label>
                <input
                  type="url"
                  value={taskForm.portalLink}
                  onChange={(e) => setTaskForm({ ...taskForm, portalLink: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visible to roles (optional)
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Only county users with at least one of these roles will see this task. Leave empty for all.
                </p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddRoleDropdown((prev) => !prev)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <span className="text-sm text-gray-900">
                      {(taskForm.assignedRoles || []).length === 0
                        ? 'All county users'
                        : (taskForm.assignedRoles || []).length === 1
                        ? DEPARTMENT_ROLES.find((r) => r.slug === (taskForm.assignedRoles || [])[0])?.label || '1 role selected'
                        : `${(taskForm.assignedRoles || []).length} roles selected`}
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
                  {showAddRoleDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {DEPARTMENT_ROLES.map(({ slug, label }) => {
                        const checked = (taskForm.assignedRoles || []).includes(slug);
                        return (
                          <label
                            key={slug}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setTaskForm((prev) => {
                                  const current = prev.assignedRoles || [];
                                  return {
                                    ...prev,
                                    assignedRoles: e.target.checked
                                      ? [...current, slug]
                                      : current.filter((r) => r !== slug)
                                  };
                                });
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
                    setTaskForm({
                      title: '',
                      description: '',
                      deadline: '',
                      status: 'pending',
                      priority: 'medium',
                      submittedToSelect: '',
                      submittedToOther: '',
                      portalLink: '',
                      assignedRoles: [],
                      assignedContactIds: []
                    });
                    setDeadlineMode('date');
                    setDeadlinePreset(null);
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
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Edit Task</h3>
              <button
                onClick={() => {
                  setShowEditTask(null);
                  setTaskForm({ title: '', description: '', deadline: '', status: 'pending', priority: 'medium', submittedToSelect: '', submittedToOther: '', portalLink: '', assignedRoles: [], assignedContactIds: [] });
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
                  Submitted To *
                </label>
                <select
                  value={taskForm.submittedToSelect}
                  onChange={(e) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      submittedToSelect: e.target.value,
                      submittedToOther:
                        e.target.value === 'Other' ? prev.submittedToOther : ''
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="mt-2 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter the agency or recipient"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Link to portal (Optional)
                </label>
                <input
                  type="url"
                  value={taskForm.portalLink}
                  onChange={(e) => setTaskForm({ ...taskForm, portalLink: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visible to roles (optional)
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Only county users with at least one of these roles will see this task. Leave empty for all.
                </p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEditRoleDropdown((prev) => !prev)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <span className="text-sm text-gray-900">
                      {(taskForm.assignedRoles || []).length === 0
                        ? 'All county users'
                        : (taskForm.assignedRoles || []).length === 1
                        ? DEPARTMENT_ROLES.find((r) => r.slug === (taskForm.assignedRoles || [])[0])?.label || '1 role selected'
                        : `${(taskForm.assignedRoles || []).length} roles selected`}
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
                  {showEditRoleDropdown && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {DEPARTMENT_ROLES.map(({ slug, label }) => {
                        const checked = (taskForm.assignedRoles || []).includes(slug);
                        return (
                          <label
                            key={slug}
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setTaskForm((prev) => {
                                  const current = prev.assignedRoles || [];
                                  return {
                                    ...prev,
                                    assignedRoles: e.target.checked
                                      ? [...current, slug]
                                      : current.filter((r) => r !== slug)
                                  };
                                });
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
                    setTaskForm({
                      title: '',
                      description: '',
                      deadline: '',
                      status: 'pending',
                      priority: 'medium',
                      submittedToSelect: '',
                      submittedToOther: '',
                      portalLink: '',
                      assignedRoles: [],
                      assignedContactIds: []
                    });
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

      {/* Form owners modal */}
      {showOwnerTask && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (!savingOwners) {
              setShowOwnerTask(null);
              setOwnerContactIds([]);
            }
          }}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Form owners</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Choose the people responsible for this form.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!savingOwners) {
                    setShowOwnerTask(null);
                    setOwnerContactIds([]);
                  }
                }}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Close"
                disabled={savingOwners}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">{showOwnerTask.title}</p>
              <p className="mt-1 text-xs text-gray-500">
                {ownerContactIds.length} owner{ownerContactIds.length === 1 ? '' : 's'} selected
              </p>
            </div>

            <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto bg-white">
              {contacts.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  No contacts are available for this county yet.
                </div>
              ) : (
                contacts.map((contact) => {
                  const checked = ownerContactIds.includes(contact._id);
                  return (
                    <label
                      key={contact._id}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleOwnerContact(contact._id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">
                          {getContactDisplayName(contact)}
                          {contactMatchesCurrentUser(contact) && (
                            <span className="ml-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                              You
                            </span>
                          )}
                        </span>
                        {(contact.email || contact.phone) && (
                          <span className="block text-xs text-gray-500 truncate">
                            {[contact.email, contact.phone].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex gap-3 pt-5 mt-5 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSaveOwners}
                disabled={savingOwners}
                className="flex-1 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingOwners ? 'Saving...' : 'Save owners'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOwnerTask(null);
                  setOwnerContactIds([]);
                }}
                disabled={savingOwners}
                className="flex-1 bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form info popup */}
      {infoTask && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 h-full w-full z-50 flex items-center justify-center p-4"
          onClick={() => setInfoTask(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-xl font-bold text-gray-900">{infoTask.title}</h3>
              <button
                onClick={() => setInfoTask(null)}
                className="text-gray-400 hover:text-gray-600 shrink-0"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Submitted to {infoTask.submittedTo || '—'}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {infoTask.description || 'No description available for this filing.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountyDetail;
