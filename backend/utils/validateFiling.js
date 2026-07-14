// Server-side "born clean" validation for online filings. Validates answers against the
// form-field catalog (form_fields: data_type + validation rules). Two tiers:
//   • HARD errors  -> block the submission (a dollar/integer field with non-numeric data —
//                     the exact "filers can put whatever numbers they want" dirt we replace).
//   • SOFT warnings -> allowed, but recorded on the submission for reviewer visibility
//                      (out-of-range values, required fields left blank).
// Answer keys are the schema field ids; catalog fields are keyed the same. Unknown keys are
// skipped (never block on a field we don't have a rule for).

function isNumericLike(s) {
  return /^-?\d+(\.\d+)?$/.test(String(s).replace(/[$,\s]/g, ''));
}

// fieldsByKey: { field_key: { field_key, label, data_type, derived, validation } }
function validateFiling(answers, fieldsByKey) {
  const errors = [];
  const warnings = [];
  if (!answers || !fieldsByKey) return { errors, warnings };

  // Answered fields: type (hard) + range (soft).
  for (const [key, raw] of Object.entries(answers)) {
    const f = fieldsByKey[key];
    if (!f || f.derived) continue;
    const val = raw == null ? '' : String(raw).trim();
    if (val === '') continue;
    const isMoney = f.data_type === 'dollar' || f.data_type === 'integer';
    if (isMoney) {
      if (!isNumericLike(val)) {
        errors.push({ fieldKey: key, label: f.label, code: 'not_numeric', message: `"${f.label}" must be a number (got "${val.slice(0, 24)}")` });
        continue;
      }
      const num = Number(val.replace(/[$,\s]/g, ''));
      const v = f.validation || {};
      if (v.min != null && num < Number(v.min)) warnings.push({ fieldKey: key, label: f.label, code: 'below_min', message: `"${f.label}" (${num}) is below the expected minimum ${v.min}` });
      if (v.max != null && num > Number(v.max)) warnings.push({ fieldKey: key, label: f.label, code: 'above_max', message: `"${f.label}" (${num}) is above the expected maximum ${v.max}` });
    }
  }

  // Required-but-blank: soft flag (client already enforces required; this catches API bypass
  // without hard-blocking a legitimately partial filing).
  for (const f of Object.values(fieldsByKey)) {
    if (f.derived || !(f.validation && f.validation.required)) continue;
    const val = answers[f.field_key];
    if (val == null || String(val).trim() === '') {
      warnings.push({ fieldKey: f.field_key, label: f.label, code: 'required_missing', message: `"${f.label}" is required` });
    }
  }

  return { errors, warnings };
}

module.exports = { validateFiling, isNumericLike };
