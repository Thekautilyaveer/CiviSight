// Fresh-environment seed for the Supabase Postgres store (DATA_DRIVER=supabase).
// DESTRUCTIVE: truncates all tables, then seeds a rich demo dataset —
//   • entities of all three types: 21 counties, 10 cities, 6 authorities
//     (real Georgia government IDs pulled from the RLGF template's reference table;
//     authorities file AARF not RLGF, so their gov_id is null),
//   • the ACCG + DCA accounts, one user per entity (Fulton gets three role subsets),
//   • the recurring filings as tasks (counties + cities), authority registration/audit,
//   • real submissions across the whole review lifecycle (submitted / under_review /
//     accepted / needs_correction) incl. a resubmission chain + review comments,
//   • contacts for most entities and notifications reflecting the round-trip.
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

// ---- fiscal-year presets ----
const FULTON_FINANCE_ROLES = ['finance_budget_accounting', 'compliance_regulatory_reporting', 'grants_funding_reimbursements', 'tax_revenue'];
const FULTON_OPERATIONS_ROLES = ['county_administration_leadership', 'public_works_infrastructure', 'emergency_management_disaster_response', 'planning_development'];
const FULTON_HR_LEGAL_ROLES = ['hr_training', 'legal_governance'];

const FY = {
  janDec: { fiscalYearStartMonth: 1, fiscalYearStartDay: 1, fiscalYearEndMonth: 12, fiscalYearEndDay: 31 },
  julJun: { fiscalYearStartMonth: 7, fiscalYearStartDay: 1, fiscalYearEndMonth: 6, fiscalYearEndDay: 30 },
  octSep: { fiscalYearStartMonth: 10, fiscalYearStartDay: 1, fiscalYearEndMonth: 9, fiscalYearEndDay: 30 },
};

// ---- entities: counties (real GA gov_ids from the RLGF reference table) ----
const counties = [
  { name: 'Fulton County', code: 'FULTON', govId: '1060060', description: 'Largest county in Georgia', email: 'fulton@civisight.org', ...FY.janDec },
  { name: 'Gwinnett County', code: 'GWINNETT', govId: '1067067', description: 'Second most populous county', email: 'gwinnett@civisight.org', ...FY.janDec },
  { name: 'Cobb County', code: 'COBB', govId: '1033033', description: 'Third most populous county', email: 'cobb@civisight.org', ...FY.octSep },
  { name: 'DeKalb County', code: 'DEKALB', govId: '1044044', description: 'Fourth most populous county', email: 'dekalb@civisight.org', ...FY.janDec },
  { name: 'Clayton County', code: 'CLAYTON', govId: '1031031', description: 'Fifth most populous county', email: 'clayton@civisight.org', ...FY.julJun },
  { name: 'Chatham County', code: 'CHATHAM', govId: '1025025', description: 'Coastal county including Savannah', email: 'chatham@civisight.org', ...FY.julJun },
  { name: 'Richmond County', code: 'RICHMOND', govId: '3121121', description: 'Augusta–Richmond consolidated government', email: 'richmond@civisight.org', ...FY.janDec },
  { name: 'Muscogee County', code: 'MUSCOGEE', govId: '3106002', description: 'Columbus–Muscogee consolidated government', email: 'muscogee@civisight.org', ...FY.julJun },
  { name: 'Bibb County', code: 'BIBB', govId: '3011011', description: 'Macon–Bibb consolidated government', email: 'bibb@civisight.org', ...FY.julJun },
  { name: 'Hall County', code: 'HALL', govId: '1069069', description: 'Includes Gainesville', email: 'hall@civisight.org', ...FY.julJun },
  { name: 'Forsyth County', code: 'FORSYTH', govId: '1058058', description: 'Fast-growing suburban county', email: 'forsyth@civisight.org', ...FY.janDec },
  { name: 'Cherokee County', code: 'CHEROKEE', govId: '1028028', description: 'North Georgia county', email: 'cherokee@civisight.org', ...FY.octSep },
  { name: 'Henry County', code: 'HENRY', govId: '1075075', description: 'South metro Atlanta county', email: 'henry@civisight.org', ...FY.julJun },
  { name: 'Paulding County', code: 'PAULDING', govId: '1110110', description: 'West metro Atlanta county', email: 'paulding@civisight.org', ...FY.julJun },
  { name: 'Douglas County', code: 'DOUGLAS', govId: '1048048', description: 'West metro Atlanta county', email: 'douglas@civisight.org', ...FY.janDec },
  { name: 'Fayette County', code: 'FAYETTE', govId: '1056056', description: 'South metro Atlanta county', email: 'fayette@civisight.org', ...FY.julJun },
  { name: 'Coweta County', code: 'COWETA', govId: '1038038', description: 'Southwest metro Atlanta county', email: 'coweta@civisight.org', ...FY.octSep },
  { name: 'Carroll County', code: 'CARROLL', govId: '1022022', description: 'West Georgia county', email: 'carroll@civisight.org', ...FY.julJun },
  { name: 'Newton County', code: 'NEWTON', govId: '1107107', description: 'East metro Atlanta county', email: 'newton@civisight.org', ...FY.julJun },
  { name: 'Bartow County', code: 'BARTOW', govId: '1008008', description: 'Northwest Georgia county', email: 'bartow@civisight.org', ...FY.janDec },
  { name: 'Troup County', code: 'TROUP', govId: '1141141', description: 'West Georgia county including LaGrange', email: 'troup@civisight.org', ...FY.julJun },
].map((c) => ({ ...c, type: 'county' }));

