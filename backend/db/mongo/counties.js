// Mongoose-backed County repo (DATA_DRIVER=mongo). Returns native Mongoose docs, which
// serialize exactly as the app has always behaved. Interface mirrors db/repos/counties.js.
const County = require('../../models/County');

async function findAllSorted() {
  return County.find().sort({ name: 1 });
}
async function findById(id) {
  return County.findById(id);
}
async function findByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return County.find({ _id: { $in: ids } });
}
async function create({ name, code, description = '', email = '' }) {
  const county = new County({ name, code, description: description || '', email: email || '' });
  await county.save(); // Mongoose sets err.code 11000 on duplicate key
  return county;
}
async function updateById(id, { name, code, description }) {
  return County.findByIdAndUpdate(id, { name, code, description }, { new: true, runValidators: true });
}
async function deleteById(id) {
  return County.findByIdAndDelete(id);
}

module.exports = { findAllSorted, findById, findByIds, create, updateById, deleteById };
