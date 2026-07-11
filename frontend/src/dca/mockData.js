// Static mock data for the DCA (state agency) section of CiviSight.
// Nothing here is fetched — every screen in /dca renders from these fixtures.

export const ENTITY_TYPES = {
  COUNTY: 'county',
  CITY: 'city',
  AUTHORITY: 'authority'
};

export const ENTITY_TYPE_LABELS = {
  county: 'County',
  city: 'City',
  authority: 'Authority'
};

export const ENTITY_TYPE_LABELS_PLURAL = {
  county: 'Counties',
  city: 'Cities',
  authority: 'Authorities'
};

// Small, consistent badge coloring per entity type — stays within the existing palette.
export const ENTITY_TYPE_BADGE_CLASSES = {
  county: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  city: 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800',
  authority: 'bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800'
};

export const entities = [
  // Counties
  { id: 'county-cherokee', name: 'Cherokee County', type: ENTITY_TYPES.COUNTY, code: 'CHER' },
  { id: 'county-cobb', name: 'Cobb County', type: ENTITY_TYPES.COUNTY, code: 'COBB' },
  { id: 'county-coweta', name: 'Coweta County', type: ENTITY_TYPES.COUNTY, code: 'COWE' },
  { id: 'county-bartow', name: 'Bartow County', type: ENTITY_TYPES.COUNTY, code: 'BART' },
  { id: 'county-dekalb', name: 'DeKalb County', type: ENTITY_TYPES.COUNTY, code: 'DEKA' },
  { id: 'county-douglas', name: 'Douglas County', type: ENTITY_TYPES.COUNTY, code: 'DOUG' },
  { id: 'county-forsyth', name: 'Forsyth County', type: ENTITY_TYPES.COUNTY, code: 'FORS' },
  { id: 'county-fulton', name: 'Fulton County', type: ENTITY_TYPES.COUNTY, code: 'FULT' },
  { id: 'county-gwinnett', name: 'Gwinnett County', type: ENTITY_TYPES.COUNTY, code: 'GWIN' },
  { id: 'county-richmond', name: 'Richmond County', type: ENTITY_TYPES.COUNTY, code: 'RICH' },
  { id: 'county-bibb', name: 'Bibb County', type: ENTITY_TYPES.COUNTY, code: 'BIBB' },
  { id: 'county-carroll', name: 'Carroll County', type: ENTITY_TYPES.COUNTY, code: 'CARR' },
  { id: 'county-chatham', name: 'Chatham County', type: ENTITY_TYPES.COUNTY, code: 'CHAT' },
  { id: 'county-clayton', name: 'Clayton County', type: ENTITY_TYPES.COUNTY, code: 'CLAY' },
  { id: 'county-troup', name: 'Troup County', type: ENTITY_TYPES.COUNTY, code: 'TROU' },

  // Cities
  { id: 'city-marietta', name: 'City of Marietta', type: ENTITY_TYPES.CITY, code: 'MARI' },
  { id: 'city-savannah', name: 'City of Savannah', type: ENTITY_TYPES.CITY, code: 'SAVA' },
  { id: 'city-athens', name: 'City of Athens', type: ENTITY_TYPES.CITY, code: 'ATHE' },
  { id: 'city-roswell', name: 'City of Roswell', type: ENTITY_TYPES.CITY, code: 'ROSW' },
  { id: 'city-valdosta', name: 'City of Valdosta', type: ENTITY_TYPES.CITY, code: 'VALD' },
  { id: 'city-dalton', name: 'City of Dalton', type: ENTITY_TYPES.CITY, code: 'DALT' },

  // Authorities
  { id: 'authority-cherokee-water', name: 'Cherokee County Water & Sewerage Authority', type: ENTITY_TYPES.AUTHORITY, code: 'CWSA' },
  { id: 'authority-fulton-development', name: 'Development Authority of Fulton County', type: ENTITY_TYPES.AUTHORITY, code: 'DAFC' },
  { id: 'authority-savannah-airport', name: 'Savannah Airport Commission', type: ENTITY_TYPES.AUTHORITY, code: 'SAC' },
  { id: 'authority-coastal-housing', name: 'Coastal Regional Housing Authority', type: ENTITY_TYPES.AUTHORITY, code: 'CRHA' },
  { id: 'authority-coweta-hospital', name: 'Hospital Authority of Coweta County', type: ENTITY_TYPES.AUTHORITY, code: 'HACC' }
];

export const entitiesById = Object.fromEntries(entities.map((e) => [e.id, e]));