// ---- entities: cities (real GA gov_ids) ----
const cities = [
  { name: 'Atlanta (City)', code: 'CITY-ATLANTA', govId: '2060002', description: 'State capital; largest city', email: 'atlanta.city@civisight.org', ...FY.julJun },
  { name: 'Savannah (City)', code: 'CITY-SAVANNAH', govId: '2025003', description: 'Coastal city in Chatham County', email: 'savannah.city@civisight.org', ...FY.janDec },
  { name: 'Marietta (City)', code: 'CITY-MARIETTA', govId: '2033004', description: 'City in Cobb County', email: 'marietta.city@civisight.org', ...FY.julJun },
  { name: 'Roswell (City)', code: 'CITY-ROSWELL', govId: '2060009', description: 'City in Fulton County', email: 'roswell.city@civisight.org', ...FY.julJun },
  { name: 'Sandy Springs (City)', code: 'CITY-SANDYSPRINGS', govId: '2060501', description: 'City in Fulton County', email: 'sandysprings.city@civisight.org', ...FY.octSep },
  { name: 'Alpharetta (City)', code: 'CITY-ALPHARETTA', govId: '2060001', description: 'City in Fulton County', email: 'alpharetta.city@civisight.org', ...FY.julJun },
  { name: 'Valdosta (City)', code: 'CITY-VALDOSTA', govId: '2092004', description: 'City in Lowndes County', email: 'valdosta.city@civisight.org', ...FY.julJun },
  { name: 'Gainesville (City)', code: 'CITY-GAINESVILLE', govId: '2069003', description: 'City in Hall County', email: 'gainesville.city@civisight.org', ...FY.janDec },
  { name: 'LaGrange (City)', code: 'CITY-LAGRANGE', govId: '2141002', description: 'City in Troup County', email: 'lagrange.city@civisight.org', ...FY.julJun },
  { name: 'Newnan (City)', code: 'CITY-NEWNAN', govId: '2038004', description: 'City in Coweta County', email: 'newnan.city@civisight.org', ...FY.julJun },
].map((c) => ({ ...c, type: 'city' }));

