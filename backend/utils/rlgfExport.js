// Fill the official RLGF workbook template with a submission's answers.
// Surgical XML edits inside the .xlsx zip: only target cells' <v> values change, so all
// of DCA's formatting/formulas/dropdowns/print layout survive byte-for-byte. Formula
// (derived) cells are never touched — Excel recomputes them on open (fullCalcOnLoad).
const path = require('path');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');

const TEMPLATE = path.join(__dirname, '../assets/rlgf-template.xlsx');
const SHEET_FILE = {
  'Page 1': 'xl/worksheets/sheet1.xml',
  'Page 2': 'xl/worksheets/sheet2.xml',
  'Page 3': 'xl/worksheets/sheet3.xml',
  'Page 4': 'xl/worksheets/sheet4.xml',
  'Page 5': 'xl/worksheets/sheet5.xml',
  'Page 6': 'xl/worksheets/sheet6.xml',
  'Page 7': 'xl/worksheets/sheet7.xml', // Attachment(s)
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// gov_id -> government name, read from the template's own embedded reference table
// (Page 1, rows 99+: J = name, K = gov id). Used to write the name the workbook's
// dropdown expects where the app stores the gov id.
let govNameById = null;
function loadGovMap() {
  if (govNameById) return govNameById;
  govNameById = new Map();
  const wb = XLSX.readFile(TEMPLATE);
  const ws = wb.Sheets['Page 1'];
  for (let r = 90; r <= 1300; r++) {
    const name = ws[`J${r}`];
    const id = ws[`K${r}`];
    if (name && id && name.v && id.v) govNameById.set(String(id.v).trim(), String(name.v).trim());
  }
  return govNameById;
}

const colOf = (ref) => ref.match(/^[A-Z]+/)[0];
const rowOf = (ref) => +ref.match(/\d+$/)[0];
const colNum = (c) => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);

// Build the filled workbook. answers: { fieldId: value }, fields: metadata.fields from
// the submission ({ fieldId: { page, cell, type, derived } }).
// Returns { buffer, written, skipped, warnings }.
function buildFilledWorkbook(answers, fields) {
  const zip = new AdmZip(TEMPLATE);
  const warnings = [];
  let written = 0;
  let skipped = 0;

  // ---- shared strings: parse count attrs; append new strings as needed ----
  let ssXml = zip.readAsText('xl/sharedStrings.xml');
  const ssAppends = [];
  let ssBase = (ssXml.match(/<si>/g) || []).length;
  const ssIndex = new Map(); // string -> index (only for strings we add or find)
  const internString = (s) => {
    if (ssIndex.has(s)) return ssIndex.get(s);
    const idx = ssBase + ssAppends.length;
    ssAppends.push(`<si><t xml:space="preserve">${esc(s)}</t></si>`);
    ssIndex.set(s, idx);
    return idx;
  };

  // ---- group target cells by sheet ----
  const bySheet = {};
  const govMap = loadGovMap();
  for (const [fieldId, meta] of Object.entries(fields || {})) {
    if (!meta || meta.derived) continue;
    const value = answers[fieldId];
    if (value === undefined || value === null || String(value).trim() === '') continue;
    const file = SHEET_FILE[meta.page];
    if (!file || !meta.cell) { skipped++; continue; }
    let v = value;
    // The app stores the government as its gov id; the workbook cell holds the name.
    if (meta.page === 'Page 1' && meta.cell === 'C12' && govMap.has(String(v).trim())) {
      v = govMap.get(String(v).trim());
    }
    (bySheet[file] = bySheet[file] || []).push({ cell: meta.cell, value: v, type: meta.type });
  }

  // ---- per sheet: replace (or insert) cell values ----
  for (const [file, cells] of Object.entries(bySheet)) {
    let xml = zip.readAsText(file);
    for (const { cell, value, type } of cells) {
      // existing cell? capture attrs + inner
      const re = new RegExp(`<c r="${cell}"((?:[^>/]|/(?!>))*)(?:/>|>(.*?)</c>)`, 's');
      const m = re.exec(xml);
      const numeric =
        type === 'dollar' || type === 'integer'
          ? true
          : /^-?\d+(\.\d+)?$/.test(String(value).trim()) && m && !/t="s"/.test(m[1]) && !(m[2] || '').includes('<f');
      let inner;
      let attrs;
      if (numeric) {
        const n = Number(value);
        if (Number.isNaN(n)) { warnings.push(`${file} ${cell}: non-numeric "${String(value).slice(0, 20)}"`); skipped++; continue; }
        inner = `<v>${n}</v>`;
        attrs = m ? m[1].replace(/\s*t="[^"]*"/, '') : '';
      } else {
        inner = `<v>${internString(String(value))}</v>`;
        attrs = m ? m[1].replace(/\s*t="[^"]*"/, '') + ' t="s"' : ' t="s"';
      }
      if (m) {
        // never overwrite a formula cell (shouldn't happen — derived are skipped)
        if ((m[2] || '').includes('<f')) { skipped++; continue; }
        xml = xml.replace(m[0], `<c r="${cell}"${attrs}>${inner}</c>`);
        written++;
      } else {
        // insert into the row, keeping cells in column order
        const row = rowOf(cell);
        const rowRe = new RegExp(`(<row r="${row}"[^>]*>)(.*?)(</row>)`, 's');
        const rm = rowRe.exec(xml);
        if (!rm) { warnings.push(`${file} ${cell}: row ${row} not in template`); skipped++; continue; }
        const newCell = `<c r="${cell}"${attrs}>${inner}</c>`;
        // find first existing cell in this row with a greater column
        const cellsInRow = [...rm[2].matchAll(/<c r="([A-Z]+)\d+"/g)].map((x) => x[1]);
        const after = cellsInRow.find((c) => colNum(c) > colNum(colOf(cell)));
        let newRowInner;
        if (after) {
          const idx = rm[2].search(new RegExp(`<c r="${after}${row}"`));
          newRowInner = rm[2].slice(0, idx) + newCell + rm[2].slice(idx);
        } else {
          newRowInner = rm[2] + newCell;
        }
        xml = xml.replace(rm[0], rm[1] + newRowInner + rm[3]);
        written++;
      }
    }
    zip.updateFile(file, Buffer.from(xml, 'utf8'));
  }

  // ---- append shared strings + bump counts ----
  if (ssAppends.length) {
    ssXml = ssXml.replace('</sst>', ssAppends.join('') + '</sst>');
    ssXml = ssXml.replace(/count="\d+"/, (s) => `count="${+s.match(/\d+/)[0] + ssAppends.length}"`);
    ssXml = ssXml.replace(/uniqueCount="\d+"/, (s) => `uniqueCount="${+s.match(/\d+/)[0] + ssAppends.length}"`);
    zip.updateFile('xl/sharedStrings.xml', Buffer.from(ssXml, 'utf8'));
  }

  // ---- force Excel to recalculate all formulas on open ----
  let wbXml = zip.readAsText('xl/workbook.xml');
  if (/<calcPr[^>]*\/>/.test(wbXml)) {
    wbXml = wbXml.replace(/<calcPr([^>]*?)\s*\/>/, (s, a) => `<calcPr${a.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
  } else if (wbXml.includes('</workbook>')) {
    wbXml = wbXml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  }
  zip.updateFile('xl/workbook.xml', Buffer.from(wbXml, 'utf8'));

  return { buffer: zip.toBuffer(), written, skipped, warnings };
}

module.exports = { buildFilledWorkbook };
