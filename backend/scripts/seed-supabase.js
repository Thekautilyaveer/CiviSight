// Fresh-environment seed for the Supabase Postgres store (DATA_DRIVER=supabase).
// Postgres port of backend/seed.js. DESTRUCTIVE: truncates all tables, then seeds
// counties, the ACCG + DCA accounts, one county user per county (Fulton gets three with
// role subsets), the recurring filings as tasks, and sample contacts.
//
//   node scripts/seed-supabase.js            # refuses if any table is non-empty
//   SEED_FORCE=1 node scripts/seed-supabase.js   # wipe + reseed even if populated
//
// The guard exists because the migrated production data lives in this same database.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { Client } = require('pg');
const { DEPARTMENT_ROLE_SLUGS } = require('../constants/departmentRoles');

const newId = () => new ObjectId().toString();

// ---- data (mirrors backend/seed.js) ----
const FULTON_FINANCE_ROLES = ['finance_budget_accounting', 'compliance_regulatory_reporting', 'grants_funding_reimbursements', 'tax_revenue'];
const FULTON_OPERATIONS_ROLES = ['county_administration_leadership', 'public_works_infrastructure', 'emergency_management_disaster_response', 'planning_development'];
const FULTON_HR_LEGAL_ROLES = ['hr_training', 'legal_governance'];

const FY = {
  janDec: { fiscalYearStartMonth: 1, fiscalYearStartDay: 1, fiscalYearEndMonth: 12, fiscalYearEndDay: 31 },
  julJun: { fiscalYearStartMonth: 7, fiscalYearStartDay: 1, fiscalYearEndMonth: 6, fiscalYearEndDay: 30 },
  octSep: { fiscalYearStartMonth: 10, fiscalYearStartDay: 1, fiscalYearEndMonth: 9, fiscalYearEndDay: 30 },
};

const counties = [
  { name: 'Fulton County', code: 'FULTON', description: 'Largest county in Georgia', email: 'fulton@civisight.org', ...FY.janDec },
  { name: 'Gwinnett County', code: 'GWINNETT', description: 'Second most populous county', email: 'gwinnett@civisight.org', ...FY.janDec },
  { name: 'Cobb County', code: 'COBB', description: 'Third most populous county', email: 'cobb@civisight.org', ...FY.octSep },
  { name: 'DeKalb County', code: 'DEKALB', description: 'Fourth most populous county', email: 'dekalb@civisight.org', ...FY.janDec },
  { name: 'Clayton County', code: 'CLAYTON', description: 'Fifth most populous county', email: 'clayton@civisight.org', ...FY.julJun },
  { name: 'Chatham County', code: 'CHATHAM', description: 'Coastal county including Savannah', email: 'chatham@civisight.org', ...FY.julJun },
  { name: 'Richmond County', code: 'RICHMOND', description: 'Includes Augusta (Augusta–Richmond CG)', email: 'richmond@civisight.org', ...FY.janDec },
  { name: 'Muscogee County', code: 'MUSCOGEE', description: 'Includes Columbus (Columbus–Muscogee CG)', email: 'muscogee@civisight.org', ...FY.julJun },
  { name: 'Bibb County', code: 'BIBB', description: 'Includes Macon (Macon–Bibb County)', email: 'bibb@civisight.org', ...FY.julJun },
  { name: 'Hall County', code: 'HALL', description: 'Includes Gainesville', email: 'hall@civisight.org', ...FY.julJun },
  { name: 'Forsyth County', code: 'FORSYTH', description: 'Fast-growing suburban county', email: 'forsyth@civisight.org', ...FY.janDec },
  { name: 'Cherokee County', code: 'CHEROKEE', description: 'North Georgia county', email: 'cherokee@civisight.org', ...FY.octSep },
  { name: 'Henry County', code: 'HENRY', description: 'South metro Atlanta county', email: 'henry@civisight.org', ...FY.julJun },
  { name: 'Paulding County', code: 'PAULDING', description: 'West metro Atlanta county', email: 'paulding@civisight.org', ...FY.julJun },
  { name: 'Douglas County', code: 'DOUGLAS', description: 'West metro Atlanta county', email: 'douglas@civisight.org', ...FY.janDec },
  { name: 'Fayette County', code: 'FAYETTE', description: 'South metro Atlanta county', email: 'fayette@civisight.org', ...FY.julJun },
  { name: 'Coweta County', code: 'COWETA', description: 'Southwest metro Atlanta county', email: 'coweta@civisight.org', ...FY.octSep },
  { name: 'Carroll County', code: 'CARROLL', description: 'West Georgia county', email: 'carroll@civisight.org', ...FY.julJun },
  { name: 'Newton County', code: 'NEWTON', description: 'East metro Atlanta county', email: 'newton@civisight.org', ...FY.julJun },
  { name: 'Bartow County', code: 'BARTOW', description: 'Northwest Georgia county', email: 'bartow@civisight.org', ...FY.janDec },
  { name: 'Troup County', code: 'TROUP', description: 'West Georgia county including LaGrange', email: 'troup@civisight.org', ...FY.julJun },
];