// ---- entities: authorities (real GA authority names; gov_id null — they file AARF,
// not the RLGF, so they aren't in the RLGF gov-id reference) ----
const authorities = [
  { name: 'Georgia Ports Authority', code: 'AUTH-GPA', description: 'Deep-water ports of Savannah and Brunswick', email: 'gpa@civisight.org', ...FY.julJun },
  { name: 'Municipal Electric Authority of Georgia', code: 'AUTH-MEAG', description: 'Wholesale power to municipal utilities (MEAG Power)', email: 'meag@civisight.org', ...FY.janDec },
  { name: 'Development Authority of Fulton County', code: 'AUTH-DAFC', description: 'Economic development / bond issuance for Fulton County', email: 'dafc@civisight.org', ...FY.janDec },
  { name: 'Atlanta Housing Authority', code: 'AUTH-AHA', description: 'Public housing authority for the City of Atlanta', email: 'aha@civisight.org', ...FY.julJun },
  { name: 'Georgia World Congress Center Authority', code: 'AUTH-GWCCA', description: 'Convention, sports and entertainment campus', email: 'gwcca@civisight.org', ...FY.julJun },
  { name: 'Metropolitan Atlanta Rapid Transit Authority', code: 'AUTH-MARTA', description: 'Regional public transit (MARTA)', email: 'marta@civisight.org', ...FY.julJun },
].map((a) => ({ ...a, type: 'authority', govId: null }));

// ---- filings (counties + cities file these local-government reports) ----
const FORMS = [
  { title: 'Annual Financial Audit', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'high', rule: { type: 'fyOffset', days: 180 }, description: 'Independent external audit of financial statements under Government Auditing Standards (O.C.G.A. § 36-81-7). Due within 180 days of fiscal year-end.' },
  { title: 'Audit Corrective-Action Plan', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'medium', rule: { type: 'fyOffset', days: 210 }, description: 'Corrective-action plan addressing any audit findings (O.C.G.A. § 36-81-7). Due 30 days after the audit due date.' },
  { title: 'Report of Local Government Finances', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'high', rule: { type: 'fyOffset', days: 270 }, description: 'Standardized report of revenues, expenditures, debt, and fund balances filed through the DCA survey window (O.C.G.A. § 36-81-8).' },
  { title: 'County Property Tax Digest Submission', submittedTo: 'Dept. of Revenue (DOR), Local Govt. Services', priority: 'high', rule: { type: 'fixed', month: 9, day: 1 }, description: 'Annual property tax digest and supporting package to the Department of Revenue (O.C.G.A. Title 48, Ch. 5). Due September 1.' },
  { title: 'Millage Rate / 5-Year History / Rollback Process', submittedTo: 'Published in local newspaper', priority: 'medium', rule: { type: 'fixed', month: 8, day: 31 }, description: 'Five-year tax history and rollback-rate advertisement published when the millage rate is set (O.C.G.A. § 48-5-32).' },
  { title: 'SPLOST Annual Report', submittedTo: 'Newspaper + county website', priority: 'medium', rule: { type: 'fixed', month: 12, day: 31 }, description: 'Annual SPLOST / ESPLOST / TSPLOST report on project-level revenues and expenditures (O.C.G.A. § 48-8-122). Due December 31.' },
  { title: 'Hotel-Motel Tax Report', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'medium', rule: { type: 'fyOffset', days: 180 }, description: 'Annual report of hotel-motel excise tax collections and authorized expenditures (O.C.G.A. § 48-13-56). Due within 180 days of fiscal year-end.' },
  { title: 'Immigration Compliance Report (Title 13 / E-Verify)', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'medium', rule: { type: 'fixed', month: 12, day: 31 }, description: 'Annual attestation of E-Verify and immigration-compliance requirements (O.C.G.A. § 13-10-91). Due December 31.' },
  { title: 'Solid Waste Survey and Full Cost Report', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'low', rule: { type: 'fixed', month: 9, day: 30 }, description: 'Annual solid waste management survey and full-cost accounting report (O.C.G.A. § 12-8-31.1(d)). Due September 30.' },
  { title: 'Local Victim Assistance 5% Report', submittedTo: 'GSCCCA (funds to county / DA)', priority: 'medium', rule: { type: 'monthly' }, description: 'Monthly remittance and report of the 5% victim-assistance add-on collected on fines and bonds (O.C.G.A. § 15-21-131/132).' },
  { title: 'Annual Budget Adoption and Advertisement', submittedTo: 'Adopted / published locally', priority: 'high', rule: { type: 'beforeFYStart' }, description: 'Adoption and public advertisement of the annual operating budget before the start of the fiscal year (O.C.G.A. § 36-81-5).' },
  { title: 'Single Audit and SF-SAC', submittedTo: 'Federal Audit Clearinghouse (FAC)', priority: 'high', rule: { type: 'fyOffset', days: 270 }, description: 'Federal Single Audit and SF-SAC submission when federal spending exceeds the $1M threshold (2 CFR Part 200, Subpart F).' },
];

