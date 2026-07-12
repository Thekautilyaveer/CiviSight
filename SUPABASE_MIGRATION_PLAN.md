# CiviSight — MongoDB → Supabase (Postgres) Migration Plan

**Status:** Ready to execute. **Type:** Store-swap only (no feature changes). **Author:** prepared for any engineer/agent to follow end-to-end.

This document is the single source of truth for migrating CiviSight's data store from MongoDB (Mongoose) to Supabase (Postgres), **without changing the API contract or the frontend**. Follow the phases in order. Every phase has explicit acceptance criteria. Do not skip verification.

---

## 0. Goal, scope, and non-negotiables

### Goal
Replace MongoDB with a Supabase Postgres database as the single source of truth for the entire backend, so all three faces (DCA, ACCG, county) read/write the same data. This is the **foundation**; modeling real "submissions"/cities/authorities for the DCA face is a **separate, later effort** and is explicitly out of scope here.

### Scope (IN)
- Stand up a Postgres schema mirroring the current Mongoose models.
- Migrate ALL existing Mongo data into Supabase (straight, one-time load).
- Rewrite the Express **data-access layer** (Mongoose → Postgres) for every route.
- Keep the Mongo connection in place, behind a driver flag, as a fallback.

### Scope (OUT)
- No new features, tables, or fields beyond what Mongo has today.
- No frontend changes (the API contract must stay byte-compatible).
- No move to Supabase Auth (keep the existing JWT + bcrypt auth).
- No move to Supabase Storage (uploaded files stay on local disk; only their DB refs move).
- No deletion or mutation of the existing Mongo data (it is the rollback path).

### Non-negotiables (read twice)
1. **API responses must stay identically shaped.** The frontend depends on `_id` (not `id`) and on "populated" nested objects (e.g. `task.countyId = { _id, name, code }`). Every endpoint's JSON output must match the current Mongoose output field-for-field. This is the #1 correctness risk — see §6.
2. **Keep JWT auth and bcrypt hashes.** Passwords migrate as-is; nobody re-logs-in. Do NOT touch `middleware/auth.js` auth logic beyond swapping the User lookup.
3. **Mongo stays untouched and available** as a fallback for the whole effort.
4. **The `service_role` key is server-only.** It lives only in `backend/.env`, never in the frontend, never committed.
5. **Preserve existing record IDs.** See the ID strategy in §3.

---

## 1. Current-state reference

### Stack
- Backend: Node/Express, Mongoose, MongoDB. Entry: `backend/server.js` (port 5001).
- Frontend: React (CRA) on 3001, talks only to `/api/*` via one axios instance (`frontend/src/utils/api.js`). **Never touches the DB directly.**
- Auth: JWT (`middleware/auth.js`), roles `accg | dca | county_user`; `adminOnly` passes `accg` and `dca` via `utils/roles.js` `hasAdminPowers()`.

### Env (`backend/.env`) — already populated
```
JWT_SECRET, MONGODB_URI, EMAIL_USER, EMAIL_PASSWORD   # existing (keep)
EMAIL_TO, PORT, FRONTEND_URL                           # existing/optional
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL   # added for this migration
```
`SUPABASE_DB_URL` = session-pooler Postgres URI (`aws-0-us-east-1.pooler.supabase.com:5432`, PostgreSQL 17.6). `pg` npm package is already installed in `backend/`.

### Live data volume (baseline for parity checks)
| Collection | Docs | Notes |
|---|---|---|
| users | 25 | 23 `county_user`, 1 `accg`, 1 `dca`. `departmentRoles` empty in practice. |
| counties | 21 | |
| tasks | 316 | statuses: 175 pending / 86 in_progress / 55 completed. 66 have `reminders`. **0** have comments/formFile/filledFormFile/assignedContacts in current data (schema still must support them). |
| contacts | 8 | one doc per county; each holds an embedded `contacts[]` (~23 entries). |
| notifications | 128 | |

Mongo docs also carry `__v` (Mongoose version key) — **drop it** during migration.

