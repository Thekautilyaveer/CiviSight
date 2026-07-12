// DEPRECATED for the Supabase store: this rename was already applied and is reflected in
// the migrated Supabase data. This one-shot targets MongoDB (DATA_DRIVER=mongo) only.
// Idempotent migration: the legacy ACCG account was `admin@civisight.org` with role
// `admin`. There is no longer an "admin" role — ACCG is its own role. This renames the
// account to `accg@civisight.org` / `accg123` with role `accg`, WITHOUT wiping any data.
// Safe to run more than once.
//
//   node scripts/migrate-admin-to-accg.js
//
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const OLD_EMAIL = 'admin@civisight.org';
const NEW_EMAIL = 'accg@civisight.org';
const NEW_PASSWORD = 'accg123';

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Match by either email OR the legacy role, so it works before/after a partial run.
    let user =
      (await User.findOne({ email: NEW_EMAIL })) ||
      (await User.findOne({ email: OLD_EMAIL })) ||
      (await User.findOne({ role: 'admin' }));

    if (!user) {
      console.log('No legacy admin/ACCG account found — nothing to migrate.');
      return;
    }

    user.username = 'accg';
    user.email = NEW_EMAIL;
    user.role = 'accg';
    user.password = NEW_PASSWORD; // pre-save hook re-hashes
    await user.save();
    console.log(`Migrated ACCG account -> ${NEW_EMAIL} / ${NEW_PASSWORD} (role: accg)`);

    const strays = await User.countDocuments({ role: 'admin' });
    console.log(strays === 0 ? 'No accounts left with role "admin".' : `WARNING: ${strays} account(s) still have role "admin".`);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