const FORMS = [
  { title: 'Annual Financial Audit', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'high', rule: { type: 'fyOffset', days: 180 }, description: 'Independent external audit of the county\'s financial statements under Government Auditing Standards (O.C.G.A. § 36-81-7). Due within 180 days of fiscal year-end. Agreed-Upon Procedures may substitute if expenditures are under $550K.' },
  { title: 'Audit Corrective-Action Plan', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'medium', rule: { type: 'fyOffset', days: 210 }, description: 'Corrective-action plan addressing any findings in the annual audit (O.C.G.A. § 36-81-7). Due 30 days after the audit due date.' },
  { title: 'Report of Local Government Finances', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'high', rule: { type: 'fyOffset', days: 270 }, description: 'Standardized report of county revenues, expenditures, debt, and fund balances filed through the DCA survey window (O.C.G.A. § 36-81-8).' },
  { title: 'County Property Tax Digest Submission', submittedTo: 'Dept. of Revenue (DOR), Local Govt. Services', priority: 'high', rule: { type: 'fixed', month: 9, day: 1 }, description: 'Annual property tax digest and supporting submission package to the Department of Revenue (O.C.G.A. Title 48, Ch. 5). Due September 1.' },
  { title: 'Millage Rate / 5-Year History / Rollback Process', submittedTo: 'Published in local newspaper', priority: 'medium', rule: { type: 'fixed', month: 8, day: 31 }, description: 'Five-year tax history and rollback-rate advertisement published when the millage rate is set (O.C.G.A. § 48-5-32). Satisfied by public newspaper publication.' },
  { title: 'SPLOST Annual Report', submittedTo: 'Newspaper + county website', priority: 'medium', rule: { type: 'fixed', month: 12, day: 31 }, description: 'Annual SPLOST / ESPLOST / TSPLOST report on project-level revenues and expenditures (O.C.G.A. § 48-8-122). Due not later than December 31.' },
  { title: 'Hotel-Motel Tax Report', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'medium', rule: { type: 'fyOffset', days: 180 }, description: 'Annual report of hotel-motel excise tax collections and authorized expenditures (O.C.G.A. § 48-13-56). Due within 180 days of fiscal year-end.' },
  { title: 'Immigration Compliance Report (Title 13 / E-Verify)', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'medium', rule: { type: 'fixed', month: 12, day: 31 }, description: 'Annual attestation of E-Verify and immigration-compliance requirements (O.C.G.A. § 13-10-91). Due December 31.' },
  { title: 'Solid Waste Survey and Full Cost Report', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'low', rule: { type: 'fixed', month: 9, day: 30 }, description: 'Annual solid waste management survey and full-cost accounting report (O.C.G.A. § 12-8-31.1(d)). Mailed out by July 15; due September 30.' },
  { title: 'Local Victim Assistance 5% Report', submittedTo: 'GSCCCA (funds to county / DA)', priority: 'medium', rule: { type: 'monthly' }, description: 'Monthly remittance and report of the 5% victim-assistance add-on collected on fines and bonds (O.C.G.A. § 15-21-131/132).' },
  { title: 'Annual Budget Adoption and Advertisement', submittedTo: 'Adopted / published locally', priority: 'high', rule: { type: 'beforeFYStart' }, description: 'Adoption and public advertisement of the annual operating budget before the start of the fiscal year (O.C.G.A. § 36-81-5).' },
  { title: 'Single Audit and SF-SAC', submittedTo: 'Federal Audit Clearinghouse (FAC)', priority: 'high', rule: { type: 'fyOffset', days: 270 }, description: 'Federal Single Audit and SF-SAC submission when federal spending exceeds the $1M threshold (2 CFR Part 200, Subpart F). Due the earlier of 30 days after the auditor\'s report or 9 months after period-end.' },
];