### Mongoose models (authoritative field list)
- **User**: `username*` (unique), `email*` (unique, lowercase), `password*` (bcrypt), `role` enum(`accg`,`dca`,`county_user`) default `county_user`, `countyId` → County (nullable), `departmentRoles[]` (enum slugs), timestamps.
- **County**: `name*` (unique), `code*` (unique), `description` (''), `email` ('', lowercase), `fiscalYearStartMonth`(1) `fiscalYearStartDay`(1) `fiscalYearEndMonth`(12) `fiscalYearEndDay`(31), timestamps.
- **Task**: `title*`, `description`(''), `countyId*` → County, `submittedTo`(''), `portalLink`(''), `status` enum(`pending`,`in_progress`,`completed`) default `pending`, `priority` enum(`low`,`medium`,`high`) default `medium`, `deadline*` (Date), `assignedBy*` → User, `assignedRoles[]` (enum slugs), `assignedContacts[]` (obj: contactId, role, name, email, phone), `reminders[]` (obj: sentAt, sentBy→User), `formFile` (obj: originalName, fileName, filePath, uploadedAt), `filledFormFile` (obj: + uploadedBy→User), `comments[]` (obj: text, createdBy→User, createdAt, readBy[]→User), `completedAt` (Date), timestamps.
- **Contact**: `countyId*` → County (unique), `contacts[]` (obj: role*, name, email, phone), timestamps.
- **Notification**: `userId*` → User, `type` enum(`deadline`,`reminder`,`task_assigned`,`task_completed`), `title*`, `message*`, `taskId` → Task (nullable), `read` (bool, default false), timestamps.

### Department role slugs (constants, mirrored FE/BE — do not change)
`finance_budget_accounting, county_administration_leadership, compliance_regulatory_reporting, grants_funding_reimbursements, public_works_infrastructure, emergency_management_disaster_response, hr_training, legal_governance, planning_development, tax_revenue`

### Complete endpoint inventory (all must behave identically post-swap)
| # | Method & path | Gating | DB operations today |
|---|---|---|---|
| 1 | POST `/api/auth/register` | auth, adminOnly | validate; check email/username `$or`; create User |
| 2 | POST `/api/auth/login` | — | find user by email; bcrypt compare; JWT |
| 3 | GET `/api/auth/me` | auth | find user by id (no password) |
| 4 | GET `/api/counties` | auth | list (all or own); per-county task stats + unread-comment count |
| 5 | GET `/api/counties/:id` | auth | findById; access check |
| 6 | POST `/api/counties` | auth, adminOnly | create |
| 7 | PUT `/api/counties/:id` | auth, adminOnly | findByIdAndUpdate |
| 8 | DELETE `/api/counties/:id` | auth, adminOnly | findByIdAndDelete (+ consider cascade) |
| 9 | GET `/api/tasks` | auth | filtered list; role visibility; `$regex` search; date ranges; populate county+assignedBy; sort deadline asc, createdAt desc |
| 10 | GET `/api/tasks/:id` | auth | findById; populate; access check |
| 11 | POST `/api/tasks` | auth, adminOnly | create (deadline or fiscal offset) |
| 12 | POST `/api/tasks/bulk` | auth, adminOnly | create N tasks (one per county in `countyIds`) |
| 13 | PUT `/api/tasks/:id` | auth | update (status/fields); sets `completedAt`; county-user may update own |
| 14 | DELETE `/api/tasks/:id` | auth, adminOnly | delete |
| 15 | POST `/api/tasks/:id/reminder` | auth, adminOnly | push reminder; email; create Notification |
| 16 | POST `/api/tasks/send-reminders` | auth, adminOnly | `$in` taskIds; push reminders; emails; Notification |
| 17 | POST `/api/tasks/:id/upload-form` | auth, adminOnly, multer | set `formFile`; file to disk |
| 18 | POST `/api/tasks/:id/upload-filled-form` | auth, multer | set `filledFormFile` |
| 19 | GET `/api/tasks/:id/download-form` | auth | stream file |
| 20 | GET `/api/tasks/:id/download-filled-form` | auth | stream file |
| 21 | POST `/api/tasks/:id/comments` | auth | push comment |
| 22 | GET `/api/tasks/:id/comments` | auth | populate `comments.createdBy` |
| 23 | POST `/api/tasks/:taskId/comments/:commentIndex/mark-read` | auth, adminOnly | **array-index** into comments; push readBy |
| 24 | GET `/api/notifications` | auth | user's notifications; populate taskId |
| 25 | GET `/api/notifications/upcoming` | auth | date-range tasks; populate county |
| 26 | PUT `/api/notifications/:id/read` | auth | set read=true |
| 27 | PUT `/api/notifications/read-all` | auth | set read=true for user |
| 28 | GET `/api/contacts/:countyId` | auth | find contacts doc; access check |
| 29 | PUT `/api/contacts/:countyId` | auth | upsert contacts doc |
| 30 | GET `/api/users` | auth, adminOnly | all users; populate county |
| 31 | GET `/api/users/admins` | auth, adminOnly | users where role=`accg`; populate county |
| 32 | GET `/api/users/:id` | auth, adminOnly | findById; populate |
| 33 | DELETE `/api/users/:id` | auth, adminOnly | findByIdAndDelete |
| 34 | POST `/api/chatbot/message` | auth | **INSPECT** `routes/chatbot.js` for DB reads before rewriting |

