// Mongoose-backed User repo (DATA_DRIVER=mongo). Interface mirrors db/repos/users.js.
const User = require('../../models/User');

async function findById(id) {
  return User.findById(id).select('-password');
}

// Verify login; returns a password-free user object or null.
async function verifyCredentials(email, password) {
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user) return null;
  const ok = await user.comparePassword(password);
  if (!ok) return null;
  return { _id: user._id, username: user.username, email: user.email, role: user.role, countyId: user.countyId };
}

async function findByEmailOrUsername(email, username) {
  return User.findOne({ $or: [{ email: (email || '').toLowerCase() }, { username }] });
}

async function create({ username, email, password, role = 'county_user', countyId = null, departmentRoles = [] }) {
  const user = new User({
    username,
    email: (email || '').toLowerCase(),
    password,
    role,
    countyId: countyId || null,
    departmentRoles: departmentRoles || [],
  });
  await user.save(); // pre-save hook hashes the password; err.code 11000 on duplicate
  return user;
}

async function findAllPopulated() {
  return User.find().select('-password').populate('countyId', 'name code').sort({ createdAt: -1 });
}
async function findByRole(role) {
  return User.find({ role }).select('-password').sort({ createdAt: -1 });
}
async function findByIdPopulated(id) {
  return User.findById(id).select('-password').populate('countyId', 'name code');
}
async function deleteById(id) {
  return User.findByIdAndDelete(id);
}
async function findCountyUsers(countyId) {
  return User.find({ countyId, role: 'county_user' });
}

module.exports = {
  findById,
  verifyCredentials,
  findByEmailOrUsername,
  create,
  findAllPopulated,
  findByRole,
  findByIdPopulated,
  deleteById,
  findCountyUsers,
};
