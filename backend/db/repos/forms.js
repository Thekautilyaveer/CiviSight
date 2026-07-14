// Form-catalog repository (Supabase Postgres): versioned form definitions + their fields.
// See db/schema.sql (form_definitions / form_fields) and scripts/seed-forms.js.
const { query } = require('../pool');

// The active definition for a form code (latest active version). Used to pin submissions
// to the exact form version they were filed against. Returns { id, code, version } or null.
async function findDefinitionByCode(code) {
  const { rows } = await query(
    `select id, code, version from form_definitions
      where code = $1 and status = 'active'
      order by version desc limit 1`,
    [String(code || '').toLowerCase()]
  );
  return rows[0] || null;
}

// All fields for a definition (ordered), for validation / the query projection later.
async function fieldsForDefinition(formDefinitionId) {
  const { rows } = await query(
    `select field_key, page, cell, label, ucoa_code, data_type, derived, formula, validation, sort_order
       from form_fields where form_definition_id = $1 order by sort_order asc`,
    [formDefinitionId]
  );
  return rows;
}

module.exports = { findDefinitionByCode, fieldsForDefinition };