---

## 2. Target architecture

Keep **Express as the API boundary** and **JWT auth**. Replace only the storage layer.

```
frontend ──HTTP──> Express routes ──> data-access layer (db/) ──> Postgres (Supabase)
                                   └─ (fallback) ──────────────> MongoDB (Mongoose)
```

- Introduce a `backend/db/` module that owns the Postgres connection pool (`pg.Pool` using `SUPABASE_DB_URL`, `ssl: { rejectUnauthorized: false }`) and per-entity repository functions returning **API-shaped objects** (see §6).
- Add a driver flag `DATA_DRIVER = supabase | mongo` (default `supabase` after cutover). Routes call the repository layer; the repository picks the backend by flag. Simplest viable approach: route handlers call `repo.tasks.find(...)` etc., and the repo implementation is Postgres. Keep the Mongoose models importable so flipping `DATA_DRIVER=mongo` restores old behavior. (If a full dual-implementation is too heavy, at minimum keep Mongoose code paths intact behind the flag for rollback.)
- Load the installed **`supabase` / `supabase-postgres-best-practices`** skills (`.agents/skills/`) before writing SQL.

### Connection choice
Use the **`pg`** driver with `SUPABASE_DB_URL` (session pooler) for all app queries and migration. `@supabase/supabase-js` is optional and not required for a store-swap (no RLS needed because Express enforces auth and connects with `service_role`/pooler privileges). Do **not** enable RLS for this swap; the DB is reached only by the trusted server.

---

## 3. ID strategy (decided — do not deviate)

**Keep the existing Mongo `ObjectId` hex strings as the primary keys**, stored as Postgres `text`.

Why: preserves every existing ID; the frontend treats IDs as opaque strings; relationships map 1:1; the `_id` field in API responses stays identical; no ID-remap table needed.

- Every PK column: `id text primary key` holding the 24-char hex.
- FK columns hold the referenced hex string (`text`).
- **New rows created after cutover** generate a fresh 24-hex ID in the app using `new (require('mongodb').ObjectId)().toString()` (the `mongodb`/`bson` package stays as a dependency for ID generation only) so all IDs remain uniform. Alternatively add `DEFAULT` via a Postgres function that emits a 24-hex string; app-side generation is preferred for uniformity.
- The API mapper renames `id` → `_id` on the way out (see §6).

---

## 4. Postgres schema (DDL)

General rules:
- Enums as `text` + `CHECK` constraints (flexible; roles have already evolved once).
- Embedded/nested Mongo structures → **`jsonb`** columns (low volume; preserves shapes 1:1; keeps the comment-mark-read-by-index endpoint working; avoids join sprawl). Array-content queries use JSONB operators (§6).
- Timestamps → `timestamptz`. `created_at`/`updated_at` mirror Mongoose `timestamps`. Add an `updated_at` trigger.
- Column names in `snake_case`; the mapper converts to the camelCase the API returns.

