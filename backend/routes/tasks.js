const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { auth, adminOnly } = require('../middleware/auth');
const { hasAdminPowers, entityTypesFor } = require('../utils/roles');
const store = require('../db/store');
const { body, validationResult } = require('express-validator');
const { uploadForm, uploadFilledForm, getSignedUrl, deleteFile } = require('../middleware/upload');
const { sendReminderEmail, sendTaskAssignmentEmail, sendFormUploadEmail } = require('../utils/email');
const logger = require('../utils/logger');
const { DEPARTMENT_ROLE_SLUGS } = require('../constants/departmentRoles');
const { validateFiling } = require('../utils/validateFiling');

const FISCAL_OFFSET_DAYS = [60, 90, 180, 270];

// Reporting fiscal year a filing is FOR. Prefer the year the filer stated on the RLGF
// (Page 1 / cell F17); the write path falls back to the entity's fiscal year if absent.
function statedReportingPeriod(answers, fields) {
  if (!answers || !fields) return null;
  let key = Object.keys(fields).find((k) => fields[k] && fields[k].page === 'Page 1' && fields[k].cell === 'F17');
  if (!key && answers.fiscalYear != null) key = 'fiscalYear';
  const yr = parseInt(String(key ? answers[key] : '').replace(/[^\d]/g, ''), 10);
  return (yr >= 1990 && yr <= 2100) ? yr : null;
}
// The fiscal year (labeled by the calendar year it ends) most recently ended as of `date`.
function fiscalYearEndingBy(entity, date) {
  const dt = new Date(date), y = dt.getFullYear();
  if (!entity) return y;
  const m = entity.fiscalYearEndMonth || 12, d = entity.fiscalYearEndDay || 31;
  return dt >= new Date(y, m - 1, d, 23, 59, 59) ? y : y - 1;
}

function parseAssignedRoles(arr) {
  if (!Array.isArray(arr)) return [];
  const valid = arr.filter((s) => typeof s === 'string' && DEPARTMENT_ROLE_SLUGS.includes(s.trim()));
  return [...new Set(valid)];
}

async function resolveAssignedContacts(countyId, assignedContactIds) {
  if (!Array.isArray(assignedContactIds) || assignedContactIds.length === 0) return [];

  const requestedIds = [...new Set(
    assignedContactIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )];
  if (requestedIds.length === 0) return [];

  const contactDoc = await store.contacts.findByCountyId(countyId);
  if (!contactDoc) {
    const error = new Error('Contacts have not been set up for this county');
    error.statusCode = 400;
    throw error;
  }

  const contactsById = new Map(
    contactDoc.contacts.map((contact) => [contact._id.toString(), contact])
  );
  const missingIds = requestedIds.filter((id) => !contactsById.has(id));
  if (missingIds.length > 0) {
    const error = new Error('One or more assigned contacts do not belong to this county');
    error.statusCode = 400;
    throw error;
  }

  return requestedIds.map((id) => {
    const contact = contactsById.get(id);
    return {
      contactId: contact._id,
      role: contact.role || '',
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || ''
    };
  });
}

function usersToNotifyForTask(countyUsers, assignedRoles) {
  if (!assignedRoles || assignedRoles.length === 0) return countyUsers;
  return countyUsers.filter((u) => {
    const roles = u.departmentRoles;
    if (!roles || roles.length === 0) return true; // user has "all roles"
    return assignedRoles.some((r) => roles.includes(r));
  });
}

function getDeadlineFromFiscalYearEnd(county, offsetDays) {
  const year = new Date().getFullYear();
  const endMonth = (county.fiscalYearEndMonth != null) ? county.fiscalYearEndMonth : 12;
  const endDay = (county.fiscalYearEndDay != null) ? county.fiscalYearEndDay : 31;
  const endDate = new Date(year, endMonth - 1, endDay, 23, 59, 0);
  endDate.setDate(endDate.getDate() + offsetDays);
  return endDate;
}

