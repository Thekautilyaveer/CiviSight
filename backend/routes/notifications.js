const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { hasAdminPowers } = require('../utils/roles');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const logger = require('../utils/logger');

// @route   GET /api/notifications
// @desc    Get all notifications for current user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .populate('taskId', 'title deadline status')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/notifications/upcoming
// @desc    Get upcoming deadline notifications
// @access  Private
router.get('/upcoming', auth, async (req, res) => {
  try {
    let query = {};
    
    // County users only see tasks for their county
    if (!hasAdminPowers(req.user)) {
      if (!req.user.countyId) {
        return res.json([]);
      }
      query.countyId = req.user.countyId;
    }

    // Get tasks with deadlines in the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    query.deadline = {
      $gte: new Date(),
      $lte: sevenDaysFromNow
    };
    query.status = { $ne: 'completed' };

    const upcomingTasks = await Task.find(query)
      .populate('countyId', 'name code')
      .sort({ deadline: 1 })
      .limit(10);

    res.json(upcomingTasks);
  } catch (error) {
    logger.error('Error fetching upcoming tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user owns this notification
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

