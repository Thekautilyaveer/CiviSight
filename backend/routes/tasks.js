const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { auth, adminOnly } = require('../middleware/auth');
const Task = require('../models/Task');
const County = require('../models/County');
const Notification = require('../models/Notification');
const { body, validationResult } = require('express-validator');
const { uploadForm, uploadFilledForm, getSignedUrl, deleteFile } = require('../middleware/upload');
const { sendReminderEmail, sendTaskAssignmentEmail, sendFormUploadEmail } = require('../utils/email');
const User = require('../models/User');
const logger = require('../utils/logger');

// @route   GET /api/tasks
// @desc    Get all tasks (filtered by county for county users)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    // County users only see tasks for their county
    if (req.user.role !== 'admin') {
      if (!req.user.countyId) {
        return res.json([]);
      }
      query.countyId = req.user.countyId;
    }

    // Filter by county if provided
    if (req.query.countyId) {
      query.countyId = req.query.countyId;
    }

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by priority if provided
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // Filter by deadline date range
    if (req.query.deadlineFrom || req.query.deadlineTo) {
      query.deadline = {};
      if (req.query.deadlineFrom) {
        query.deadline.$gte = new Date(req.query.deadlineFrom);
      }
      if (req.query.deadlineTo) {
        query.deadline.$lte = new Date(req.query.deadlineTo);
      }
    }

    // Filter by assigned date range
    if (req.query.assignedFrom || req.query.assignedTo) {
      query.createdAt = {};
      if (req.query.assignedFrom) {
        query.createdAt.$gte = new Date(req.query.assignedFrom);
      }
      if (req.query.assignedTo) {
        query.createdAt.$lte = new Date(req.query.assignedTo);
      }
    }

    // Search by title or description
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email')
      .sort({ deadline: 1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private (Admin only)
router.post('/', auth, adminOnly, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('countyId').notEmpty().withMessage('County ID is required'),
  body('deadline').isISO8601().withMessage('Valid deadline is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, countyId, status, deadline } = req.body;

    // Verify county exists
    const county = await County.findById(countyId);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    const task = new Task({
      title,
      description: description || '',
      countyId,
      status: status || 'pending',
      priority: req.body.priority || 'medium',
      deadline: new Date(deadline),
      assignedBy: req.user._id
    });

    await task.save();

    // Send email notification - always send to EMAIL_TO
    try {
      const populatedCounty = await County.findById(countyId);
      const assignedByUser = await User.findById(req.user._id);
      const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
      
      if (populatedCounty) {
        await sendTaskAssignmentEmail(
          emailTo,
          populatedCounty.name,
          title,
          deadline,
          assignedByUser.username
        );
        logger.info(`Task assignment email sent to ${emailTo} for ${populatedCounty.name}`);
      }
    } catch (emailError) {
      logger.error('Failed to send task assignment email:', emailError);
      // Continue even if email fails
    }

    // Create notification for county users
    const Notification = require('../models/Notification');
    const countyUsers = await User.find({ countyId: countyId, role: 'county_user' });
    for (const user of countyUsers) {
      const notification = new Notification({
        userId: user._id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `New task assigned: ${title}`,
        taskId: task._id
      });
      await notification.save();
    }

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code email')
      .populate('assignedBy', 'username email');

    res.status(201).json(populatedTask);
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/bulk
// @desc    Create tasks for multiple counties
// @access  Private (Admin only)
router.post('/bulk', auth, adminOnly, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('countyIds').isArray().withMessage('County IDs must be an array'),
  body('countyIds.*').isMongoId().withMessage('Each county ID must be a valid MongoDB ObjectId'),
  body('deadline').isISO8601().withMessage('Valid deadline is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, countyIds, status, deadline, priority } = req.body;

    // Verify all counties exist
    const counties = await County.find({ _id: { $in: countyIds } });
    if (counties.length !== countyIds.length) {
      return res.status(404).json({ message: 'One or more counties not found' });
    }

    // Create tasks for each county
    const tasks = countyIds.map(countyId => ({
      title,
      description: description || '',
      countyId,
      status: status || 'pending',
      priority: priority || 'medium',
      deadline: new Date(deadline),
      assignedBy: req.user._id
    }));

    const createdTasks = await Task.insertMany(tasks);

    // Send email notifications for each task - always send to EMAIL_TO
    const assignedByUser = await User.findById(req.user._id);
    const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
    for (const createdTask of createdTasks) {
      try {
        const county = await County.findById(createdTask.countyId);
        if (county) {
          await sendTaskAssignmentEmail(
            emailTo,
            county.name,
            title,
            deadline,
            assignedByUser.username
          );
        }
        
        // Create notifications for county users
        const Notification = require('../models/Notification');
        const countyUsers = await User.find({ countyId: createdTask.countyId, role: 'county_user' });
        for (const user of countyUsers) {
          const notification = new Notification({
            userId: user._id,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `New task assigned: ${title}`,
            taskId: createdTask._id
          });
          await notification.save();
        }
      } catch (emailError) {
        logger.error(`Failed to send emails for task ${createdTask._id}:`, emailError);
      }
    }

    // Populate the created tasks
    const populatedTasks = await Task.find({ _id: { $in: createdTasks.map(t => t._id) } })
      .populate('countyId', 'name code email')
      .populate('assignedBy', 'username email');

    res.status(201).json({ 
      message: `Created ${createdTasks.length} tasks successfully`,
      tasks: populatedTasks 
    });
  } catch (error) {
    logger.error('Error creating bulk tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private
router.put('/:id', auth, [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('deadline').optional().isISO8601().withMessage('Valid deadline is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access (admin or county user for their county)
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, status, deadline } = req.body;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (req.body.priority) task.priority = req.body.priority;
    if (deadline) task.deadline = new Date(deadline);

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    res.json(populatedTask);
  } catch (error) {
    logger.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Delete related notifications
    await Notification.deleteMany({ taskId: req.params.id });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/reminder
// @desc    Send reminder for a task
// @access  Private (Admin only)
router.post('/:id/reminder', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('countyId', 'name code email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Always send reminder emails to EMAIL_TO, regardless of county email
    const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';

    // Send email
    try {
      await sendReminderEmail(
        emailTo,
        task.countyId.name,
        task.title,
        task.deadline
      );
      logger.info(`Reminder email sent successfully to ${emailTo}`);
    } catch (emailError) {
      logger.error('Failed to send reminder email:', emailError);
      // Continue even if email fails - still record the reminder
    }

    // Add reminder record
    task.reminders.push({
      sentAt: new Date(),
      sentBy: req.user._id
    });

    await task.save();

    // Create notification
    const notification = new Notification({
      userId: req.user._id,
      type: 'reminder',
      title: 'Reminder Sent',
      message: `Reminder sent for task: ${task.title}`,
      taskId: task._id
    });

    await notification.save();

    res.json({ 
      message: 'Reminder sent successfully',
      task: await Task.findById(task._id).populate('countyId', 'name code email')
    });
  } catch (error) {
    logger.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/upload-form
// @desc    Upload form file for a task (admin only)
// @access  Private (Admin only)
router.post('/:id/upload-form', auth, adminOnly, uploadForm, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if file upload was successful
    if (!req.file.path) {
      logger.error('File upload failed - no file path returned', { file: req.file });
      return res.status(500).json({ message: 'File upload failed' });
    }

    // Delete old form file if exists
    if (task.formFile && task.formFile.filePath) {
      await deleteFile(task.formFile.filePath);
    }

    // Store relative path from uploads directory
    const relativePath = path.relative(path.join(__dirname, '../uploads'), req.file.path);
    
    task.formFile = {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: relativePath,
      uploadedAt: new Date()
    };

    await task.save();

    // Send email notification - always send to EMAIL_TO
    try {
      const populatedTask = await Task.findById(task._id)
        .populate('countyId', 'name code email');
      
      const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
      
      if (populatedTask.countyId) {
        await sendFormUploadEmail(
          emailTo,
          populatedTask.countyId.name,
          populatedTask.title,
          req.file.originalname
        );
        logger.info(`Form upload notification sent to ${emailTo} for ${populatedTask.countyId.name}`);
      }
      
      // Create notifications for county users
      const Notification = require('../models/Notification');
      const countyUsers = await User.find({ countyId: task.countyId, role: 'county_user' });
      for (const user of countyUsers) {
        const notification = new Notification({
          userId: user._id,
          type: 'task_assigned',
          title: 'Form Available',
          message: `Form available for task: ${populatedTask.title}`,
          taskId: task._id
        });
        await notification.save();
      }
    } catch (emailError) {
      logger.error('Failed to send form upload email:', emailError);
    }

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code email')
      .populate('assignedBy', 'username email');

    res.json({ message: 'Form uploaded successfully', task: populatedTask });
  } catch (error) {
    logger.error('Error uploading form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/upload-filled-form
// @desc    Upload filled form file (county users)
// @access  Private
router.post('/:id/upload-filled-form', auth, uploadFilledForm, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if file upload was successful
    if (!req.file.path) {
      logger.error('File upload failed - no file path returned', { file: req.file });
      return res.status(500).json({ message: 'File upload failed' });
    }

    // Delete old filled form file if exists
    if (task.filledFormFile && task.filledFormFile.filePath) {
      await deleteFile(task.filledFormFile.filePath);
    }

    // Store relative path from uploads directory
    const relativePath = path.relative(path.join(__dirname, '../uploads'), req.file.path);
    
    task.filledFormFile = {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: relativePath,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    };

    // Automatically set status to completed when filled form is submitted
    task.status = 'completed';
    task.completedAt = new Date();

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    res.json({ message: 'Filled form uploaded successfully', task: populatedTask });
  } catch (error) {
    logger.error('Error uploading filled form:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   GET /api/tasks/:id/download-form
// @desc    Download form file
// @access  Private
router.get('/:id/download-form', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !task.formFile) {
      return res.status(404).json({ message: 'Form file not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get file path and serve directly
    const filePath = path.join(__dirname, '../uploads', task.formFile.filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Set headers for file download
    const fileName = task.formFile.originalName || 'form.pdf';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Stream the file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    logger.error('Error downloading form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id/download-filled-form
// @desc    Download filled form file
// @access  Private
router.get('/:id/download-filled-form', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !task.filledFormFile) {
      return res.status(404).json({ message: 'Filled form file not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get file path and serve directly
    const filePath = path.join(__dirname, '../uploads', task.filledFormFile.filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error(`File not found: ${filePath}`);
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Set headers for file download
    const fileName = task.filledFormFile.originalName || 'filled-form.pdf';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Stream the file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    logger.error('Error downloading filled form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/comments
// @desc    Add a comment to a task
// @access  Private
router.post('/:id/comments', auth, [
  body('text').trim().notEmpty().withMessage('Comment text is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add comment
    task.comments.push({
      text: req.body.text,
      createdBy: req.user._id,
      createdAt: new Date()
    });

    await task.save();

    // Populate the comment with user info
    const populatedTask = await Task.findById(task._id)
      .populate('comments.createdBy', 'username email role')
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    const newComment = populatedTask.comments[populatedTask.comments.length - 1];

    res.status(201).json({ 
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id/comments
// @desc    Get all comments for a task
// @access  Private
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('comments.createdBy', 'username email role')
      .select('comments');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin') {
      // For county users, verify they belong to the task's county
      const fullTask = await Task.findById(req.params.id).select('countyId');
      if (!fullTask || req.user.countyId?.toString() !== fullTask.countyId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ comments: task.comments });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:taskId/comments/:commentIndex/mark-read
// @desc    Mark a comment as read by the current admin
// @access  Private (Admin only)
router.post('/:taskId/comments/:commentIndex/mark-read', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const commentIndex = parseInt(req.params.commentIndex);
    if (commentIndex < 0 || commentIndex >= task.comments.length) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = task.comments[commentIndex];
    
    // Check if already read by this admin
    if (!comment.readBy) {
      comment.readBy = [];
    }
    
    const alreadyRead = comment.readBy.some(
      userId => userId.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      comment.readBy.push(req.user._id);
      await task.save();
    }

    res.json({ message: 'Comment marked as read', comment });
  } catch (error) {
    logger.error('Error marking comment as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

