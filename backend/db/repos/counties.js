// Entity repository (Supabase Postgres). "Entities" are reporting governments — counties,
// cities, and authorities (the table was formerly `counties`). The store key stays
// `store.counties` for interface stability; it manages entities of all types, scoped by
// the caller's role (see routes + utils/roles.js entityTypesFor). Returns Mongoose-shaped
// JSON via mapper.county.
const { query } = require('../pool');
const m = require('../mapper');

const COLS = `id,gov_id,type,name,code,description,email,
  fiscal_year_start_month,fiscal_year_start_day,fiscal_year_end_month,fiscal_year_end_day,
  created_at,updated_at`;

// Mongoose duplicate-key parity: throw an error carrying code 11000 so routes that check
// `error.code === 11000` behave identically.
function dupError() {
  const e = new Error('duplicate key');
  e.code = 11000;
  return e;
}

// Optional `types` (array of 'county'|'city'|'authority') scopes the list — ACCG passes
// ['county'], DCA passes all types. Omitted => every type.
async function findAllSorted(types = null) {
  const scoped = Array.isArray(types) && types.length > 0;
  const { rows } = await query(
    `select ${COLS} from entities ${scoped ? 'where type = any($1::text[])' : ''} order by name asc`,
    scoped ? [types] : []
  );
  return rows.map((r) => m.county(r));
}

async function findById(id) {
  const { rows } = await query(`select ${COLS} from entities where id = $1`, [id]);
  return rows[0] ? m.county(rows[0]) : null;
}

// Returns raw rows for existence checks (id list). Used by bulk task create.
async function findByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const { rows } = await query(`select ${COLS} from entities where id = any($1::text[])`, [ids]);
  return rows.map((r) => m.county(r));
}

async function create({ name, code, description = '', email = '', type = 'county', govId = null }) {
  const id = m.newId();
  try {
    const { rows } = await query(
      `insert into entities (id,name,code,description,email,type,gov_id)
       values ($1,$2,$3,$4,$5,$6,$7) returning ${COLS}`,
      [id, name, code, description || '', (email || '').toLowerCase(), type, govId]
    );
    return m.county(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw dupError(); // unique_violation
    throw err;
  }
}

// Mirrors findByIdAndUpdate({name,code,description}, {new:true}); returns null if absent.
async function updateById(id, { name, code, description }) {
  const { rows } = await query(
    `update entities set
       name = coalesce($2, name),
       code = coalesce($3, code),
       description = coalesce($4, description)
     where id = $1 returning ${COLS}`,
    [id, name ?? null, code ?? null, description ?? null]
  );
  return rows[0] ? m.county(rows[0]) : null;
}

// Returns the deleted row (null if none) so routes can 404 like findByIdAndDelete.
async function deleteById(id) {
  const { rows } = await query(`delete from entities where id = $1 returning ${COLS}`, [id]);
  return rows[0] ? m.county(rows[0]) : null;
}

module.exports = {
  findAllSorted,
  findById,
  findByIds,
  create,
  updateById,
  deleteById,
};
