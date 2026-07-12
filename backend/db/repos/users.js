// User repository (Supabase Postgres). Passwords are bcrypt-hashed here (mirrors the
// Mongoose pre-save hook) and never returned except by the explicit *WithPassword lookups.
const bcrypt = require('bcryptjs');
const { query } = require('../pool');
const m = require('../mapper');

const COLS = `id,username,email,role,county_id,department_roles,created_at,updated_at`;
const COLS_PW = `${COLS},password`;

function dupError() {
  const e = new Error('duplicate key');
  e.code = 11000;
  return e;
}

// county join columns aliased so the mapper can embed a populated countyId.
const COUNTY_JOIN = `c.id as c_id, c.name as c_name, c.code as c_code, c.email as c_email`;
const countyFromRow = (r) => (r.c_id ? { id: r.c_id, name: r.c_name, code: r.c_code, email: r.c_email } : null);

// For auth middleware: user minus password, countyId as id string (not populated).
async function findById(id) {
  const { rows } = await query(`select ${COLS} from users where id = $1`, [id]);
  return rows[0] ? m.user(rows[0]) : null;
}

// Login: needs the password hash. Returns { user: shaped, password } or null.
async function findByEmailWithPassword(email) {
  const { rows } = await query(`select ${COLS_PW} from users where email = $1`, [(email || '').toLowerCase()]);
  if (!rows[0]) return null;
  return { user: m.user(rows[0]), password: rows[0].password };
}

// Register duplicate check (email OR username).
async function findByEmailOrUsername(email, username) {
  const { rows } = await query(
    `select ${COLS} from users where email = $1 or username = $2 limit 1`,
    [(email || '').toLowerCase(), username]
  );
  return rows[0] ? m.user(rows[0]) : null;
}

async function comparePassword(candidate, hash) {
  return bcrypt.compare(candidate, hash);
}

// Mirrors `new User(...).save()` incl. bcrypt hashing at 10 rounds.
async function create({ username, email, password, role = 'county_user', countyId = null, departmentRoles = [] }) {
  const id = m.newId();
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `insert into users (id,username,email,password,role,county_id,department_roles)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb) returning ${COLS}`,
      [id, username, (email || '').toLowerCase(), hash, role, countyId || null, JSON.stringify(departmentRoles || [])]
    );
    return m.user(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw dupError();
    throw err;
  }
}

// GET /users — all users, no password, populate countyId (name/code), sort createdAt desc.
async function findAllPopulated() {
  const { rows } = await query(
    `select ${COLS.split(',').map((c) => 'u.' + c.trim()).join(',')}, ${COUNTY_JOIN}
       from users u left join counties c on c.id = u.county_id
      order by u.created_at desc`
  );
  return rows.map((r) => m.user(r, { populatedCounty: countyFromRow(r) }));
}

// GET /users/admins — role='accg', no password, sort createdAt desc (countyId as id/null).
async function findByRole(role) {
  const { rows } = await query(`select ${COLS} from users where role = $1 order by created_at desc`, [role]);
  return rows.map((r) => m.user(r));
}

// GET /users/:id — no password, populate countyId.
async function findByIdPopulated(id) {
  const { rows } = await query(
    `select ${COLS.split(',').map((c) => 'u.' + c.trim()).join(',')}, ${COUNTY_JOIN}
       from users u left join counties c on c.id = u.county_id
      where u.id = $1`,
    [id]
  );
  return rows[0] ? m.user(rows[0], { populatedCounty: countyFromRow(rows[0]) }) : null;
}

async function deleteById(id) {
  const { rows } = await query(`delete from users where id = $1 returning ${COLS}`, [id]);
  return rows[0] ? m.user(rows[0]) : null;
}

// Task notifications: county users for a county (need departmentRoles for role filtering).
async function findCountyUsers(countyId) {
  const { rows } = await query(
    `select ${COLS} from users where county_id = $1 and role = 'county_user'`,
    [countyId]
  );
  return rows.map((r) => m.user(r));
}

// Fetch a set of users as populate refs for comments ({_id,username,email,role}).
async function findRefsByIds(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (uniq.length === 0) return new Map();
  const { rows } = await query(`select id,username,email,role from users where id = any($1::text[])`, [uniq]);
  const map = new Map();
  for (const r of rows) map.set(r.id, { _id: r.id, username: r.username, email: r.email, role: r.role });
  return map;
}

module.exports = {
  findById,
  findByEmailWithPassword,
  findByEmailOrUsername,
  comparePassword,
  create,
  findAllPopulated,
  findByRole,
  findByIdPopulated,
  deleteById,
  findCountyUsers,
  findRefsByIds,
};
