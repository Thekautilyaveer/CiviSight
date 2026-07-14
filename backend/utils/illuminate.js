// Illuminate — natural-language querying over the system of record. Gemini translates a
// question into ONE read-only SELECT against a single curated view (illuminate_financials);
// the result is validated (read-only, single statement, that view only, bounded) before it
// is ever run. Defense in depth: routes run it in a READ ONLY transaction with a timeout.
const logger = require('./logger');

const GEMINI_MODEL = 'gemini-2.5-flash';
const VIEW = 'illuminate_financials';
const MAX_LIMIT = 200;

// The only surface the model may query. Kept human-named so NL maps cleanly.
const SCHEMA_DOC = `View: ${VIEW}  (one row per current government filing; money columns are US dollars)
Columns:
  entity            text     -- government name, e.g. 'Troup County', 'Atlanta (City)'
  entity_type       text     -- 'county' | 'city' | 'authority'
  gov_id            text     -- Georgia government id
  fiscal_year       integer  -- reporting year, e.g. 2025
  status            text     -- 'submitted' | 'under_review' | 'accepted' | 'needs_correction'
  real_property_tax                 numeric
  motor_vehicle_tax                 numeric
  local_option_sales_tax            numeric
  charges_for_services              numeric
  general_government_expenditures   numeric
  public_safety_expenditures        numeric
  debt_service                      numeric
  ending_fund_balance               numeric
  total_tax_revenue                 numeric  -- property + motor-vehicle + sales tax`;

async function generateSql(question) {
  const key = process.env.GEMINI_API;
  if (!key) { const e = new Error('GEMINI_API is not configured'); e.code = 'NO_LLM'; throw e; }

  const prompt = `You are a careful data analyst for CiviSight, the system of record for Georgia local-government finance filings. Translate the user's question into ONE PostgreSQL query.

STRICT RULES:
- Output a SINGLE read-only SELECT statement. Never write/modify data.
- Read ONLY from the view "${VIEW}". Do not reference any other table or view.
- No semicolons, no comments, no CTEs that touch other tables.
- Match text with ILIKE. fiscal_year is an integer. Money columns are dollars.
- Always include a LIMIT (<= ${MAX_LIMIT}).
- If the question is ambiguous, make a reasonable assumption and note it in the explanation.

${SCHEMA_DOC}

Respond with ONLY a JSON object:
{ "sql": "<the SELECT>", "explanation": "<one plain-English sentence on what it returns and any assumption>" }

Question: """${String(question).slice(0, 500)}"""`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Model did not return valid JSON'); }
  return { sql: String(parsed.sql || '').trim(), explanation: String(parsed.explanation || '').trim() };
}

// Reject anything that isn't a single read-only SELECT against ONLY the allowed view.
const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|merge|call|do|vacuum|analyze|pg_sleep|pg_read|current_setting|set_config|nextval)\b/i;
function validateSelect(sql) {
  const s = String(sql || '').trim().replace(/;+\s*$/, ''); // allow one optional trailing ;
  if (!s) return { ok: false, reason: 'empty query' };
  if (s.includes(';')) return { ok: false, reason: 'multiple statements are not allowed' };
  if (s.includes('--') || s.includes('/*')) return { ok: false, reason: 'comments are not allowed' };
  if (!/^(select|with)\b/i.test(s)) return { ok: false, reason: 'only SELECT queries are allowed' };
  if (FORBIDDEN.test(s)) return { ok: false, reason: 'query contains a disallowed keyword' };
  // every from/join target must be the allowed view
  const relations = [...s.matchAll(/\b(?:from|join)\s+([a-zA-Z_][\w.]*)/gi)].map((m) => m[1].toLowerCase());
  if (relations.length === 0) return { ok: false, reason: 'no source table found' };
  if (relations.some((r) => r !== VIEW)) return { ok: false, reason: `only the ${VIEW} view may be queried` };
  return { ok: true, sql: s };
}

// Force a bounded LIMIT.
function enforceLimit(sql) {
  const m = sql.match(/\blimit\s+(\d+)/i);
  if (!m) return `${sql} limit ${MAX_LIMIT}`;
  if (Number(m[1]) > MAX_LIMIT) return sql.replace(/\blimit\s+\d+/i, `limit ${MAX_LIMIT}`);
  return sql;
}

module.exports = { generateSql, validateSelect, enforceLimit, VIEW, MAX_LIMIT, SCHEMA_DOC };
