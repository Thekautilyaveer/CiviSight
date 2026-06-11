/*
 * County-side UI exploration. 5 prototype layouts for what a COUNTY user sees,
 * styled to match the redesigned ACCG/admin side (clean, full-width nav, Manrope
 * logo, attention-first, status chips). Prototypes only — does NOT touch the app.
 * Run: node county-generate.js
 */
const fs = require('fs');
const path = require('path');
const OUT = __dirname;

const COUNTY = 'Troup County';

// Mock filings for one county. days: positive = upcoming; status drives grouping.
const FILINGS = [
  { title: 'Local Victim Assistance (5%) Fine Report', agency: 'GSCCCA', status: 'pending', days: 19, form: false, portal: true, comments: 1 },
  { title: 'Report of Local Government Finances (RLGF)', agency: 'Dept. of Community Affairs (DCA)', status: 'in_progress', days: 30, form: false, portal: true, comments: 2 },
  { title: 'County Property Tax Digest + Submission Package', agency: 'Dept. of Revenue (DOR)', status: 'pending', days: 82, form: true, portal: false, comments: 0 },
  { title: 'Annual Financial Audit', agency: 'Dept. of Audits & Accounts (DOAA)', status: 'pending', days: 91, form: true, portal: false, comments: 0 },
  { title: 'Hotel-Motel Tax Report', agency: 'Dept. of Community Affairs (DCA)', status: 'pending', days: 91, form: true, portal: false, comments: 0 },
  { title: 'Solid Waste Management Survey & Full Cost Report', agency: 'Dept. of Community Affairs (DCA)', status: 'in_progress', days: 111, form: true, portal: false, comments: 1 },
  { title: 'Immigration Compliance Report (E-Verify)', agency: 'Dept. of Audits & Accounts (DOAA)', status: 'pending', days: 203, form: false, portal: true, comments: 0 },
  { title: 'SPLOST Annual Report', agency: 'Newspaper + county website', status: 'pending', days: 203, form: false, portal: true, comments: 0 },
  { title: 'Annual Budget Adoption + Advertisement', agency: 'Adopted / published locally', status: 'completed', days: -40, form: false, portal: false, comments: 0 },
  { title: 'Millage Rate / 5-Year History + Rollback', agency: 'Published in local newspaper', status: 'completed', days: -70, form: true, portal: false, comments: 0 },
  { title: 'TIGA Salary & Travel Report', agency: 'DOAA (Open Georgia)', status: 'completed', days: -120, form: true, portal: false, comments: 0 },
];

const dueText = (f) => {
  if (f.status === 'completed') return 'Filed';
  if (f.days < 0) return `Overdue by ${Math.abs(f.days)} days`;
  if (f.days === 0) return 'Due today';
  return `Due in ${f.days} days`;
};
const chipCls = (f) => {
  if (f.status === 'completed') return 'done';
  if (f.days < 0) return 'over';
  if (f.days <= 30) return 'todo';
  return 'soon';
};
const statusLabel = (s) => (s === 'in_progress' ? 'In progress' : s === 'completed' ? 'Completed' : 'Not started');
const statusCls = (s) => (s === 'in_progress' ? 'prog' : s === 'completed' ? 'done' : 'todo');

const notDone = FILINGS.filter((f) => f.status !== 'completed').sort((a, b) => a.days - b.days);
const within90 = notDone.filter((f) => f.days <= 90);
const later = notDone.filter((f) => f.days > 90);
const done = FILINGS.filter((f) => f.status === 'completed');
const inProgress = FILINGS.filter((f) => f.status === 'in_progress');
const toStart = FILINGS.filter((f) => f.status === 'pending');