// @route   GET /api/tasks
// @desc    Get all tasks (filtered by county for county users)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const filters = {};

    // County users only see tasks for their county
    if (!hasAdminPowers(req.user)) {
      if (!req.user.countyId) {
        return res.json([]);
      }
      filters.countyId = req.user.countyId.toString();

      // Role-based visibility: if user has departmentRoles, only show tasks with no
      // assignedRoles or overlapping roles.
      const userRoles = req.user.departmentRoles;
      if (userRoles && userRoles.length > 0) {
        filters.visibleRoles = userRoles;
      }
    } else {
      // Entity-type visibility: ACCG oversees counties only; DCA sees all types.
      filters.entityTypes = entityTypesFor(req.user);
    }

    // Filter by county if provided — admins only. County users are already locked to
    // their own countyId above; honoring this param for them would let one county read
    // another's tasks (e.g. ?countyId=<other>).
    if (req.query.countyId && hasAdminPowers(req.user)) filters.countyId = req.query.countyId;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.deadlineFrom) filters.deadlineFrom = req.query.deadlineFrom;
    if (req.query.deadlineTo) filters.deadlineTo = req.query.deadlineTo;
    if (req.query.assignedFrom) filters.assignedFrom = req.query.assignedFrom;
    if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
    if (req.query.search) filters.search = req.query.search;

    const tasks = await store.tasks.findList(filters);
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
    const task = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: false });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access (county)
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // County users: if task has assigned roles, user must have at least one matching role
    if (req.user.role === 'county_user' && task.assignedRoles && task.assignedRoles.length > 0) {
      const userRoles = req.user.departmentRoles || [];
      const hasMatch = task.assignedRoles.some((r) => userRoles.includes(r));
      if (!hasMatch) {
        return res.status(403).json({ message: 'Access denied' });
      }
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
  body('deadline').optional({ checkFalsy: true }).isISO8601().withMessage('Valid deadline is required'),
  body('submittedTo').trim().notEmpty().withMessage('"Submitted To" is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, countyId, status, deadline, submittedTo, portalLink, deadlineType, deadlineOffsetDays } = req.body;
    const assignedRoles = parseAssignedRoles(req.body.assignedRoles);

    // Verify county exists
    const county = await store.counties.findById(countyId);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }
    const assignedContacts = await resolveAssignedContacts(countyId, req.body.assignedContactIds);

    let resolvedDeadline;
    if (deadline) {
      resolvedDeadline = new Date(deadline);
    } else if (deadlineType === 'fiscal_year_offset' && deadlineOffsetDays != null && FISCAL_OFFSET_DAYS.includes(Number(deadlineOffsetDays))) {
      resolvedDeadline = getDeadlineFromFiscalYearEnd(county, Number(deadlineOffsetDays));
    } else {
      return res.status(400).json({ message: 'Either deadline (ISO date) or deadlineType "fiscal_year_offset" with deadlineOffsetDays (60, 90, 180, or 270) is required' });
    }

    const task = await store.tasks.create({
      title,
      description: description || '',
      countyId,
      submittedTo: submittedTo || '',
      portalLink: (portalLink && String(portalLink).trim()) || '',
      status: status || 'pending',
      priority: req.body.priority || 'medium',
      deadline: resolvedDeadline,
      assignedBy: req.user._id,
      assignedRoles,
      assignedContacts
    });

    // Send email notification - always send to EMAIL_TO
    try {
      const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
      await sendTaskAssignmentEmail(
        emailTo,
        county.name,
        title,
        resolvedDeadline,
        req.user.username
      );
      logger.info(`Task assignment email sent to ${emailTo} for ${county.name}`);
    } catch (emailError) {
      logger.error('Failed to send task assignment email:', emailError);
      // Continue even if email fails
    }

    // Create notification for county users whose roles match the task
    const countyUsers = await store.users.findCountyUsers(countyId);
    const usersToNotify = usersToNotifyForTask(countyUsers, assignedRoles);
    for (const user of usersToNotify) {
      await store.notifications.create({
        userId: user._id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `New task assigned: ${title}`,
        taskId: task._id
      });
    }

    const populatedTask = await store.tasks.findByIdPopulated(task._id, { countyEmail: true });
    res.status(201).json(populatedTask);
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Server error' });
  }
});

