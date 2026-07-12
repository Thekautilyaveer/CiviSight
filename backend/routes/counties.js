const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const { hasAdminPowers } = require('../utils/roles');
const store = require('../db/store');
const logger = require('../utils/logger');

// @route   GET /api/counties
// @desc    Get all counties with task statistics
// @access  Private (Admin only for full list, county users see their county)
router.get('/', auth, async (req, res) => {
  try {
    let counties;

    if (hasAdminPowers(req.user)) {
      counties = await store.counties.findAllSorted();
    } else {
      // County users only see their own county
      if (!req.user.countyId) {
        return res.json([]);
      }
      const own = await store.counties.findById(req.user.countyId);
      counties = own ? [own] : [];
    }

    // Get task statistics for each county
    const countiesWithStats = await Promise.all(
      counties.map(async (county) => {
        const tasks = await store.tasks.findForCountyStats(county._id);
        const pending = tasks.filter(t => t.status === 'pending').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        
        // Count unread comments for admin (only if user is admin)
        let unreadComments = 0;
        if (hasAdminPowers(req.user)) {
          unreadComments = tasks.reduce((sum, task) => {
            if (!task.comments || task.comments.length === 0) return sum;
            const unread = task.comments.filter(comment => {
              // Comment is unread if:
              // 1. It wasn't created by the current admin (they don't need to read their own comments)
              // 2. The current admin hasn't read it yet
              const createdByAdmin = comment.createdBy?._id?.toString() === req.user._id.toString() ||
                                     comment.createdBy?.toString() === req.user._id.toString();
              const readByAdmin = comment.readBy?.some(
                userId => {
                  const userIdStr = userId._id ? userId._id.toString() : userId.toString();
                  return userIdStr === req.user._id.toString();
                }
              );
              return !createdByAdmin && !readByAdmin;
            }).length;
            return sum + unread;
          }, 0);
        }

        const base = typeof county.toObject === 'function' ? county.toObject() : county;
        return {
          ...base,
          taskStats: {
            total: tasks.length,
            pending,
            inProgress,
            completed,
            unreadComments
          }
        };
      })
    );

    res.json(countiesWithStats);
  } catch (error) {
    logger.error('Error fetching counties:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/counties/:id
// @desc    Get single county by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const county = await store.counties.findById(req.params.id);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    // Check if user has access (admin or county user for their county)
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(county);
  } catch (error) {
    logger.error('Error fetching county by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/counties
// @desc    Create a new county
// @access  Private (Admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, code, description, email } = req.body;

    const county = await store.counties.create({
      name,
      code,
      description: description || '',
      email: email || ''
    });

    // Automatically create a county user for this county
    const countyCodeLower = code.toLowerCase();
    const countyEmail = `${countyCodeLower}county@civisight.org`;
    const countyUsername = `${countyCodeLower}_user`;

    try {
      await store.users.create({
        username: countyUsername,
        email: countyEmail,
        password: 'county123',
        role: 'county_user',
        countyId: county._id
      });

      logger.info(`Created county user: ${countyEmail} / county123 (${countyUsername})`);
    } catch (userError) {
      // If user creation fails (e.g., duplicate email), log but don't fail county creation
      logger.error('Error creating county user:', userError);
      // Continue - county is already created
    }

    res.status(201).json(county);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'County with this name or code already exists' });
    }
    logger.error('Error creating county:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/counties/:id
// @desc    Update a county
// @access  Private (Admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, code, description } = req.body;

    const county = await store.counties.updateById(req.params.id, { name, code, description });

    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    res.json(county);
  } catch (error) {
    logger.error('Error updating county:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/counties/:id
// @desc    Delete a county
// @access  Private (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const county = await store.counties.deleteById(req.params.id);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    // Also delete all tasks for this county
    await store.tasks.deleteByCountyId(req.params.id);

    res.json({ message: 'County deleted successfully' });
  } catch (error) {
    logger.error('Error deleting county:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

