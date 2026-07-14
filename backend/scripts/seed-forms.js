// Seed the form catalog (form_definitions + form_fields) from the RLGF schema JSON.
// NON-DESTRUCTIVE: only writes the two form-catalog tables, and upserts (safe to re-run;
// never truncates, never touches entities/users/tasks/submissions). Promotes the form's
// definition from a repo file into queryable, versioned rows. See db/schema.sql.
//
//   node scripts/seed-forms.js
//
// Adding GOMI/AARF later = point RLGF_SCHEMA at their JSON (or loop over several); same code.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const { ObjectId } = require('mongodb');
const { Client } = require('pg');

const newId = () => new ObjectId().toString();
const RLGF_SCHEMA = path.join(__dirname, '..', '..', 'frontend', 'src', 'forms', 'rlgf', 'rlgf_schema.json');

// Map one schema JSON -> { definition, fields[] } ready to upsert.
function extract(schema) {
  const definition = {
    code: String(schema.form || '').toLowerCase() || 'unknown',
    version: schema.version || '1',
    title: schema.form || '',
    sourceFile: schema.source_file || '',
    generatedAt: schema.generated_at || null,
  };
  const fields = [];
  let order = 0;
  for (const page of schema.pages || []) {
    for (const f of page.fields || []) {
      fields.push({
        fieldKey: f.id,
        page: f.page || page.page || '',
        part: page.part || null,
        pageTitle: page.title || null,
        navLabel: page.nav_label || null,
        cell: f.cell || null,
        label: f.label || '',
        ucoaCode: f.ucoa_code || null,
        dataType: f.type || 'text',
        derived: !!f.is_derived,
        formula: f.formula || null,
        optionsSource: f.options_source || null,
        needsReview: !!f.needs_review,
        validation: f.validation || {},
        sortOrder: order++,
      });
    }
  }
  return { definition, fields };
}

async function seedForm(client, schema) {
  const { definition: d, fields } = extract(schema);

  // Upsert the form_definitions row; keep a stable id across re-runs (on conflict keep id).
  const defRes = await client.query(
    `insert into form_definitions (id, code, version, title, source_file, generated_at)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (code, version) do update
       set title = excluded.title, source_file = excluded.source_file, generated_at = excluded.generated_at
     returning id`,
    [newId(), d.code, d.version, d.title, d.sourceFile, d.generatedAt]
  );
  const formDefinitionId = defRes.rows[0].id;

  // Upsert each field. on conflict (form_definition_id, field_key) keeps the row's id stable.
  for (const f of fields) {
    await client.query(
      `insert into form_fields
        (id, form_definition_id, field_key, page, part, page_title, nav_label, cell, label,
         ucoa_code, data_type, derived, formula, options_source, needs_review, validation, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)
       on conflict (form_definition_id, field_key) do update set
         page = excluded.page, part = excluded.part, page_title = excluded.page_title,
         nav_label = excluded.nav_label, cell = excluded.cell, label = excluded.label,
         ucoa_code = excluded.ucoa_code, data_type = excluded.data_type, derived = excluded.derived,
         formula = excluded.formula, options_source = excluded.options_source,
         needs_review = excluded.needs_review, validation = excluded.validation, sort_order = excluded.sort_order`,
      [newId(), formDefinitionId, f.fieldKey, f.page, f.part, f.pageTitle, f.navLabel, f.cell, f.label,
       f.ucoaCode, f.dataType, f.derived, f.formula, f.optionsSource, f.needsReview, JSON.stringify(f.validation), f.sortOrder]
    );
  }
  return { code: d.code, version: d.version, formDefinitionId, fields: fields.length };
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('SUPABASE_DB_URL missing in backend/.env'); process.exit(1); }
  const schema = require(RLGF_SCHEMA);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin');
    const res = await seedForm(client, schema);
    await client.query('commit');
    console.log(`Seeded form catalog: ${res.code} v${res.version} — ${res.fields} fields (definition ${res.formDefinitionId}).`);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error('Form seed FAILED (rolled back):', err.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { extract, seedForm };

if (require.main === module) main();
