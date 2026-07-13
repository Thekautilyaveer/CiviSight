// One-shot, idempotent, NON-DESTRUCTIVE data migration: MongoDB -> Supabase Postgres.
// Reads Mongo via MONGODB_URI; writes Postgres via SUPABASE_DB_URL.
// Mongo is left completely untouched (read-only). See /SUPABASE_MIGRATION_PLAN.md §5.
//
//   node scripts/migrate-mongo-to-supabase.js
//
// Idempotent: every table is upserted ON CONFLICT (id) DO UPDATE, so re-runs are no-ops
// (aside from refreshing updated_at). Load order respects FKs:
//   counties -> users -> tasks -> contacts -> notifications
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');
const { Client } = require('pg');

// Source doc counts. `notifications` here is the Mongo total; the migratable subset is
// smaller because much of it is historical dead data (notifications whose user was later
// deleted). The target schema's `notifications.user_id` FK is ON DELETE CASCADE, so those
// rows cannot exist in Postgres and are skipped (Mongo keeps them as fallback). The
// migratable count is computed at runtime and asserted below.
const EXPECTED = { counties: 21, users: 25, tasks: 316, contacts: 8 };

// --- value converters ---------------------------------------------------------
// Deeply convert a Mongo value for storage: ObjectId -> hex string, Date -> ISO string,
// recurse into arrays/plain objects. camelCase keys are preserved (for jsonb passthrough).
function deep(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof ObjectId) return v.toString();
  if (v && v._bsontype === 'ObjectID') return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(deep);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = deep(val);
    return o;
  }
  return v;
}
const id = (v) => (v == null ? null : (v instanceof ObjectId || (v && v._bsontype === 'ObjectID')) ? v.toString() : String(v));
const iso = (v) => (v instanceof Date ? v.toISOString() : v == null ? null : v);
const jstr = (v) => JSON.stringify(deep(v == null ? (Array.isArray(v) ? [] : v) : v));
const arrJson = (v) => JSON.stringify(deep(Array.isArray(v) ? v : []));
const objJson = (v) => (v == null ? null : JSON.stringify(deep(v)));

