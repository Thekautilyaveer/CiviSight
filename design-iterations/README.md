# Dashboard UI Iterations

Eight layout explorations for the CiviSight **Counties** dashboard, aimed at the ACCG
audience: simpler, calmer, faster to scan — **not bigger**. All share the same mock data,
toolbar, and design system; only the way the county list is presented changes.

**Design system:** Public Sans (USWDS / US-government UI typeface) + Newsreader (serif titles),
a restrained navy palette, and muted status colors (amber = to do, blue = in progress, green = done).

## Browse them
Open **`index.html`** in a browser for a gallery of all eight, or open any
`iteration-*.html` directly. Screenshots live in `screens/`.

| # | Name | Idea |
|---|------|------|
| 1 | Data table | Spreadsheet-style rows, aligned numbers |
| 2 | Compact cards | Small tiles, four per row |
| 3 | Progress rows | Completion bar per county |
| 4 | Attention first | Needs-action counties float to the top |
| 5 | Inbox | Slim two-line rows with a status stripe |
| 6 | Summary strip | Totals bar + quiet rows |
| 7 | Segmented | Filter control with live counts + two-column list |
| 8 | Minimal | Name + one status chip per row |

## Regenerate
These are static prototypes (HTML/CSS only — no backend, no React).
```bash
node generate.js          # rewrites the 8 html files from generate.js
# then re-screenshot (macOS, Chrome):
for f in iteration-*.html; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --window-size=1100,1000 --screenshot="screens/${f%.html}.png" "file://$PWD/$f"
done
```

Once a direction is chosen, it gets built into `frontend/src/pages/Dashboard.js` for real.
