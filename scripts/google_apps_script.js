/**
 * FloatSwim — Outscraper Automation for Swim Lesson Directory
 *
 * Paste this entire file into your Google Apps Script editor
 * (Extensions > Apps Script in your Google Sheet).
 *
 * Setup:
 *   1. Replace OUTSCRAPER_API_KEY with your key.
 *   2. Run main() manually the first time.
 *   3. Check the swim_lessons sheet for new rows with status = Approved.
 *   4. Set a weekly time-driven trigger (Edit > Triggers) on main().
 *
 * Rate limits:
 *   - 2-second delay between API calls
 *   - Outscraper free tier: 500 places/month, then $3/1,000
 */

// ── Configuration ────────────────────────────────────────────────────────────

var CONFIG = {
  OUTSCRAPER_API_KEY: "YOUR_API_KEY_HERE",
  SHEET_NAME: "swim_lessons",
  RESULTS_PER_QUERY: 20,
  DELAY_MS: 2000
};

/**
 * One query per US state for broad national coverage.
 * Add city-specific queries (e.g. "swim lessons, Tampa, FL") for denser areas.
 */
var SEARCH_QUERIES = [
  "swim lessons, Alabama",
  "swim lessons, Alaska",
  "swim lessons, Arizona",
  "swim lessons, Arkansas",
  "swim lessons, California",
  "swim lessons, Colorado",
  "swim lessons, Connecticut",
  "swim lessons, Delaware",
  "swim lessons, Florida",
  "swim lessons, Georgia",
  "swim lessons, Hawaii",
  "swim lessons, Idaho",
  "swim lessons, Illinois",
  "swim lessons, Indiana",
  "swim lessons, Iowa",
  "swim lessons, Kansas",
  "swim lessons, Kentucky",
  "swim lessons, Louisiana",
  "swim lessons, Maine",
  "swim lessons, Maryland",
  "swim lessons, Massachusetts",
  "swim lessons, Michigan",
  "swim lessons, Minnesota",
  "swim lessons, Mississippi",
  "swim lessons, Missouri",
  "swim lessons, Montana",
  "swim lessons, Nebraska",
  "swim lessons, Nevada",
  "swim lessons, New Hampshire",
  "swim lessons, New Jersey",
  "swim lessons, New Mexico",
  "swim lessons, New York",
  "swim lessons, North Carolina",
  "swim lessons, North Dakota",
  "swim lessons, Ohio",
  "swim lessons, Oklahoma",
  "swim lessons, Oregon",
  "swim lessons, Pennsylvania",
  "swim lessons, Rhode Island",
  "swim lessons, South Carolina",
  "swim lessons, South Dakota",
  "swim lessons, Tennessee",
  "swim lessons, Texas",
  "swim lessons, Utah",
  "swim lessons, Vermont",
  "swim lessons, Virginia",
  "swim lessons, Washington",
  "swim lessons, West Virginia",
  "swim lessons, Wisconsin",
  "swim lessons, Wyoming"
];

// ── State name → 2-letter code lookup ────────────────────────────────────────

var STATE_ABBREVS = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
  "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
  "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
  "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  "district of columbia": "DC"
};

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Resumes from where it left off using PropertiesService.
 * Run multiple times until all 50 states are done.
 * Call resetProgress() to start over from the beginning.
 */
function main() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error("Sheet '" + CONFIG.SHEET_NAME + "' not found.");
  }

  var props = PropertiesService.getScriptProperties();
  var startIndex = parseInt(props.getProperty("lastCompletedQuery") || "-1", 10) + 1;

  if (startIndex >= SEARCH_QUERIES.length) {
    Logger.log("All " + SEARCH_QUERIES.length + " states already completed. Call resetProgress() to start over.");
    return;
  }

  Logger.log("Resuming from query " + (startIndex + 1) + "/" + SEARCH_QUERIES.length);

  var existingRows = getExistingRows(sheet);
  var added = 0;

  for (var i = startIndex; i < SEARCH_QUERIES.length; i++) {
    var query = SEARCH_QUERIES[i];
    Logger.log("Query " + (i + 1) + "/" + SEARCH_QUERIES.length + ": " + query);

    var places = fetchOutscraper(query);
    if (!places || places.length === 0) {
      Logger.log("  No results.");
      props.setProperty("lastCompletedQuery", String(i));
      continue;
    }

    for (var j = 0; j < places.length; j++) {
      var row = mapToRow(places[j]);
      if (!row) continue;

      var website = row[11];  // website column index
      var phone = row[9];     // phone column index
      var address = row[5];   // address column index

      if (isDuplicate(existingRows, website, phone, address)) continue;

      sheet.appendRow(row);
      existingRows.push({ website: website, phone: phone, address: address });
      added++;
    }

    // Save progress after each successful state
    props.setProperty("lastCompletedQuery", String(i));

    if (i < SEARCH_QUERIES.length - 1) {
      Utilities.sleep(CONFIG.DELAY_MS);
    }
  }

  Logger.log("Done. Added " + added + " new rows. Completed through query " + SEARCH_QUERIES.length + "/" + SEARCH_QUERIES.length);
}

