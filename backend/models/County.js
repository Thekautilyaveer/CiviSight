const mongoose = require('mongoose');

// "County" is the legacy model name; it now represents any reporting entity
// (county | city | authority). Kept for the mongo rollback driver's parity with the
// Supabase `entities` table. gov_id is Georgia's canonical government identifier.
const countySchema = new mongoose.Schema({
  govId: {
    type: String,
    trim: true,
    default: null
  },
  type: {
    type: String,
    enum: ['county', 'city', 'authority'],
    default: 'county'
  },
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

