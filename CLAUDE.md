# CLAUDE.md — FloatSwim Project Context

## Project Overview
FloatSwim.org — a drowning prevention and water safety site hosted on GitHub Pages.
Repo: `tobuku/floatswim-site` | Domain: `floatswim.org`

## Tech Stack
- Static HTML + CSS (no frameworks)
- Google Fonts: Inter (400, 500, 600, 700)
- GSAP 3.12.7 + ScrollTrigger (via jsDelivr CDN, `defer`)
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
├── img/
│   ├── banner_1024x512.png           ← Horizontal logo (social/headers)
│   ├── banner_1200x630.png           ← OG/Twitter share image
│   ├── banner_1500x500.png           ← Header & footer logo (used in nav)
│   ├── favicon_16.png
│   ├── favicon_32.png
│   ├── favicon_180.png               ← Apple touch icon
│   ├── favicon_192.png               ← Android icon
│   ├── favicon_512.png               ← PWA icon
│   └── logo_square.png               ← Square social avatar (512x512)
├── index.html, about.html, dashboard.html, directory.html, resources.html, roadmap.html, share-story.html
├── style.css
├── sitemap.xml
├── robots.txt
└── READ.md
```

## Site Design (Feb 2026 Redesign)
- **Theme:** Light blue/white (was dark navy #020617, now ice blue #f0f9ff)
- **CSS variables:** `--bg`, `--bg-alt`, `--accent` (#0284c7), `--text-main` (#0f172a), `--card-bg` (#fff), etc.
- **Font:** Inter (Google Fonts) + system-ui fallback
- **Header:** Sticky, glass blur, uses `banner_1500x500.png` as clickable logo (links to index.html)
- **Footer:** Same banner logo + copyright + nav links
- **Homepage:** Search-first landing — pill search bar (action=directory.html), state chip quick links, wave SVG divider, stats bar (1,245+ providers / 50 states / 100% free), floating bubble animations
- **Directory:** `data-fs-directory` generates all markup via JS. Reads `?q=` and `?state=` URL params from homepage search handoff. Cards have colored cost (green) and type (blue) tags. Modal for provider details.
- **Animations (GSAP):** Section fade-in on scroll, card stagger, hero slide-in, floating bubbles (homepage), wave morph. All wrapped in `typeof gsap` + `prefers-reduced-motion` checks.
- **SEO:** Canonical URLs, OG/Twitter meta + image tags, JSON-LD structured data (WebSite+SearchAction on homepage, ItemList on directory, Organization on about, BreadcrumbList on all), sitemap.xml, robots.txt
- **Favicons:** 5 sizes (16, 32, 180, 192, 512) in `/img/`, linked in all page heads
- **No public email:** `hello@floatswim.org` was removed from all pages (Feb 2026)

## Conventions
- Scripts use Node.js ESM (`.mjs`)
- State codes: 2-letter uppercase
- Stable IDs: `{slug}-{12char-sha1-hash}` based on provider_name, city, state, website, phone, address, zip
- Cost type enum: Free, Low cost, Scholarship, Paid, Mixed, Unknown
- Auto-commit message format: `data: update swim lessons`

## Windows Dev Notes
- Use `powershell.exe -Command "cd '...'; git ..."` for git operations (bash `cd` to Windows paths doesn't work)
- PowerShell uses `;` not `&&` to chain commands