```sql
-- === helper: updated_at trigger ===
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- === counties ===
create table counties (
  id text primary key,
  name text not null unique,
  code text not null unique,
  description text not null default '',
  email text not null default '',
  fiscal_year_start_month int not null default 1,
  fiscal_year_start_day   int not null default 1,
  fiscal_year_end_month   int not null default 12,
  fiscal_year_end_day     int not null default 31,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_counties_updated before update on counties
  for each row execute function set_updated_at();

-- === users ===
create table users (
  id text primary key,
  username text not null unique,
  email text not null unique,           -- store lowercased
  password text not null,               -- bcrypt hash, migrated as-is
  role text not null default 'county_user'
       check (role in ('accg','dca','county_user')),
  county_id text references counties(id) on delete set null,
  department_roles jsonb not null default '[]'::jsonb,  -- array of slugs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_users_county_role on users(county_id, role);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- === tasks ===
create table tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  county_id text not null references counties(id) on delete cascade,
  submitted_to text not null default '',
  portal_link text not null default '',
  status text not null default 'pending'
       check (status in ('pending','in_progress','completed')),
  priority text not null default 'medium'
       check (priority in ('low','medium','high')),
  deadline timestamptz not null,
  assigned_by text not null references users(id),
  assigned_roles     jsonb not null default '[]'::jsonb,  -- array of slugs
  assigned_contacts  jsonb not null default '[]'::jsonb,  -- [{contactId,role,name,email,phone}]
  reminders          jsonb not null default '[]'::jsonb,  -- [{sentAt,sentBy}]
  form_file          jsonb,                               -- {originalName,fileName,filePath,uploadedAt}
  filled_form_file   jsonb,                               -- {..., uploadedBy}
  comments           jsonb not null default '[]'::jsonb,  -- [{text,createdBy,createdAt,readBy[]}]
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_county on tasks(county_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_priority on tasks(priority);
create index idx_tasks_deadline on tasks(deadline);
create index idx_tasks_created on tasks(created_at);
create index idx_tasks_assigned_by on tasks(assigned_by);
create index idx_tasks_county_status on tasks(county_id, status);
create index idx_tasks_county_deadline on tasks(county_id, deadline);
create index idx_tasks_status_deadline on tasks(status, deadline);
-- full-text search replacing Mongo $text (title, description)
create index idx_tasks_fts on tasks
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- === contacts (one row per county) ===
create table contacts (
  id text primary key,
  county_id text not null unique references counties(id) on delete cascade,
  contacts jsonb not null default '[]'::jsonb,  -- [{role,name,email,phone}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_contacts_updated before update on contacts
  for each row execute function set_updated_at();

-- === notifications ===
create table notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  type text not null
       check (type in ('deadline','reminder','task_assigned','task_completed')),
  title text not null,
  message text not null,
  task_id text references tasks(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id);
create index idx_notifications_task on notifications(task_id);
create index idx_notifications_user_read on notifications(user_id, read);
create index idx_notifications_user_created on notifications(user_id, created_at desc);
create trigger trg_notifications_updated before update on notifications
  for each row execute function set_updated_at();
```

**Load order (FK-safe):** `counties` → `users` → `tasks` → `contacts` → `notifications`.

> Note on `assigned_by`: it's `not null` in the model. Confirm every task's `assignedBy` references a surviving user during migration; if any dangle, either import the referenced user or relax to nullable. (Current data: verify in Phase 2.)

---

## 5. Data migration script (`backend/scripts/migrate-mongo-to-supabase.js`)

Non-destructive, idempotent, one-shot. Reads Mongo via `MONGODB_URI`, writes Postgres via `SUPABASE_DB_URL`.

**Algorithm:**
1. Connect to both. Wrap the Postgres load in a single transaction (or per-table transactions) so a failure rolls back cleanly.
2. For each collection in load order, stream docs and `INSERT ... ON CONFLICT (id) DO UPDATE` (idempotent re-runs):
   - `_id.toString()` → `id`.
   - Drop `__v`.
   - Convert `ObjectId` refs → their hex string (`countyId`, `assignedBy`, `userId`, `taskId`, and nested `sentBy`, `createdBy`, `readBy[]`, `uploadedBy`).
   - Convert Mongo `Date` → JS `Date`/ISO for `timestamptz`.
   - Camel→snake for scalar columns; nested arrays/objects → `jsonb` **with their original camelCase keys preserved** (e.g. `reminders: [{sentAt, sentBy}]`) so the API mapper can pass them through untouched.
   - Lowercase `email` fields (mirrors schema).