const FULTON_CONTACTS = [
  { role: 'Chief Financial Officer', name: 'Alexandra Green', email: 'alexandra.green@fultoncounty.gov', phone: '(404) 612-1001' },
  { role: 'Grants & Compliance Manager', name: 'Marcus Thompson', email: 'marcus.thompson@fultoncounty.gov', phone: '(404) 612-1002' },
  { role: 'Internal Audit Director', name: 'Priya Shah', email: 'priya.shah@fultoncounty.gov', phone: '(404) 612-1003' },
  { role: 'SPLOST Program Manager', name: 'Daniel Roberts', email: 'daniel.roberts@fultoncounty.gov', phone: '(404) 612-1004' },
  { role: 'Records & Reporting Coordinator', name: 'Lauren Mitchell', email: 'lauren.mitchell@fultoncounty.gov', phone: '(404) 612-1005' },
];

// ---- deadline helpers (target calendar year 2026) ----
const TARGET_YEAR = 2026;
const atEod = (y, m, d) => new Date(y, m - 1, d, 23, 59, 0);
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const fyEnd = (c, year) => atEod(year, c.fiscalYearEndMonth, c.fiscalYearEndDay);
const fyOffsetDeadline = (c, days) => {
  const a = addDays(fyEnd(c, TARGET_YEAR - 1), days);
  const b = addDays(fyEnd(c, TARGET_YEAR), days);
  if (a.getFullYear() === TARGET_YEAR) return a;
  if (b.getFullYear() === TARGET_YEAR) return b;
  return a;
};
const beforeFyStartDeadline = (c) => {
  const startYear = c.fiscalYearStartMonth === 1 ? TARGET_YEAR + 1 : TARGET_YEAR;
  return addDays(atEod(startYear, c.fiscalYearStartMonth, c.fiscalYearStartDay), -1);
};
const endOfCurrentMonth = () => {
  const n = new Date();
  return atEod(n.getFullYear(), n.getMonth() + 1, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate());
};
const deadlineFor = (form, county) => {
  switch (form.rule.type) {
    case 'fyOffset': return fyOffsetDeadline(county, form.rule.days);
    case 'fixed': return atEod(TARGET_YEAR, form.rule.month, form.rule.day);
    case 'beforeFYStart': return beforeFyStartDeadline(county);
    case 'monthly': return endOfCurrentMonth();
    default: return atEod(TARGET_YEAR, 12, 31);
  }
};
// RLGF is submitted via the online form workflow, so never seed it as completed —
// leave it pending/in_progress so counties can actually submit it.
const isRlgfForm = (form) => form.title === 'Report of Local Government Finances';
const statusFor = (form, deadline, countyIdx, formIdx, now) => {
  if (isRlgfForm(form)) {
    return (countyIdx + formIdx) % 4 === 0 ? 'in_progress' : 'pending';
  }
  if (deadline.getTime() < now) return 'completed';
  return (countyIdx + formIdx) % 3 === 0 ? 'in_progress' : 'pending';
};

