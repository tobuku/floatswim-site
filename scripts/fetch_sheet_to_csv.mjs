import fs from "node:fs";
import path from "node:path";

const SHEET_CSV_URL = "REPLACE_WITH_PUBLISHED_SHEET_CSV_URL";

async function main() {
  if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("REPLACE_WITH")) {
    throw new Error("Missing SHEET_CSV_URL value.");
  }

  const res = await fetch(SHEET_CSV_URL, {
    headers: {
      "user-agent": "floatswim-data-pipeline"
    }
  });

  if (!res.ok) {
    throw new Error("Sheet fetch failed. HTTP " + res.status);
  }

  const csvText = await res.text();

  const outDir = path.join(process.cwd(), "data_raw");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "swim_lessons.csv");
  fs.writeFileSync(outPath, csvText, "utf8");

  console.log("Wrote " + outPath + " bytes=" + Buffer.byteLength(csvText, "utf8"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