// ---- shared design (matches the real app: blue primary, system sans, Manrope logo) ----
const TOKENS = `
:root{
  --ink:#111827; --muted:#4b5563; --faint:#9ca3af;
  --line:#e5e7eb; --line-soft:#f1f3f5; --bg:#f9fafb; --surface:#fff;
  --primary:#2563eb; --primary-dark:#1d4ed8;
  --todo-bg:#fef3c7; --todo-fg:#92400e;
  --soon-bg:#f3f4f6; --soon-fg:#4b5563;
  --prog-bg:#dbeafe; --prog-fg:#1e40af;
  --done-bg:#dcfce7; --done-fg:#166534;
  --over-bg:#fee2e2; --over-fg:#991b1b;
  --radius:12px; --radius-sm:8px;
}`;
const BASE = `
*{box-sizing:border-box} html,body{margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.45}
.cap{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#1e293b;padding:7px 18px;font-weight:600}
.topbar{background:var(--surface);border-bottom:1px solid var(--line);box-shadow:0 1px 3px rgba(0,0,0,.05);display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:64px}
.brand{display:flex;align-items:center;gap:28px}
.logo{display:flex;align-items:center;gap:9px}
.logo .mark{width:26px;height:26px;border-radius:6px;background:var(--primary);display:grid;place-items:center;color:#fff;font-size:13px;font-weight:800;font-family:'Manrope',sans-serif}
.logo .name{font-family:'Manrope',system-ui,sans-serif;font-weight:800;font-size:22px;letter-spacing:-.02em}
.nav{display:flex;gap:26px;font-size:14px;font-weight:500;color:var(--muted)}
.nav .on{color:var(--ink);font-weight:700;border-bottom:2px solid var(--primary);padding-bottom:20px}
.who{display:flex;align-items:center;gap:16px;font-size:13px;color:var(--muted)}
.who .out{background:#dc2626;color:#fff;padding:8px 16px;border-radius:7px;font-weight:600;font-size:13px}
main{padding:28px 32px 60px}
.head{margin-bottom:22px}
.head h1{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:0}
.head p{margin:4px 0 0;color:var(--muted);font-size:14px}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap}
.chip.todo{background:var(--todo-bg);color:var(--todo-fg)} .chip.soon{background:var(--soon-bg);color:var(--soon-fg)}
.chip.prog{background:var(--prog-bg);color:var(--prog-fg)} .chip.done{background:var(--done-bg);color:var(--done-fg)}
.chip.over{background:var(--over-bg);color:var(--over-fg)}
.sec-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
.sec-h .n{border-radius:999px;padding:1px 8px;font-size:11px}
.sec-h.attn .n{background:var(--todo-bg);color:var(--todo-fg)} .sec-h.calm .n{background:var(--done-bg);color:var(--done-fg)}
.agency{font-size:12.5px;color:var(--faint)}
/* action buttons */
.btn{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:6px 11px;border-radius:7px;cursor:pointer;border:1px solid var(--line);background:#fff;color:var(--ink);white-space:nowrap}
.btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
.btn.ghost{background:#fff;color:var(--primary);border-color:#bfdbfe}
.btn svg{width:14px;height:14px}
`;
const dl = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>`;
const up = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21V9m0 0 4 4m-4-4-4 4M5 3h14"/></svg>`;
const ext = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4h6m0 0v6m0-6L10 14M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>`;

const nav = `
<header class="topbar">
  <div class="brand">
    <span class="logo"><span class="mark">C</span><span class="name">CiviSight</span></span>
    <nav class="nav"><span class="on">My Tasks</span><span>Contacts</span><span>FormPilot</span></nav>
  </div>
  <div class="who"><span>troup_user (County User)</span><span class="out">Logout</span></div>
</header>`;

// action buttons for a filing (varies by what it has)
const actions = (f) => {
  if (f.status === 'completed') {
    return `<span class="btn ghost">${dl} View submission</span>`;
  }
  const parts = [];
  if (f.form) {
    parts.push(`<span class="btn">${dl} Download form</span>`);
    parts.push(`<span class="btn primary">${up} Upload completed</span>`);
  } else if (f.portal) {
    parts.push(`<span class="btn primary">${ext} Fill online</span>`);
  }
  return parts.join('');
};

function page({ n, name, blurb, css, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CiviSight County · ${n} ${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap" rel="stylesheet">
<style>${TOKENS}${BASE}${css}</style></head>
<body>
<div class="cap">County side · Version ${n} — <b>${name}</b> &nbsp; ${blurb}</div>
${nav}
<main>
  <div class="head"><h1>${COUNTY}</h1><p>Your filings and deadlines — download each form, complete it, and upload it back.</p></div>
  ${body}
</main></body></html>`;
}

const versions = [];