(async () => {
  const mongoUri = process.env.MONGODB_URI;
  const pgUrl = process.env.SUPABASE_DB_URL;
  if (!mongoUri || !pgUrl) {
    console.error('Missing MONGODB_URI or SUPABASE_DB_URL in backend/.env');
    process.exit(1);
  }

  const mongo = new MongoClient(mongoUri);
  const pg = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
  await mongo.connect();
  await pg.connect();
  const db = mongo.db();

  const stats = {};
  const skipped = { notif_no_user: 0, notif_task_nulled: 0 };
  // Valid-id sets so we never violate a FK (schema-mandated cascade/set-null semantics).
  const validUsers = new Set((await db.collection('users').find({}, { projection: { _id: 1 } }).toArray()).map((u) => u._id.toString()));
  const validTasks = new Set((await db.collection('tasks').find({}, { projection: { _id: 1 } }).toArray()).map((t) => t._id.toString()));
  try {
    await pg.query('begin');

    // === counties ===
    {
      const docs = await db.collection('counties').find({}).toArray();
      for (const d of docs) {
        await pg.query(
          `insert into entities
             (id,name,code,description,email,
              fiscal_year_start_month,fiscal_year_start_day,fiscal_year_end_month,fiscal_year_end_day,
              created_at,updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (id) do update set
             name=excluded.name, code=excluded.code, description=excluded.description, email=excluded.email,
             fiscal_year_start_month=excluded.fiscal_year_start_month, fiscal_year_start_day=excluded.fiscal_year_start_day,
             fiscal_year_end_month=excluded.fiscal_year_end_month, fiscal_year_end_day=excluded.fiscal_year_end_day,
             created_at=excluded.created_at, updated_at=excluded.updated_at`,
          [
            id(d._id), d.name, d.code, d.description || '', d.email || '',
            d.fiscalYearStartMonth ?? 1, d.fiscalYearStartDay ?? 1,
            d.fiscalYearEndMonth ?? 12, d.fiscalYearEndDay ?? 31,
            iso(d.createdAt) || new Date().toISOString(), iso(d.updatedAt) || new Date().toISOString(),
          ]
        );
      }
      stats.counties = docs.length;
    }

    // === users ===
    {
      const docs = await db.collection('users').find({}).toArray();
      for (const d of docs) {
        await pg.query(
          `insert into users
             (id,username,email,password,role,county_id,department_roles,created_at,updated_at)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
           on conflict (id) do update set
             username=excluded.username, email=excluded.email, password=excluded.password,
             role=excluded.role, county_id=excluded.county_id, department_roles=excluded.department_roles,
             created_at=excluded.created_at, updated_at=excluded.updated_at`,
          [
            id(d._id), d.username, (d.email || '').toLowerCase(), d.password,
            d.role || 'county_user', id(d.countyId), arrJson(d.departmentRoles),
            iso(d.createdAt) || new Date().toISOString(), iso(d.updatedAt) || new Date().toISOString(),
          ]
        );
      }
      stats.users = docs.length;
    }

    // === tasks ===
    {
      const docs = await db.collection('tasks').find({}).toArray();
      for (const d of docs) {
        await pg.query(
          `insert into tasks
             (id,title,description,county_id,submitted_to,portal_link,status,priority,deadline,assigned_by,
              assigned_roles,assigned_contacts,reminders,form_file,filled_form_file,comments,
              completed_at,created_at,updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                   $11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,
                   $17,$18,$19)
           on conflict (id) do update set
             title=excluded.title, description=excluded.description, county_id=excluded.county_id,
             submitted_to=excluded.submitted_to, portal_link=excluded.portal_link, status=excluded.status,
             priority=excluded.priority, deadline=excluded.deadline, assigned_by=excluded.assigned_by,
             assigned_roles=excluded.assigned_roles, assigned_contacts=excluded.assigned_contacts,
             reminders=excluded.reminders, form_file=excluded.form_file, filled_form_file=excluded.filled_form_file,
             comments=excluded.comments, completed_at=excluded.completed_at,
             created_at=excluded.created_at, updated_at=excluded.updated_at`,
          [
            id(d._id), d.title, d.description || '', id(d.countyId), d.submittedTo || '', d.portalLink || '',
            d.status || 'pending', d.priority || 'medium', iso(d.deadline), id(d.assignedBy),
            arrJson(d.assignedRoles), arrJson(d.assignedContacts), arrJson(d.reminders),
            objJson(d.formFile), objJson(d.filledFormFile), arrJson(d.comments),
            iso(d.completedAt), iso(d.createdAt) || new Date().toISOString(), iso(d.updatedAt) || new Date().toISOString(),
          ]
        );
      }
      stats.tasks = docs.length;
    }

    // === contacts ===
    {
      const docs = await db.collection('contacts').find({}).toArray();
      for (const d of docs) {
        await pg.query(
          `insert into contacts (id,county_id,contacts,created_at,updated_at)
           values ($1,$2,$3::jsonb,$4,$5)
           on conflict (id) do update set
             county_id=excluded.county_id, contacts=excluded.contacts,
             created_at=excluded.created_at, updated_at=excluded.updated_at`,
          [
            id(d._id), id(d.countyId), arrJson(d.contacts),
            iso(d.createdAt) || new Date().toISOString(), iso(d.updatedAt) || new Date().toISOString(),
          ]
        );
      }
      stats.contacts = docs.length;
    }

    // === notifications ===
    {
      const docs = await db.collection('notifications').find({}).toArray();
      let migrated = 0;
      for (const d of docs) {
        const uid = id(d.userId);
        if (!uid || !validUsers.has(uid)) { skipped.notif_no_user++; continue; } // ON DELETE CASCADE semantics
        let tid = id(d.taskId);
        if (tid && !validTasks.has(tid)) { tid = null; skipped.notif_task_nulled++; } // ON DELETE SET NULL semantics
        await pg.query(
          `insert into notifications (id,user_id,type,title,message,task_id,read,created_at,updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (id) do update set
             user_id=excluded.user_id, type=excluded.type, title=excluded.title, message=excluded.message,
             task_id=excluded.task_id, read=excluded.read,
             created_at=excluded.created_at, updated_at=excluded.updated_at`,
          [
            id(d._id), uid, d.type, d.title, d.message, tid, !!d.read,
            iso(d.createdAt) || new Date().toISOString(), iso(d.updatedAt) || new Date().toISOString(),
          ]
        );
        migrated++;
      }
      stats.notifications_total = docs.length;
      stats.notifications = migrated;
    }

    await pg.query('commit');
  } catch (err) {
    await pg.query('rollback').catch(() => {});
    console.error('\nMIGRATION FAILED (rolled back):', err.message);
    await mongo.close().catch(() => {});
    await pg.end().catch(() => {});
    process.exit(1);
  }

  // === verify: row counts + referential integrity ===
  console.log('\nSource docs migrated:');
  for (const k of Object.keys(EXPECTED)) console.log(`  ${k}: ${stats[k]}`);
  console.log(`  notifications: ${stats.notifications} of ${stats.notifications_total} (skipped ${skipped.notif_no_user} orphaned-user; nulled ${skipped.notif_task_nulled} orphaned task_id)`);

  const q = async (sql) => (await pg.query(sql)).rows[0].n;
  const pgCounts = {
    counties: await q('select count(*)::int n from entities'),
    users: await q('select count(*)::int n from users'),
    tasks: await q('select count(*)::int n from tasks'),
    contacts: await q('select count(*)::int n from contacts'),
    notifications: await q('select count(*)::int n from notifications'),
  };

  console.log('\nPostgres row counts (expected):');
  let ok = true;
  for (const k of Object.keys(EXPECTED)) {
    const match = pgCounts[k] === EXPECTED[k];
    if (!match) ok = false;
    console.log(`  ${k}: ${pgCounts[k]} (${EXPECTED[k]})  ${match ? 'OK' : 'MISMATCH'}`);
  }
  {
    const match = pgCounts.notifications === stats.notifications;
    if (!match) ok = false;
    console.log(`  notifications: ${pgCounts.notifications} (${stats.notifications})  ${match ? 'OK' : 'MISMATCH'}`);
  }

  const orphanTasksCounty = await q('select count(*)::int n from tasks t left join entities c on c.id=t.county_id where c.id is null');
  const orphanTasksUser = await q('select count(*)::int n from tasks t left join users u on u.id=t.assigned_by where u.id is null');
  const orphanNotifUser = await q('select count(*)::int n from notifications x left join users u on u.id=x.user_id where u.id is null');
  const orphanContactsCounty = await q('select count(*)::int n from contacts c left join entities k on k.id=c.county_id where k.id is null');

  console.log('\nReferential integrity (all should be 0):');
  console.log(`  tasks w/ missing county:      ${orphanTasksCounty}`);
  console.log(`  tasks w/ missing assigned_by: ${orphanTasksUser}`);
  console.log(`  notifications w/ missing user:${orphanNotifUser}`);
  console.log(`  contacts w/ missing county:   ${orphanContactsCounty}`);
  const fkOk = orphanTasksCounty + orphanTasksUser + orphanNotifUser + orphanContactsCounty === 0;

  await mongo.close().catch(() => {});
  await pg.end().catch(() => {});

  if (ok && fkOk) {
    console.log('\n✅ Phase 2 complete: counts match, referential integrity clean.');
  } else {
    console.log('\n❌ Verification failed (see above).');
    process.exit(1);
  }
})();
