// Mongo fallback stub for the form catalog. The versioned form_definitions/form_fields
// catalog is a Postgres-only feature (Supabase is the live driver); under the rollback
// mongo driver there is no catalog, so definition lookups return null (submissions simply
// don't pin a form_definition_id — the write path handles a null gracefully).
async function findDefinitionByCode() { return null; }
async function fieldsForDefinition() { return []; }

module.exports = { findDefinitionByCode, fieldsForDefinition };
