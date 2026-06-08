/*
 * Dashboard UI exploration generator.
 * Emits 8 self-contained HTML layout iterations for the CiviSight "Counties" dashboard.
 * Goal: simpler, easier to scan, NOT bigger. Refined government-utilitarian aesthetic.
 * Run: node generate.js   (no dependencies)
 */
const fs = require('fs');
const path = require('path');
const OUT = __dirname;

// ---- Shared mock data (same across all iterations for fair comparison) ----
const COUNTIES = [
  { name: 'Fulton County', code: 'FULTON', total: 12, pending: 3, inProgress: 2, completed: 7, unread: 1 },
  { name: 'Troup County', code: 'TROUP', total: 4, pending: 4, inProgress: 0, completed: 0, unread: 0 },
  { name: 'Cobb County', code: 'COBB', total: 10, pending: 5, inProgress: 0, completed: 5, unread: 2 },
  { name: 'Chatham County', code: 'CHATHAM', total: 9, pending: 2, inProgress: 3, completed: 4, unread: 0 },
  { name: 'Bibb County', code: 'BIBB', total: 7, pending: 1, inProgress: 2, completed: 4, unread: 0 },
  { name: 'Gwinnett County', code: 'GWINNETT', total: 8, pending: 0, inProgress: 1, completed: 7, unread: 0 },
  { name: 'DeKalb County', code: 'DEKALB', total: 6, pending: 0, inProgress: 0, completed: 6, unread: 0 },
  { name: 'Muscogee County', code: 'MUSCOGEE', total: 5, pending: 0, inProgress: 0, completed: 5, unread: 0 },
  { name: 'Clarke County', code: 'CLARKE', total: 0, pending: 0, inProgress: 0, completed: 0, unread: 0 },
];

const pct = (c) => (c.total ? Math.round((c.completed / c.total) * 100) : 0);
const needsAttention = (c) => c.pending > 0;
const allDone = (c) => c.total > 0 && c.completed === c.total;
const summaryLine = (c) => {
  if (c.total === 0) return 'No tasks yet';
  const parts = [];
  if (c.pending) parts.push(`${c.pending} to do`);
  if (c.inProgress) parts.push(`${c.inProgress} in progress`);
  if (c.completed) parts.push(`${c.completed} done`);
  return parts.join(' · ');
};
// One-chip summary (most urgent state wins)
const chip = (c) => {
  if (c.total === 0) return { txt: 'No tasks', cls: 'none' };
  if (c.pending > 0) return { txt: `${c.pending} to do`, cls: 'todo' };
  if (c.inProgress > 0) return { txt: 'In progress', cls: 'prog' };
  return { txt: 'All done', cls: 'done' };
};

const TOTALS = COUNTIES.reduce((a, c) => ({
  counties: a.counties + 1,
  pending: a.pending + c.pending,
  inProgress: a.inProgress + c.inProgress,
  completed: a.completed + c.completed,
}), { counties: 0, pending: 0, inProgress: 0, completed: 0 });

// ---- Design tokens + base CSS (shared) ----
const TOKENS = `
:root{
  --ink:#16233b; --muted:#64748b; --faint:#94a3b8;
  --line:#e6e9ef; --line-soft:#eef1f6;
  --bg:#f4f5f8; --surface:#ffffff;
  --primary:#1b4965; --primary-ink:#12384f;
  --todo-bg:#fdf0d5; --todo-fg:#9a5b06;
  --prog-bg:#dde9fb; --prog-fg:#1d4e89;
  --done-bg:#d8efe1; --done-fg:#1c6b46;
  --none-bg:#eef1f6; --none-fg:#7a8699;
  --radius:12px; --radius-sm:8px;
}`;

const BASE = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Public Sans',-apple-system,sans-serif;background:var(--bg);color:var(--ink);
  -webkit-font-smoothing:antialiased;font-size:14px;line-height:1.45}
