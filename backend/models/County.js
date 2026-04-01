const mongoose = require('mongoose');

const countySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  fiscalYearStartMonth: { type: Number, default: 1 },
  fiscalYearStartDay: { type: Number, default: 1 },
  fiscalYearEndMonth: { type: Number, default: 12 },
  fiscalYearEndDay: { type: Number, default: 31 }
}, {
  timestamps: true
});

module.exports = mongoose.model('County', countySchema);