/**
 * Resets progress so main() starts from the first state again.
 */
function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastCompletedQuery");
  Logger.log("Progress reset. Next main() run will start from query 1.");
}

// ── Outscraper API ───────────────────────────────────────────────────────────

function fetchOutscraper(query) {
  var url = "https://api.app.outscraper.com/maps/search-v3"
    + "?query=" + encodeURIComponent(query)
    + "&limit=" + CONFIG.RESULTS_PER_QUERY
    + "&async=false";

  var options = {
    method: "get",
    headers: {
      "X-API-KEY": CONFIG.OUTSCRAPER_API_KEY
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log("  API error " + code + ": " + response.getContentText().substring(0, 200));
    return [];
  }

  var json = JSON.parse(response.getContentText());

  // Outscraper v3 returns { data: [ [ ...places ] ] }
  if (json.data && json.data.length > 0 && Array.isArray(json.data[0])) {
    return json.data[0];
  }
  return [];
}

// ── Row mapping ──────────────────────────────────────────────────────────────

/**
 * Maps an Outscraper place object to a sheet row.
 * Column order matches the swim_lessons sheet:
 *   provider_name, program_name, provider_type, cost_type, ages,
 *   address, city, state, zip, phone, email, website, source_url,
 *   notes, status
 */
function mapToRow(place) {
  if (!place || !place.name) return null;

  var state = normalizeState(place.us_state || place.state || "");
  var notes = buildNotes(place);
  var mapsUrl = place.google_maps_url || place.place_url || "";

  return [
    (place.name || "").trim(),                          // provider_name
    "",                                                 // program_name
    (place.category || place.type || "").trim(),         // provider_type
    "Unknown",                                          // cost_type
    "",                                                 // ages
    (place.street || place.full_address || "").trim(),   // address
    (place.city || "").trim(),                           // city
    state,                                              // state
    (place.postal_code || "").toString().trim(),         // zip
    (place.phone || "").trim(),                          // phone
    "",                                                 // email
    (place.site || "").trim(),                           // website
    mapsUrl,                                            // source_url
    notes,                                              // notes
    "Approved"                                          // status
  ];
}

function buildNotes(place) {
  var parts = [];
  if (place.rating) {
    parts.push(place.rating + " stars");
  }
  if (place.reviews) {
    parts.push(place.reviews + " reviews");
  }
  return parts.join(", ");
}

// ── Deduplication ────────────────────────────────────────────────────────────

/**
 * Loads existing rows into a lightweight lookup array.
 * Uses website (col 12), phone (col 10), and address (col 6) — 1-indexed.
 */
function getExistingRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    rows.push({
      website: String(data[i][11]).trim().toLowerCase(),
      phone: String(data[i][9]).trim(),
      address: String(data[i][5]).trim().toLowerCase()
    });
  }
  return rows;
}

/**
 * A row is a duplicate if any non-empty identifier matches an existing row.
 */
function isDuplicate(existingRows, website, phone, address) {
  var w = (website || "").trim().toLowerCase();
  var p = (phone || "").trim();
  var a = (address || "").trim().toLowerCase();

  // Nothing to compare — treat as unique so it still gets added
  if (!w && !p && !a) return false;

  for (var i = 0; i < existingRows.length; i++) {
    var row = existingRows[i];

    if (w && row.website && w === row.website) return true;
    if (p && row.phone && p === row.phone) return true;
    if (a && row.address && a === row.address) return true;
  }
  return false;
}

// ── State normalization ──────────────────────────────────────────────────────

function normalizeState(raw) {
  if (!raw) return "";
  var trimmed = raw.trim();

  // Already a 2-letter code
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Full state name lookup
  var key = trimmed.toLowerCase();
  if (STATE_ABBREVS[key]) {
    return STATE_ABBREVS[key];
  }

  return trimmed.toUpperCase().substring(0, 2);
}
