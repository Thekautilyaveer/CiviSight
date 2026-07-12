// Parity harness: diff API JSON between DATA_DRIVER=mongo and DATA_DRIVER=supabase.
// Point it at two already-running servers (one per driver):
//
//   PARITY_MONGO_URL=http://localhost:5061/api \
//   PARITY_SUPA_URL=http://localhost:5062/api \
//   node scripts/verify-parity.js
//
// Documented normalizations (see SUPABASE_MIGRATION_PLAN.md §8):
//   - `__v` is dropped (Mongoose emits it; the frontend never reads it).
//   - List endpoints are compared as sets keyed by _id (tie-order within equal
//     (deadline, createdAt) groups is not guaranteed and doesn't matter).
//   - contacts[]._id is dropped (a GET may lazily append missing default roles, whose
//     subdoc ids are generated independently per driver).
// Note: avoid ports on the WHATWG "bad ports" blocklist (e.g. 5060/5061) — fetch() rejects them.
const MONGO = process.env.PARITY_MONGO_URL || 'http://localhost:5071/api';
const SUPA = process.env.PARITY_SUPA_URL || 'http://localhost:5072/api';

const CREDS = {
  accg: ['accg@civisight.org', 'accg123'],
  dca: ['dca@civisight.org', 'dca123'],
  county: ['troupcounty@civisight.org', 'county123'],
};

async function login(base, [email, password]) {
  const r = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return j.token ? { token: j.token, user: j.user } : null;
}

async function get(base, token, path) {
  const r = await fetch(base + path, { headers: { Authorization: 'Bearer ' + token } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// Recursively drop __v and sort keys for stable stringify.
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (k === '__v') continue;
      out[k] = canon(v[k]);
    }
    return out;
  }
  return v;
}

// Compare two list responses as sets keyed by _id.
function sortById(arr) {
  return [...arr].sort((a, b) => String(a?._id).localeCompare(String(b?._id)));
}

// GET /contacts/:id lazily appends missing default roles, mutating the doc and bumping
// updatedAt at a different instant per driver. Compare content only: drop subdoc _ids and
// the doc timestamps (the appended roles' generated ids also differ per driver).
function stripContactIds(body) {
  if (body && Array.isArray(body.contacts)) {
    // Drop the doc _id too: for a county with no prior contacts row, each driver creates a
    // fresh doc with an independently generated id (identity is by countyId, which matches).
    const { _id, createdAt, updatedAt, ...rest } = body;
    return { ...rest, contacts: body.contacts.map(({ _id: cid, ...c }) => c) };
  }
  return body;
}

const results = [];
function record(name, a, b, { list = false, contacts = false } = {}) {
  if (a.status !== b.status) {
    results.push({ name, ok: false, detail: `status mongo=${a.status} supa=${b.status}` });
    return;
  }
  let ba = a.body;
  let bb = b.body;
  if (contacts) { ba = stripContactIds(ba); bb = stripContactIds(bb); }
  if (list && Array.isArray(ba) && Array.isArray(bb)) {
    if (ba.length !== bb.length) {
      results.push({ name, ok: false, detail: `length mongo=${ba.length} supa=${bb.length}` });
      return;
    }
    ba = sortById(ba);
    bb = sortById(bb);
  }
  const sa = JSON.stringify(canon(ba));
  const sb = JSON.stringify(canon(bb));
  if (sa === sb) {
    results.push({ name, ok: true, detail: list && Array.isArray(ba) ? `${ba.length} items` : 'match' });
  } else {
    // Find the first differing top-level item for a helpful hint.
    let hint = '';
    if (list && Array.isArray(ba)) {
      for (let i = 0; i < ba.length; i++) {
        const x = JSON.stringify(canon(ba[i]));
        const y = JSON.stringify(canon(bb[i]));
        if (x !== y) { hint = ` first diff at _id=${ba[i]?._id}`; break; }
      }
    }
    results.push({ name, ok: false, detail: 'JSON differs' + hint, sa, sb });
  }
}