3. After load, print row counts per table and assert they equal Mongo counts (see targets in §1). Also assert referential integrity (no task with a missing county/user; no notification with a missing user).
4. Idempotency: safe to re-run; uses upserts keyed on `id`.

**Acceptance:** row counts match exactly (25/21/316/8/128); zero FK violations; script re-runnable with no dupes.

---

## 6. Data-access layer & API-shape preservation (the critical part)

Create `backend/db/pool.js` (pg Pool) and `backend/db/repos/*.js` (one per entity). Each repository returns objects already shaped exactly like the current Mongoose JSON. A shared mapper handles the universal rules:

- Output key is **`_id`** (from `id`), as a string.
- Convert snake_case columns back to the model's camelCase (`county_id`→ used to build `countyId`, `fiscal_year_end_month`→`fiscalYearEndMonth`, `completed_at`→`completedAt`, etc.).
- `jsonb` columns pass through with their preserved camelCase keys.
- `created_at`/`updated_at` → `createdAt`/`updatedAt` as ISO strings (Mongoose serializes Dates to ISO in JSON).
- Emit `__v: 0` only if any frontend code reads it — **it does not**, so omit `__v`.

### "Populate" replacement — exact target shapes
The frontend reads these nested objects; reproduce them precisely via joins (or secondary fetches) and shaping:

- **Task list/detail** (`GET /tasks`, `/tasks/:id`): join county + assignedBy →
  - `countyId: { _id, name, code }` (and `email` too where the current code populates `'name code email'` — endpoints 15/16/17/18/19/20 use `name code email`; endpoints 9/10 use `name code`). Match per-endpoint.
  - `assignedBy: { _id, username, email }`.
- **Task comments** (`GET /tasks/:id/comments`, and county list unread count): `comments[].createdBy: { _id, username, email, role }`; `readBy` stays an array of id strings (as stored).
- **Counties list** (`GET /counties`): each county object plus `taskStats: { total, pending, inProgress, completed, unreadComments }`. Reproduce the unread-comment logic from `counties.js:38-57` against the `tasks.comments` jsonb.
- **Notifications** (`GET /notifications`): `taskId: { _id, title, deadline, status }` (populated) or null.
- **Notifications upcoming** (`GET /notifications/upcoming`): tasks with `countyId: { name, code }`.
- **Users** (`GET /users`, `/users/admins`, `/users/:id`): `countyId: { _id, name, code }` (or null); never return `password`.

> Rule of thumb: for each endpoint, open the current handler, note the exact `.populate(field, 'a b c')` projections and the exact object returned, and reproduce it byte-for-byte. When in doubt, diff old vs new JSON (see §8).

### Mongo query → SQL translation cheatsheet
| Mongo | Postgres |
|---|---|
| `find({countyId})` | `where county_id = $1` |
| `$regex` on title/description (GET /tasks search) | `title ilike '%'||$1||'%' or description ilike '%'||$1||'%'` (or FTS via `idx_tasks_fts`) |
| `$text` search | `to_tsvector(...) @@ plainto_tsquery('english',$1)` |
| `deadline {$gte,$lte}` | `deadline >= $1 and deadline <= $2` |
| `status {$ne:'completed'}` | `status <> 'completed'` |
| `_id {$in: ids}` | `id = any($1::text[])` |
| assignedRoles `$exists`/`$size:0`/`$in` (role visibility) | `jsonb_array_length(assigned_roles)=0 or assigned_roles ?| $1::text[]` |
| sort `{deadline:1, createdAt:-1}` | `order by deadline asc, created_at desc` |
| `findByIdAndUpdate` | `update ... where id=$1 returning *` |
| `findByIdAndDelete` | `delete from ... where id=$1` |
| push to array (reminder/comment) | read jsonb → append in app → `update set col = $2::jsonb` (or `col || $2::jsonb`) |
| comment mark-read by **index** | fetch `comments`, mutate element `[commentIndex]`, write back the whole array (preserves current index semantics) |