// Cities file a lighter subset than counties (no county tax digest, etc.)
const CITY_FORM_TITLES = new Set([
  'Annual Financial Audit', 'Report of Local Government Finances', 'Hotel-Motel Tax Report',
  'Annual Budget Adoption and Advertisement', 'Immigration Compliance Report (Title 13 / E-Verify)', 'SPLOST Annual Report',
]);

// Authorities file registration + an audit (AARF is not yet a modeled online form).
const AUTHORITY_FORMS = [
  { title: 'Authority Registration (AARF)', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'high', rule: { type: 'fixed', month: 12, day: 31 }, description: 'Annual registration of the local authority with DCA under the Authorities Registration Act (O.C.G.A. § 36-80-16). Due December 31.' },
  { title: 'Annual Financial Audit', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'high', rule: { type: 'fyOffset', days: 180 }, description: 'Independent external audit of the authority\'s financial statements (O.C.G.A. § 36-81-7).' },
];

// ---- a compact, UCOA-coded RLGF answer set (real codes; demo values scaled per entity) ----
const RLGF_FIELDS = [
  { key: 'govId', page: 'Page 1', cell: 'C12', label: 'Government ID', type: 'text', derived: false },
  { key: 'fiscalYear', page: 'Page 1', cell: 'F17', label: 'Fiscal year', type: 'integer', derived: false },
  { key: 'realPropertyTax', page: 'Page 2', cell: 'F38', label: 'Real property taxes', ucoaCode: '31.1100', type: 'dollar', derived: false },
  { key: 'motorVehicleTax', page: 'Page 2', cell: 'F44', label: 'Motor vehicle taxes', ucoaCode: '31.1300', type: 'dollar', derived: false },
  { key: 'localOptionSalesTax', page: 'Page 2', cell: 'F48', label: 'Local option sales tax (LOST)', ucoaCode: '31.3100', type: 'dollar', derived: false },
  { key: 'chargesForServices', page: 'Page 3', cell: 'F70', label: 'Charges for services', ucoaCode: '34.1000', type: 'dollar', derived: false },
  { key: 'generalGovtExpend', page: 'Page 4', cell: 'F120', label: 'General government expenditures', ucoaCode: '51.1000', type: 'dollar', derived: false },
  { key: 'publicSafetyExpend', page: 'Page 4', cell: 'F140', label: 'Public safety expenditures', ucoaCode: '51.3200', type: 'dollar', derived: false },
  { key: 'debtService', page: 'Page 5', cell: 'F200', label: 'Total debt service', ucoaCode: '58.1000', type: 'dollar', derived: false },
  { key: 'endingFundBalance', page: 'Page 6', cell: 'F250', label: 'Ending fund balance', ucoaCode: '99.9999', type: 'dollar', derived: false },
];
const RLGF_META_FIELDS = Object.fromEntries(RLGF_FIELDS.map((f) => [f.key, f]));

// Deterministic pseudo-random in [0,1) from a string, so seeded values are stable.
const seededUnit = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
};
const round = (n) => Math.round(n);
// Build a realistic answer set for an entity's RLGF filing. `zeroDebt` forces the
// vision's example scenario (revenue > $1M, zero debt service) for at least one entity.
const rlgfAnswersFor = (entity, fiscalYear, { zeroDebt = false } = {}) => {
  const scale = 0.25 + seededUnit(entity.code) * 4; // ~0.25x .. 4.25x
  const base = 1_000_000;
  const prop = round(base * scale * (1.0 + seededUnit(entity.code + 'p')));
  const mv = round(prop * 0.12);
  const lost = round(base * scale * (0.6 + seededUnit(entity.code + 'l')));
  const charges = round(base * scale * 0.4);
  const genGov = round((prop + lost) * 0.25);
  const pubSafety = round((prop + lost) * 0.45);
  const debt = zeroDebt ? 0 : round(base * scale * 0.18 * seededUnit(entity.code + 'd'));
  const fundBal = round((prop + lost + charges) * (0.2 + seededUnit(entity.code + 'f') * 0.3));
  return {
    govId: entity.govId || '',
    fiscalYear,
    realPropertyTax: prop,
    motorVehicleTax: mv,
    localOptionSalesTax: lost,
    chargesForServices: charges,
    generalGovtExpend: genGov,
    publicSafetyExpend: pubSafety,
    debtService: debt,
    endingFundBalance: fundBal,
  };
};