// @route   POST /api/tasks/bulk
// @desc    Create tasks for multiple counties
// @access  Private (Admin only)
router.post('/bulk', auth, adminOnly, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('countyIds').isArray().withMessage('County IDs must be an array'),
  body('countyIds.*').isMongoId().withMessage('Each county ID must be a valid MongoDB ObjectId'),
  body('deadline').optional({ checkFalsy: true }).isISO8601().withMessage('Valid deadline is required'),
  body('submittedTo').trim().notEmpty().withMessage('"Submitted To" is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, countyIds, status, deadline, priority, submittedTo, portalLink, deadlineType, deadlineOffsetDays } = req.body;
    const assignedRoles = parseAssignedRoles(req.body.assignedRoles);

    // Verify all counties exist
    const counties = await store.counties.findByIds(countyIds);
    if (counties.length !== countyIds.length) {
      return res.status(404).json({ message: 'One or more counties not found' });
    }

    const useFiscalPreset = deadlineType === 'fiscal_year_offset' && deadlineOffsetDays != null && FISCAL_OFFSET_DAYS.includes(Number(deadlineOffsetDays));
    if (!deadline && !useFiscalPreset) {
      return res.status(400).json({ message: 'Either deadline (ISO date) or deadlineType "fiscal_year_offset" with deadlineOffsetDays (60, 90, 180, or 270) is required' });
    }

    const portalLinkVal = (portalLink && String(portalLink).trim()) || '';
    const contactsByCountyId = new Map();
    if (Array.isArray(req.body.assignedContactsByCounty)) {
      for (const entry of req.body.assignedContactsByCounty) {
        if (entry?.countyId) {
          contactsByCountyId.set(String(entry.countyId), await resolveAssignedContacts(entry.countyId, entry.assignedContactIds));
        }
      }
    }

    const tasksData = countyIds.map(countyId => {
      const county = counties.find(c => c._id.toString() === countyId.toString());
      const taskDeadline = useFiscalPreset
        ? getDeadlineFromFiscalYearEnd(county, Number(deadlineOffsetDays))
        : new Date(deadline);
      return {
        title,
        description: description || '',
        countyId,
        submittedTo: submittedTo || '',
        portalLink: portalLinkVal,
        status: status || 'pending',
        priority: priority || 'medium',
        deadline: taskDeadline,
        assignedBy: req.user._id,
        assignedRoles,
        assignedContacts: contactsByCountyId.get(String(countyId)) || []
      };
    });

    const createdTasks = await store.tasks.insertMany(tasksData);

    // Send email notifications for each task - always send to EMAIL_TO
    const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
    for (const createdTask of createdTasks) {
      try {
        const county = counties.find(c => c._id.toString() === createdTask.countyId.toString());
        if (county) {
          await sendTaskAssignmentEmail(
            emailTo,
            county.name,
            title,
            createdTask.deadline,
            req.user.username
          );
        }

        // Create notifications for county users whose roles match the task
        const countyUsers = await store.users.findCountyUsers(createdTask.countyId);
        const usersToNotify = usersToNotifyForTask(countyUsers, assignedRoles);
        for (const user of usersToNotify) {
          await store.notifications.create({
            userId: user._id,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `New task assigned: ${title}`,
            taskId: createdTask._id
          });
        }
      } catch (emailError) {
        logger.error(`Failed to send emails for task ${createdTask._id}:`, emailError);
      }
    }

    // Populate the created tasks
    const populatedTasks = await store.tasks.findByIdsPopulated(createdTasks.map(t => t._id), { countyEmail: true });

    res.status(201).json({
      message: `Created ${createdTasks.length} tasks successfully`,
      tasks: populatedTasks
    });
  } catch (error) {
    logger.error('Error creating bulk tasks:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Server error' });
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

    const task = await store.tasks.getRaw(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access (admin or county user for their county)
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, status, deadline, submittedTo, portalLink } = req.body;

    const fields = {};
    if (title) fields.title = title;
    if (description !== undefined) fields.description = description;
    if (status) fields.status = status;
    if (req.body.priority) fields.priority = req.body.priority;
    if (deadline) fields.deadline = new Date(deadline);
    if (submittedTo !== undefined) fields.submittedTo = submittedTo;
    if (portalLink !== undefined) fields.portalLink = (portalLink && String(portalLink).trim()) || '';
    if (req.body.assignedRoles !== undefined) fields.assignedRoles = parseAssignedRoles(req.body.assignedRoles);
    if (req.body.assignedContactIds !== undefined) {
      fields.assignedContacts = await resolveAssignedContacts(task.countyId, req.body.assignedContactIds);
    }

    await store.tasks.updateFields(req.params.id, fields);

    const populatedTask = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: false });
    res.json(populatedTask);
  } catch (error) {
    logger.error('Error updating task:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const task = await store.tasks.getRaw(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Delete related notifications first, while the task_id link still exists (the
    // notifications.task_id FK is ON DELETE SET NULL, so deleting the task first would
    // orphan them instead of removing them).
    await store.notifications.deleteByTaskId(req.params.id);
    await store.tasks.deleteById(req.params.id);

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
    const task = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: true });

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
    await store.tasks.pushReminder(req.params.id, {
      sentAt: new Date(),
      sentBy: req.user._id
    });

    // Create notification
    await store.notifications.create({
      userId: req.user._id,
      type: 'reminder',
      title: 'Reminder Sent',
      message: `Reminder sent for task: ${task.title}`,
      taskId: req.params.id
    });

    res.json({
      message: 'Reminder sent successfully',
      task: await store.tasks.findByIdPopulated(req.params.id, { countyEmail: true })
    });
  } catch (error) {
    logger.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/send-reminders
// @desc    Send a manual reminder for many tasks at once (admin only)
// @access  Private (Admin only)
router.post('/send-reminders', auth, adminOnly, async (req, res) => {
  try {
    const { taskIds, message } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: 'No recipients selected' });
    }

    const tasks = await store.tasks.findByIdsPopulated(taskIds, { countyEmail: true });

    if (tasks.length === 0) {
      return res.status(404).json({ message: 'No matching tasks found' });
    }

    // Always send to EMAIL_TO, consistent with the per-task reminder + scheduler.
    const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
    const customMessage = typeof message === 'string' ? message.trim() : '';

    let sent = 0;
    for (const task of tasks) {
      try {
        await sendReminderEmail(
          emailTo,
          task.countyId?.name || 'County',
          task.title,
          task.deadline,
          customMessage
        );
        sent++;
      } catch (emailError) {
        logger.error('Failed to send manual reminder email:', { taskId: task._id, error: emailError.message });
        // Continue — still record the reminder on the task.
      }

      await store.tasks.pushReminder(task._id, { sentAt: new Date(), sentBy: req.user._id });
    }

    // One summary notification for the admin's activity feed.
    await store.notifications.create({
      userId: req.user._id,
      type: 'reminder',
      title: 'Reminders Sent',
      message: `Manual reminder sent for "${tasks[0].title}" to ${sent} ${sent === 1 ? 'county' : 'counties'}`
    });

    logger.info(`Manual reminders sent for ${tasks.length} tasks (${sent} emails) by ${req.user.username}`);
    res.json({ message: 'Reminders sent', sent, total: tasks.length });
  } catch (error) {
    logger.error('Error sending bulk reminders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/upload-form
// @desc    Upload form file for a task (admin only)
// @access  Private (Admin only)
router.post('/:id/upload-form', auth, adminOnly, uploadForm, async (req, res) => {
  try {
    const task = await store.tasks.getRaw(req.params.id);
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

    const formFile = {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: relativePath,
      uploadedAt: new Date()
    };
    await store.tasks.setFormFile(req.params.id, formFile);

    // Send email notification - always send to EMAIL_TO
    try {
      const emailTo = process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';
      const notifyTask = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: true });

      if (notifyTask.countyId) {
        await sendFormUploadEmail(
          emailTo,
          notifyTask.countyId.name,
          notifyTask.title,
          req.file.originalname
        );
        logger.info(`Form upload notification sent to ${emailTo} for ${notifyTask.countyId.name}`);
      }

      // Create notifications for county users
      const countyUsers = await store.users.findCountyUsers(task.countyId);
      for (const user of countyUsers) {
        await store.notifications.create({
          userId: user._id,
          type: 'task_assigned',
          title: 'Form Available',
          message: `Form available for task: ${notifyTask.title}`,
          taskId: req.params.id
        });
      }
    } catch (emailError) {
      logger.error('Failed to send form upload email:', emailError);
    }

    const populatedTask = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: true });
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
    const task = await store.tasks.getRaw(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId.toString()) {
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

    const filledFormFile = {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: relativePath,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    };

    // Attach the file and move the task to 'submitted' (awaiting agency review).
    await store.tasks.setFilledFormFile(req.params.id, filledFormFile);

    // Record the submission for the receiving agency's review queue. An uploaded file
    // carries no answers to read a year from, so the reporting period is the entity's
    // fiscal year most recently ended. form_definition_id stays null (the form filed
    // inside an arbitrary PDF isn't identifiable).
    const uploadedAt = new Date();
    const entity = await store.counties.findById(task.countyId);
    await store.submissions.create({
      taskId: req.params.id,
      countyId: task.countyId,
      agency: task.submittedTo || '',
      formName: task.title,
      formType: 'file',
      status: 'submitted',
      submittedBy: req.user._id,
      submittedAt: uploadedAt,
      file: {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        filePath: relativePath,
        uploadedAt
      },
      reportingPeriod: fiscalYearEndingBy(entity, uploadedAt),
      metadata: { source: 'filled_form_upload' }
    });

    // Notify the reviewing agency (DCA) that a new filing is waiting for review.
    try {
      const populated = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: false });
      const countyName = populated.countyId?.name || 'A county';
      const reviewers = await store.users.findByRole('dca');
      for (const reviewer of reviewers) {
        await store.notifications.create({
          userId: reviewer._id,
          type: 'submission_received',
          title: 'New filing to review',
          message: `${countyName} uploaded "${task.title}" for review`,
          taskId: req.params.id
        });
      }
    } catch (notifyErr) {
      logger.error('Failed to create upload-received notifications:', notifyErr);
    }

    const populatedTask = await store.tasks.findByIdPopulated(req.params.id, { countyEmail: false });
    res.json({ message: 'Filled form uploaded successfully', task: populatedTask });
  } catch (error) {
    logger.error('Error uploading filled form:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   POST /api/tasks/:id/submit-online
// @desc    Submit an online form payload to the receiving agency
// @access  Private
router.post('/:id/submit-online', auth, async (req, res) => {
  try {
    const task = await store.tasks.getRaw(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const metadata = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const answerCount = Object.keys(answers).length;

    if (answerCount === 0) {
      return res.status(400).json({ message: 'Submission must include at least one answer' });
    }

    // Optional: the original workbook this submission was imported from (audit trail).
    // Ownership is enforced by the uploader-id prefix the parse endpoint bakes into the
    // stored filename, so one county can't attach another's upload.
    let file = null;
    const src = req.body.sourceFile;
    if (src && typeof src === 'object' && typeof src.fileName === 'string') {
      const expectedPrefix = `${req.user._id}_`;
      const safeName = /^[\w.-]+$/.test(src.fileName) ? src.fileName : null;
      if (safeName && safeName.startsWith(expectedPrefix)) {
        file = {
          originalName: String(src.originalName || safeName).slice(0, 200),
          fileName: safeName,
          filePath: `rlgf-imports/${safeName}`,
          uploadedAt: src.uploadedAt || new Date()
        };
      }
    }

    // Pin the exact form version filed, and stamp the reporting fiscal year (first-class,
    // so filings are queryable by year and resubmissions version cleanly).
    const submittedAt = new Date();
    const formDef = await store.forms.findDefinitionByCode(req.body.form || 'rlgf');
    const entity = await store.counties.findById(task.countyId);
    const reportingPeriod = statedReportingPeriod(answers, metadata.fields) ?? fiscalYearEndingBy(entity, submittedAt);

    // Born-clean validation against the form catalog. Hard type errors block the filing;
    // soft warnings (out-of-range, required-blank) are recorded for the reviewer.
    let validation;
    if (formDef) {
      const catalog = await store.forms.fieldsForDefinition(formDef.id);
      const byKey = Object.fromEntries(catalog.map((f) => [f.field_key, f]));
      const { errors, warnings } = validateFiling(answers, byKey);
      if (errors.length) {
        return res.status(422).json({ message: 'This filing has validation errors and was not submitted.', errors });
      }
      if (warnings.length) validation = { warnings, validatedAt: submittedAt };
    }

    const submission = await store.submissions.create({
      taskId: req.params.id,
      countyId: task.countyId,
      agency: task.submittedTo || '',
      formName: req.body.formName || task.title,
      formType: 'online',
      status: 'submitted',
      submittedBy: req.user._id,
      submittedAt,
      answers,
      file,
      reportingPeriod,
      formDefinitionId: formDef ? formDef.id : null,
      metadata: {
        ...metadata,
        source: 'online_form',
        form: req.body.form,
        version: req.body.version,
        answerCount,
        validation
      }
    });

    // Filing is with the agency now — awaiting review, NOT yet "completed".
    // (Accepting it later marks the task completed; a bounce-back reopens it.)
    await store.tasks.markSubmitted(req.params.id);

    const populatedSubmission = await store.submissions.findByIdPopulated(submission._id);

    // Notify the reviewing agency (DCA) that a new filing is waiting for review.
    try {
      const countyName = populatedSubmission.countyId?.name || 'A county';
      const formName = populatedSubmission.formName || task.title;
      const reviewers = await store.users.findByRole('dca');
      for (const reviewer of reviewers) {
        await store.notifications.create({
          userId: reviewer._id,
          type: 'submission_received',
          title: 'New filing to review',
          message: `${countyName} submitted "${formName}" for review`,
          taskId: req.params.id
        });
      }
    } catch (notifyErr) {
      logger.error('Failed to create submission-received notifications:', notifyErr);
      // Non-fatal: the submission itself succeeded.
    }

    res.status(201).json({
      message: 'Form submitted to agency successfully',
      submission: populatedSubmission
    });
  } catch (error) {
    logger.error('Error submitting online form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id/download-form
// @desc    Download form file
// @access  Private
router.get('/:id/download-form', auth, async (req, res) => {
  try {
    const task = await store.tasks.getRaw(req.params.id);
    if (!task || !task.formFile) {
      return res.status(404).json({ message: 'Form file not found' });
    }

    // Check if user has access
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId.toString()) {
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
    const task = await store.tasks.getRaw(req.params.id);
    if (!task || !task.filledFormFile) {
      return res.status(404).json({ message: 'Filled form file not found' });
    }

    // Check if user has access
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId.toString()) {
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

    const task = await store.tasks.getRaw(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add comment
    await store.tasks.pushComment(req.params.id, {
      text: req.body.text,
      createdBy: req.user._id,
      createdAt: new Date()
    });

    // Populate the comment with user info
    const populated = await store.tasks.findCommentsPopulated(req.params.id);
    const newComment = populated.comments[populated.comments.length - 1];

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
    const result = await store.tasks.findCommentsPopulated(req.params.id);

    if (!result) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (!hasAdminPowers(req.user)) {
      // For county users, verify they belong to the task's county
      const fullTask = await store.tasks.getRaw(req.params.id);
      if (!fullTask || req.user.countyId?.toString() !== fullTask.countyId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ comments: result.comments });
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
    const commentIndex = parseInt(req.params.commentIndex);
    const comment = await store.tasks.markCommentRead(req.params.taskId, commentIndex, req.user._id);

    if (comment === null) {
      return res.status(404).json({ message: 'Task not found' });
    }
    if (comment === 'OOB') {
      return res.status(404).json({ message: 'Comment not found' });
    }

    res.json({ message: 'Comment marked as read', comment });
  } catch (error) {
    logger.error('Error marking comment as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
