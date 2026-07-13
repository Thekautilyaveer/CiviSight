// Mongoose-backed Contact repo (DATA_DRIVER=mongo). Interface mirrors db/repos/contacts.js.
const Contact = require('../../models/Contact');

async function findByCountyId(countyId) {
  return Contact.findOne({ countyId });
}

async function findAllPopulated() {
  return Contact.find().populate('countyId', 'name code');
}

async function create(countyId, contacts) {
  const contact = new Contact({ countyId, contacts: contacts || [] });
  await contact.save();
  return contact;
}

async function updateContacts(countyId, contacts) {
  let contact = await Contact.findOne({ countyId });
  if (!contact) contact = new Contact({ countyId, contacts: [] });
  contact.contacts = contacts || [];
  await contact.save();
  return contact;
}

module.exports = { findByCountyId, findAllPopulated, create, updateContacts };