### Cross-cutting rewrites
- **`middleware/auth.js`**: only the `User.findById(...).select('-password')` lookup changes to a repo call returning the same shape (with `_id`, `role`, `countyId`). Auth logic and `hasAdminPowers` unchanged.
- **`utils/reminderScheduler.js`**: rewrite its single query (`status != completed and deadline in [now, now+3d]`, populate county name+email) and the per-task reminder push/save to the repo. Logic (24h dedupe, EMAIL_TO) unchanged.
- **Fiscal deadline** (`getDeadlineFromFiscalYearEnd`) and `FISCAL_OFFSET_DAYS = [60,90,180,270]`: pure JS, unchanged.
- **File uploads** (`middleware/upload.js`, `utils/storage.js`): unchanged; only the `form_file`/`filled_form_file` jsonb refs are read/written via the repo. Files stay on local disk under `backend/uploads/`.
- **`routes/chatbot.js`**: inspect first; rewrite any DB reads to the repo. If it only calls an external LLM with request data, no DB change needed.
- **`seed.js`, `seed-troup-contacts.js`, `scripts/seed-dca-user.js`, `scripts/migrate-admin-to-accg.js`**: port to Postgres or mark deprecated. At minimum, provide a Postgres `seed.js` equivalent for fresh environments. (Not required for the data migration itself, which uses real Mongo data.)
- **`server.js`**: replace the hard `MONGODB_URI` requirement + `mongoose.connect` with: validate `SUPABASE_DB_URL` when `DATA_DRIVER=supabase`; open the pg pool; keep the Mongo connect only when `DATA_DRIVER=mongo`. Keep scheduler + error handlers.

---

## 7. Env & dependency additions
- Deps (backend): `pg` (installed). Keep `mongoose`/`mongodb` (fallback + ID generation). Optional: `@supabase/supabase-js` (not required).
- Env: add `DATA_DRIVER=supabase` (default). `SUPABASE_*` already present. Update `server.js` validation accordingly. Ensure `.env` stays gitignored (it is).

---

## 8. Verification & parity plan (do all before cutover)

Run the server on both drivers and compare. Build a small parity harness (`backend/scripts/verify-parity.js`) that, for a fixed set of requests, hits the API and diffs JSON between `DATA_DRIVER=mongo` and `DATA_DRIVER=supabase`.

**Automated checks:**
1. **Row counts** match §1 exactly (25/21/316/8/128).
2. **Endpoint JSON diff** (login first to get tokens per role) for at least:
   - `GET /tasks` (as dca, as accg, as a county user) — same set/shape, same sort order.
   - `GET /tasks/:id` for a sampled task — identical nested `countyId`/`assignedBy`.
   - `GET /counties` — identical `taskStats` per county (incl. `unreadComments`).
   - `GET /counties/:id`, `GET /users`, `GET /users/admins`, `GET /users/:id` (no `password` leaks).
   - `GET /notifications`, `GET /notifications/upcoming`.
   - `GET /contacts/:countyId`.
   Normalize volatile fields (e.g., ignore ordering within equal-key groups) but assert field-for-field equality otherwise.
3. **Writes** (against Supabase, then confirm reflected): create task (single + bulk with fiscal offset), update task status → `completedAt` set, add comment, mark-read by index, per-task reminder + bulk reminders (assert Notification rows created; email may be a no-op), create/delete county, register/delete user, upsert contacts, mark notifications read/read-all.
4. **Auth**: all three logins succeed with existing passwords; `adminOnly` still blocks county users; old `admin@` remains dead.
5. **Frontend smoke (browser)**: ACCG `/dashboard` + Track by Counties + Reminders; DCA `/dca` dashboard shows real counts and Remind works; a county user sees only their tasks. Zero console errors.
6. **FK integrity**: no orphan tasks/notifications.

**Acceptance:** all diffs empty (modulo documented normalizations), all writes verified, all logins/faces working, no console errors.

---

