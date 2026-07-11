/**
 * One-off: populate Gwinnett County contacts without re-running full seed.
 * Usage: node seed-gwinnett-contacts.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const County = require('./models/County');
const Contact = require('./models/Contact');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';

const gwinnettContactRows = [
  {
    role: 'County Administrator',
    name: 'Glenn Stephens',
    email: 'Glenn.Stephens@GwinnettCounty.com',
    phone: '770-822-7000'
  },
  {
    role: 'County Clerk to the Commission',
    name: 'Tammy Gibson',
    email: 'Tammy.Gibson@GwinnettCounty.com',
    phone: '770-822-7000'
  },
  {
    role: 'Deputy County Administrator / Chief Financial Officer',
    name: 'Buffy Rainey',
    email: 'Buffy.Rainey@GwinnettCounty.com',
    phone: '770-822-7000'
  },
  {
    role: 'Budget Director',
    name: 'Joe Johnson',
    email: 'Joseph.Johnson@GwinnettCounty.com',
    phone: '770-822-7832'
  },
  {
    role: 'Grants Manager / Director',
    name: 'Dr. Nde Phinda "Phinda" Hillmon',
    email: 'NdePhinda.Hillmon@GwinnettCounty.com',
    phone: '770-822-5079'
  },
  {
    role: 'County Attorney / Legal Counsel',
    name: 'Mike Ludwiczak',
    email: 'Mike.Ludwiczak@GwinnettCounty.com',
    phone: '770-822-8700'
  },
  {
    role: 'District 2 County Commissioner',
    name: 'Ben Ku',
    email: 'Ben.Ku@GwinnettCounty.com',
    phone: '770-822-7002'
  }
];

async function run() {
  await mongoose.connect(MONGODB_URI);
  const county = await County.findOne({ code: 'GWINNETT' });
  if (!county) {
    console.error('Gwinnett County not found. Run seed.js first.');
    process.exit(1);
  }

  await Contact.findOneAndUpdate(
    { countyId: county._id },
    { countyId: county._id, contacts: gwinnettContactRows },
    { upsert: true, new: true }
  );

  console.log(`Seeded ${gwinnettContactRows.length} contacts for Gwinnett County.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
