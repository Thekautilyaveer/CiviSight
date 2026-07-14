-- CiviSight — Postgres schema (Supabase) mirroring the Mongoose models.
-- Store-swap migration; see /SUPABASE_MIGRATION_PLAN.md.
-- Idempotent: safe to run repeatedly (IF NOT EXISTS / CREATE OR REPLACE).
-- Primary keys are the original Mongo ObjectId hex strings (text). See plan §3.

-- === helper: updated_at trigger function ===
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- === entities (reporting governments: counties, cities, authorities) ===
-- Formerly `counties`. `type` distinguishes the government kind; ACCG oversees counties
-- only, DCA oversees all types (see utils/roles.js entityTypesFor). `gov_id` is Georgia's
-- canonical government identifier — the stable identity that reconciles a filer across
-- forms, years, and legacy sources (nullable until captured, e.g. from an RLGF filing).
create table if not exists entities (
  id text primary key,
  gov_id text unique,
  type text not null default 'county' check (type in ('county','city','authority')),
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
create index if not exists idx_entities_type on entities(type);
create or replace trigger trg_entities_updated before update on entities
  for each row execute function set_updated_at();

-- === users ===
create table if not exists users (
  id text primary key,
  username text not null unique,
  email text not null unique,                       -- stored lowercased
  password text not null,                           -- bcrypt hash, migrated as-is
  role text not null default 'county_user'
       check (role in ('accg','dca','county_user')),
  county_id text references entities(id) on delete set null,
  department_roles jsonb not null default '[]'::jsonb,   -- array of role slugs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_county_role on users(county_id, role);
create or replace trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- === tasks ===
create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  county_id text not null references entities(id) on delete cascade,
  submitted_to text not null default '',
  portal_link text not null default '',
  status text not null default 'pending'
       check (status in ('pending','in_progress','submitted','completed')),
  priority text not null default 'medium'
       check (priority in ('low','medium','high')),
  deadline timestamptz not null,
  assigned_by text not null references users(id),
  assigned_roles     jsonb not null default '[]'::jsonb,   -- [slug,...]
  assigned_contacts  jsonb not null default '[]'::jsonb,   -- [{contactId,role,name,email,phone}]
  reminders          jsonb not null default '[]'::jsonb,   -- [{sentAt,sentBy}]
  form_file          jsonb,                                -- {originalName,fileName,filePath,uploadedAt}
  filled_form_file   jsonb,                                -- {...,uploadedBy}
  comments           jsonb not null default '[]'::jsonb,   -- [{text,createdBy,createdAt,readBy[]}]
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_county on tasks(county_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_priority on tasks(priority);
create index if not exists idx_tasks_deadline on tasks(deadline);
create index if not exists idx_tasks_created on tasks(created_at);
create index if not exists idx_tasks_assigned_by on tasks(assigned_by);
create index if not exists idx_tasks_county_status on tasks(county_id, status);
create index if not exists idx_tasks_county_deadline on tasks(county_id, deadline);
create index if not exists idx_tasks_status_deadline on tasks(status, deadline);
create index if not exists idx_tasks_fts on tasks
  using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create or replace trigger trg_tasks_updated before update on tasks
  for each row execute function set_updated_at();

-- === contacts (one row per county) ===
create table if not exists contacts (
  id text primary key,
  county_id text not null unique references entities(id) on delete cascade,
  contacts jsonb not null default '[]'::jsonb,            -- [{role,name,email,phone}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace trigger trg_contacts_updated before update on contacts
  for each row execute function set_updated_at();

-- === notifications ===
create table if not exists notifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  type text not null
       check (type in ('deadline','reminder','task_assigned','task_completed',
                       'submission_received','submission_reviewed','submission_comment')),
  title text not null,
  message text not null,
  task_id text references tasks(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_task on notifications(task_id);
create index if not exists idx_notifications_user_read on notifications(user_id, read);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);
create or replace trigger trg_notifications_updated before update on notifications
  for each row execute function set_updated_at();

-- === submissions (county form submissions to agencies + agency review workflow) ===
create table if not exists submissions (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  county_id text not null references entities(id) on delete cascade,
  agency text not null default '',
  form_name text not null,
  form_type text not null check (form_type in ('online','file')),
  status text not null default 'submitted'
       check (status in ('submitted','under_review','accepted','needs_correction')),
  submitted_by text not null references users(id),
  submitted_at timestamptz not null default now(),
  answers jsonb,                                   -- online form answers {fieldId: value} (Mixed; null for file)
  metadata jsonb not null default '{}'::jsonb,     -- {source, form, version, fields{...}, ...}
  comments jsonb not null default '[]'::jsonb,     -- [{fieldId,text,createdBy,createdAt,readBy[]}]
  file jsonb,                                       -- {originalName,fileName,filePath,uploadedAt}
  reviewed_by text references users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_submissions_task on submissions(task_id, submitted_at desc);
create index if not exists idx_submissions_county on submissions(county_id, submitted_at desc);
create index if not exists idx_submissions_agency_status on submissions(agency, status);
create index if not exists idx_submissions_form_agency on submissions(form_name, agency);
create or replace trigger trg_submissions_updated before update on submissions
  for each row execute function set_updated_at();

-- === form catalog (versioned form definitions + their fields) ===
-- A form's definition is DATA, not a repo file: one form_definitions row per (code,version)
-- and one form_fields row per question. Seeded from the RLGF schema JSON
-- (frontend/src/forms/rlgf/rlgf_schema.json) via scripts/seed-forms.js. Submissions will
-- later pin the form_definition_id they were filed against. Additive: nothing reads these
-- tables yet, so creating/seeding them does not affect the running app.
create table if not exists form_definitions (
  id text primary key,
  code text not null,                     -- 'rlgf' | 'gomi' | 'aarf' | ...
  version text not null,                  -- e.g. '2020_UCOA_4th+parts'
  title text not null default '',
  source_file text not null default '',
  ucoa_version text,
  effective_from date,
  effective_to date,
  status text not null default 'active' check (status in ('draft','active','retired')),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version)
);
create or replace trigger trg_form_definitions_updated before update on form_definitions
  for each row execute function set_updated_at();

create table if not exists form_fields (
  id text primary key,
  form_definition_id text not null references form_definitions(id) on delete cascade,
  field_key text not null,                -- stable id within the form (schema field id)
  page text not null default '',
  part text,
  page_title text,
  nav_label text,
  cell text,                              -- Excel address (e.g. C12) for the workbook bridge
  label text not null default '',
  ucoa_code text,
  data_type text not null default 'text', -- dropdown | text | dollar | ...
  derived boolean not null default false, -- schema `is_derived`
  formula text,
  options_source text,
  needs_review boolean not null default false,
  validation jsonb not null default '{}'::jsonb,   -- {min,max,required,allow_text}
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_definition_id, field_key)
);
create index if not exists idx_form_fields_def on form_fields(form_definition_id);
create index if not exists idx_form_fields_ucoa on form_fields(ucoa_code);
create or replace trigger trg_form_fields_updated before update on form_fields
  for each row execute function set_updated_at();
