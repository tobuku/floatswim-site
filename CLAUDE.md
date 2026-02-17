# CLAUDE.md — FloatSwim Project Context

## Project Overview
FloatSwim.org — a drowning prevention and water safety site hosted on GitHub Pages.
Repo: `tobuku/floatswim-site` | Domain: `floatswim.org`

## Tech Stack
- Static HTML + CSS (no frameworks)
- GitHub Pages hosting
- Data pipeline: Google Sheets → CSV → JSON → live site
- CSV export URL: `/export?format=csv` (not `gviz/tq` — that endpoint mangles headers)

## Data Pipeline
- **Google Sheet ID:** `1NTCYcugbSS_g7el2cHDqrNYOqJB9r0dF3IbaZtfzWhg`
- **Tab:** `swim_lessons`
- **GitHub Action** (`data_pipeline.yml`): runs daily at 3:17 AM UTC
  1. `scripts/fetch_sheet_to_csv.mjs` — fetches sheet as CSV
  2. `scripts/normalize_csv_to_json.mjs` — filters to `status=Approved`, deduplicates, applies data fallbacks (missing website/state), outputs JSON
- **Output files:** `data/swim_lessons.json`, `data/index_by_state.json`, `data/providers_by_id.json`, `data/build_report.json`
- Bot account: `floatswim-bot`

## Sheet Column Order (swim_lessons)
1. provider_name
2. program_name
3. provider_type
4. cost_type (Free | Low cost | Scholarship | Paid | Mixed | Unknown)
5. ages
6. address
7. city
8. state (2-letter uppercase)
9. zip
10. phone
11. email
12. website
13. source_url
14. notes
15. status (only "Approved" rows are published)

## Outscraper Automation (LIVE)
- **File:** `scripts/google_apps_script.js` — reference script for Google Apps Script
- **Purpose:** Queries Outscraper Google Maps API for swim lesson providers across all 50 US states, writes results directly into the `swim_lessons` sheet with `status = Approved`
- **Flow:** Outscraper API → Google Apps Script → Google Sheet → GitHub Action → live site
- **Setup steps:**
  1. User pastes script into Google Sheet > Extensions > Apps Script (replace Code.gs contents)
  2. Copy from GitHub Raw view to avoid smart-quote issues: https://github.com/tobuku/floatswim-site/blob/main/scripts/google_apps_script.js → Raw button
  3. Replace `YOUR_API_KEY_HERE` with Outscraper API key
  4. Run `main()` manually to test
  5. Set weekly trigger via Edit > Triggers
- **Current status:** Fully operational. All 50 states queried, ~1,245 providers live on floatswim.org. Weekly triggers set in Apps Script (resetProgress + main). Daily GitHub Action pushes data live.
- **Progress tracking:**
  - Script uses `PropertiesService` to track which states have been processed
  - If `main()` times out (Apps Script 6-min limit), re-running resumes from the next unprocessed state
  - `resetProgress()` — resets tracking so `main()` starts from the beginning (use before weekly refresh)
  - Typical full run requires 2–3 executions to cover all 50 states
- **Data fallbacks:**
  - Missing website → falls back to Google Maps URL from the listing
  - Missing state → extracted from the query string (e.g., "swim lessons, Alabama" → AL)
- **Key details:**
  - 50 queries (one per US state), 20 results each
  - Deduplicates on website, phone, or address match
  - 2-second delay between API calls
  - Outscraper free tier: 500 places/month, then $3/1,000

## File Structure
```
floatswim-site/
├── .github/workflows/data_pipeline.yml
├── scripts/
│   ├── fetch_sheet_to_csv.mjs
│   ├── normalize_csv_to_json.mjs
│   └── google_apps_script.js        ← Outscraper automation (paste into Apps Script)
├── data/
│   ├── swim_lessons.json
│   ├── incidents.json
│   ├── index_by_state.json
│   ├── providers_by_id.json
│   └── build_report.json
├── data_raw/
├── index.html, about.html, dashboard.html, directory.html, resources.html, roadmap.html, share-story.html
├── style.css
└── READ.md
```

## Conventions
- Scripts use Node.js ESM (`.mjs`)
- State codes: 2-letter uppercase
- Stable IDs: `{slug}-{12char-sha1-hash}` based on provider_name, city, state, website, phone, address, zip
- Cost type enum: Free, Low cost, Scholarship, Paid, Mixed, Unknown
- Auto-commit message format: `data: update swim lessons`

## Windows Dev Notes
- Use `powershell.exe -Command "cd '...'; git ..."` for git operations (bash `cd` to Windows paths doesn't work)
- PowerShell uses `;` not `&&` to chain commands