// ---- core seeding (runs on a provided pg client so it can be tx-wrapped) ----
async function seedInto(client) {
  await client.query('truncate notifications, contacts, tasks, users, entities restart identity cascade');

  // Counties
  const countyRows = counties.map((c) => ({ ...c, id: newId() }));
  for (const c of countyRows) {
    await client.query(
      `insert into entities (id,name,code,description,email,
         fiscal_year_start_month,fiscal_year_start_day,fiscal_year_end_month,fiscal_year_end_day)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [c.id, c.name, c.code, c.description, c.email,
       c.fiscalYearStartMonth, c.fiscalYearStartDay, c.fiscalYearEndMonth, c.fiscalYearEndDay]
    );
  }

  const hash = (pw) => bcrypt.hash(pw, 10);
  const insertUser = async (u) => {
    await client.query(
      `insert into users (id,username,email,password,role,county_id,department_roles)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [u.id, u.username, u.email.toLowerCase(), await hash(u.password), u.role, u.countyId || null, JSON.stringify(u.departmentRoles || [])]
    );
  };

  // ACCG + DCA accounts
  const accgId = newId();
  await insertUser({ id: accgId, username: 'accg', email: 'accg@civisight.org', password: 'accg123', role: 'accg' });
  await insertUser({ id: newId(), username: 'dca', email: 'dca@civisight.org', password: 'dca123', role: 'dca' });

  // County users (Fulton gets three role-scoped users)
  let countyUserCount = 0;
  for (const county of countyRows) {
    if (county.code === 'FULTON') {
      await insertUser({ id: newId(), username: 'fulton_finance_user', email: 'alexandra.green@fultoncounty.gov', password: 'county123', role: 'county_user', countyId: county.id, departmentRoles: FULTON_FINANCE_ROLES });
      await insertUser({ id: newId(), username: 'fulton_operations_user', email: 'fulton_operations@civisight.org', password: 'county123', role: 'county_user', countyId: county.id, departmentRoles: FULTON_OPERATIONS_ROLES });
      await insertUser({ id: newId(), username: 'fulton_hr_legal_user', email: 'fulton_hr_legal@civisight.org', password: 'county123', role: 'county_user', countyId: county.id, departmentRoles: FULTON_HR_LEGAL_ROLES });
      countyUserCount += 3;
    } else {
      const slug = county.name.toLowerCase().replace(/\s+/g, '');
      await insertUser({ id: newId(), username: `${slug}_user`, email: `${slug}@civisight.org`, password: 'county123', role: 'county_user', countyId: county.id, departmentRoles: DEPARTMENT_ROLE_SLUGS });
      countyUserCount += 1;
    }
  }

  // Tasks: every filing for every county, deadlines fit calendar 2026
  const now = Date.now();
  let taskCount = 0;
  for (let i = 0; i < countyRows.length; i++) {
    const county = countyRows[i];
    for (let f = 0; f < FORMS.length; f++) {
      const form = FORMS[f];
      const deadline = deadlineFor(form, county);
      const status = statusFor(form, deadline, i, f, now);
      const completedAt = status === 'completed' ? addDays(deadline, -5) : null;
      await client.query(
        `insert into tasks (id,title,description,county_id,submitted_to,portal_link,status,priority,deadline,assigned_by,completed_at)
         values ($1,$2,$3,$4,$5,'',$6,$7,$8,$9,$10)`,
        [newId(), form.title, form.description, county.id, form.submittedTo, status, form.priority, deadline, accgId, completedAt]
      );
      taskCount++;
    }
  }

  // Fulton contacts
  const fulton = countyRows.find((c) => c.code === 'FULTON');
  if (fulton) {
    const contacts = FULTON_CONTACTS.map((c) => ({ ...c, _id: newId() }));
    await client.query(
      `insert into contacts (id,county_id,contacts) values ($1,$2,$3::jsonb)`,
      [newId(), fulton.id, JSON.stringify(contacts)]
    );
  }

  return { counties: countyRows.length, users: countyUserCount + 2, tasks: taskCount };
}

async function isPopulated(client) {
  const { rows } = await client.query(
    `select (select count(*) from entities) + (select count(*) from users) +
            (select count(*) from tasks) + (select count(*) from contacts) +
            (select count(*) from notifications) as n`
  );
  return Number(rows[0].n) > 0;
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('SUPABASE_DB_URL missing in backend/.env'); process.exit(1); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (await isPopulated(client) && process.env.SEED_FORCE !== '1') {
      console.error('Refusing to seed: database is not empty. Re-run with SEED_FORCE=1 to wipe and reseed.');
      process.exit(1);
    }
    await client.query('begin');
    const summary = await seedInto(client);
    await client.query('commit');
    console.log('Seeded Supabase:', JSON.stringify(summary));
    console.log('Logins — ACCG: accg@civisight.org/accg123 · DCA: dca@civisight.org/dca123 · county users: <countyslug>@civisight.org/county123');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('Seed FAILED (rolled back):', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { seedInto };

if (require.main === module) main();