a{color:inherit;text-decoration:none}
.cap{font-family:'Public Sans';font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:#fff;background:var(--primary-ink);padding:7px 18px;font-weight:600}
.cap b{color:#9ec7dd;font-weight:700}
/* top bar */
.topbar{background:var(--surface);border-bottom:1px solid var(--line);
  display:flex;align-items:center;justify-content:space-between;padding:0 28px;height:56px}
.brand{display:flex;align-items:center;gap:18px}
.logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;letter-spacing:-.01em}
.logo .mark{width:24px;height:24px;border-radius:6px;background:var(--primary);
  display:grid;place-items:center;color:#fff;font-size:13px;font-weight:800}
.nav{display:flex;gap:22px;font-size:13.5px;font-weight:500;color:var(--muted)}
.nav .on{color:var(--ink);font-weight:700;border-bottom:2px solid var(--primary);padding-bottom:18px}
.who{display:flex;align-items:center;gap:14px;font-size:13px;color:var(--muted)}
.who .out{background:var(--primary);color:#fff;padding:6px 14px;border-radius:7px;font-weight:600;font-size:12.5px}
/* page shell */
main{max-width:1080px;margin:0 auto;padding:30px 28px 60px}
.head{margin-bottom:20px}
.head h1{font-family:'Newsreader',serif;font-weight:600;font-size:27px;letter-spacing:-.01em;margin:0}
.head p{margin:4px 0 0;color:var(--muted);font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:18px}
.btn{font-family:inherit;font-size:13.5px;font-weight:600;border-radius:8px;padding:9px 15px;
  border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}
.btn.primary{background:var(--primary);border-color:var(--primary);color:#fff}
.btn.ghost{background:transparent;border-color:var(--line)}
.search{flex:1;min-width:200px;position:relative}
.search input{width:100%;font-family:inherit;font-size:14px;padding:9px 13px 9px 36px;
  border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink)}
.search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--faint)}
.search input::placeholder{color:var(--faint)}
/* status chip */
.chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
  padding:3px 9px;border-radius:999px;white-space:nowrap}
.chip.todo{background:var(--todo-bg);color:var(--todo-fg)}
.chip.prog{background:var(--prog-bg);color:var(--prog-fg)}
.chip.done{background:var(--done-bg);color:var(--done-fg)}
.chip.none{background:var(--none-bg);color:var(--none-fg)}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.dot.todo{background:var(--todo-fg)} .dot.prog{background:var(--prog-fg)}
.dot.done{background:var(--done-fg)} .dot.none{background:var(--faint)}
.new{font-size:11px;font-weight:700;color:var(--prog-fg);background:var(--prog-bg);
  padding:2px 7px;border-radius:999px}
.muted{color:var(--muted)} .faint{color:var(--faint)}
.code{font-size:11.5px;color:var(--faint);font-weight:600;letter-spacing:.04em}
`;

const navHTML = `
<header class="topbar">
  <div class="brand">
    <span class="logo"><span class="mark">C</span>CiviSight</span>
    <nav class="nav"><span class="on">Dashboard</span><span>Create Task</span><span>Notifications</span></nav>
  </div>
  <div class="who"><span>admin (Admin)</span><span class="out">Logout</span></div>
</header>`;

const searchSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;

const toolbar = (withSearch = true) => `
<div class="toolbar">
  <button class="btn primary">Manage Counties</button>
  <button class="btn">Manage Users</button>
  <button class="btn ghost">Export to Excel</button>
  ${withSearch ? `<div class="search">${searchSVG}<input placeholder="Search for a county…"></div>` : ''}
</div>`;

function page({ n, name, blurb, css, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CiviSight · Iteration ${n} — ${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${TOKENS}${BASE}${css}</style></head>
<body>
<div class="cap">Iteration ${n} · <b>${name}</b> &nbsp;—&nbsp; ${blurb}</div>
${navHTML}
<main>
  <div class="head"><h1>Counties</h1><p>Select a county to view and manage its tasks.</p></div>
  ${body}
</main>
</body></html>`;
}

// =====================================================================
// ITERATIONS
// =====================================================================
const iterations = [];

