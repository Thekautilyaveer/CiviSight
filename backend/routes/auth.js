const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const County = require('../models/County');
const { body, validationResult } = require('express-validator');
const { auth, adminOnly } = require('../middleware/auth');
const logger = require('../utils/logger');

// Generate JWT Token
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user (Admin only - Public registration is disabled)
// @access  Private (Admin only)
// @note    Public registration is disabled for security. Only authenticated admins can create new users.
router.post('/register', auth, adminOnly, [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
  body('role').isIn(['accg', 'dca', 'county_user']).withMessage('Invalid role'),
  body('countyId')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (!value || value === '') return true; // Allow empty/undefined for admin users
      return /^[0-9a-fA-F]{24}$/.test(value); // Validate MongoDB ObjectId format
    })
    .withMessage('Invalid county ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role, countyId } = req.body;
    
    // Clean up countyId - remove if empty string or null for admin users
    const cleanCountyId = (role === 'accg' || role === 'dca' || !countyId || countyId === '') ? null : countyId;

    // Check if user exists
    let user = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate countyId if provided for county_user
    if (role === 'county_user') {
      if (!cleanCountyId) {
        return res.status(400).json({ message: 'County ID is required for county users' });
      }
      // Verify county exists
      const county = await County.findById(cleanCountyId);
      if (!county) {
        return res.status(404).json({ message: 'County not found' });
      }
    }

    // Create user
    user = new User({
      username,
      email: email.toLowerCase(),
      password,
      role,
      countyId: cleanCountyId
    });

    await user.save();

    // Log the action
    logger.info(`Admin ${req.user.username} created user: ${username} (${email}) with role: ${role}`);

    // Don't return token - admin creates account, user logs in separately
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        countyId: user.countyId
      }
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists - convert email to lowercase to match database
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        countyId: user.countyId
      }
    });
  } catch (error) {
    logger.error('Error during login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        countyId: user.countyId
      }
    });
  } catch (error) {
    logger.error('Error fetching current user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