// 1 — Attention-first list, split into three sections
const v1row = (f) => {
  const cls = f.status === 'in_progress' ? 'prog' : (f.days > 90 ? 'later' : '');
  return `<div class="row ${cls}">
      <div class="info"><div class="nm">${f.title}</div>
        <div class="sub"><span class="agency">${f.agency}</span><span class="chip ${chipCls(f)}">${dueText(f)}</span>${f.status === 'in_progress' ? '<span class="chip prog">In progress</span>' : ''}</div></div>
      <div class="acts">${actions(f)}</div></div>`;
};
versions.push({
  n: 1, name: 'Attention-first list', blurb: 'Three sections — due in 90 days, due later, completed',
  css: `
  .panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;margin-bottom:26px}
  .row{display:flex;align-items:center;gap:16px;padding:15px 18px;border-bottom:1px solid var(--line-soft);border-left:3px solid var(--todo-fg)}
  .row:last-child{border-bottom:none}
  .row.prog{border-left-color:var(--prog-fg)}
  .row.later{border-left-color:#cbd5e1}
  .row .info{flex:1;min-width:0}
  .row .nm{font-weight:700;font-size:14.5px}
  .row .sub{margin-top:3px;display:flex;align-items:center;gap:10px}
  .row .acts{display:flex;gap:8px;flex-shrink:0}
  .sec-h.later .n{background:#f3f4f6;color:#4b5563}
  .calm-list{display:flex;flex-wrap:wrap;gap:8px}
  .calm{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600}
  .calm svg{width:15px;height:15px;color:var(--done-fg)}`,
  body: `
  <div class="sec-h attn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>Due in the next 90 days <span class="n">${within90.length}</span></div>
  <div class="panel">
    ${within90.map(v1row).join('')}
  </div>

  <div class="sec-h later"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/></svg>Due later than 90 days <span class="n">${later.length}</span></div>
  <div class="panel">
    ${later.map(v1row).join('')}
  </div>

  <div class="sec-h calm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5"/></svg>Completed <span class="n">${done.length}</span></div>
  <div class="calm-list">
    ${done.map((f) => `<div class="calm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5"/></svg>${f.title}</div>`).join('')}
  </div>`
});

// 2 — Two-column cards
versions.push({
  n: 2, name: 'Cards', blurb: 'Each filing a card with status, deadline, and actions',
  css: `
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px}
  .card.over{border-color:#fca5a5}
  .card .top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px}
  .card .nm{font-weight:700;font-size:15px}
  .card .agency{margin-bottom:14px}
  .card .meta{display:flex;align-items:center;gap:8px;margin-bottom:14px}
  .card .acts{display:flex;gap:8px;flex-wrap:wrap}`,
  body: `<div class="grid">
    ${FILINGS.map((f) => `<div class="card ${chipCls(f) === 'over' ? 'over' : ''}">
      <div class="top"><div class="nm">${f.title}</div><span class="chip ${statusCls(f.status)}">${statusLabel(f.status)}</span></div>
      <div class="agency">${f.agency}</div>
      <div class="meta"><span class="chip ${chipCls(f)}">${dueText(f)}</span>${f.comments ? `<span class="agency">💬 ${f.comments}</span>` : ''}</div>
      <div class="acts">${actions(f)}</div></div>`).join('')}
  </div>`
});

// 3 — Table
versions.push({
  n: 3, name: 'Table', blurb: 'Compact spreadsheet-style rows with an action per filing',
  css: `
  .tbl{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .tbl th{text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:12px 16px;background:#fafbfc;border-bottom:1px solid var(--line)}
  .tbl td{padding:13px 16px;border-bottom:1px solid var(--line-soft);vertical-align:middle}
  .tbl tr:last-child td{border-bottom:none}
  .tbl tbody tr:hover{background:#f8fafc}
  .tbl .nm{font-weight:700}
  .tbl .act{text-align:right}`,
  body: `<table class="tbl"><thead><tr>
    <th>Filing</th><th>Submitted to</th><th>Status</th><th>Deadline</th><th class="act">Action</th>
  </tr></thead><tbody>
    ${FILINGS.map((f) => `<tr>
      <td class="nm">${f.title}</td>
      <td class="agency">${f.agency}</td>
      <td><span class="chip ${statusCls(f.status)}">${statusLabel(f.status)}</span></td>
      <td><span class="chip ${chipCls(f)}">${dueText(f)}</span></td>
      <td class="act">${f.status === 'completed' ? `<span class="btn ghost">View</span>` : f.form ? `<span class="btn primary">${up} Upload</span>` : `<span class="btn primary">${ext} Fill online</span>`}</td>
    </tr>`).join('')}
  </tbody></table>`
});