// 1 — Clean data table
iterations.push({
  n: 1, name: 'Data table', blurb: 'Familiar spreadsheet-style rows; numbers aligned for fast scanning',
  css: `
  .tbl{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .tbl th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);
    font-weight:700;padding:11px 16px;border-bottom:1px solid var(--line);background:#fafbfc}
  .tbl th.num,.tbl td.num{text-align:right}
  .tbl td{padding:13px 16px;border-bottom:1px solid var(--line-soft);font-size:14px}
  .tbl tr:last-child td{border-bottom:none}
  .tbl tbody tr:hover{background:#f8fafc;cursor:pointer}
  .tbl .nm{font-weight:700}.tbl .cd{font-size:11px;color:var(--faint);font-weight:600;margin-left:8px}
  .num b{font-weight:700}.num .z{color:var(--faint);font-weight:500}
  .bar{height:6px;width:90px;background:var(--line);border-radius:99px;overflow:hidden;display:inline-block;vertical-align:middle}
  .bar>span{display:block;height:100%;background:var(--done-fg);border-radius:99px}
  .arr{color:var(--faint);text-align:right}`,
  body: `${toolbar()}
  <table class="tbl"><thead><tr>
    <th>County</th><th class="num">To do</th><th class="num">In progress</th>
    <th class="num">Done</th><th class="num">Total</th><th>Progress</th><th></th>
  </tr></thead><tbody>
  ${COUNTIES.map(c => `<tr>
    <td><span class="nm">${c.name}</span><span class="cd">${c.code}</span>${c.unread ? ` <span class="new">new</span>` : ''}</td>
    <td class="num">${c.pending ? `<b style="color:var(--todo-fg)">${c.pending}</b>` : '<span class="z">0</span>'}</td>
    <td class="num">${c.inProgress ? `<b style="color:var(--prog-fg)">${c.inProgress}</b>` : '<span class="z">0</span>'}</td>
    <td class="num">${c.completed ? `<b style="color:var(--done-fg)">${c.completed}</b>` : '<span class="z">0</span>'}</td>
    <td class="num">${c.total || '<span class="z">0</span>'}</td>
    <td><span class="bar"><span style="width:${pct(c)}%"></span></span> <span class="muted" style="font-size:12px">${pct(c)}%</span></td>
    <td class="arr">›</td></tr>`).join('')}
  </tbody></table>`
});

// 2 — Compact cards
iterations.push({
  n: 2, name: 'Compact cards', blurb: 'Small tiles, four per row; tiny stat trio per county',
  css: `
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 15px;cursor:pointer;position:relative}
  .card:hover{border-color:#cdd6e3;box-shadow:0 4px 14px rgba(20,35,59,.06)}
  .card .top{height:3px;border-radius:99px;background:var(--line);margin:-14px -15px 12px;border-top-left-radius:var(--radius);border-top-right-radius:var(--radius)}
  .card.att .top{background:var(--todo-fg)} .card.dn .top{background:var(--done-fg)}
  .card h3{margin:0;font-size:15px;font-weight:700}
  .card .cd{margin:1px 0 12px}
  .stats{display:flex;gap:0}
  .stat{flex:1;text-align:center;border-right:1px solid var(--line-soft)}
  .stat:last-child{border-right:none}
  .stat .v{font-size:18px;font-weight:800;line-height:1}
  .stat .l{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-top:4px}
  .v.todo{color:var(--todo-fg)} .v.prog{color:var(--prog-fg)} .v.done{color:var(--done-fg)} .v.z{color:var(--faint)}
  .newdot{position:absolute;top:12px;right:12px;width:8px;height:8px;border-radius:50%;background:var(--prog-fg)}`,
  body: `${toolbar()}
  <div class="grid">
  ${COUNTIES.map(c => `<div class="card ${needsAttention(c) ? 'att' : (allDone(c) ? 'dn' : '')}">
    <div class="top"></div>
    ${c.unread ? '<span class="newdot" title="New comments"></span>' : ''}
    <h3>${c.name}</h3><div class="code cd">${c.code}</div>
    <div class="stats">
      <div class="stat"><div class="v ${c.pending ? 'todo' : 'z'}">${c.pending}</div><div class="l">To do</div></div>
      <div class="stat"><div class="v ${c.inProgress ? 'prog' : 'z'}">${c.inProgress}</div><div class="l">Active</div></div>
      <div class="stat"><div class="v ${c.completed ? 'done' : 'z'}">${c.completed}</div><div class="l">Done</div></div>
    </div></div>`).join('')}
  </div>`
});