## 9. Cutover & rollback
- **Cutover:** set `DATA_DRIVER=supabase`, restart backend. (It runs as plain `node server.js`; a supervisor/`npm run dev` may respawn — restart explicitly to load new code.)
- **Rollback:** set `DATA_DRIVER=mongo`, restart. Mongo data was never touched, so this is instant and lossless. Keep this path working until you've run on Supabase in real use for an agreed soak period.
- Do **not** drop Mongo or delete `MONGODB_URI` in this effort.

---

## 10. Sequenced task checklist (phases with acceptance)

- [ ] **Phase 0 — Prep.** Confirm `.env` has all `SUPABASE_*` + `MONGODB_URI`; confirm `pg` installed; confirm connectivity to both DBs; load the `supabase` skills. *Accept:* both DBs reachable; Supabase `public` empty.
- [ ] **Phase 1 — Schema.** Apply §4 DDL to Supabase (a `backend/scripts/schema.sql` + a runner, or via the migration script). *Accept:* all 5 tables + indexes + triggers exist; `\d` matches spec.
- [ ] **Phase 2 — Migrate data.** Run `migrate-mongo-to-supabase.js`. *Accept:* counts match; zero FK violations; re-run is a no-op.
- [ ] **Phase 3 — Data layer.** Build `db/pool.js` + repos + API mappers. *Accept:* unit-level shape checks pass for each entity mapper (incl. populated variants).
- [ ] **Phase 4 — Route rewrite.** Swap every endpoint (§1 table) + `middleware/auth.js` + `reminderScheduler.js` (+ chatbot if needed) to repos, behind `DATA_DRIVER`. *Accept:* server boots on `DATA_DRIVER=supabase`; no route imports Mongoose at runtime when flag=supabase.
- [ ] **Phase 5 — Parity.** Run §8 harness + browser smoke. *Accept:* all §8 acceptance met.
- [ ] **Phase 6 — Cutover.** Default `DATA_DRIVER=supabase`; document rollback. *Accept:* app runs on Supabase; rollback verified once.
- [ ] **Phase 7 — Docs/seed.** Update `CLAUDE.md`/`README.md` (Mongo→Supabase, driver flag); port or deprecate seed scripts. *Accept:* docs accurate; fresh-env seed works on Postgres.

---

## 11. Risks & gotchas (each has a mitigation above)
1. **API shape drift** → §6 mapper + §8 JSON diff. Highest risk.
2. **`_id` vs `id`** → mapper always emits `_id`.
3. **Populated projections differ per endpoint** (`name code` vs `name code email`) → match per-endpoint.
4. **Dates/timezones** → `timestamptz`; compare instants, not strings.
5. **`$text`/`$regex` search semantics** → ILIKE for parity (FTS index available if needed).
6. **Comment mark-read by array index** → keep comments as jsonb array; mutate-by-index in app.
7. **Empty-array vs missing** (`assignedRoles $exists/$size`) → default `'[]'::jsonb`; translate with `jsonb_array_length`.
8. **Unique/lowercase constraints** → `unique` on user email/username, county name/code, contact county_id; lowercase emails on load and write.
9. **`assigned_by` not null** → verify no dangling refs in Phase 2.
10. **New-ID format** → generate ObjectId-hex in app for uniformity (§3).
11. **`__v` removal** → confirmed unused by frontend; safe to drop.
12. **Cascade on delete** → decide county/user delete behavior (DDL uses `on delete cascade`/`set null`); confirm it matches or improves current (currently no explicit cascade — deleting a county leaves orphan tasks in Mongo; cascade is safer but is a behavior change — call it out and get sign-off, or replicate current no-cascade by removing the cascade and handling in app).
13. **Pooler quirks** → session pooler is fine for app + migration; if prepared-statement issues arise, use the direct connection string for the migration script.

---

## 12. Definition of done
- App serves entirely from Supabase with `DATA_DRIVER=supabase`; Mongo is only a dormant fallback.
- All 34 endpoints return JSON identical to the Mongo-backed versions (verified by diff).
- All three logins and faces work in the browser with no console errors; reminders, task create/update, comments, contacts, notifications all function.
- Migration + schema + parity scripts are committed and re-runnable; docs updated.
- Mongo data remains intact and untouched.
```
