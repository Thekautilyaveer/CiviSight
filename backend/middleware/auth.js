const jwt = require('jsonwebtoken');
const store = require('../db/store');
const { hasAdminPowers, isReviewingAgency } = require('../utils/roles');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    const user = await store.users.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Gates admin-only endpoints. Both ACCG ('accg') and DCA ('dca') pass — DCA has
// all the backend powers ACCG has.
const adminOnly = (req, res, next) => {
  if (!hasAdminPowers(req.user)) {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

// Gates submission-review actions to reviewing agencies (DCA) only. ACCG is a mediator
// and cannot review — reviewing belongs to the receiving state agency.
const agencyOnly = (req, res, next) => {
  if (!isReviewingAgency(req.user)) {
    return res.status(403).json({ message: 'Access denied. Only the reviewing agency can review submissions.' });
  }
  next();
};

module.exports = { auth, adminOnly, agencyOnly };

