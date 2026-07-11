const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { hasAdminPowers } = require('../utils/roles');
const Contact = require('../models/Contact');
const County = require('../models/County');
const logger = require('../utils/logger');

// Default contact roles
const DEFAULT_CONTACT_ROLES = [
  'County Manager / Administrator',
  'Assistant County Manager',
  'County Commission Chair / Board of Commissioners',
  'County Clerk / Clerk of the Board',
  'Chief Financial Officer (CFO) / Finance Director',
  'Budget Director',
  'Grants Manager / Grants Coordinator',
  'Procurement / Purchasing Director',
  'Accounts Payable / Receivable Manager',
  'County Attorney / Legal Counsel',
  'Compliance Officer',
  'Risk Management Director',
  'Insurance / Claims Manager',
  'Open Records / FOIA Officer',
  'Elections Supervisor',
  'Registrar',
  'Records Manager',
  'Deeds & Records Clerk'
];

// @route   GET /api/contacts/:countyId
// @desc    Get contacts for a county
// @access  Private
router.get('/:countyId', auth, async (req, res) => {
  try {
    const { countyId } = req.params;

    // Check if user has access to this county
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== countyId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify county exists
    const county = await County.findById(countyId);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    // Get or create contact document
    let contact = await Contact.findOne({ countyId });

    if (!contact) {
      // Create contact document with default roles
      contact = new Contact({
        countyId,
        contacts: DEFAULT_CONTACT_ROLES.map(role => ({
          role,
          name: '',
          email: '',
          phone: ''
        }))
      });
      await contact.save();
    } else {
      // Ensure all default roles exist
      const existingRoles = contact.contacts.map(c => c.role);
      const missingRoles = DEFAULT_CONTACT_ROLES.filter(role => !existingRoles.includes(role));
      
      if (missingRoles.length > 0) {
        missingRoles.forEach(role => {
          contact.contacts.push({
            role,
            name: '',
            email: '',
            phone: ''
          });
        });
        await contact.save();
      }
    }

    res.json(contact);
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/contacts/:countyId
// @desc    Update contacts for a county
// @access  Private
router.put('/:countyId', auth, async (req, res) => {
  try {
    const { countyId } = req.params;
    const { contacts } = req.body;

    // Check if user has access to this county
    if (!hasAdminPowers(req.user) && req.user.countyId?.toString() !== countyId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify county exists
    const county = await County.findById(countyId);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    // Validate contacts structure
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ message: 'Contacts must be an array' });
    }

    // Update or create contact document
    let contact = await Contact.findOne({ countyId });

    if (!contact) {
      contact = new Contact({
        countyId,
        contacts: []
      });
    }

    contact.contacts = contacts;
    await contact.save();

    res.json(contact);
  } catch (error) {
    logger.error('Error updating contacts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

