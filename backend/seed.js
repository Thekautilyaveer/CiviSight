const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const County = require('./models/County');
const Task = require('./models/Task');
const Contact = require('./models/Contact');
const logger = require('./utils/logger');
const { DEPARTMENT_ROLE_SLUGS } = require('./constants/departmentRoles');

dotenv.config();

// Fulton County: three users with different role subsets
const FULTON_FINANCE_ROLES = ['finance_budget_accounting', 'compliance_regulatory_reporting', 'grants_funding_reimbursements', 'tax_revenue'];
const FULTON_OPERATIONS_ROLES = ['county_administration_leadership', 'public_works_infrastructure', 'emergency_management_disaster_response', 'planning_development'];
const FULTON_HR_LEGAL_ROLES = ['hr_training', 'legal_governance'];

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';

// ---------------------------------------------------------------------------
// Fiscal years (source: Georgia Local Government Fiscal Years list).
// Each county's start/end drives the FY-relative filing deadlines below.
// ---------------------------------------------------------------------------
const FY = {
  janDec: { fiscalYearStartMonth: 1, fiscalYearStartDay: 1, fiscalYearEndMonth: 12, fiscalYearEndDay: 31 },
  julJun: { fiscalYearStartMonth: 7, fiscalYearStartDay: 1, fiscalYearEndMonth: 6, fiscalYearEndDay: 30 },
  octSep: { fiscalYearStartMonth: 10, fiscalYearStartDay: 1, fiscalYearEndMonth: 9, fiscalYearEndDay: 30 }
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
  { name: 'Troup County', code: 'TROUP', description: 'West Georgia county including LaGrange', email: 'troup@civisight.org', ...FY.julJun }
];

// ---------------------------------------------------------------------------
// Recurring reports & filings Georgia counties submit (source: Georgia County
// Recurring Reports & Filings). Deadlines are computed for calendar year 2026.
//   rule: { type: 'fyOffset', days }   -> N days after the county's FY-end
//         { type: 'fixed', month, day} -> a fixed statutory calendar date
//         { type: 'beforeFYStart' }    -> day before the county's next FY starts
//         { type: 'monthly' }          -> end of the current month
// ---------------------------------------------------------------------------
const FORMS = [
  { title: 'Annual Financial Audit', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'high', rule: { type: 'fyOffset', days: 180 },
    description: 'Independent external audit of the county\'s financial statements under Government Auditing Standards (O.C.G.A. § 36-81-7). Due within 180 days of fiscal year-end. Agreed-Upon Procedures may substitute if expenditures are under $550K.' },
  { title: 'Audit Corrective-Action Plan', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'medium', rule: { type: 'fyOffset', days: 210 },
    description: 'Corrective-action plan addressing any findings in the annual audit (O.C.G.A. § 36-81-7). Due 30 days after the audit due date.' },
  { title: 'Report of Local Government Finances (RLGF)', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'high', rule: { type: 'fyOffset', days: 270 },
    description: 'Standardized report of county revenues, expenditures, debt, and fund balances filed through the DCA survey window (O.C.G.A. § 36-81-8).' },
  { title: 'County Property Tax Digest + Submission Package', submittedTo: 'Dept. of Revenue (DOR), Local Govt. Services', priority: 'high', rule: { type: 'fixed', month: 9, day: 1 },
    description: 'Annual property tax digest and supporting submission package to the Department of Revenue (O.C.G.A. Title 48, Ch. 5). Due September 1.' },
  { title: 'Millage Rate / 5-Year History + Rollback Advertisement', submittedTo: 'Published in local newspaper', priority: 'medium', rule: { type: 'fixed', month: 8, day: 31 },
    description: 'Five-year tax history and rollback-rate advertisement published when the millage rate is set (O.C.G.A. § 48-5-32). Satisfied by public newspaper publication.' },
  { title: 'SPLOST Annual Report', submittedTo: 'Newspaper + county website', priority: 'medium', rule: { type: 'fixed', month: 12, day: 31 },
    description: 'Annual SPLOST / ESPLOST / TSPLOST report on project-level revenues and expenditures (O.C.G.A. § 48-8-122). Due not later than December 31.' },
  { title: 'Hotel-Motel Tax Report', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'medium', rule: { type: 'fyOffset', days: 180 },
    description: 'Annual report of hotel-motel excise tax collections and authorized expenditures (O.C.G.A. § 48-13-56). Due within 180 days of fiscal year-end.' },
  { title: 'Local Retirement / Pension Report', submittedTo: 'State Auditor (DOAA)', priority: 'medium', rule: { type: 'fyOffset', days: 180 },
    description: 'Annual actuarial and financial report on the county\'s local retirement/pension plans (O.C.G.A. § 47-20-1 et seq.), per the DOAA schedule.' },
  { title: 'Immigration Compliance Report (Title 13 / E-Verify)', submittedTo: 'Dept. of Audits & Accounts (DOAA)', priority: 'medium', rule: { type: 'fixed', month: 12, day: 31 },
    description: 'Annual attestation of E-Verify and immigration-compliance requirements (O.C.G.A. § 13-10-91). Due December 31.' },
  { title: 'Transparency in Government Act (TIGA) Salary & Travel Report', submittedTo: 'DOAA (published on Open Georgia)', priority: 'low', rule: { type: 'fyOffset', days: 46 },
    description: 'Annual salary and travel report published on Open Georgia (O.C.G.A. § 50-6-32). Due roughly 45 days after fiscal year-end (~August 15 for June 30 FY-ends).' },
  { title: 'Solid Waste Management Survey & Full Cost Report', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'low', rule: { type: 'fixed', month: 9, day: 30 },
    description: 'Annual solid waste management survey and full-cost accounting report (O.C.G.A. § 12-8-31.1(d)). Mailed out by July 15; due September 30.' },
  { title: 'Local Victim Assistance (5%) Fine Report', submittedTo: 'GSCCCA (funds to county / DA)', priority: 'medium', rule: { type: 'monthly' },
    description: 'Monthly remittance and report of the 5% victim-assistance add-on collected on fines and bonds (O.C.G.A. § 15-21-131/132).' },
  { title: 'Annual Budget Adoption + Advertisement', submittedTo: 'Adopted / published locally', priority: 'high', rule: { type: 'beforeFYStart' },
    description: 'Adoption and public advertisement of the annual operating budget before the start of the fiscal year (O.C.G.A. § 36-81-5).' },
  { title: 'Annual Authority Registration & Financials (AARF)', submittedTo: 'Dept. of Community Affairs (DCA)', priority: 'medium', rule: { type: 'fyOffset', days: 180 },
    description: 'Registration and financial filing for county authorities, due within 6 months of the authority\'s fiscal year-end (HB 257, 2018).' },
  { title: 'Single Audit + SF-SAC Form', submittedTo: 'Federal Audit Clearinghouse (FAC)', priority: 'high', rule: { type: 'fyOffset', days: 270 },
    description: 'Federal Single Audit and SF-SAC submission when federal spending exceeds the $1M threshold (2 CFR Part 200, Subpart F). Due the earlier of 30 days after the auditor\'s report or 9 months after period-end.' }
];

