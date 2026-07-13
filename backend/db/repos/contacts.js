// Contact repository (Supabase Postgres). One row per county; contacts is a jsonb array
// of {_id, role, name, email, phone} objects (keys preserved from Mongo).
const { query } = require('../pool');
const m = require('../mapper');

const COLS = `id,county_id,contacts,created_at,updated_at`;

// Mongoose assigns an _id to every subdocument on save. Mirror that so downstream code
// (task assignedContacts resolution) can match on contact._id.
function withIds(contacts) {
  return (Array.isArray(contacts) ? contacts : []).map((c) => ({
    ...c,
    _id: c && c._id ? String(c._id) : m.newId(),
  }));
}

async function findByCountyId(countyId) {
  const { rows } = await query(`select ${COLS} from contacts where county_id = $1`, [countyId]);
  return rows[0] ? m.contact(rows[0]) : null;
}

// All contact docs, county populated ({_id,name,code}), sorted by county name.
// One round-trip instead of N per-county fetches.
async function findAllPopulated() {
  const { rows } = await query(
    `select ct.id, ct.county_id, ct.contacts, ct.created_at, ct.updated_at,
            c.name as c_name, c.code as c_code
       from contacts ct left join entities c on c.id = ct.county_id
      order by c.name asc`
  );
  return rows.map((r) => {
    const doc = m.contact(r);
    doc.countyId = r.c_name ? { _id: r.county_id, name: r.c_name, code: r.c_code } : r.county_id;
    return doc;
  });
}

// Create a contact doc for a county with the given contacts array.
async function create(countyId, contacts) {
  const id = m.newId();
  const { rows } = await query(
    `insert into contacts (id,county_id,contacts) values ($1,$2,$3::jsonb) returning ${COLS}`,
    [id, countyId, JSON.stringify(withIds(contacts))]
  );
  return m.contact(rows[0]);
}

// Replace the contacts array for an existing doc (by county).
async function updateContacts(countyId, contacts) {
  const { rows } = await query(
    `update contacts set contacts = $2::jsonb where county_id = $1 returning ${COLS}`,
    [countyId, JSON.stringify(withIds(contacts))]
  );
  return rows[0] ? m.contact(rows[0]) : null;
}

module.exports = { findByCountyId, findAllPopulated, create, updateContacts };