// 3 — List with progress bar
iterations.push({
  n: 3, name: 'Progress rows', blurb: 'One row per county with a completion bar — progress at a glance',
  css: `
  .rows{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .row{display:grid;grid-template-columns:240px 1fr 110px 24px;align-items:center;gap:18px;
    padding:14px 18px;border-bottom:1px solid var(--line-soft);cursor:pointer}
  .row:last-child{border-bottom:none}.row:hover{background:#f8fafc}
  .row .nm{font-weight:700;font-size:14.5px}.row .nm .new{margin-left:7px}
  .pbar{height:8px;background:var(--line);border-radius:99px;overflow:hidden}
  .pbar>span{display:block;height:100%;border-radius:99px;background:var(--done-fg)}
  .pbar.att>span{background:var(--todo-fg)}
  .pmeta{font-size:12px;color:var(--muted);margin-top:5px}
  .rc{text-align:right}.arr{color:var(--faint)}`,
  body: `${toolbar()}
  <div class="rows">
  ${COUNTIES.map(c => `<div class="row">
    <div><div class="nm">${c.name}${c.unread ? ' <span class="new">new</span>' : ''}</div><div class="code">${c.code}</div></div>
    <div><div class="pbar ${needsAttention(c) ? 'att' : ''}"><span style="width:${c.total ? pct(c) : 0}%"></span></div>
      <div class="pmeta">${summaryLine(c)}</div></div>
    <div class="rc">${(() => { const k = chip(c); return `<span class="chip ${k.cls}">${k.txt}</span>`; })()}</div>
    <div class="arr">›</div></div>`).join('')}
  </div>`
});

// 4 — Attention first
iterations.push({
  n: 4, name: 'Attention first', blurb: 'Counties needing action float to the top; finished ones tuck away',
  css: `
  .sec{margin-bottom:22px}
  .sec h2{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
    font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:8px}
  .sec h2 .n{background:var(--todo-bg);color:var(--todo-fg);border-radius:99px;padding:1px 8px;font-size:11px}
  .sec.calm h2 .n{background:var(--done-bg);color:var(--done-fg)}
  .alist{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .att-card{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--todo-fg);
    border-radius:var(--radius-sm);padding:13px 15px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
  .att-card:hover{box-shadow:0 4px 14px rgba(20,35,59,.06)}
  .att-card .nm{font-weight:700}.att-card .sl{font-size:12px;color:var(--muted);margin-top:2px}
  .calm-list{display:flex;flex-wrap:wrap;gap:8px}
  .calm-pill{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);
    border-radius:99px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer}
  .calm-pill svg{color:var(--done-fg)}`,
  body: `${toolbar()}
  <div class="sec">
    <h2>Needs attention <span class="n">${COUNTIES.filter(needsAttention).length}</span></h2>
    <div class="alist">
    ${COUNTIES.filter(needsAttention).map(c => `<div class="att-card">
      <div><div class="nm">${c.name}${c.unread ? ' <span class="new">new</span>' : ''}</div><div class="sl">${summaryLine(c)}</div></div>
      <span class="chip todo">${c.pending} to do</span></div>`).join('')}
    </div>
  </div>
  <div class="sec calm">
    <h2>Up to date <span class="n">${COUNTIES.filter(c => !needsAttention(c)).length}</span></h2>
    <div class="calm-list">
    ${COUNTIES.filter(c => !needsAttention(c)).map(c => `<div class="calm-pill">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
      ${c.name} <span class="code">${c.code}</span></div>`).join('')}
    </div>
  </div>`
});

// 5 — Inbox style
iterations.push({
  n: 5, name: 'Inbox', blurb: 'Slim two-line rows with a status stripe, like an email inbox',
  css: `
  .inbox{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .ir{display:flex;align-items:center;gap:14px;padding:12px 18px 12px 0;border-bottom:1px solid var(--line-soft);cursor:pointer}
  .ir:last-child{border-bottom:none}.ir:hover{background:#f8fafc}
  .stripe{width:4px;align-self:stretch;border-radius:0 4px 4px 0}
  .stripe.todo{background:var(--todo-fg)}.stripe.prog{background:var(--prog-fg)}
  .stripe.done{background:var(--done-fg)}.stripe.none{background:var(--line)}
  .ir .main{flex:1;min-width:0}
  .ir .nm{font-weight:700;font-size:14.5px}
  .ir .sl{font-size:12.5px;color:var(--muted);margin-top:2px}
  .ir .right{display:flex;align-items:center;gap:12px;padding-right:4px}
  .ir .arr{color:var(--faint)}`,
  body: `${toolbar()}
  <div class="inbox">
  ${COUNTIES.map(c => { const k = chip(c); return `<div class="ir">
    <span class="stripe ${k.cls}"></span>
    <div class="main"><div class="nm">${c.name} <span class="code">${c.code}</span></div>
      <div class="sl">${summaryLine(c)}</div></div>
    <div class="right">${c.unread ? '<span class="new">new comments</span>' : ''}
      <span class="chip ${k.cls}">${k.txt}</span><span class="arr">›</span></div></div>`; }).join('')}
  </div>`
});