// Filing types DCA tracks. `applicableTypes` mapping is placeholder — will be corrected later.
export const filingTypes = [
  {
    id: 'rlgf',
    title: 'Report of Local Government Finances (RLGF)',
    agency: 'Dept. of Community Affairs (DCA)',
    applicableTypes: ['county', 'city', 'authority'],
    description: 'Annual financial report every local government files with DCA covering revenues, expenditures, and fund balances.'
  },
  {
    id: 'aarf',
    title: 'Annual Authority Registration & Financials (AARF)',
    agency: 'Dept. of Community Affairs (DCA)',
    applicableTypes: ['authority'],
    description: 'Yearly registration and financial disclosure filed by every active local authority.'
  },
  {
    id: 'lgar',
    title: 'Local Government Audit Report',
    agency: 'Dept. of Community Affairs (DCA)',
    applicableTypes: ['county', 'city'],
    description: 'Independently audited financial statements submitted to DCA for review.'
  },
  {
    id: 'tiga',
    title: 'Transparency in Government Act (TIGA) Salary & Travel Report',
    agency: 'Dept. of Community Affairs (DCA)',
    applicableTypes: ['county', 'city', 'authority'],
    description: 'Published salary and travel-expense disclosure required under the Transparency in Government Act.'
  },
  {
    id: 'swm',
    title: 'Solid Waste Management Survey & Full Cost Report',
    agency: 'Dept. of Community Affairs (DCA)',
    applicableTypes: ['county', 'city'],
    description: 'Annual survey of solid waste operations and full cost accounting.'
  },
  {
    id: 'immigration',
    title: 'Immigration Compliance Report (Title 13 / E-Verify)',
    agency: 'Dept. of Community Affairs (DCA)',
    applicableTypes: ['county', 'city', 'authority'],
    description: 'Annual certification of compliance with Georgia Title 13 / E-Verify requirements.'
  }
];

export const filingTypesById = Object.fromEntries(filingTypes.map((f) => [f.id, f]));

const STATUS_CYCLE = ['pending', 'in_progress', 'submitted', 'under_review', 'completed'];
const PRIORITY_CYCLE = ['high', 'medium', 'low'];
const DAY_MS = 24 * 60 * 60 * 1000;

const daysFromNow = (n) => new Date(Date.now() + n * DAY_MS).toISOString();

// A handful of entities are fully caught up on every DCA filing, so the dashboard
// compliance rate is non-zero and the Entities "Up to date" section is populated.
const COMPLIANT_ENTITY_IDS = new Set([
  'county-cobb',
  'county-forsyth',
  'county-chatham',
  'city-athens',
  'authority-savannah-airport',
  'authority-coweta-hospital'
]);

// One task per (entity, applicable filing) pair, deterministically varied so the
// dashboard/filings/entities views all have a realistic, mixed spread of statuses.
export const tasks = [];
let taskSeq = 1;
entities.forEach((entity, ei) => {
  const fullyCompliant = COMPLIANT_ENTITY_IDS.has(entity.id);
  filingTypes
    .filter((f) => f.applicableTypes.includes(entity.type))
    .forEach((filing, fi) => {
      const idx = ei * 3 + fi * 7;
      const status = fullyCompliant ? 'completed' : STATUS_CYCLE[idx % STATUS_CYCLE.length];
      const priority = PRIORITY_CYCLE[idx % PRIORITY_CYCLE.length];
      // Compliant entities filed on time (past deadline, completed); others spread wide.
      const deadlineOffsetDays = fullyCompliant ? -((idx % 30) + 5) : ((idx * 13) % 70) - 20;
      tasks.push({
        id: `task-${taskSeq++}`,
        entityId: entity.id,
        filingId: filing.id,
        title: filing.title,
        agency: filing.agency,
        status,
        priority,
        deadline: daysFromNow(deadlineOffsetDays),
        commentCount: idx % 4 === 0 ? 1 : 0
      });
    });
});

export const tasksByEntityId = (entityId) => tasks.filter((t) => t.entityId === entityId);
export const tasksByFilingId = (filingId) => tasks.filter((t) => t.filingId === filingId);

