const jwt = require('jsonwebtoken');
const store = require('../db/store');
const { hasAdminPowers } = require('../utils/roles');

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

module.exports = { auth, adminOnly };