// 6 — Summary strip + rows
iterations.push({
  n: 6, name: 'Summary strip', blurb: 'A thin totals bar for orientation, then quiet compact rows',
  css: `
  .strip{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
    overflow:hidden;margin-bottom:16px}
  .strip .cell{flex:1;padding:14px 18px;border-right:1px solid var(--line-soft)}
  .strip .cell:last-child{border-right:none}
  .strip .v{font-size:22px;font-weight:800;line-height:1}
  .strip .l{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:5px}
  .v.todo{color:var(--todo-fg)}.v.prog{color:var(--prog-fg)}.v.done{color:var(--done-fg)}
  .qr{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .q{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line-soft);cursor:pointer}
  .q:last-child{border-bottom:none}.q:hover{background:#f8fafc}
  .q .nm{font-weight:700;flex:1}.q .cd{margin-right:auto}`,
  body: `${toolbar(false)}
  <div class="strip">
    <div class="cell"><div class="v">${TOTALS.counties}</div><div class="l">Counties</div></div>
    <div class="cell"><div class="v todo">${TOTALS.pending}</div><div class="l">Tasks to do</div></div>
    <div class="cell"><div class="v prog">${TOTALS.inProgress}</div><div class="l">In progress</div></div>
    <div class="cell"><div class="v done">${TOTALS.completed}</div><div class="l">Completed</div></div>
  </div>
  <div class="qr">
  ${COUNTIES.map(c => { const k = chip(c); return `<div class="q">
    <span class="dot ${k.cls}"></span><span class="nm">${c.name}</span>
    <span class="code cd">${c.code}</span>
    ${c.unread ? '<span class="new">new</span>' : ''}
    <span class="chip ${k.cls}">${k.txt}</span></div>`; }).join('')}
  </div>`
});

// 7 — Segmented filter + two-column
iterations.push({
  n: 7, name: 'Segmented', blurb: 'A single segmented filter with live counts drives a tidy two-column list',
  css: `
  .seg{display:inline-flex;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px;gap:2px;margin-bottom:18px}
  .seg button{font-family:inherit;border:none;background:transparent;font-size:13px;font-weight:600;color:var(--muted);
    padding:7px 14px;border-radius:7px;cursor:pointer;display:flex;align-items:center;gap:7px}
  .seg button.on{background:var(--primary);color:#fff}
  .seg .badge{font-size:11px;font-weight:700;background:rgba(0,0,0,.07);border-radius:99px;padding:0 7px}
  .seg button.on .badge{background:rgba(255,255,255,.22)}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .sc{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;cursor:pointer;
    display:flex;align-items:center;justify-content:space-between}
  .sc:hover{border-color:#cdd6e3;box-shadow:0 4px 14px rgba(20,35,59,.06)}
  .sc .nm{font-weight:700;font-size:14.5px}.sc .sl{font-size:12px;color:var(--muted);margin-top:2px}
  .sc .total{font-size:20px;font-weight:800;color:var(--ink)}.sc .tl{font-size:10px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;text-align:right}`,
  body: `${toolbar()}
  <div class="seg">
    <button class="on">All <span class="badge">${TOTALS.counties}</span></button>
    <button>To do <span class="badge">${COUNTIES.filter(c => c.pending > 0).length}</span></button>
    <button>In progress <span class="badge">${COUNTIES.filter(c => c.inProgress > 0).length}</span></button>
    <button>Done <span class="badge">${COUNTIES.filter(allDone).length}</span></button>
  </div>
  <div class="two">
  ${COUNTIES.map(c => { const k = chip(c); return `<div class="sc">
    <div><div class="nm">${c.name}${c.unread ? ' <span class="new">new</span>' : ''}</div>
      <div class="sl"><span class="chip ${k.cls}" style="padding:1px 8px">${k.txt}</span> &nbsp;${c.total ? `${c.completed}/${c.total} done` : ''}</div></div>
    <div><div class="total">${c.total}</div><div class="tl">tasks</div></div></div>`; }).join('')}
  </div>`
});

