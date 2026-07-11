/**
 * One-off: keep Gwinnett County active/incomplete tasks aligned to the approved
 * form list. Completed tasks are intentionally not changed.
 * Usage: node cleanup-gwinnett-active-tasks.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const County = require('./models/County');
const Task = require('./models/Task');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';

const APPROVED_TITLES = [
  'Annual Financial Audit',
  'Audit Corrective-Action Plan',
  'Report of Local Government Finances',
  'County Property Tax Digest Submission',
  'Millage Rate / 5-Year History / Rollback Process',
  'SPLOST Annual Report',
  'Hotel-Motel Tax Report',
  'Immigration Compliance Report',
  'Solid Waste Survey and Full Cost Report',
  'Local Victim Assistance 5% Report',
  'Annual Budget Adoption and Advertisement',
  'Single Audit and SF-SAC'
];

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\(rlgf\)/g, '')
    .replace(/\(title 13 \/ e-verify\)/g, '')
    .replace(/\(5%\)/g, '5%')
    .replace(/\+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/\bform\b/g, '')
    .replace(/\badvertisement\b/g, 'process')
    .replace(/\bsubmission package\b/g, 'submission')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const approvedByNormalizedTitle = new Map(
  APPROVED_TITLES.map((title) => [normalizeTitle(title), title])
);

const explicitAliases = new Map([
  ['report of local government finances', 'Report of Local Government Finances'],
  ['county property tax digest submission', 'County Property Tax Digest Submission'],
  ['millage rate 5 year history rollback process', 'Millage Rate / 5-Year History / Rollback Process'],
  ['immigration compliance report', 'Immigration Compliance Report'],
  ['solid waste management survey and full cost report', 'Solid Waste Survey and Full Cost Report'],
  ['solid waste survey and full cost report', 'Solid Waste Survey and Full Cost Report'],
  ['local victim assistance 5% fine report', 'Local Victim Assistance 5% Report'],
  ['local victim assistance 5% report', 'Local Victim Assistance 5% Report'],
  ['annual budget adoption process', 'Annual Budget Adoption and Advertisement'],
  ['annual budget adoption and process', 'Annual Budget Adoption and Advertisement'],
  ['single audit sf sac', 'Single Audit and SF-SAC'],
  ['single audit and sf sac', 'Single Audit and SF-SAC']
]);

function approvedTitleFor(taskTitle) {
  const normalized = normalizeTitle(taskTitle);
  return approvedByNormalizedTitle.get(normalized) || explicitAliases.get(normalized) || null;
}

async function run() {
  await mongoose.connect(MONGODB_URI);

  const county = await County.findOne({ code: 'GWINNETT' });
  if (!county) {
    console.error('Gwinnett County not found. Run seed.js first.');
    process.exit(1);
  }

  const activeTasks = await Task.find({
    countyId: county._id,
    status: { $ne: 'completed' }
  });

  let renamed = 0;
  let removed = 0;

  for (const task of activeTasks) {
    const approvedTitle = approvedTitleFor(task.title);
    if (!approvedTitle) {
      await Task.deleteOne({ _id: task._id });
      removed++;
      continue;
    }

    if (task.title !== approvedTitle) {
      task.title = approvedTitle;
      await task.save();
      renamed++;
    }
  }

  console.log(`Gwinnett active task cleanup complete. Renamed ${renamed}; removed ${removed}; completed tasks unchanged.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