const FULTON_CONTACTS = [
  { role: 'Chief Financial Officer', name: 'Alexandra Green', email: 'alexandra.green@fultoncounty.gov', phone: '(404) 612-1001' },
  { role: 'Grants & Compliance Manager', name: 'Marcus Thompson', email: 'marcus.thompson@fultoncounty.gov', phone: '(404) 612-1002' },
  { role: 'Internal Audit Director', name: 'Priya Shah', email: 'priya.shah@fultoncounty.gov', phone: '(404) 612-1003' },
  { role: 'SPLOST Program Manager', name: 'Daniel Roberts', email: 'daniel.roberts@fultoncounty.gov', phone: '(404) 612-1004' },
  { role: 'Records & Reporting Coordinator', name: 'Lauren Mitchell', email: 'lauren.mitchell@fultoncounty.gov', phone: '(404) 612-1005' },
];
// Generic contacts for every other entity (varied names, stable per entity).
const FIRST = ['James', 'Maria', 'Robert', 'Linda', 'David', 'Susan', 'Michael', 'Karen', 'William', 'Nancy', 'Richard', 'Betty'];
const LAST = ['Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson'];
const genericContactsFor = (entity) => {
  const u = seededUnit(entity.code);
  const nm = (salt) => {
    const f = FIRST[Math.floor(seededUnit(entity.code + salt + 'f') * FIRST.length)];
    const l = LAST[Math.floor(seededUnit(entity.code + salt + 'l') * LAST.length)];
    return `${f} ${l}`;
  };
  const domain = entity.code.replace(/[^a-z0-9]/gi, '').toLowerCase() + '.gov';
  return [
    { role: entity.type === 'authority' ? 'Executive Director' : 'Finance Director', name: nm('1'), email: `finance@${domain}`, phone: '(770) 555-0' + String(100 + Math.floor(u * 800)).padStart(3, '0') },
    { role: 'Compliance & Reporting Officer', name: nm('2'), email: `compliance@${domain}`, phone: '(770) 555-0' + String(100 + Math.floor(seededUnit(entity.code + 'x') * 800)).padStart(3, '0') },
  ];
};

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
const isRlgfForm = (form) => form.title === 'Report of Local Government Finances';
// Default status for tasks that DON'T receive a seeded submission.
const statusFor = (form, deadline, entityIdx, formIdx, now) => {
  if (isRlgfForm(form)) return (entityIdx + formIdx) % 4 === 0 ? 'in_progress' : 'pending';
  if (deadline.getTime() < now) return 'completed';
  return (entityIdx + formIdx) % 3 === 0 ? 'in_progress' : 'pending';
};