// 8 — Minimal rows (one decision per line)
iterations.push({
  n: 8, name: 'Minimal', blurb: 'Just a name and one status — the least to read, the fastest to act',
  css: `
  .mwrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:4px 0}
  .m{display:flex;align-items:center;padding:15px 22px;border-bottom:1px solid var(--line-soft);cursor:pointer}
  .m:last-child{border-bottom:none}.m:hover{background:#f8fafc}
  .m .nm{font-size:15px;font-weight:700;flex:1}
  .m .cd{margin-right:16px}
  .m .arr{color:var(--faint);margin-left:16px}
  .m .chip{font-size:12.5px;padding:4px 11px}`,
  body: `${toolbar()}
  <div class="mwrap">
  ${COUNTIES.map(c => { const k = chip(c); return `<div class="m">
    <span class="nm">${c.name}</span>
    ${c.unread ? '<span class="new" style="margin-right:12px">new comments</span>' : ''}
    <span class="code cd">${c.code}</span>
    <span class="chip ${k.cls}">${k.txt}</span><span class="arr">›</span></div>`; }).join('')}
  </div>`
});

// 9 — Attention first + single chip (blend of #4 and #8)
iterations.push({
  n: 9, name: 'Attention chip', blurb: 'Triage groups from #4, one minimal status chip per row from #8',
  css: `
  .sec{margin-bottom:24px}
  .sec h2{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);
    font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:8px}
  .sec h2 .n{border-radius:99px;padding:1px 8px;font-size:11px}
  .sec.attn h2 .n{background:var(--todo-bg);color:var(--todo-fg)}
  .sec.calm h2 .n{background:var(--done-bg);color:var(--done-fg)}
  .sec.calm h2{color:var(--faint)}
  .mwrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
  .sec.attn .mwrap{border-left:3px solid var(--todo-fg)}
  .m{display:flex;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line-soft);cursor:pointer}
  .m:last-child{border-bottom:none}.m:hover{background:#f8fafc}
  .m .nm{font-size:15px;font-weight:700;flex:1}
  .sec.calm .m .nm{font-weight:600}
  .m .cd{margin-right:16px}
  .m .arr{color:var(--faint);margin-left:16px;font-size:15px}
  .m .chip{font-size:12.5px;padding:4px 11px}
  .empty{padding:16px 20px;color:var(--faint);font-size:13.5px}`,
  body: (() => {
    const attn = COUNTIES.filter(needsAttention);
    const calm = COUNTIES.filter(c => !needsAttention(c));
    const row = (c) => { const k = chip(c); return `<div class="m">
      <span class="nm">${c.name}</span>
      ${c.unread ? '<span class="new" style="margin-right:12px">new comments</span>' : ''}
      <span class="code cd">${c.code}</span>
      <span class="chip ${k.cls}">${k.txt}</span><span class="arr">›</span></div>`; };
    return `${toolbar()}
    <div class="sec attn">
      <h2>Needs attention <span class="n">${attn.length}</span></h2>
      <div class="mwrap">${attn.length ? attn.map(row).join('') : '<div class="empty">Nothing needs attention right now.</div>'}</div>
    </div>
    <div class="sec calm">
      <h2>Up to date <span class="n">${calm.length}</span></h2>
      <div class="mwrap">${calm.length ? calm.map(row).join('') : '<div class="empty">—</div>'}</div>
    </div>`;
  })()
});

// ---- write files ----
iterations.forEach(it => {
  const file = path.join(OUT, `iteration-${it.n}-${it.name.toLowerCase().replace(/[^a-z]+/g, '-')}.html`);
  fs.writeFileSync(file, page(it));
  console.log('wrote', path.basename(file));
});
console.log(`\n${iterations.length} iterations generated.`);