// Hand-written submissions inbox — filings entities have actually sent in for DCA review.
export const submissions = [
  {
    id: 'sub-1',
    entityId: 'county-cherokee',
    filingId: 'rlgf',
    submitter: 'Dana Whitfield, Finance Director',
    submittedAt: daysFromNow(-2),
    status: 'under_review',
    fields: [
      { label: 'Total Revenues', value: '$184,220,410' },
      { label: 'Total Expenditures', value: '$179,865,003' },
      { label: 'General Fund Balance', value: '$22,140,880' },
      { label: 'Fiscal Year End', value: 'June 30, 2026' }
    ],
    flags: [
      { level: 'amber', text: 'General Fund Balance is 12.3% of expenditures — below the 16.7% (2-month) guideline.' }
    ]
  },
  {
    id: 'sub-2',
    entityId: 'city-savannah',
    filingId: 'lgar',
    submitter: 'Marcus Ellery, City Auditor',
    submittedAt: daysFromNow(-5),
    status: 'under_review',
    fields: [
      { label: 'Audit Opinion', value: 'Unmodified (Clean)' },
      { label: 'Material Weaknesses', value: 'None reported' },
      { label: 'Auditor of Record', value: 'Coastal & Associates, CPA' }
    ],
    flags: []
  },
  {
    id: 'sub-3',
    entityId: 'authority-cherokee-water',
    filingId: 'aarf',
    submitter: 'Priya Nair, Authority Secretary',
    submittedAt: daysFromNow(-9),
    status: 'accepted',
    fields: [
      { label: 'Board Members Registered', value: '7' },
      { label: 'Total Assets', value: '$61,402,110' },
      { label: 'Outstanding Bonds', value: '$18,900,000' }
    ],
    flags: []
  },
  {
    id: 'sub-4',
    entityId: 'county-bibb',
    filingId: 'swm',
    submitter: 'Tomás Reyes, Public Works Director',
    submittedAt: daysFromNow(-14),
    status: 'returned',
    fields: [
      { label: 'Tonnage Collected (annual)', value: '142,300 tons' },
      { label: 'Full Cost per Ton', value: '$58.40' },
      { label: 'Diversion Rate', value: '19%' }
    ],
    flags: [
      { level: 'red', text: 'Full cost accounting worksheet is missing landfill closure/post-closure cost line.' }
    ]
  },
  {
    id: 'sub-5',
    entityId: 'city-roswell',
    filingId: 'tiga',
    submitter: 'Helen Ogundipe, HR Director',
    submittedAt: daysFromNow(-1),
    status: 'received',
    fields: [
      { label: 'Employees Reported', value: '612' },
      { label: 'Total Salaries Disclosed', value: '$41,850,600' },
      { label: 'Total Travel Expense', value: '$318,240' }
    ],
    flags: []
  },
  {
    id: 'sub-6',
    entityId: 'authority-fulton-development',
    filingId: 'rlgf',
    submitter: 'Wendell Cho, CFO',
    submittedAt: daysFromNow(-3),
    status: 'received',
    fields: [
      { label: 'Total Revenues', value: '$9,410,220' },
      { label: 'Total Expenditures', value: '$8,995,110' },
      { label: 'Fiscal Year End', value: 'June 30, 2026' }
    ],
    flags: [
      { level: 'amber', text: 'Prior-year comparative figures not attached.' }
    ]
  },
  {
    id: 'sub-7',
    entityId: 'county-carroll',
    filingId: 'immigration',
    submitter: 'Ruth Callahan, County Clerk',
    submittedAt: daysFromNow(-7),
    status: 'accepted',
    fields: [
      { label: 'E-Verify Number', value: '482910' },
      { label: 'Certification Signed By', value: 'Board Chair, Ruth Callahan' }
    ],
    flags: []
  },
  {
    id: 'sub-8',
    entityId: 'city-dalton',
    filingId: 'swm',
    submitter: 'Ivan Petrov, Sanitation Superintendent',
    submittedAt: daysFromNow(-4),
    status: 'under_review',
    fields: [
      { label: 'Tonnage Collected (annual)', value: '38,760 tons' },
      { label: 'Full Cost per Ton', value: '$61.15' },
      { label: 'Diversion Rate', value: '24%' }
    ],
    flags: [
      { level: 'amber', text: 'Diversion rate calculation method differs from last year — confirm before accepting.' }
    ]
  }
];

export const submissionsById = Object.fromEntries(submissions.map((s) => [s.id, s]));

export const notifications = [
  { id: 'n1', text: 'Cherokee County submitted RLGF for review.', timestamp: daysFromNow(-2) },
  { id: 'n2', text: 'City of Savannah submitted Local Government Audit Report for review.', timestamp: daysFromNow(-5) },
  { id: 'n3', text: 'Bibb County’s Solid Waste Management Survey was returned for correction.', timestamp: daysFromNow(-14) }
];

export const upcomingDeadlines = [
  { id: 'd1', text: 'AARF due for all registered authorities', date: daysFromNow(18) },
  { id: 'd2', text: 'TIGA Salary & Travel Report due for all counties and cities', date: daysFromNow(31) },
  { id: 'd3', text: 'RLGF due for all local governments', date: daysFromNow(45) }
];

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const urgencyFor = (deadlineIso, status) => {
  if (status === 'completed') return { level: 'none', text: 'Completed' };
  const diffDays = Math.ceil((new Date(deadlineIso).getTime() - Date.now()) / DAY_MS);
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { level: 'over', text: `Overdue by ${n} day${n === 1 ? '' : 's'}` };
  }
  if (diffDays === 0) return { level: 'over', text: 'Due today' };
  if (diffDays <= 7) return { level: 'todo', text: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}` };
  return { level: 'none', text: `Due in ${diffDays} days` };
};
