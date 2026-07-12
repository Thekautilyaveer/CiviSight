/**
 * One-off: populate Troup County contacts without re-running full seed.
 * MongoDB-only (DATA_DRIVER=mongo); for the Supabase store, edit contacts via the app.
 * Usage: node seed-troup-contacts.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const County = require('./models/County');
const Contact = require('./models/Contact');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';

const troupContactRows = [
  {
    role: 'County Manager / Administrator',
    name: 'Eric Steele',
    email: 'eric.steele@troupcounty.org',
    phone: '(706) 883-1610'
  },
  {
    role: 'County Clerk / Clerk of the Board',
    name: 'Diane Morrison',
    email: 'diane.morrison@troupcounty.org',
    phone: '(706) 883-1611'
  },
  {
    role: 'Chief Financial Officer (CFO) / Finance Director',
    name: 'Patricia Nguyen',
    email: 'patricia.nguyen@troupcounty.org',
    phone: '(706) 883-1612'
  },
  {
    role: 'Budget Director',
    name: 'James Carter',
    email: 'james.carter@troupcounty.org',
    phone: '(706) 883-1613'
  },
  {
    role: 'Grants Manager / Grants Coordinator',
    name: 'Angela Brooks',
    email: 'angela.brooks@troupcounty.org',
    phone: '(706) 883-1614'
  },
  {
    role: 'County Attorney / Legal Counsel',
    name: 'David Whitfield',
    email: 'david.whitfield@troupcounty.org',
    phone: '(706) 883-1615'
  }
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  const county = await County.findOne({ code: 'TROUP' });
  if (!county) {
    console.error('Troup County not found. Run seed.js first.');
    process.exit(1);
  }

  await Contact.findOneAndUpdate(
    { countyId: county._id },
    { countyId: county._id, contacts: troupContactRows },
    { upsert: true, new: true }
  );

  console.log(`Seeded ${troupContactRows.length} contacts for Troup County.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