// ---- deadline helpers (target calendar year 2026) ----
const TARGET_YEAR = 2026;
const atEod = (y, m, d) => new Date(y, m - 1, d, 23, 59, 0);
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const fyEnd = (c, year) => atEod(year, c.fiscalYearEndMonth, c.fiscalYearEndDay);

// Pick the FY-end (prior or current year) whose offset lands the deadline in 2026.
const fyOffsetDeadline = (c, days) => {
  const a = addDays(fyEnd(c, TARGET_YEAR - 1), days);
  const b = addDays(fyEnd(c, TARGET_YEAR), days);
  if (a.getFullYear() === TARGET_YEAR) return a;
  if (b.getFullYear() === TARGET_YEAR) return b;
  return a;
};
const beforeFyStartDeadline = (c) => {
  // Budget is due before the NEXT fiscal year begins; choose the start that lands the deadline in 2026.
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

// Deterministic status mix that reflects mid-2026 reality:
// filings already past their deadline are mostly completed (counties filed them),
// only a few counties are genuinely behind, and upcoming filings are a mix of
// not-started and in-progress. This keeps the attention list meaningful.
const statusFor = (deadline, countyIdx, formIdx, now) => {
  const past = deadline.getTime() < now;
  // Anything already past its deadline is treated as filed (completed) — no overdue.
  if (past) return 'completed';
  // Upcoming filings: roughly a third are already in progress.
  return (countyIdx + formIdx) % 3 === 0 ? 'in_progress' : 'pending';
};

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await County.deleteMany({});
    await Task.deleteMany({});
    await Contact.deleteMany({});

    console.log('Cleared existing data');

    // Create counties
    const createdCounties = await County.insertMany(counties);
    console.log(`Created ${createdCounties.length} counties`);

    // Create admin user
    const admin = new User({
      username: 'admin',
      email: 'admin@civisight.org',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('Created admin user (email: admin@civisight.org, password: admin123)');

    // Create county users: one per county with all roles, except Fulton which gets three users with role subsets
    const countyUsers = [];
    for (const county of createdCounties) {
      if (county.code === 'FULTON') {
        const fultonFinance = new User({
          username: 'fulton_finance_user',
          email: 'alexandra.green@fultoncounty.gov',
          password: 'county123',
          role: 'county_user',
          countyId: county._id,
          departmentRoles: FULTON_FINANCE_ROLES
        });
        await fultonFinance.save();
        countyUsers.push(fultonFinance);

        const fultonOperations = new User({
          username: 'fulton_operations_user',
          email: 'fulton_operations@civisight.org',
          password: 'county123',
          role: 'county_user',
          countyId: county._id,
          departmentRoles: FULTON_OPERATIONS_ROLES
        });
        await fultonOperations.save();
        countyUsers.push(fultonOperations);

        const fultonHrLegal = new User({
          username: 'fulton_hr_legal_user',
          email: 'fulton_hr_legal@civisight.org',
          password: 'county123',
          role: 'county_user',
          countyId: county._id,
          departmentRoles: FULTON_HR_LEGAL_ROLES
        });
        await fultonHrLegal.save();
        countyUsers.push(fultonHrLegal);
      } else {
        const countyName = county.name.toLowerCase().replace(/\s+/g, '');
        const countyUser = new User({
          username: `${countyName}_user`,
          email: `${countyName}@civisight.org`,
          password: 'county123',
          role: 'county_user',
          countyId: county._id,
          departmentRoles: DEPARTMENT_ROLE_SLUGS
        });
        await countyUser.save();
        countyUsers.push(countyUser);
      }
    }

    console.log(`Created ${countyUsers.length} county users`);
    console.log('\nCounty user credentials:');
    countyUsers.forEach(user => {
      console.log(`  ${user.email} / county123 (${user.username})`);
    });
    console.log('\nFulton County has 3 users with different roles: fulton_finance@, fulton_operations@, fulton_hr_legal@civisight.org');

    // Create the real recurring filings for every county, with deadlines
    // adjusted to each county's fiscal year (for calendar year 2026).
    const allTasks = [];
    const now = Date.now();

    createdCounties.forEach((county, i) => {
      FORMS.forEach((form, f) => {
        const deadline = deadlineFor(form, county);
        const status = statusFor(deadline, i, f, now);
        allTasks.push({
          title: form.title,
          description: form.description,
          countyId: county._id,
          submittedTo: form.submittedTo,
          priority: form.priority,
          status,
          deadline,
          completedAt: status === 'completed' ? addDays(deadline, -5) : undefined,
          assignedBy: admin._id
        });
      });
    });

    await Task.insertMany(allTasks);
    console.log(`Created ${allTasks.length} tasks (${FORMS.length} filings × ${createdCounties.length} counties)`);

    // Summary by priority and status
    const priorityCount = { high: 0, medium: 0, low: 0 };
    const statusCount = { pending: 0, in_progress: 0, completed: 0 };
    allTasks.forEach(task => {
      priorityCount[task.priority]++;
      statusCount[task.status]++;
    });

    console.log('\nTask Summary:');
    console.log(`  By Priority: High: ${priorityCount.high}, Medium: ${priorityCount.medium}, Low: ${priorityCount.low}`);
    console.log(`  By Status: Pending: ${statusCount.pending}, In Progress: ${statusCount.in_progress}, Completed: ${statusCount.completed}`);

    // Create dummy contacts for Fulton County
    const fultonCounty = createdCounties.find(c => c.code === 'FULTON');
    if (fultonCounty) {
      const fultonContacts = new Contact({
        countyId: fultonCounty._id,
        contacts: [
          {
            role: 'Chief Financial Officer',
            name: 'Alexandra Green',
            email: 'alexandra.green@fultoncounty.gov',
            phone: '(404) 612-1001'
          },
          {
            role: 'Grants & Compliance Manager',
            name: 'Marcus Thompson',
            email: 'marcus.thompson@fultoncounty.gov',
            phone: '(404) 612-1002'
          },
          {
            role: 'Internal Audit Director',
            name: 'Priya Shah',
            email: 'priya.shah@fultoncounty.gov',
            phone: '(404) 612-1003'
          },
          {
            role: 'SPLOST Program Manager',
            name: 'Daniel Roberts',
            email: 'daniel.roberts@fultoncounty.gov',
            phone: '(404) 612-1004'
          },
          {
            role: 'Records & Reporting Coordinator',
            name: 'Lauren Mitchell',
            email: 'lauren.mitchell@fultoncounty.gov',
            phone: '(404) 612-1005'
          }
        ]
      });
      await fultonContacts.save();
      console.log(`\nCreated ${fultonContacts.contacts.length} contacts for Fulton County`);
    }

    // Create dummy contacts for Bartow County
    const bartowCounty = createdCounties.find(c => c.code === 'BARTOW');
    if (bartowCounty) {
      const bartowContacts = new Contact({
        countyId: bartowCounty._id,
        contacts: [
          {
            role: 'County Administrator',
            name: 'John Smith',
            email: 'john.smith@bartowcounty.gov',
            phone: '(770) 387-5000'
          },
          {
            role: 'County Clerk',
            name: 'Sarah Johnson',
            email: 'sarah.johnson@bartowcounty.gov',
            phone: '(770) 387-5001'
          },
          {
            role: 'Finance Director',
            name: 'Michael Davis',
            email: 'michael.davis@bartowcounty.gov',
            phone: '(770) 387-5002'
          },
          {
            role: 'Public Works Director',
            name: 'Emily Wilson',
            email: 'emily.wilson@bartowcounty.gov',
            phone: '(770) 387-5003'
          },
          {
            role: 'Emergency Management Director',
            name: 'Robert Brown',
            email: 'robert.brown@bartowcounty.gov',
            phone: '(770) 387-5004'
          }
        ]
      });
      await bartowContacts.save();
      console.log(`\nCreated ${bartowContacts.contacts.length} contacts for Bartow County`);
    }

    // Create dummy contacts for Troup County
    const troupCounty = createdCounties.find(c => c.code === 'TROUP');
    if (troupCounty) {
      const troupContacts = new Contact({
        countyId: troupCounty._id,
        contacts: [
          {
            role: 'County Manager / Administrator',
            name: 'Eric Steele',
            email: 'eric.steele@troupcounty.org',
            phone: '(706) 883-1610'
          },
          {
            role: 'County Clerk / Clerk of the Board',
            name: 'Diane Morrison',
            email: 'diane.morrison@troupcounty.org',
            phone: '(706) 883-1611'
          },
          {
            role: 'Chief Financial Officer (CFO) / Finance Director',
            name: 'Patricia Nguyen',
            email: 'patricia.nguyen@troupcounty.org',
            phone: '(706) 883-1612'
          },
          {
            role: 'Budget Director',
            name: 'James Carter',
            email: 'james.carter@troupcounty.org',
            phone: '(706) 883-1613'
          },
          {
            role: 'Grants Manager / Grants Coordinator',
            name: 'Angela Brooks',
            email: 'angela.brooks@troupcounty.org',
            phone: '(706) 883-1614'
          },
          {
            role: 'County Attorney / Legal Counsel',
            name: 'David Whitfield',
            email: 'david.whitfield@troupcounty.org',
            phone: '(706) 883-1615'
          }
        ]
      });
      await troupContacts.save();
      console.log(`\nCreated ${troupContacts.contacts.length} contacts for Troup County`);
    }

    // Create dummy contacts for Gwinnett County
    const gwinnettCounty = createdCounties.find(c => c.code === 'GWINNETT');
    if (gwinnettCounty) {
      const gwinnettContacts = new Contact({
        countyId: gwinnettCounty._id,
        contacts: [
          {
            role: 'County Administrator',
            name: 'Glenn Stephens',
            email: 'glenn.stephens@gwinnettcounty.com',
            phone: '(770) 822-7000'
          },
          {
            role: 'County Clerk',
            name: 'Tonya Henderson',
            email: 'tonya.henderson@gwinnettcounty.com',
            phone: '(770) 822-7001'
          },
          {
            role: 'Chief Financial Officer / Finance Director',
            name: 'Buffy Alexzulian',
            email: 'buffy.alexzulian@gwinnettcounty.com',
            phone: '(770) 822-7002'
          },
          {
            role: 'Budget Director',
            name: 'Maria Woods',
            email: 'maria.woods@gwinnettcounty.com',
            phone: '(770) 822-7003'
          },
          {
            role: 'Grants Manager / Coordinator',
            name: 'Derrick Patterson',
            email: 'derrick.patterson@gwinnettcounty.com',
            phone: '(770) 822-7004'
          },
          {
            role: 'County Attorney / Legal Counsel',
            name: 'Karen Bynum',
            email: 'karen.bynum@gwinnettcounty.com',
            phone: '(770) 822-7005'
          }
        ]
      });
      await gwinnettContacts.save();
      console.log(`\nCreated ${gwinnettContacts.contacts.length} contacts for Gwinnett County`);
    }

    console.log('Seed data created successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding data:', error);
    console.error('Error seeding data:', error.message);
    process.exit(1);
  }
};

seedData();
