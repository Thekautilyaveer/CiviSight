// DEPRECATED for the Supabase store: scripts/seed-supabase.js already creates the DCA
// account, and the live Supabase data already includes it. This one-shot targets MongoDB
// (DATA_DRIVER=mongo) only.
// Idempotent: ensures the DCA (Georgia Dept. of Community Affairs) admin-privileged
// account exists, WITHOUT wiping any existing data. Safe to run against a live DB.
//
//   node scripts/seed-dca-user.js
//
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const DCA = {
  username: 'dca',
  email: 'dca@civisight.org',
  password: 'dca123',
  role: 'dca'
};

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const existing = await User.findOne({ email: DCA.email });
    if (existing) {
      // Keep it in sync (role + password) but leave everything else alone.
      existing.role = 'dca';
      existing.password = DCA.password; // pre-save hook re-hashes
      await existing.save();
      console.log(`Updated existing DCA user: ${DCA.email} (role: dca, password reset to dca123)`);
    } else {
      await new User(DCA).save();
      console.log(`Created DCA user: ${DCA.email} / ${DCA.password} (role: dca)`);
    }
  } catch (err) {
    console.error('Failed to seed DCA user:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