(async () => {
  const tok = { mongo: {}, supa: {} };
  for (const role of Object.keys(CREDS)) {
    tok.mongo[role] = await login(MONGO, CREDS[role]);
    tok.supa[role] = await login(SUPA, CREDS[role]);
    const ok = tok.mongo[role] && tok.supa[role];
    results.push({ name: `login ${role}`, ok: !!ok, detail: ok ? `role=${tok.supa[role].user.role}` : 'login failed' });
  }

  // Discover sample ids from the accg /tasks list (same rows on both drivers).
  const accgTasks = (await get(SUPA, tok.supa.accg.token, '/tasks')).body;
  const taskIds = accgTasks.slice(0, 6).map((t) => t._id);
  const counties = (await get(SUPA, tok.supa.accg.token, '/counties')).body;
  const countyIds = counties.slice(0, 6).map((c) => c._id);
  const users = (await get(SUPA, tok.supa.accg.token, '/users')).body;
  const userIds = users.slice(0, 6).map((u) => u._id);
  // Counties that already have a contacts row (avoid lazy-create diffs on empty ones).
  const contactCountyIds = counties
    .filter((c) => c.taskStats) // all have taskStats; pick a few with existing data
    .slice(0, 4)
    .map((c) => c._id);

  const pairGet = async (path, token) => [await get(MONGO, tok.mongo[token].token, path), await get(SUPA, tok.supa[token].token, path)];

  // Lists per role
  for (const role of ['accg', 'dca', 'county']) {
    const [a, b] = await pairGet('/tasks', role);
    record(`GET /tasks (${role})`, a, b, { list: true });
  }
  { const [a, b] = await pairGet('/counties', 'accg'); record('GET /counties (accg)', a, b, { list: true }); }
  { const [a, b] = await pairGet('/counties', 'county'); record('GET /counties (county)', a, b, { list: true }); }
  { const [a, b] = await pairGet('/users', 'accg'); record('GET /users', a, b, { list: true }); }
  { const [a, b] = await pairGet('/users/admins', 'accg'); record('GET /users/admins', a, b, { list: true }); }
  for (const role of ['accg', 'dca', 'county']) {
    const [a, b] = await pairGet('/notifications', role);
    record(`GET /notifications (${role})`, a, b, { list: true });
  }
  { const [a, b] = await pairGet('/notifications/upcoming', 'accg'); record('GET /notifications/upcoming', a, b, { list: true }); }

  // Singles
  for (const id of taskIds) { const [a, b] = await pairGet('/tasks/' + id, 'accg'); record('GET /tasks/' + id, a, b); }
  for (const id of taskIds) { const [a, b] = await pairGet('/tasks/' + id + '/comments', 'accg'); record('GET /tasks/' + id + '/comments', a, b); }
  for (const id of countyIds) { const [a, b] = await pairGet('/counties/' + id, 'accg'); record('GET /counties/' + id, a, b); }
  for (const id of userIds) { const [a, b] = await pairGet('/users/' + id, 'accg'); record('GET /users/' + id, a, b); }
  for (const id of contactCountyIds) { const [a, b] = await pairGet('/contacts/' + id, 'accg'); record('GET /contacts/' + id, a, b, { contacts: true }); }

  // Report
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nParity: ${pass}/${results.length} checks passed.\n`);
  for (const r of results) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  if (fail.length) {
    console.log('\n--- first failing diff detail ---');
    const f = fail.find((r) => r.sa);
    if (f) {
      console.log(f.name);
      console.log('mongo:', f.sa.slice(0, 1200));
      console.log('supa :', f.sb.slice(0, 1200));
    }
    process.exit(1);
  }
  console.log('\n✅ Full parity across all checked endpoints.');
})().catch((e) => { console.error('PARITY HARNESS ERROR:', e); process.exit(1); });
