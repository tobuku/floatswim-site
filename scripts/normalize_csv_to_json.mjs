import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const IN_PATH = path.join(process.cwd(), "data_raw", "swim_lessons.csv");
const OUT_DIR = path.join(process.cwd(), "data");

const COST_ENUM = new Set(["Free", "Low cost", "Scholarship", "Paid", "Mixed", "Unknown"]);

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/https?:\/\/(www\.)?/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableId(rec) {
  const basis = [
    rec.provider_name || "",
    rec.city || "",
    rec.state || "",
    rec.website || "",
    rec.phone || "",
    rec.address || "",
    rec.zip || ""
  ].join("|");
  const hash = crypto.createHash("sha1").update(basis).digest("hex").slice(0, 12);
  const slug = slugify((rec.provider_name || "provider") + "-" + (rec.city || "") + "-" + (rec.state || ""));
  return (slug ? slug + "-" : "") + hash;
}

function parseCsv(csvText) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < csvText.length) {
    const ch = csvText[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = csvText[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  pushField();
  pushRow();

  return rows;
}

function normState(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!s) return "";
  if (s.length === 2) return s;
  return s.slice(0, 2);
}

function normCost(v) {
  const raw = String(v || "").trim();
  if (!raw) return "Unknown";
  const low = raw.toLowerCase();

  if (low === "free") return "Free";
  if (low === "low cost" || low === "low-cost" || low === "lowcost") return "Low cost";
  if (low === "scholarship" || low === "scholarships") return "Scholarship";
  if (low === "paid" || low === "fee" || low === "fees") return "Paid";
  if (low === "mixed") return "Mixed";
  if (COST_ENUM.has(raw)) return raw;

  return "Unknown";
}

function trimAll(rec) {
  const out = {};
  for (const k of Object.keys(rec)) {
    out[k] = String(rec[k] ?? "").trim();
  }
  return out;
}

function main() {
  if (!fs.existsSync(IN_PATH)) {
    throw new Error("Missing input file at " + IN_PATH);
  }

  const csvText = fs.readFileSync(IN_PATH, "utf8");
  const table = parseCsv(csvText);

  const header = (table[0] || []).map((h) => String(h || "").trim());
  const body = table.slice(1).filter((r) => r.some((c) => String(c || "").trim().length > 0));

  const required = [
    "provider_name",
    "program_name",
    "provider_type",
    "cost_type",
    "ages",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "email",
    "website",
    "source_url",
    "notes",
    "status"
  ];

  const missingCols = required.filter((c) => !header.includes(c));
  if (missingCols.length) {
    throw new Error("Missing columns: " + missingCols.join(", "));
  }

  const idx = {};
  for (let i = 0; i < header.length; i += 1) idx[header[i]] = i;

  const rawRecords = body.map((r) => {
    const rec = {};
    for (const col of required) {
      rec[col] = r[idx[col]] ?? "";
    }
    return rec;
  });

  const kept = [];
  let droppedNotApproved = 0;

  for (const rec0 of rawRecords) {
    const rec1 = trimAll(rec0);
    if (String(rec1.status || "").toLowerCase() !== "approved") {
      droppedNotApproved += 1;
      continue;
    }

    rec1.state = normState(rec1.state);
    rec1.cost_type = normCost(rec1.cost_type);

    // Fallback: use source_url (Google Maps link) as website if website is empty
    if (!rec1.website && rec1.source_url) {
      rec1.website = rec1.source_url;
    }

    // Fallback: try to extract state from address field
    if (!rec1.state && rec1.address) {
      const stateMatch = rec1.address.match(/\b([A-Z]{2})\s+\d{5}/);
      if (stateMatch) {
        rec1.state = stateMatch[1];
      }
    }

    kept.push(rec1);
  }

  const dedupMap = new Map();
  let merged = 0;

  for (const rec of kept) {
    const key = [
      (rec.website || "").toLowerCase(),
      (rec.phone || "").toLowerCase(),
      (rec.address || "").toLowerCase(),
      (rec.city || "").toLowerCase(),
      (rec.state || "").toLowerCase(),
      (rec.zip || "").toLowerCase()
    ].join("|");

    const prev = dedupMap.get(key);
    if (!prev) {
      dedupMap.set(key, rec);
      continue;
    }

    const mergedRec = { ...prev };
    for (const k of Object.keys(rec)) {
      if (!mergedRec[k] && rec[k]) mergedRec[k] = rec[k];
    }
    dedupMap.set(key, mergedRec);
    merged += 1;
  }

  const finalRecords = Array.from(dedupMap.values()).map((rec) => {
    const out = {
      id: stableId(rec),
      provider_name: rec.provider_name,
      program_name: rec.program_name,
      provider_type: rec.provider_type,
      cost_type: rec.cost_type,
      ages: rec.ages,
      address: rec.address,
      city: rec.city,
      state: rec.state,
      zip: rec.zip,
      phone: rec.phone,
      email: rec.email,
      website: rec.website,
      source_url: rec.source_url,
      notes: rec.notes
    };
    return out;
  });

  finalRecords.sort((a, b) => {
    const as = (a.state || "").localeCompare(b.state || "");
    if (as !== 0) return as;
    const ac = (a.city || "").localeCompare(b.city || "");
    if (ac !== 0) return ac;
    return (a.provider_name || "").localeCompare(b.provider_name || "");
  });

  const byState = {};
  for (const rec of finalRecords) {
    const st = rec.state || "NA";
    byState[st] = byState[st] || [];
    byState[st].push(rec.id);
  }

  const byId = {};
  for (const rec of finalRecords) byId[rec.id] = rec;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const outAll = path.join(OUT_DIR, "swim_lessons.json");
  const outByState = path.join(OUT_DIR, "index_by_state.json");
  const outById = path.join(OUT_DIR, "providers_by_id.json");
  const outReport = path.join(OUT_DIR, "build_report.json");

  fs.writeFileSync(outAll, JSON.stringify(finalRecords, null, 2) + "\n", "utf8");
  fs.writeFileSync(outByState, JSON.stringify(byState, null, 2) + "\n", "utf8");
  fs.writeFileSync(outById, JSON.stringify(byId, null, 2) + "\n", "utf8");

  const report = {
    input_rows: rawRecords.length,
    kept_rows: kept.length,
    output_rows: finalRecords.length,
    dropped_not_approved: droppedNotApproved,
    merged_duplicates: merged,
    missing_website: finalRecords.filter((r) => !r.website).length,
    missing_state: finalRecords.filter((r) => !r.state).length,
    generated_at_utc: new Date().toISOString()
  };

  fs.writeFileSync(outReport, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("Input rows=" + report.input_rows);
  console.log("Kept rows=" + report.kept_rows);
  console.log("Output rows=" + report.output_rows);
  console.log("Dropped not approved=" + report.dropped_not_approved);
  console.log("Merged duplicates=" + report.merged_duplicates);
  console.log("Wrote " + outAll);
  console.log("Wrote " + outByState);
  console.log("Wrote " + outById);
  console.log("Wrote " + outReport);
}

main();