// 4 — Status columns (kanban)
versions.push({
  n: 4, name: 'Status board', blurb: 'Three columns: not started, in progress, filed',
  css: `
  .board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:start}
  .col{background:#f3f4f6;border:1px solid var(--line);border-radius:var(--radius);padding:12px}
  .col h3{margin:2px 4px 12px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:7px}
  .col h3 .n{background:#fff;border:1px solid var(--line);border-radius:999px;padding:0 7px;font-size:11px}
  .kc{background:#fff;border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 13px;margin-bottom:10px}
  .kc:last-child{margin-bottom:0}
  .kc .nm{font-weight:700;font-size:13.5px;margin-bottom:4px}
  .kc .agency{margin-bottom:10px}
  .kc .foot{display:flex;align-items:center;justify-content:space-between;gap:8px}`,
  body: `<div class="board">
    ${[['Not started', toStart], ['In progress', inProgress], ['Filed', done]].map(([label, list]) => `
    <div class="col"><h3>${label} <span class="n">${list.length}</span></h3>
      ${list.map((f) => `<div class="kc"><div class="nm">${f.title}</div><div class="agency">${f.agency}</div>
        <div class="foot"><span class="chip ${chipCls(f)}">${dueText(f)}</span>${f.status === 'completed' ? `<span class="btn ghost">View</span>` : f.form ? `<span class="btn primary">${up} Upload</span>` : `<span class="btn primary">${ext} Fill</span>`}</div></div>`).join('')}
    </div>`).join('')}
  </div>`
});

// 5 — Summary strip + accordion list
versions.push({
  n: 5, name: 'Summary + list', blurb: 'A status strip up top, then a clean expandable list',
  css: `
  .strip{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;margin-bottom:18px}
  .strip .cell{flex:1;padding:14px 18px;border-right:1px solid var(--line-soft)}
  .strip .cell:last-child{border-right:none}
  .strip .v{font-size:22px;font-weight:800;line-height:1}
  .strip .l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:5px}
  .v.todo{color:var(--todo-fg)} .v.prog{color:var(--prog-fg)} .v.done{color:var(--done-fg)}
  .list{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .li{padding:14px 18px;border-bottom:1px solid var(--line-soft)}
  .li:last-child{border-bottom:none}
  .li .main{display:flex;align-items:center;gap:14px}
  .li .nm{font-weight:700;flex:1}
  .li.exp{background:#f8fafc}
  .li .detail{margin-top:12px;padding-top:12px;border-top:1px dashed var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px}
  .li .detail .agency{font-size:13px}
  .chev{color:var(--faint)}`,
  body: `
  <div class="strip">
    <div class="cell"><div class="v">${FILINGS.length}</div><div class="l">Total filings</div></div>
    <div class="cell"><div class="v todo">${toStart.length}</div><div class="l">Not started</div></div>
    <div class="cell"><div class="v prog">${inProgress.length}</div><div class="l">In progress</div></div>
    <div class="cell"><div class="v done">${done.length}</div><div class="l">Filed</div></div>
  </div>
  <div class="list">
    ${FILINGS.map((f, i) => `<div class="li ${i === 0 ? 'exp' : ''}">
      <div class="main"><span class="nm">${f.title}</span><span class="chip ${statusCls(f.status)}">${statusLabel(f.status)}</span><span class="chip ${chipCls(f)}">${dueText(f)}</span><span class="chev">${i === 0 ? '▾' : '▸'}</span></div>
      ${i === 0 ? `<div class="detail"><span class="agency">Submitted to ${f.agency}</span><span style="display:flex;gap:8px">${actions(f)}</span></div>` : ''}
    </div>`).join('')}
  </div>`
});

versions.forEach((v) => {
  const file = path.join(OUT, `county-${v.n}-${v.name.toLowerCase().replace(/[^a-z]+/g, '-')}.html`);
  fs.writeFileSync(file, page(v));
  console.log('wrote', path.basename(file));
});
console.log(`${versions.length} county versions generated.`);
