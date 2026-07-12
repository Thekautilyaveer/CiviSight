const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEPARTMENT_ROLE_SLUGS } = require('../constants/departmentRoles');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['accg', 'dca', 'county_user'],
    default: 'county_user'
  },
  countyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'County',
    default: null
  },
  departmentRoles: [{
    type: String,
    enum: DEPARTMENT_ROLE_SLUGS
  }]
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Database indexes for performance optimization
// Compound index for finding county users (very common query)
userSchema.index({ countyId: 1, role: 1 });

// Note: email and username already have unique indexes (from unique: true in schema)

module.exports = mongoose.model('User', userSchema);