// ---- core seeding (runs on a provided pg client so it can be tx-wrapped) ----
async function seedInto(client) {
  await client.query('truncate submissions, notifications, contacts, tasks, users, entities restart identity cascade');

  const allEntities = [...counties, ...cities, ...authorities].map((e) => ({ ...e, id: newId() }));

  // Entities (counties, cities, authorities)
  for (const e of allEntities) {
    await client.query(
      `insert into entities (id,gov_id,type,name,code,description,email,
         fiscal_year_start_month,fiscal_year_start_day,fiscal_year_end_month,fiscal_year_end_day)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [e.id, e.govId ?? null, e.type, e.name, e.code, e.description, e.email,
       e.fiscalYearStartMonth, e.fiscalYearStartDay, e.fiscalYearEndMonth, e.fiscalYearEndDay]
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
  const dcaId = newId();
  await insertUser({ id: accgId, username: 'accg', email: 'accg@civisight.org', password: 'accg123', role: 'accg' });
  await insertUser({ id: dcaId, username: 'dca', email: 'dca@civisight.org', password: 'dca123', role: 'dca' });

  // One user per entity (Fulton gets three role-scoped users). Cities/authorities get a
  // single entity user; the role stays 'county_user' (the generic non-agency role).
  const usersByEntity = new Map(); // entityId -> [userId,...]
  let entityUserCount = 0;
  for (const e of allEntities) {
    const ids = [];
    if (e.code === 'FULTON') {
      const u1 = newId(), u2 = newId(), u3 = newId();
      await insertUser({ id: u1, username: 'fulton_finance_user', email: 'alexandra.green@fultoncounty.gov', password: 'county123', role: 'county_user', countyId: e.id, departmentRoles: FULTON_FINANCE_ROLES });
      await insertUser({ id: u2, username: 'fulton_operations_user', email: 'fulton_operations@civisight.org', password: 'county123', role: 'county_user', countyId: e.id, departmentRoles: FULTON_OPERATIONS_ROLES });
      await insertUser({ id: u3, username: 'fulton_hr_legal_user', email: 'fulton_hr_legal@civisight.org', password: 'county123', role: 'county_user', countyId: e.id, departmentRoles: FULTON_HR_LEGAL_ROLES });
      ids.push(u1, u2, u3);
      entityUserCount += 3;
    } else {
      const slug = e.code.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const uid = newId();
      await insertUser({ id: uid, username: `${slug}_user`, email: `${slug}@civisight.org`, password: 'county123', role: 'county_user', countyId: e.id, departmentRoles: DEPARTMENT_ROLE_SLUGS });
      ids.push(uid);
      entityUserCount += 1;
    }
    usersByEntity.set(e.id, ids);
  }

  // Tasks. Counties: all FORMS. Cities: the municipal subset. Authorities: AUTHORITY_FORMS.
  const now = Date.now();
  const tasks = []; // { id, form, entity }
  const formsFor = (e) =>
    e.type === 'authority' ? AUTHORITY_FORMS
      : e.type === 'city' ? FORMS.filter((f) => CITY_FORM_TITLES.has(f.title))
        : FORMS;
  for (let i = 0; i < allEntities.length; i++) {
    const entity = allEntities[i];
    const forms = formsFor(entity);
    for (let f = 0; f < forms.length; f++) {
      const form = forms[f];
      const deadline = deadlineFor(form, entity);
      const status = statusFor(form, deadline, i, f, now);
      const completedAt = status === 'completed' ? addDays(deadline, -5) : null;
      const id = newId();
      await client.query(
        `insert into tasks (id,title,description,county_id,submitted_to,portal_link,status,priority,deadline,assigned_by,completed_at)
         values ($1,$2,$3,$4,$5,'',$6,$7,$8,$9,$10)`,
        [id, form.title, form.description, entity.id, form.submittedTo, status, form.priority, deadline, accgId, completedAt]
      );
      tasks.push({ id, form, entity, deadline });
    }
  }

  // ---- Submissions across the review lifecycle ----
  const daysAgo = (n) => new Date(now - n * 86400000);
  const notifications = [];
  const pushNotif = (userId, type, title, message, taskId) =>
    notifications.push({ id: newId(), userId, type, title, message, taskId: taskId || null });

  const insertSubmission = async (s) => {
    await client.query(
      `insert into submissions
        (id,task_id,county_id,agency,form_name,form_type,status,submitted_by,submitted_at,
         answers,metadata,comments,file,reviewed_by,reviewed_at,review_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,$16)`,
      [s.id, s.taskId, s.entityId, s.agency, s.formName, s.formType, s.status, s.submittedBy, s.submittedAt,
       JSON.stringify(s.answers ?? null), JSON.stringify(s.metadata || {}), JSON.stringify(s.comments || []),
       JSON.stringify(s.file ?? null), s.reviewedBy ?? null, s.reviewedAt ?? null, s.reviewNote || '']
    );
  };
  // Update a task's status/completed_at to stay consistent with its submission.
  const setTaskStatus = async (taskId, status) => {
    const completedAt = status === 'completed' ? daysAgo(4) : null;
    await client.query(`update tasks set status=$2, completed_at=$3 where id=$1`, [taskId, status, completedAt]);
  };

  // Map review status -> the task status it implies.
  const TASK_STATUS_FOR_REVIEW = { submitted: 'submitted', under_review: 'submitted', accepted: 'completed', needs_correction: 'in_progress' };
  const REVIEW_CYCLE = ['accepted', 'under_review', 'submitted', 'needs_correction'];

  // Attach one online RLGF submission per county + per city (rotating through states),
  // and a couple of file-upload submissions, so every review state is represented.
  let submissionCount = 0;
  const rlgfTasks = tasks.filter((t) => isRlgfForm(t.form) && t.entity.type !== 'authority');
  for (let idx = 0; idx < rlgfTasks.length; idx++) {
    const t = rlgfTasks[idx];
    const reviewStatus = REVIEW_CYCLE[idx % REVIEW_CYCLE.length];
    const submitter = (usersByEntity.get(t.entity.id) || [])[0];
    const fiscalYear = TARGET_YEAR - 1;
    // Make one mid-size entity the "revenue > $1M, zero debt" example for the vision query.
    const zeroDebt = t.entity.code === 'HENRY';
    const answers = rlgfAnswersFor(t.entity, fiscalYear, { zeroDebt });
    const submittedAt = daysAgo(reviewStatus === 'accepted' ? 60 : reviewStatus === 'needs_correction' ? 25 : reviewStatus === 'under_review' ? 9 : 3);
    const reviewed = reviewStatus === 'accepted' || reviewStatus === 'needs_correction' || reviewStatus === 'under_review';
    const comments = reviewStatus === 'needs_correction'
      ? [{ fieldId: 'debtService', text: 'Debt service figure does not tie to the audited statements — please correct and resubmit.', createdBy: dcaId, createdAt: daysAgo(20).toISOString(), readBy: [] }]
      : [];
    const subId = newId();
    await insertSubmission({
      id: subId, taskId: t.id, entityId: t.entity.id, agency: t.form.submittedTo,
      formName: t.form.title, formType: 'online', status: reviewStatus, submittedBy: submitter,
      submittedAt, answers, metadata: { source: 'online_form', form: 'rlgf', version: '2020', fields: RLGF_META_FIELDS, answerCount: Object.keys(answers).length },
      comments, reviewedBy: reviewed ? dcaId : null, reviewedAt: reviewed ? daysAgo(reviewStatus === 'accepted' ? 50 : 20) : null,
      reviewNote: reviewStatus === 'accepted' ? 'Accepted — figures tie to the audit.' : reviewStatus === 'needs_correction' ? 'Returned for correction (see comment).' : '',
    });
    await setTaskStatus(t.id, TASK_STATUS_FOR_REVIEW[reviewStatus]);
    submissionCount++;
    // notifications reflecting the round-trip
    if (submitter) pushNotif(dcaId, 'submission_received', 'New filing to review', `${t.entity.name} submitted "${t.form.title}" for review`, t.id);
    if (reviewStatus === 'accepted' && submitter) pushNotif(submitter, 'submission_reviewed', 'Filing accepted', `Your filing "${t.form.title}" was accepted.`, t.id);
    if (reviewStatus === 'needs_correction' && submitter) {
      pushNotif(submitter, 'submission_reviewed', 'Filing returned for correction', `Your filing "${t.form.title}" was returned for correction.`, t.id);
      pushNotif(submitter, 'submission_comment', 'New review comment', `The reviewer left a comment on "${t.form.title}".`, t.id);
    }

    // Resubmission chain (history): for Gwinnett, add a corrected v2 after the v1 bounce.
    if (t.entity.code === 'GWINNETT') {
      const v2Answers = rlgfAnswersFor(t.entity, fiscalYear);
      const v2Id = newId();
      await insertSubmission({
        id: v2Id, taskId: t.id, entityId: t.entity.id, agency: t.form.submittedTo,
        formName: t.form.title, formType: 'online', status: 'submitted', submittedBy: submitter,
        submittedAt: daysAgo(2), answers: v2Answers,
        metadata: { source: 'online_form', form: 'rlgf', version: '2020', fields: RLGF_META_FIELDS, answerCount: Object.keys(v2Answers).length, resubmissionOf: subId },
        comments: [], reviewedBy: null, reviewedAt: null, reviewNote: '',
      });
      await setTaskStatus(t.id, 'submitted'); // v2 is now pending review
      submissionCount++;
      if (submitter) pushNotif(dcaId, 'submission_received', 'Resubmitted filing to review', `${t.entity.name} resubmitted "${t.form.title}" after correction`, t.id);
    }
  }

  // A few file-upload submissions on Annual Financial Audit tasks (formType 'file').
  const auditTasks = tasks.filter((t) => t.form.title === 'Annual Financial Audit' && t.entity.type === 'county').slice(0, 5);
  for (let i = 0; i < auditTasks.length; i++) {
    const t = auditTasks[i];
    const submitter = (usersByEntity.get(t.entity.id) || [])[0];
    const reviewStatus = i % 2 === 0 ? 'accepted' : 'under_review';
    const reviewed = true;
    await insertSubmission({
      id: newId(), taskId: t.id, entityId: t.entity.id, agency: t.form.submittedTo,
      formName: t.form.title, formType: 'file', status: reviewStatus, submittedBy: submitter,
      submittedAt: daysAgo(reviewStatus === 'accepted' ? 70 : 12), answers: null,
      metadata: { source: 'filled_form_upload' },
      file: { originalName: `${t.entity.code}_FY${TARGET_YEAR - 1}_Audit.pdf`, fileName: `seed-${t.entity.code}-audit.pdf`, filePath: `filled-forms/seed-${t.entity.code}-audit.pdf`, uploadedAt: daysAgo(70) },
      comments: [], reviewedBy: dcaId, reviewedAt: daysAgo(reviewStatus === 'accepted' ? 60 : 8),
      reviewNote: reviewStatus === 'accepted' ? 'Audit received and accepted.' : '',
    });
    await setTaskStatus(t.id, TASK_STATUS_FOR_REVIEW[reviewStatus]);
    submissionCount++;
    if (submitter) pushNotif(dcaId, 'submission_received', 'New filing to review', `${t.entity.name} uploaded "${t.form.title}" for review`, t.id);
    if (reviewStatus === 'accepted' && submitter) pushNotif(submitter, 'submission_reviewed', 'Filing accepted', `Your filing "${t.form.title}" was accepted.`, t.id);
  }

  // ---- Contacts for most entities (Fulton keeps its detailed roster) ----
  let contactCount = 0;
  for (const e of allEntities) {
    const list = (e.code === 'FULTON' ? FULTON_CONTACTS : genericContactsFor(e)).map((c) => ({ ...c, _id: newId() }));
    await client.query(`insert into contacts (id,county_id,contacts) values ($1,$2,$3::jsonb)`, [newId(), e.id, JSON.stringify(list)]);
    contactCount++;
  }

  // ---- A batch of task_assigned notifications (recent assignments) ----
  for (const t of tasks.slice(0, 40)) {
    for (const uid of (usersByEntity.get(t.entity.id) || [])) {
      pushNotif(uid, 'task_assigned', 'New Task Assigned', `New task assigned: ${t.form.title}`, t.id);
    }
  }

  // Flush notifications
  for (const n of notifications) {
    await client.query(
      `insert into notifications (id,user_id,type,title,message,task_id,read) values ($1,$2,$3,$4,$5,$6,$7)`,
      [n.id, n.userId, n.type, n.title, n.message, n.taskId, false]
    );
  }

  return {
    entities: { counties: counties.length, cities: cities.length, authorities: authorities.length, total: allEntities.length },
    users: entityUserCount + 2,
    tasks: tasks.length,
    submissions: submissionCount,
    contacts: contactCount,
    notifications: notifications.length,
  };
}

async function isPopulated(client) {
  const { rows } = await client.query(
    `select (select count(*) from entities) + (select count(*) from users) +
            (select count(*) from tasks) + (select count(*) from contacts) +
            (select count(*) from submissions) + (select count(*) from notifications) as n`
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
    console.log('Logins — ACCG: accg@civisight.org/accg123 · DCA: dca@civisight.org/dca123 · entity users: <code>@civisight.org/county123');
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
