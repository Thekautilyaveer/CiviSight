// Mongo fallback stub for the Database explorer. The explorer runs on the Postgres query
// projection (submission_values) + form catalog, which are Supabase-only; under the mongo
// rollback driver it returns empty results.
async function listFilings() { return []; }
async function distinctPeriods() { return []; }
async function fieldCatalog() { return []; }
async function filingVersions() { return []; }
async function complianceData() { return { entities: [], facts: [], latestPeriod: null }; }

module.exports = { listFilings, distinctPeriods, fieldCatalog, filingVersions, complianceData };
